import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertConfirmedUnlimitedRead } from "./firestore-read-budget.mjs";

const DEFAULT_PROJECT_ID = "pricemaster-4a611";
const DEFAULT_REFERENCE_BUDGET = 500;

/**
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 */
export function parseRouteScannerArgs(argv, env = process.env) {
  const projectId = env.GOOGLE_CLOUD_PROJECT?.trim() || DEFAULT_PROJECT_ID;
  const databaseId = env.FIRESTORE_DATABASE_ID?.trim() || "(default)";
  let readAll = false;
  let confirmation;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--all") {
      if (readAll) throw new Error("--all may be provided only once.");
      readAll = true;
      continue;
    }
    if (argument === "--confirm-project") {
      if (confirmation !== undefined) {
        throw new Error("--confirm-project may be provided only once.");
      }
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--confirm-project requires a value.");
      }
      confirmation = value.trim();
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  assertConfirmedUnlimitedRead({ readAll, projectId, confirmation });
  return {
    projectId,
    databaseId,
    readAll,
    maxReferences: readAll ? Number.POSITIVE_INFINITY : DEFAULT_REFERENCE_BUDGET,
    confirmation,
  };
}

const readCollectionDocuments = async (
  collectionReference,
  remaining,
  readAll,
  documentIdField,
) => {
  if (readAll) return collectionReference.listDocuments();
  const snapshot = await collectionReference
    .orderBy(documentIdField)
    .limit(remaining)
    .get();
  return snapshot.docs.map((document) => document.ref);
};

export async function scanFirestoreRoutes(options, dependencies) {
  const discovered = new Set();
  const pending = [];
  let inspectedDocumentReferences = 0;
  let truncated = false;

  const enqueue = (collectionReference) => {
    if (discovered.has(collectionReference.path)) return;
    discovered.add(collectionReference.path);
    pending.push(collectionReference);
  };

  for (const collectionReference of await dependencies.db.listCollections()) {
    enqueue(collectionReference);
  }

  while (pending.length > 0) {
    const remaining = options.readAll
      ? Number.POSITIVE_INFINITY
      : options.maxReferences - inspectedDocumentReferences;
    if (remaining <= 0) {
      truncated = true;
      break;
    }

    const collectionReference = pending.shift();
    const documentReferences = await readCollectionDocuments(
      collectionReference,
      remaining,
      options.readAll,
      dependencies.documentIdField,
    );
    inspectedDocumentReferences += documentReferences.length;
    if (!options.readAll && documentReferences.length >= remaining) truncated = true;

    for (const documentReference of documentReferences) {
      for (const nestedCollection of await documentReference.listCollections()) {
        enqueue(nestedCollection);
      }
    }
  }

  if (pending.length > 0) truncated = true;
  return {
    projectId: options.projectId,
    databaseId: options.databaseId,
    inspectedDocumentReferences,
    truncated,
    routes: [...discovered].sort((left, right) => left.localeCompare(right)),
  };
}

async function saveRoutes(result) {
  const outputDirectory = path.resolve(process.cwd(), "exports", "firestore");
  await mkdir(outputDirectory, { recursive: true });
  const jsonOutputPath = path.join(outputDirectory, "firestore-routes.json");
  const textOutputPath = path.join(outputDirectory, "firestore-routes.txt");
  const output = { generatedAt: new Date().toISOString(), ...result };
  await writeFile(jsonOutputPath, JSON.stringify(output, null, 2), "utf8");
  await writeFile(textOutputPath, `${result.routes.join("\n")}\n`, "utf8");
  return { jsonOutputPath, textOutputPath };
}

async function createFirestore(options) {
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
  return { db, documentIdField: firestoreAdmin.FieldPath.documentId() };
}

async function main() {
  const options = parseRouteScannerArgs(process.argv.slice(2));
  console.log("Escaneando Firestore.");
  console.log(`Proyecto: ${options.projectId}`);
  console.log(`Base: ${options.databaseId}`);
  console.log(`Presupuesto: ${options.readAll ? "sin limite confirmado" : options.maxReferences}`);
  const dependencies = await createFirestore(options);
  const result = await scanFirestoreRoutes(options, dependencies);
  const paths = await saveRoutes(result);
  console.log(`Rutas encontradas: ${result.routes.length}`);
  console.log(`Referencias inspeccionadas: ${result.inspectedDocumentReferences}`);
  console.log(`Truncado: ${result.truncated}`);
  console.log(`Archivo JSON: ${paths.jsonOutputPath}`);
  console.log(`Archivo TXT: ${paths.textOutputPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("No fue posible recorrer Firestore.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
