/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const COLLECTION = "proveedores";
const ITEMS_SUBCOLLECTION = "items";
const NAMES_SUBCOLLECTION = "names";

const ACCOUNT_LABELS = {
  FondoGeneral: "FONDO GENERAL",
  CajaNegra: "CAJA NEGRA",
  Tucan: "TUCAN",
};

const TRANSFER_ACCOUNTS = ["FondoGeneral", "CajaNegra", "Tucan"];
const INCOME_TYPE = "OTROS INGRESOS";
const OUTGOING_TYPE = "GASTOS VARIOS";

function parseArgs(argv) {
  const args = {
    apply: false,
    company: "",
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
    if (token === "--company") {
      args.company = String(argv[i + 1] || "").trim();
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
  node scripts/add-transfer-providers.js [opciones]

Opciones:
  --apply              Escribe cambios en Firestore
  --company <id>       Limita a una empresa/proveedor doc
  --database <id>      Firestore database ID (vacio = default)
  --env <modo>         development => .env.local, production => .env
  --page-size <n>      Empresas por pagina (default 200, max 450)
  -h, --help           Ayuda

Ejemplos:
  node scripts/add-transfer-providers.js
  node scripts/add-transfer-providers.js --apply
  node scripts/add-transfer-providers.js --company ALCHACAS --apply
  node scripts/add-transfer-providers.js --database restauracion --env production --apply
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

function providerNameKey(value) {
  return encodeURIComponent(String(value || "").trim().toUpperCase()).slice(
    0,
    1200,
  );
}

function transferProviderNameKey(provider) {
  return providerNameKey(`${provider.accountId} ${provider.name}`);
}

function padCode(value) {
  return String(value).padStart(4, "0");
}

function parseCode(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : -1;
}

function normalizeProviderName(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function buildTransferProviders() {
  const providers = [];
  for (const accountId of TRANSFER_ACCOUNTS) {
    for (const otherAccountId of TRANSFER_ACCOUNTS) {
      if (accountId === otherAccountId) continue;
      const otherLabel = ACCOUNT_LABELS[otherAccountId];
      providers.push({
        name: `SALIDA  A ${otherLabel}`,
        type: OUTGOING_TYPE,
        category: "Gasto",
        accountId,
      });
      providers.push({
        name: `INGRESO DESDE ${otherLabel}`,
        type: INCOME_TYPE,
        category: "Ingreso",
        accountId,
      });
    }
  }

  const deduped = new Map();
  for (const provider of providers) {
    deduped.set(`${provider.accountId}|${provider.name}`, provider);
  }
  return Array.from(deduped.values());
}

async function listCompanyDocs(db, args) {
  if (args.company) {
    const ref = db.collection(COLLECTION).doc(args.company);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error(`Empresa no existe: ${COLLECTION}/${args.company}`);
    }
    return [snap];
  }

  const docs = [];
  let lastDoc = null;
  while (true) {
    let q = db
      .collection(COLLECTION)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(args.pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    docs.push(...snap.docs);
    lastDoc = snap.docs[snap.docs.length - 1];
  }
  return docs;
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

  const transferProviders = buildTransferProviders();

  console.log("--- Add transfer providers ---");
  console.log(`Database: ${args.database || "(default)"}`);
  console.log(`Env:      ${args.env}`);
  console.log(`Modo:     ${args.apply ? "APLICAR" : "dry-run"}`);
  console.log(`Empresa:  ${args.company || "(todas)"}`);
  console.log(`Tipos:    entrada=${INCOME_TYPE}, salida=${OUTGOING_TYPE}`);

  const companyDocs = await listCompanyDocs(db, args);
  let scannedCompanies = 0;
  let scannedItems = 0;
  let createdItems = 0;
  let skippedItems = 0;

  for (const companyDoc of companyDocs) {
    scannedCompanies++;
    const company = companyDoc.id;
    const companyData = companyDoc.data() || {};
    const itemsSnap = await companyDoc.ref.collection(ITEMS_SUBCOLLECTION).get();
    const existingByNameAndAccount = new Set();
    let maxCode = parseCode(companyData.nextCode) - 1;

    for (const itemDoc of itemsSnap.docs) {
      scannedItems++;
      const data = itemDoc.data() || {};
      const name = normalizeProviderName(data.name);
      const accountId = String(data.accountId || "").trim();
      if (name) existingByNameAndAccount.add(`${accountId}|${name}`);
      maxCode = Math.max(maxCode, parseCode(data.code), parseCode(itemDoc.id));
    }

    let nextCode = Math.max(parseCode(companyData.nextCode), maxCode + 1, 0);
    let batch = db.batch();
    let ops = 0;
    let companyCreated = 0;

    for (const template of transferProviders) {
      const key = `${template.accountId}|${normalizeProviderName(template.name)}`;
      if (existingByNameAndAccount.has(key)) {
        skippedItems++;
        continue;
      }

      const code = padCode(nextCode++);
      const now = new Date().toISOString();
      const provider = {
        code,
        name: template.name,
        company,
        accountId: template.accountId,
        type: template.type,
        category: template.category,
        createdAt: now,
        updatedAt: now,
        movementCount: 0,
      };

      createdItems++;
      companyCreated++;

      if (!args.apply) {
        console.log(
          `[dry-run] ${COLLECTION}/${company}/${ITEMS_SUBCOLLECTION}/${code} ${provider.accountId} ${provider.name}`,
        );
        continue;
      }

      batch.set(
        companyDoc.ref.collection(ITEMS_SUBCOLLECTION).doc(code),
        provider,
        { merge: false },
      );
      batch.set(
        companyDoc.ref.collection(NAMES_SUBCOLLECTION).doc(
          transferProviderNameKey(provider),
        ),
        {
          code,
          name: provider.name,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      ops += 2;

      if (ops >= 440) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }

    if (args.apply && companyCreated > 0) {
      batch.set(
        companyDoc.ref,
        {
          company: String(companyData.company || company).trim() || company,
          nextCode,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      ops++;
    }

    if (args.apply && ops > 0) await batch.commit();
  }

  console.log("---");
  console.log(
    `Listo. empresas=${scannedCompanies}, itemsLeidos=${scannedItems}, creados=${createdItems}, omitidos=${skippedItems}`,
  );
  if (!args.apply) console.log("Dry-run. Usa --apply para escribir.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
