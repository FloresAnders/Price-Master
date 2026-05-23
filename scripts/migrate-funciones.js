/* eslint-disable no-console */
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const DEFAULT_OWNER_NAME = "EDEBERTO MORA VARGAS";
const LEGACY_COLLECTION = "funciones";
const TARGET_COLLECTION = "funcionesByOwner";
const TARGET_SUBCOLLECTION = "generales";

function parseArgs(argv) {
  const args = {
    apply: false,
    deleteLegacy: false,
    database: (process.env.FIRESTORE_DATABASE_ID || "").trim(),
    env: (process.env.FIREBASE_ENV || process.env.NODE_ENV || "development")
      .trim()
      .toLowerCase(),
    ownerName: DEFAULT_OWNER_NAME,
    serviceAccount: "../serviceAccountKey.json",
  };

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];

    if (token === "--apply") {
      args.apply = true;
      continue;
    }

    if (token === "--delete-legacy") {
      args.deleteLegacy = true;
      continue;
    }

    if (token === "--database") {
      args.database = String(argv[index + 1] || "").trim();
      index++;
      continue;
    }

    if (token === "--env") {
      args.env = String(argv[index + 1] || "").trim().toLowerCase();
      index++;
      continue;
    }

    if (token === "--owner-name") {
      args.ownerName = String(argv[index + 1] || "").trim() || args.ownerName;
      index++;
      continue;
    }

    if (token === "--service-account") {
      args.serviceAccount =
        String(argv[index + 1] || "").trim() || args.serviceAccount;
      index++;
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
  node scripts/migrate-funciones-by-owner.js [opciones]

Opciones:
  --apply                  Escribe cambios en Firestore
  --delete-legacy          Borra los docs numerados de la colección legacy
  --database <id>          Base nombrada (vacío = default)
  --env <modo>             development => usa .env.local, production => usa .env
  --owner-name <nombre>    Default: ${DEFAULT_OWNER_NAME}
  --service-account <path> Default: ../serviceAccountKey.json
  -h, --help               Ayuda

Ejemplos:
  node scripts/migrate-funciones-by-owner.js
  node scripts/migrate-funciones-by-owner.js --apply
  node scripts/migrate-funciones-by-owner.js --apply --delete-legacy
  node scripts/migrate-funciones-by-owner.js --apply --database restauracion --env production
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

function normalizePathSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[\\/#?\[\]]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function isNumericFuncionId(value) {
  return /^\d+$/.test(String(value || "").trim());
}

function isGeneralFuncionDoc(data) {
  if (!data || typeof data !== "object") return false;
  return data.type === "general" || (data.funcionId && data.nombre && !data.empresaId);
}

async function readLegacyNumericDocs(db, ownerId) {
  const snapshot = await db.collection(LEGACY_COLLECTION).get();
  const docs = snapshot.docs
    .map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }))
    .filter((docData) => {
      if (!isGeneralFuncionDoc(docData.data)) return false;
      if (!isNumericFuncionId(docData.data.funcionId)) return false;
      if (!ownerId) return true;
      return String(docData.data.ownerId || "").trim() === ownerId;
    });

  docs.sort((left, right) => {
    const leftOrder = Number.parseInt(String(left.data?.funcionId || "").trim(), 10);
    const rightOrder = Number.parseInt(String(right.data?.funcionId || "").trim(), 10);

    if (Number.isFinite(leftOrder) && Number.isFinite(rightOrder)) {
      return leftOrder - rightOrder;
    }

    return String(left.id).localeCompare(String(right.id), "es");
  });

  return docs;
}

async function findOwnerAdmin(db, ownerName) {
  const normalized = String(ownerName || "").trim();
  if (!normalized) return null;

  const snapshot = await db
    .collection("users")
    .where("fullName", "==", normalized)
    .get();

  const candidates = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const adminCandidates = candidates.filter((user) => user.role === "admin");

  return adminCandidates[0] || candidates[0] || null;
}

async function writeTargetDocs(targetCollectionRef, docs) {
  const batchSize = 400;
  for (let index = 0; index < docs.length; index += batchSize) {
    const batch = targetCollectionRef.firestore.batch();
    const chunk = docs.slice(index, index + batchSize);

    for (const docData of chunk) {
      batch.set(docData.ref, docData.data, {
        merge: false,
      });
    }

    await batch.commit();
  }
}

async function deleteLegacyDocs(db, docs) {
  const batchSize = 400;
  for (let index = 0; index < docs.length; index += batchSize) {
    const batch = db.batch();
    const chunk = docs.slice(index, index + batchSize);

    for (const docData of chunk) {
      batch.delete(db.collection(LEGACY_COLLECTION).doc(docData.id));
    }

    await batch.commit();
  }
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

  const serviceAccountPath = path.resolve(__dirname, args.serviceAccount);
  const serviceAccount = require(serviceAccountPath);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const databaseId = String(args.database || "").trim();

  // Inicializar Firestore y apuntar a la base correcta con settings()
  // settings() debe llamarse antes de cualquier operación y una sola vez.
  const db = admin.firestore();
  if (databaseId) {
    db.settings({ databaseId });
  }

  const ownerName = String(args.ownerName || DEFAULT_OWNER_NAME).trim();
  const scopeId = normalizePathSegment(ownerName);
  const ownerAdmin = await findOwnerAdmin(db, ownerName);
  const ownerId = String(ownerAdmin?.ownerId || ownerAdmin?.id || "").trim();
  const targetCollectionRef = db
    .collection(TARGET_COLLECTION)
    .doc(scopeId)
    .collection(TARGET_SUBCOLLECTION);

  console.log("Configuracion:");
  console.log({
    apply: args.apply,
    deleteLegacy: args.deleteLegacy,
    database: databaseId || "(default)",
    env: args.env,
    ownerName,
    scopeId,
    ownerId: ownerId || null,
    legacyCollection: LEGACY_COLLECTION,
    targetCollection: TARGET_COLLECTION,
    targetSubcollection: TARGET_SUBCOLLECTION,
  });

  if (ownerAdmin) {
    console.log("Owner admin encontrado:");
    console.log({
      id: ownerAdmin.id || null,
      fullName: ownerAdmin.fullName || null,
      ownerId: ownerAdmin.ownerId || null,
      email: ownerAdmin.email || null,
      role: ownerAdmin.role || null,
    });
  } else {
    console.warn(
      `No se encontró un usuario admin con fullName = ${ownerName}. Se continuará con el scope derivado del nombre.`,
    );
  }

  const legacyDocs = await readLegacyNumericDocs(db, ownerId);

  console.log(`Funciones numeradas legacy encontradas: ${legacyDocs.length}`);
  console.log(
    `Ruta destino: ${TARGET_COLLECTION}/${scopeId}/${TARGET_SUBCOLLECTION}`,
  );

  if (legacyDocs.length === 0) {
    console.log("No hay documentos para migrar.");
    return;
  }

  console.log("Vista previa de documentos a migrar:");
  legacyDocs.forEach((docData) => {
    console.log(`- ${docData.id} -> ${docData.data?.nombre || "(sin nombre)"}`);
  });

  if (!args.apply) {
    console.log("Dry-run completado. Usa --apply para escribir los cambios.");
    return;
  }

  const targetDocs = legacyDocs.map((docData) => ({
    ref: targetCollectionRef.doc(docData.id),
    data: docData.data,
    id: docData.id,
  }));

  await writeTargetDocs(targetCollectionRef, targetDocs);
  console.log(
    `✓ Copiados ${legacyDocs.length} documentos a ${TARGET_COLLECTION}/${scopeId}/${TARGET_SUBCOLLECTION}`,
  );

  if (args.deleteLegacy) {
    await deleteLegacyDocs(db, legacyDocs);
    console.log(
      `✓ Eliminados ${legacyDocs.length} documentos numerados de ${LEGACY_COLLECTION}`,
    );
  } else {
    console.log(`La colección legacy ${LEGACY_COLLECTION} se dejó intacta.`);
  }
}

main().catch((error) => {
  console.error("Error durante la migración:", error);
  process.exit(1);
});