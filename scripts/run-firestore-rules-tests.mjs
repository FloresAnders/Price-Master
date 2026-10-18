#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectId = "price-master-cutover-tests";
const emulatorPort = 8185;
const firebaseBin = path.join(
  root,
  "node_modules",
  "firebase-tools",
  "lib",
  "bin",
  "firebase.js",
);
const debugArtifacts = ["firebase-debug.log", "firestore-debug.log"].map(
  (name) => {
    const artifactPath = path.join(root, name);
    return {
      artifactPath,
      original: existsSync(artifactPath) ? readFileSync(artifactPath) : null,
    };
  },
);

function restoreDebugArtifacts() {
  for (const artifact of debugArtifacts) {
    if (artifact.original) {
      writeFileSync(artifact.artifactPath, artifact.original);
    } else if (existsSync(artifact.artifactPath)) {
      rmSync(artifact.artifactPath, { force: true });
    }
  }
}

function cleanupWindowsFirestoreEmulator() {
  if (process.platform !== "win32") return;

  const script = [
    "$matches = Get-CimInstance Win32_Process | Where-Object {",
    "$_.Name -eq 'java.exe' -and",
    "$_.CommandLine -like '*cloud-firestore-emulator*' -and",
    `$_.CommandLine -like '*--project_id*${projectId}*' -and`,
    `$_.CommandLine -like '*--port*${emulatorPort}*'`,
    "};",
    "foreach ($match in $matches) { Stop-Process -Id $match.ProcessId -ErrorAction Stop }",
  ].join(" ");

  const cleanup = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { cwd: root, encoding: "utf8", windowsHide: true },
  );
  if (cleanup.status !== 0) {
    console.error(
      `[firestore-rules-tests] No se pudo cerrar emulador propio: ${String(cleanup.stderr || "sin detalle").trim()}`,
    );
  }
}

const result = spawnSync(
  process.execPath,
  [
    firebaseBin,
    "emulators:exec",
    "--only",
    "firestore",
    "--project",
    projectId,
    "--config",
    "firebase.cutover-tests.json",
    "vitest run tests/firebase/firestore-rules-roles.test.ts",
  ],
  {
    cwd: root,
    env: { ...process.env, DEBUG: "" },
    stdio: "inherit",
    windowsHide: true,
  },
);

cleanupWindowsFirestoreEmulator();
restoreDebugArtifacts();
process.exitCode = result.status ?? 1;
