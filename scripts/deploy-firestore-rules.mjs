#!/usr/bin/env node
/**
 * Deploy de reglas + activacion de versionstorage (SOLO en Vercel).
 *
 * corre en `npm run vercel-build` (build de PRODUCCION de Vercel). Secuencia:
 *   1. Despliega `firestore.rules` a las bases declaradas en firebase.json
 *      ((default) y restauracion) usando FIREBASE_SERVICE_ACCOUNT_KEY, que
 *      Vercel YA tiene para Firebase Admin. Sin secret nuevo, sin consola.
 *   2. Si src/data/version.json trae `versionstorage` mayor al publicado,
 *      escribe el doc version/current en la base del CLIENTE — exactamente el
 *      flujo de scripts/update-versionstorage.js. Ese cambio dispara el
 *      logout+reload de los clientes abiertos; al recargar ya corren el
 *      codigo nuevo y firman con el puente de custom token.
 *
 * Fuera de Vercel (dev/CI local) el script NO HACE NADA y termina 0, para no
 * desplegar nada por accidente desde la laptop.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const isVercel = process.env.CI === "true" && Boolean(process.env.VERCEL);
const isProductionBuild =
  process.env.VERCEL_ENV === "production" || process.env.CONTEXT === "production";

function log(step, message) {
  console.log(`[deploy-firestore-rules] ${step}: ${message}`);
}

function fatal(step, message, error) {
  console.error(`[deploy-firestore-rules] ${step}: ${message}`);
  if (error?.stderr) console.error(String(error.stderr).slice(0, 2000));
  process.exit(1);
}

/** Service account desde el entorno (igual que src/lib/firebase-admin.ts). */
function readServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const privateKey = (parsed.private_key || parsed.privateKey || "").replace(/\\n/g, "\n");
    const projectId = parsed.project_id || parsed.projectId;
    const clientEmail = parsed.client_email || parsed.clientEmail;
    if (!projectId || !clientEmail || !privateKey) return null;
    return { projectId, clientEmail, privateKey, raw: parsed };
  } catch {
    return null;
  }
}

/** Bases de datos firestore declaradas en firebase.json. */
function declaredDatabases() {
  try {
    const config = JSON.parse(readFileSync(path.join(root, "firebase.json"), "utf8"));
    return (config.firestore || []).map((entry) => entry.database);
  } catch {
    return [];
  }
}

function runFirebaseCli(args, credentialsFile) {
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--yes", "firebase-tools@15.31.0", ...args],
    {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      shell: process.platform === "win32",
      env: credentialsFile
        ? { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: credentialsFile }
        : { ...process.env },
    },
  );
  return { ok: result.status === 0, stdout: result.stdout || "", stderr: result.stderr || "" };
}

// ---------------------------------------------------------------------------
// 1) Solo produccion en Vercel
// ---------------------------------------------------------------------------
if (!isVercel || !isProductionBuild) {
  log("skip", "no es un build de produccion de Vercel; no se toca nada (exit 0).");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 2) Credenciales: la misma service account que Admin ya usa
// ---------------------------------------------------------------------------
const serviceAccount = readServiceAccount();
if (!serviceAccount) {
  fatal(
    "abort",
    "FIREBASE_SERVICE_ACCOUNT_KEY no disponible o invalida en el entorno de build. " +
      "El despliegue de codigo sigue normal en Vercel; las reglas NO se desplegaron.",
  );
}

const databases = declaredDatabases();
if (databases.length === 0) {
  fatal("abort", "firebase.json no declara bases de datos firestore.");
}

// ---------------------------------------------------------------------------
// 3) Deploy de reglas a TODAS las bases declaradas
// ---------------------------------------------------------------------------
let credentialsFile = null;
try {
  credentialsFile = mkdtempSync(path.join(tmpdir(), "firebase-sa-"));
  const saPath = path.join(credentialsFile, "sa.json");
  writeFileSync(saPath, JSON.stringify(serviceAccount.raw), { mode: 0o600 });
  credentialsFile = saPath;

  // Validar ANTES de publicar: el dry-run compila/valida las reglas y el
  // acceso del proyecto sin aplicar nada. Si falla, abortamos y Vercel NO
  // publica el build (solo publica si este script termina en 0).
  log("validate", "validando reglas con firebase deploy --dry-run ...");
  const dryRun = runFirebaseCli(
    ["deploy", "--only", "firestore:rules", "--project", serviceAccount.projectId, "--non-interactive", "--dry-run"],
    credentialsFile,
  );
  if (!dryRun.ok) {
    fatal("validate", "dry-run fallo: reglas invalidas o proyecto inaccesible. Nada fue modificado.", dryRun);
  }
  log("validate", "dry-run OK.");

  log("deploy", `desplegando firestore.rules a: ${databases.join(", ")}`);
  const deploy = runFirebaseCli(
    ["deploy", "--only", "firestore:rules", "--project", serviceAccount.projectId, "--non-interactive", "--force"],
    credentialsFile,
  );
  if (!deploy.ok) {
    fatal("deploy", "firebase deploy fallo (reglas NO aplicadas).", deploy);
  }
  log("deploy", deploy.stdout.trim().split("\n").slice(-8).join("\n"));
} finally {
  if (credentialsFile && existsSync(credentialsFile)) {
    try { rmSync(credentialsFile, { force: true }); } catch { /* noop */ }
  }
}

// ---------------------------------------------------------------------------
// 4) versionstorage: misma logica que scripts/update-versionstorage.js
// ---------------------------------------------------------------------------
let bumped = false;
try {
  const { default: admin } = await import("firebase-admin");

  const versionPath = path.join(root, "src/data/version.json");
  const versionData = JSON.parse(readFileSync(versionPath, "utf8"));
  const localVersionStorage = String(versionData.versionstorage || "").trim();
  if (!localVersionStorage) {
    log("versionstorage", "version.json no define versionstorage; se omite el paso.");
  } else {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount.raw) });
    }

    // La base donde vive el doc que leen los clientes es la misma que usa el
    // cliente (NEXT_PUBLIC_FIRESTORE_DATABASE_ID en .env / Vercel).
    const clientDbId =
      process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim() || "(default)";
    const db = admin.firestore();
    if (clientDbId && clientDbId !== "(default)") {
      db.settings({ databaseId: clientDbId });
    }
    log("versionstorage", `escribiendo en base: ${clientDbId}`);

    const versionRef = db.collection("version").doc("current");
    const current = await versionRef.get();
    const dbValue = String(current.data()?.versionstorage || "").trim();

    const compare = (a, b) => {
      const pa = String(a || "").split(".").map(Number);
      const pb = String(b || "").split(".").map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const x = pa[i] || 0;
        const y = pb[i] || 0;
        if (x > y) return 1;
        if (x < y) return -1;
      }
      return 0;
    };

    if (!dbValue) {
      await versionRef.set(
        {
          versionstorage: localVersionStorage,
          storageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          storageDescription: "Version de storage (invalidacion de sesiones)",
          storageSource: "version.json",
        },
        { merge: true },
      );
      bumped = true;
    } else if (compare(localVersionStorage, dbValue) > 0) {
      await versionRef.set(
        {
          versionstorage: localVersionStorage,
          storageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          storageDescription: "Version de storage (invalidacion de sesiones)",
          storageSource: "version.json",
          previousVersionstorage: dbValue,
        },
        { merge: true },
      );
      bumped = true;
    } else {
      log("versionstorage", `sin cambios (firestore=${dbValue}, local=${localVersionStorage}).`);
    }

    if (bumped) {
      log("versionstorage", `publicado ${dbValue || "(vacio)"} -> ${localVersionStorage}`);
    }
  }
} catch (error) {
  // El deploy de reglas ya termino OK; la sincronizacion de versionstorage no
  // debe tumbar el build. Se registra y sigue.
  console.error(
    "[deploy-firestore-rules] versionstorage: ERROR (no bloquea el build):",
    error?.message || error,
  );
}

log("done", "deploy de reglas + versionstorage completado.");
process.exit(0);
