import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertConfirmedUnlimitedRead } from "./firestore-read-budget.mjs";

const DEFAULT_PROJECT_ID = "pricemaster-4a611";
const BATCH_SIZE = 500;

/**
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 */
export function parseFirebaseReadArgs(argv, env = process.env) {
  const projectId = env.GOOGLE_CLOUD_PROJECT?.trim() || DEFAULT_PROJECT_ID;
  const databaseId = env.FIRESTORE_DATABASE_ID?.trim() || "(default)";
  const rawCollectionPath = argv[0]?.trim();
  if (!rawCollectionPath) throw new Error("Debes indicar la ruta de una coleccion.");
  const pathSegments = rawCollectionPath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (pathSegments.length % 2 === 0) {
    throw new Error("La ruta debe terminar con el nombre de una coleccion.");
  }

  const limitArgument = argv[1]?.trim().toLowerCase() || "10";
  const readAll = limitArgument === "all";
  let requestedLimit = null;
  if (!readAll) {
    requestedLimit = Number.parseInt(limitArgument, 10);
    if (!Number.isFinite(requestedLimit) || requestedLimit < 1) {
      throw new Error('El limite debe ser mayor que 0 o la palabra "all".');
    }
  }

  let confirmation;
  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument !== "--confirm-project") throw new Error(`Unknown argument: ${argument}`);
    if (confirmation !== undefined) {
      throw new Error("--confirm-project may be provided only once.");
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("--confirm-project requires a value.");
    }
    confirmation = value.trim();
    index += 1;
  }

  assertConfirmedUnlimitedRead({ readAll, projectId, confirmation });
  return {
    projectId,
    databaseId,
    collectionPath: pathSegments.join("/"),
    readAll,
    requestedLimit,
    confirmation,
  };
}

function normalizeFirestoreValue(value) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (
    typeof value === "object" &&
    typeof value.latitude === "number" &&
    typeof value.longitude === "number"
  ) {
    return { latitude: value.latitude, longitude: value.longitude };
  }
  if (typeof value === "object" && typeof value.path === "string" && value.firestore) {
    return { referencePath: value.path };
  }
  if (Buffer.isBuffer(value)) return { type: "Buffer", base64: value.toString("base64") };
  if (Array.isArray(value)) return value.map(normalizeFirestoreValue);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizeFirestoreValue(nested)]),
    );
  }
  return value;
}

const normalizeDocument = (document) => ({
  id: document.id,
  path: document.ref.path,
  data: normalizeFirestoreValue(document.data()),
});

async function readLimitedDocuments(collectionReference, limit, documentIdField) {
  const snapshot = await collectionReference
    .orderBy(documentIdField)
    .limit(limit)
    .get();
  return snapshot.docs.map(normalizeDocument);
}

async function readAllDocuments(collectionReference, documentIdField) {
  const documents = [];
  let lastDocument = null;
  let batchNumber = 0;
  while (true) {
    let query = collectionReference.orderBy(documentIdField).limit(BATCH_SIZE);
    if (lastDocument) query = query.startAfter(lastDocument);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    batchNumber += 1;
    documents.push(...snapshot.docs.map(normalizeDocument));
    lastDocument = snapshot.docs[snapshot.docs.length - 1];
    console.error(
      `Lote ${batchNumber}: ${snapshot.size} documentos leidos. Total: ${documents.length}.`,
    );
    if (snapshot.size < BATCH_SIZE) break;
  }
  return documents;
}

const safeFileName = (value) => value.replace(/[\\/:*?"<>|]/g, "_");
const fileTimestamp = () => new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");

async function main() {
  const options = parseFirebaseReadArgs(process.argv.slice(2));
  const [{ applicationDefault, getApps, initializeApp }, firestoreAdmin] =
    await Promise.all([
      import("firebase-admin/app"),
      import("firebase-admin/firestore"),
    ]);
  const app =
    getApps()[0] ??
    initializeApp({ credential: applicationDefault(), projectId: options.projectId });
  const db =
    options.databaseId === "(default)" || options.databaseId.toLowerCase() === "default"
      ? firestoreAdmin.getFirestore(app)
      : firestoreAdmin.getFirestore(app, options.databaseId);
  const collectionReference = db.collection(options.collectionPath);

  console.error(`Proyecto: ${options.projectId}`);
  console.error(`Base: ${options.databaseId}`);
  console.error(`Coleccion: ${options.collectionPath}`);
  console.error(`Cantidad: ${options.readAll ? "all confirmado" : options.requestedLimit}`);
  const documents = options.readAll
    ? await readAllDocuments(collectionReference, firestoreAdmin.FieldPath.documentId())
    : await readLimitedDocuments(
        collectionReference,
        options.requestedLimit,
        firestoreAdmin.FieldPath.documentId(),
      );
  const result = {
    success: true,
    generatedAt: new Date().toISOString(),
    projectId: options.projectId,
    databaseId: options.databaseId,
    collectionPath: options.collectionPath,
    mode: options.readAll ? "all" : "limited",
    requestedLimit: options.requestedLimit,
    total: documents.length,
    documents,
  };

  if (!options.readAll) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const exportDirectory = path.resolve(process.cwd(), "exports", "firestore");
  await mkdir(exportDirectory, { recursive: true });
  const outputFile = path.join(
    exportDirectory,
    `${safeFileName(options.collectionPath)}_${fileTimestamp()}.json`,
  );
  await writeFile(outputFile, JSON.stringify(result, null, 2), "utf8");
  console.log(
    JSON.stringify(
      {
        success: true,
        projectId: options.projectId,
        databaseId: options.databaseId,
        collectionPath: options.collectionPath,
        total: documents.length,
        outputFile,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("No fue posible leer Firestore.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
