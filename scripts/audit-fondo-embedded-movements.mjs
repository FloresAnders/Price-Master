#!/usr/bin/env node

/**
 * Audita los documentos `MovimientosFondos/*` que todavía embeben movimientos
 * en `operations.movements` (formato legacy V1).
 *
 * Por qué importa: el ledger V2 guarda los movimientos en una subcolección y el
 * documento padre solo lleva estado (`state`). Si un documento conserva
 * `operations.movements` no vacío:
 *   - el listener en tiempo real descarga TODOS los movimientos en cada cambio,
 *   - cada alta reescribe el array completo (amplificación de escritura),
 *   - puede acercarse al límite de 1 MiB por documento.
 *
 * Uso:
 *   node scripts/audit-fondo-embedded-movements.mjs           # solo reporta
 *   node scripts/audit-fondo-embedded-movements.mjs --fix     # limpia el campo
 *
 * Requiere credenciales de Firebase Admin:
 *   FIREBASE_SERVICE_ACCOUNT_KEY (JSON) o GOOGLE_APPLICATION_CREDENTIALS.
 */

import admin from "firebase-admin";

const APPLY = process.argv.includes("--fix");
const DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID ||
  (process.env.NODE_ENV === "production" ? "restauracion" : undefined);

function readServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      projectId: parsed.project_id || parsed.projectId,
      clientEmail: parsed.client_email || parsed.clientEmail,
      privateKey:
        typeof (parsed.private_key || parsed.privateKey) === "string"
          ? (parsed.private_key || parsed.privateKey).replace(/\\n/g, "\n")
          : undefined,
    };
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY must be valid JSON.");
  }
}

function initAdmin() {
  const serviceAccount = readServiceAccountFromEnv();
  if (serviceAccount?.projectId) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
  return DATABASE_ID
    ? admin.firestore(DATABASE_ID)
    : admin.firestore();
}

async function main() {
  const db = initAdmin();
  const snapshot = await db.collection("MovimientosFondos").get();

  let affected = 0;
  const details = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const embedded = data?.operations?.movements;
    const count = Array.isArray(embedded) ? embedded.length : 0;
    if (count === 0) continue;

    affected += 1;
    const sizeKb = Math.round(JSON.stringify(data).length / 1024);
    details.push({ id: doc.id, count, sizeKb });

    if (APPLY) {
      await doc.ref.update({ "operations.movements": [] });
    }
  }

  details.sort((a, b) => b.count - a.count);

  console.log(
    `MovimientosFondos: ${snapshot.size} documento(s) revisados, ${affected} con movimientos embebidos.`,
  );
  for (const item of details.slice(0, 50)) {
    console.log(`  - ${item.id}: ${item.count} movimientos (~${item.sizeKb} KB)`);
  }
  if (details.length > 50) {
    console.log(`  ... y ${details.length - 50} más`);
  }
  console.log(
    APPLY
      ? "Limpieza aplicada: operations.movements = []."
      : "Modo reporte. Ejecuta con --fix para limpiar.",
  );
}

main().catch((error) => {
  console.error("Auditoría falló:", error);
  process.exitCode = 1;
});
