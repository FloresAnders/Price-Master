/* eslint-disable no-console */
const admin = require("firebase-admin");
const path = require("path");

const DEFAULT_OWNER_NAME = "EDEBERTO MORA VARGAS";
const LEGACY_COLLECTION = "fondoMovementTypes";
const TARGET_COLLECTION = "fondoMovementTypesByOwner";
const TARGET_SUBCOLLECTION = "types";

function parseArgs(argv) {
  const args = {
    apply: false,
    deleteLegacy: false,
    database: (process.env.FIRESTORE_DATABASE_ID || "").trim(),
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
  node scripts/migrate-fondoMovementTypes-by-owner.js [opciones]

Opciones:
  --apply                  Escribe cambios en Firestore
  --delete-legacy          Borra la colección legacy después de copiar
  --database <id>          Base nombrada (vacío = default)
  --owner-name <nombre>    Default: EDEBERTO MORA VARGAS
  --service-account <path> Default: ../serviceAccountKey.json
  -h, --help               Ayuda

Ejemplos:
  node scripts/migrate-fondoMovementTypes-by-owner.js
  node scripts/migrate-fondoMovementTypes-by-owner.js --apply
  node scripts/migrate-fondoMovementTypes-by-owner.js --apply --delete-legacy
`);
}

function normalizePathSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[\\/#?\[\]]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function getDb(databaseId) {
  if (!databaseId) return admin.firestore();
  return admin.app().firestore(databaseId);
}

async function readLegacyTypes(db) {
  const snapshot = await db.collection(LEGACY_COLLECTION).get();
  const docs = snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data(),
  }));

  docs.sort((left, right) => {
    const leftOrder = Number(left.data?.order ?? 0);
    const rightOrder = Number(right.data?.order ?? 0);
    return leftOrder - rightOrder;
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
      batch.set(targetCollectionRef.doc(docData.id), docData.data, {
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
  const args = parseArgs(process.argv.slice(2));
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

  const db = getDb(args.database);
  const ownerName = String(args.ownerName || DEFAULT_OWNER_NAME).trim();
  const scopeId = normalizePathSegment(ownerName);
  const ownerAdmin = await findOwnerAdmin(db, ownerName);

  console.log("Configuracion:");
  console.log({
    apply: args.apply,
    deleteLegacy: args.deleteLegacy,
    database: args.database || "(default)",
    ownerName,
    scopeId,
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

  const legacyDocs = await readLegacyTypes(db);
  const targetCollectionRef = db
    .collection(TARGET_COLLECTION)
    .doc(scopeId)
    .collection(TARGET_SUBCOLLECTION);

  console.log(`Tipos legacy encontrados: ${legacyDocs.length}`);
  console.log(
    `Ruta destino: ${TARGET_COLLECTION}/${scopeId}/${TARGET_SUBCOLLECTION}`,
  );

  if (legacyDocs.length === 0) {
    console.log("No hay documentos para migrar.");
    return;
  }

  console.log("Vista previa de documentos a migrar:");
  legacyDocs.forEach((docData) => {
    console.log(`- ${docData.id} -> ${docData.data?.name || "(sin nombre)"}`);
  });

  if (!args.apply) {
    console.log("Dry-run completado. Usa --apply para escribir los cambios.");
    return;
  }

  await writeTargetDocs(targetCollectionRef, legacyDocs);
  console.log(
    `✓ Copiados ${legacyDocs.length} documentos a ${TARGET_COLLECTION}/${scopeId}/${TARGET_SUBCOLLECTION}`,
  );

  if (args.deleteLegacy) {
    await deleteLegacyDocs(db, legacyDocs);
    console.log(`✓ Eliminados ${legacyDocs.length} documentos de ${LEGACY_COLLECTION}`);
  } else {
    console.log(`La colección legacy ${LEGACY_COLLECTION} se dejó intacta.`);
  }
}

main().catch((error) => {
  console.error("Error durante la migración:", error);
  process.exit(1);
});
