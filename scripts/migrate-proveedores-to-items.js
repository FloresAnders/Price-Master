const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const COLLECTION = "proveedores";
const ITEMS_SUBCOLLECTION = "items";
const NAMES_SUBCOLLECTION = "names";

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
  node scripts/migrate-proveedores-to-items.js [opciones]

Opciones:
  --apply              Escribe cambios en Firestore
  --database <id>      Firestore database ID (vacio = default)
  --env <modo>         development => .env.local, production => .env
  --page-size <n>      Docs padre por pagina (default 200, max 450)
  -h, --help           Ayuda

Ejemplos:
  npm run migrate:proveedores
  npm run migrate:proveedores -- --apply
  npm run migrate:proveedores -- --apply --database restauracion --env production
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
  const serviceAccountPath = path.resolve(process.cwd(), "serviceAccountKey.json");
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }
  admin.initializeApp();
}

function padCode(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return String(value).padStart(4, "0");
  }
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isNaN(parsed) && parsed >= 0) {
    return String(parsed).padStart(4, "0");
  }
  return raw.padStart(4, "0");
}

function stripUndefined(value) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value.map(stripUndefined).filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      const cleaned = stripUndefined(item);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  return value;
}

function normalizeProvider(raw, company) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim();
  const code = padCode(raw.code ?? raw.id ?? raw.identifier);
  if (!name || !code) return null;
  return stripUndefined({
    code,
    name,
    company: String(raw.company || company).trim() || company,
    type:
      typeof raw.type === "string" && raw.type.trim()
        ? raw.type.trim().toUpperCase()
        : undefined,
    category:
      typeof raw.category === "string" && raw.category.trim()
        ? raw.category.trim()
        : undefined,
    createdAt:
      typeof raw.createdAt === "string" && raw.createdAt.trim()
        ? raw.createdAt
        : undefined,
    updatedAt:
      typeof raw.updatedAt === "string" && raw.updatedAt.trim()
        ? raw.updatedAt
        : undefined,
    correonotifi:
      typeof raw.correonotifi === "string" && raw.correonotifi.trim()
        ? raw.correonotifi.trim()
        : undefined,
    agent: raw.agent && typeof raw.agent === "object" ? raw.agent : undefined,
    visit: raw.visit && typeof raw.visit === "object" ? raw.visit : undefined,
    movementCount:
      typeof raw.movementCount === "number" &&
      Number.isFinite(raw.movementCount) &&
      raw.movementCount >= 0
        ? raw.movementCount
        : 0,
  });
}

function highestCode(providers) {
  return providers.reduce((max, provider) => {
    const numeric = Number.parseInt(provider?.code, 10);
    return Number.isFinite(numeric) && numeric > max ? numeric : max;
  }, -1);
}

function providerNameKey(value) {
  return encodeURIComponent(String(value || "").trim().toUpperCase()).slice(
    0,
    1200,
  );
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

  console.log("--- Migracion proveedores/items ---");
  console.log(`Database: ${args.database || "(default)"}`);
  console.log(`Env:      ${args.env}`);
  console.log(`Modo:     ${args.apply ? "APLICAR" : "dry-run"}`);

  let scannedDocs = 0;
  let scannedProviders = 0;
  let writtenProviders = 0;
  let skippedProviders = 0;
  let duplicateErrors = 0;
  let lastDoc = null;

  while (true) {
    let q = db
      .collection(COLLECTION)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(args.pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    let batch = db.batch();
    let ops = 0;

    for (const parentDoc of snap.docs) {
      scannedDocs++;
      lastDoc = parentDoc;
      const company = String(parentDoc.id || "").trim();
      const data = parentDoc.data() || {};
      const providers = Array.isArray(data.providers) ? data.providers : [];
      const normalizedProviders = providers
        .map((provider) =>
          normalizeProvider(provider, String(data.company || company).trim() || company),
        )
        .filter(Boolean);
      scannedProviders += providers.length;
      skippedProviders += providers.length - normalizedProviders.length;

      const seenCodes = new Map();
      const seenNames = new Map();
      for (const provider of normalizedProviders) {
        if (seenCodes.has(provider.code)) {
          duplicateErrors++;
          console.error(
            `Duplicado codigo ${COLLECTION}/${company}: ${provider.code} (${seenCodes.get(provider.code)} / ${provider.name})`,
          );
        }
        seenCodes.set(provider.code, provider.name);

        const nameKey = providerNameKey(provider.name);
        if (seenNames.has(nameKey)) {
          duplicateErrors++;
          console.error(
            `Duplicado nombre ${COLLECTION}/${company}: ${provider.name} (${seenNames.get(nameKey)})`,
          );
        }
        seenNames.set(nameKey, provider.code);
      }
      if (duplicateErrors > 0) continue;

      const storedNextCode =
        typeof data.nextCode === "number" && Number.isFinite(data.nextCode)
          ? data.nextCode
          : 0;
      const parentPatch = {
        company: String(data.company || company).trim() || company,
        nextCode: Math.max(storedNextCode, highestCode(normalizedProviders) + 1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (args.apply) {
        batch.set(parentDoc.ref, parentPatch, { merge: true });
        ops++;
      }

      for (const provider of normalizedProviders) {
        if (args.apply) {
          batch.set(
            parentDoc.ref.collection(ITEMS_SUBCOLLECTION).doc(provider.code),
            provider,
            { merge: false },
          );
          batch.set(
            parentDoc.ref.collection(NAMES_SUBCOLLECTION).doc(providerNameKey(provider.name)),
            {
              code: provider.code,
              name: provider.name,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: false },
          );
          ops++;
          ops++;
          writtenProviders++;
        } else {
          console.log(
            `[dry-run] ${COLLECTION}/${company}/${ITEMS_SUBCOLLECTION}/${provider.code} ${provider.name}`,
          );
        }

        if (ops >= 450) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }
    }

    if (args.apply && ops > 0) await batch.commit();
    console.log(
      `Procesados docs=${scannedDocs}, providers=${scannedProviders}, escritos=${writtenProviders}, omitidos=${skippedProviders}`,
    );
  }

  console.log("---");
  console.log(
    `Listo. docs=${scannedDocs}, providers=${scannedProviders}, escritos=${writtenProviders}, omitidos=${skippedProviders}`,
  );
  if (duplicateErrors > 0) {
    throw new Error(
      `Migracion detenida: ${duplicateErrors} duplicados encontrados. Corrige antes de aplicar.`,
    );
  }
  if (!args.apply) console.log("Dry-run. Usa --apply para escribir.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
