/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const COLLECTION = "proveedores";
const ITEMS_SUBCOLLECTION = "items";
const FIELD_NAME = "accountId";

function parseArgs(argv) {
  const args = {
    apply: false,
    database: (
      process.env.FIRESTORE_DATABASE_ID ||
      process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID ||
      ""
    ).trim(),
    env: (process.env.FIREBASE_ENV || process.env.NODE_ENV || "development")
      .trim()
      .toLowerCase(),
    pageSize: 200,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--apply") {
      args.apply = true;
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
    if (token === "--page-size") {
      const value = Number(argv[i + 1]);
      if (Number.isFinite(value) && value > 0 && value <= 450) {
        args.pageSize = Math.trunc(value);
      }
      i++;
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Uso:
  node scripts/delete-provider-items-accountid.js [opciones]

Opciones:
  --apply              Escribe cambios en Firestore
  --database <id>      Firestore database ID (vacio = default)
  --env <modo>         development => .env.local, production => .env
  --page-size <n>      Empresas por pagina (default 200, max 450)
  -h, --help           Ayuda

Ejemplos:
  node scripts/delete-provider-items-accountid.js
  node scripts/delete-provider-items-accountid.js --apply
  node scripts/delete-provider-items-accountid.js --apply --database restauracion --env production
`);
}

function parseEnvFileContent(content) {
  const entries = [];
  const lines = String(content || "").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ")
      ? line.slice(7).trim()
      : line;
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
  if (!fs.existsSync(filePath)) return false;
  const entries = parseEnvFileContent(fs.readFileSync(filePath, "utf8"));
  for (const [key, value] of entries) {
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
  return true;
}

function loadSelectedEnv(envMode) {
  const workspaceRoot = path.resolve(__dirname, "..");
  const selectedFile =
    String(envMode || "development").toLowerCase() === "production"
      ? ".env"
      : ".env.local";
  const loaded = loadEnvFile(path.join(workspaceRoot, selectedFile));
  console.log(
    loaded
      ? `Variables cargadas desde ${selectedFile}`
      : `No se encontro ${selectedFile} en ${workspaceRoot}.`,
  );
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
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  loadSelectedEnv(args.env);
  initAdmin();

  const db = admin.firestore();
  if (args.database) db.settings({ databaseId: args.database });

  console.log("--- Delete proveedores/items accountId ---");
  console.log(`Database: ${args.database || "(default)"}`);
  console.log(`Env:      ${args.env}`);
  console.log(`Modo:     ${args.apply ? "APLICAR" : "dry-run"}`);
  console.log(`Campo:    ${FIELD_NAME}`);

  let scannedCompanies = 0;
  let scannedItems = 0;
  let changedItems = 0;
  let lastCompanyDoc = null;

  while (true) {
    let companiesQuery = db
      .collection(COLLECTION)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(args.pageSize);

    if (lastCompanyDoc) {
      companiesQuery = companiesQuery.startAfter(lastCompanyDoc);
    }

    const companiesSnap = await companiesQuery.get();
    if (companiesSnap.empty) break;

    for (const companyDoc of companiesSnap.docs) {
      scannedCompanies++;
      lastCompanyDoc = companyDoc;

      const itemsSnap = await companyDoc.ref
        .collection(ITEMS_SUBCOLLECTION)
        .orderBy(admin.firestore.FieldPath.documentId())
        .get();

      let batch = db.batch();
      let ops = 0;

      for (const itemDoc of itemsSnap.docs) {
        scannedItems++;
        const data = itemDoc.data() || {};
        if (!Object.prototype.hasOwnProperty.call(data, FIELD_NAME)) continue;

        changedItems++;
        if (!args.apply) {
          console.log(`[dry-run] ${itemDoc.ref.path}: delete ${FIELD_NAME}`);
          continue;
        }

        batch.update(itemDoc.ref, {
          [FIELD_NAME]: admin.firestore.FieldValue.delete(),
        });
        ops++;

        if (ops >= 450) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }

      if (args.apply && ops > 0) await batch.commit();
    }

    console.log(
      `Procesados empresas=${scannedCompanies}, items=${scannedItems}, cambios=${changedItems}`,
    );
  }

  console.log("---");
  console.log(
    `Listo. empresas=${scannedCompanies}, items=${scannedItems}, cambios=${changedItems}`,
  );
  if (!args.apply) console.log("Dry-run. Usa --apply para escribir.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
