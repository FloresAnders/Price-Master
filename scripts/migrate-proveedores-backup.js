/* eslint-disable no-console */
/**
 * Migrate proveedores backup JSON to Firestore
 *
 * Reads src/data/pruebas.json (CollectionBackup format) and writes
 * each document to the proveedores Firestore collection.
 *
 * Usage:
 *   node scripts/migrate-proveedores-backup.js [opciones]
 *
 * Options:
 *   --apply                  Escribe cambios en Firestore
 *   --source <path>          Ruta al archivo JSON (default: src/data/pruebas.json)
 *   --database <id>          Firestore database ID (vacío = default)
 *   --env <modo>             development => usa .env.local, production => usa .env
 *   -h, --help               Ayuda
 */

const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");

const DEFAULT_SOURCE = path.resolve(
  process.cwd(),
  "src",
  "data",
  "pruebas.json",
);
const COLLECTION = "proveedores";

function parseArgs(argv) {
  const args = {
    apply: false,
    source: DEFAULT_SOURCE,
    database: (
      process.env.FIRESTORE_DATABASE_ID ||
      process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID ||
      ""
    ).trim(),
    env: (process.env.FIREBASE_ENV || process.env.NODE_ENV || "development")
      .trim()
      .toLowerCase(),
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === "--apply") {
      args.apply = true;
      continue;
    }

    if (token === "--source") {
      args.source = path.resolve(
        process.cwd(),
        String(argv[i + 1] || "").trim(),
      );
      i++;
      continue;
    }

    if (token === "--database") {
      args.database = String(argv[i + 1] || "").trim();
      i++;
      continue;
    }

    if (token === "--env") {
      args.env = String(argv[i + 1] || "").trim().toLowerCase();
      i++;
      continue;
    }

    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Uso:
  node scripts/migrate-proveedores-backup.js [opciones]

Opciones:
  --apply                  Escribe cambios en Firestore
  --source <path>          Ruta al archivo JSON (default: src/data/pruebas.json)
  --database <id>          Firestore database ID (vacío = default)
  --env <modo>             development => usa .env.local, production => usa .env
  -h, --help               Ayuda

Ejemplos:
  node scripts/migrate-proveedores-backup.js
  node scripts/migrate-proveedores-backup.js --apply
  node scripts/migrate-proveedores-backup.js --source src/data/pruebas.json --apply
  node scripts/migrate-proveedores-backup.js --apply --database restauracion --env production
`);
}

function parseEnvFileContent(content) {
  const entries = [];
  const lines = String(content || "").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const equalsIndex = withoutExport.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = withoutExport.slice(0, equalsIndex).trim();
    if (!key) continue;

    let value = withoutExport.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries.push([key, value]);
  }

  return entries;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const fileContent = fs.readFileSync(filePath, "utf8");
  const entries = parseEnvFileContent(fileContent);

  for (const [key, value] of entries) {
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }

  return true;
}

function loadSelectedEnv(envMode) {
  const workspaceRoot = path.resolve(__dirname, "..");
  const normalizedMode = String(envMode || "development").toLowerCase();
  const isProduction = normalizedMode === "production";
  const selectedFile = isProduction ? ".env" : ".env.local";
  const selectedPath = path.join(workspaceRoot, selectedFile);
  const loaded = loadEnvFile(selectedPath);

  if (!loaded) {
    console.warn(`No se encontró ${selectedFile} en ${workspaceRoot}.`);
  } else {
    console.log(`Variables cargadas desde ${selectedFile}`);
  }
}

function loadBackup(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || parsed.kind !== "CollectionBackup") {
    throw new Error(
      "Formato invalido: se esperaba un CollectionBackup (kind: CollectionBackup)",
    );
  }

  if (!Array.isArray(parsed.documents)) {
    throw new Error(
      "Formato invalido: se esperaba un array 'documents'",
    );
  }

  return parsed;
}

function initAdmin() {
  if (admin.apps?.length) return;

  const serviceAccountPath = path.resolve(
    process.cwd(),
    "serviceAccountKey.json",
  );
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }

  admin.initializeApp();
}

async function main() {
  const argv = process.argv.slice(2);
  const envFlagIndex = argv.indexOf("--env");
  const preliminaryEnv =
    envFlagIndex !== -1
      ? String(argv[envFlagIndex + 1] || "")
      : process.env.FIREBASE_ENV || process.env.NODE_ENV || "development";

  loadSelectedEnv(preliminaryEnv);

  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  console.log("--- Migracion de Proveedores ---");
  console.log(`Fuente:   ${args.source}`);
  console.log(`Database: ${args.database || "(default)"}`);
  console.log(`Env:      ${args.env}`);
  console.log(`Modo:     ${args.apply ? "APLICAR" : "dry-run"}`);

  const backup = loadBackup(args.source);
  console.log(
    `\nBackup: collection="${backup.collection}", version=${backup.version}, docs=${backup.documents.length}`,
  );

  initAdmin();

  // Inicializar Firestore y apuntar a la base correcta con settings()
  // settings() debe llamarse antes de cualquier operación y una sola vez.
  const db = admin.firestore();
  const databaseId = String(args.database || "").trim();
  if (databaseId) {
    db.settings({ databaseId });
  }

  const collectionRef = db.collection(COLLECTION);

  const CHUNK_SIZE = 450;
  let written = 0;

  for (let i = 0; i < backup.documents.length; i += CHUNK_SIZE) {
    const chunk = backup.documents.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();

    for (const doc of chunk) {
      const docId = String(doc.id || "").trim();
      if (!docId) {
        console.warn("⚠️ Documento sin ID, saltando...");
        continue;
      }

      const data = doc.data || {};
      const ref = collectionRef.doc(docId);

      if (args.apply) {
        batch.set(ref, {
          company: data.company || docId,
          providers: Array.isArray(data.providers) ? data.providers : [],
          nextCode:
            typeof data.nextCode === "number" ? data.nextCode : 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        console.log(
          `  [dry-run] ${COLLECTION}/${docId} -> ${data.providers?.length || 0} proveedores, nextCode=${data.nextCode}`,
        );
      }
    }

    if (args.apply) {
      await batch.commit();
      written += chunk.length;
      console.log(
        `✅ Procesados ${written}/${backup.documents.length} documentos`,
      );
    }
  }

  console.log("---");
  if (args.apply) {
    console.log(
      `✅ Migracion completada. ${written} documentos escritos en ${COLLECTION}.`,
    );
  } else {
    console.log(
      "🔎 Dry-run completado. Ejecuta con --apply para escribir en Firestore.",
    );
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});