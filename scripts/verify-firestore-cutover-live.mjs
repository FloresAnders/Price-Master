#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareCompositeIndexes,
  inspectRequiredFunctions,
  normalizeRulesSource,
} from "./lib/firestore-cutover-verifier.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DATABASE = "(default)";
const REQUIRED_FUNCTIONS = [
  {
    name: "onMovementWrite",
    database: DEFAULT_DATABASE,
    document: "MovimientosFondos/{docId}/movements/{movementId}",
  },
  {
    name: "onMovementWriteLegacyPath",
    database: DEFAULT_DATABASE,
    document: "MovimientosFondos/{docId}/Movements/{movementId}",
  },
  {
    name: "onTucanMovementWrite",
    database: DEFAULT_DATABASE,
    document: "MovimientosFondos/{docId}/tucan/{movementId}",
  },
  {
    name: "onTiemposMovementWrite",
    database: DEFAULT_DATABASE,
    document: "MovimientosFondos/{docId}/tiempos/{movementId}",
  },
  {
    name: "sendEmailTrigger",
    database: DEFAULT_DATABASE,
    document: "mail/{emailId}",
  },
];

function readProjectId(argv) {
  const index = argv.indexOf("--project");
  const projectId = index >= 0 ? String(argv[index + 1] || "").trim() : "";
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new Error("Use --project con un ID Firebase valido.");
  }
  return projectId;
}

function runGcloud(args) {
  const command = process.platform === "win32" ? "gcloud.cmd" : "gcloud";
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `gcloud ${args[0]} fallo: ${String(result.stderr || result.error?.message || "sin detalle").trim()}`,
    );
  }
  return String(result.stdout || "").trim();
}

function runGcloudJson(args) {
  const output = runGcloud([...args, "--format=json"]);
  return output ? JSON.parse(output) : null;
}

async function fetchGoogleJson(url, accessToken, projectId, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-goog-user-project": projectId,
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 1000);
    throw new Error(`${response.status} ${response.statusText}: ${body}`);
  }
  return response.json();
}

async function readRelease(projectId, releaseId, accessToken) {
  return fetchGoogleJson(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/${releaseId}`,
    accessToken,
    projectId,
  );
}

async function verifyRules(projectId, accessToken) {
  const [defaultRelease, rollbackRelease] = await Promise.all([
    readRelease(projectId, "cloud.firestore", accessToken),
    readRelease(projectId, "cloud.firestore/restauracion", accessToken),
  ]);
  const ruleset = await fetchGoogleJson(
    `https://firebaserules.googleapis.com/v1/${defaultRelease.rulesetName}`,
    accessToken,
    projectId,
  );
  const deployedSource = ruleset.source?.files?.find(
    (file) => file.name === "firestore.rules",
  )?.content;
  const localSource = readFileSync(path.join(root, "firestore.rules"), "utf8");

  return {
    defaultRuleset: defaultRelease.rulesetName,
    rollbackRuleset: rollbackRelease.rulesetName,
    sameRuleset: defaultRelease.rulesetName === rollbackRelease.rulesetName,
    matchesLocal:
      typeof deployedSource === "string" &&
      normalizeRulesSource(deployedSource) === normalizeRulesSource(localSource),
  };
}

async function probeData(projectId, accessToken) {
  const database = encodeURIComponent(DEFAULT_DATABASE);
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${database}/documents`;
  const collectionInventory = await fetchGoogleJson(
    `${base}:listCollectionIds`,
    accessToken,
    projectId,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pageSize: 1000 }),
    },
  );
  const topLevelCollections = new Set(collectionInventory.collectionIds || []);
  const probes = [
    ["version/current", `${base}/version/current`],
    ["empresas", `${base}/empresas?pageSize=1`],
    ["MovimientosFondos", `${base}/MovimientosFondos?pageSize=1`],
    ["reportes_movimientos", `${base}/reportes_movimientos?pageSize=1`],
  ];

  const results = [];
  for (const [name, url] of probes) {
    const payload = await fetchGoogleJson(url, accessToken, projectId);
    const present = name.includes("/")
      ? Boolean(payload?.name)
      : Array.isArray(payload?.documents) && payload.documents.length > 0;
    results.push({ name, present });
  }
  results.push({ name: "Facturas", present: topLevelCollections.has("Facturas") });
  return results;
}

async function main() {
  const projectId = readProjectId(process.argv.slice(2));
  const localIndexes = JSON.parse(
    readFileSync(path.join(root, "firestore.indexes.json"), "utf8"),
  ).indexes;

  console.log(`[cutover] proyecto=${projectId} base=${DEFAULT_DATABASE} modo=solo-lectura`);

  const database = runGcloudJson([
    "firestore",
    "databases",
    "describe",
    `--project=${projectId}`,
    `--database=${DEFAULT_DATABASE}`,
  ]);
  const deployedIndexes = runGcloudJson([
    "firestore",
    "indexes",
    "composite",
    "list",
    `--project=${projectId}`,
    `--database=${DEFAULT_DATABASE}`,
  ]);
  const deployedFunctions = runGcloudJson([
    "functions",
    "list",
    "--v2",
    `--project=${projectId}`,
  ]);
  const accessToken = runGcloud(["auth", "print-access-token"]);

  const [rules, dataProbes] = await Promise.all([
    verifyRules(projectId, accessToken),
    probeData(projectId, accessToken),
  ]);
  const indexes = compareCompositeIndexes(localIndexes, deployedIndexes || []);
  const functions = inspectRequiredFunctions(
    deployedFunctions || [],
    REQUIRED_FUNCTIONS,
  );

  const failures = [];
  if (database?.name !== `projects/${projectId}/databases/${DEFAULT_DATABASE}`) {
    failures.push(`base inesperada: ${database?.name || "no encontrada"}`);
  }
  if (database?.type !== "FIRESTORE_NATIVE") {
    failures.push(`tipo de base inesperado: ${database?.type || "desconocido"}`);
  }
  if (indexes.missing.length) failures.push(`indices faltantes: ${indexes.missing.join("; ")}`);
  if (indexes.unexpected.length) failures.push(`indices extra: ${indexes.unexpected.join("; ")}`);
  if (indexes.notReady.length) failures.push(`indices no READY: ${indexes.notReady.join("; ")}`);
  failures.push(...functions.failures);
  if (!rules.sameRuleset) failures.push("reglas de (default) y restauracion usan rulesets distintos");
  if (!rules.matchesLocal) failures.push("reglas desplegadas no coinciden con firestore.rules local");
  for (const probe of dataProbes) {
    if (!probe.present) failures.push(`sin datos verificables en ${probe.name}`);
  }

  console.log(
    `[cutover] indices local=${indexes.localCount} desplegados=${indexes.deployedCount} no-ready=${indexes.notReady.length}`,
  );
  console.log(`[cutover] funciones requeridas=${functions.checked}`);
  console.log(
    `[cutover] reglas mismas=${rules.sameRuleset} local=${rules.matchesLocal}`,
  );
  console.log(
    `[cutover] lecturas=${dataProbes.map((probe) => `${probe.name}:${probe.present ? "OK" : "FALTA"}`).join(", ")}`,
  );

  if (failures.length) {
    console.error(`[cutover] FALLA (${failures.length})`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log("[cutover] OK");
}

main().catch((error) => {
  console.error(`[cutover] ERROR: ${error?.message || error}`);
  process.exitCode = 1;
});
