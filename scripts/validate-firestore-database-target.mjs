#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_DATABASE_LABEL = "(default)";

function normalizeDatabaseId(value) {
  const databaseId = String(value || "").trim();
  if (!databaseId) return undefined;

  const normalized = databaseId.toLowerCase();
  return normalized === "default" || normalized === DEFAULT_DATABASE_LABEL
    ? undefined
    : databaseId;
}

function databaseLabel(databaseId) {
  return databaseId || DEFAULT_DATABASE_LABEL;
}

/**
 * @param {Record<string, string | undefined>} [env]
 */
export function validateFirestoreDatabaseTarget(env = process.env) {
  const stage = String(env.VERCEL_ENV || "local").trim().toLowerCase();
  const nodeEnv = String(env.NODE_ENV || "").trim().toLowerCase();
  const clientRaw = String(
    env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "",
  ).trim();
  const adminRaw = String(env.FIRESTORE_DATABASE_ID || "").trim();

  if (
    (stage === "production" || stage === "preview") &&
    nodeEnv &&
    nodeEnv !== "production"
  ) {
    throw new Error(
      `Vercel ${stage} requiere NODE_ENV=production; recibió ${nodeEnv}.`,
    );
  }

  const clientDatabaseId = clientRaw
    ? normalizeDatabaseId(clientRaw)
    : stage === "production"
      ? undefined
      : "restauracion";
  const adminDatabaseId = adminRaw
    ? normalizeDatabaseId(adminRaw)
    : clientDatabaseId;

  if (
    stage === "production" &&
    (clientDatabaseId !== undefined || adminDatabaseId !== undefined)
  ) {
    throw new Error(
      `Vercel Production debe usar ${DEFAULT_DATABASE_LABEL} en cliente y Admin; recibió cliente=${databaseLabel(clientDatabaseId)}, Admin=${databaseLabel(adminDatabaseId)}.`,
    );
  }

  if (clientDatabaseId !== adminDatabaseId) {
    throw new Error(
      `Destino Firestore distinto entre cliente (${databaseLabel(clientDatabaseId)}) y Admin (${databaseLabel(adminDatabaseId)}).`,
    );
  }

  if (
    stage === "preview" &&
    (!clientRaw || clientDatabaseId !== "restauracion")
  ) {
    throw new Error(
      "Vercel Preview debe declarar restauracion explícitamente.",
    );
  }

  return {
    stage,
    clientDatabaseId: databaseLabel(clientDatabaseId),
    adminDatabaseId: databaseLabel(adminDatabaseId),
  };
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  try {
    const nextEnv = await import("@next/env");
    const loadEnvConfig =
      nextEnv.loadEnvConfig || nextEnv.default?.loadEnvConfig;
    if (typeof loadEnvConfig !== "function") {
      throw new Error("No se pudo cargar @next/env para validar el build.");
    }
    loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

    const target = validateFirestoreDatabaseTarget(process.env);
    console.log(
      `[firestore-target] ${target.stage}: cliente=${target.clientDatabaseId}, admin=${target.adminDatabaseId}`,
    );
  } catch (error) {
    console.error(`[firestore-target] ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
