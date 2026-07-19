import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  applicationDefault,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import {
  getFirestore,
} from "firebase-admin/firestore";

/*
 * Configuración general
 */

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
  "pricemaster-4a611";

const databaseId =
  process.env.FIRESTORE_DATABASE_ID?.trim() ||
  "(default)";

/*
 * Controla cuántas colecciones y documentos se inspeccionan
 * simultáneamente.
 *
 * Estos valores no limitan la cantidad total de rutas.
 */
const collectionConcurrency = 3;
const documentConcurrency = 10;

/*
 * Inicialización de Firebase
 */

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: applicationDefault(),
        projectId,
      });

const db =
  databaseId === "(default)" ||
  databaseId.toLowerCase() === "default"
    ? getFirestore(app)
    : getFirestore(app, databaseId);

/*
 * Rutas encontradas.
 *
 * Solo se guardan rutas de colecciones.
 * Nunca se leen ni se guardan los campos de los documentos.
 */
const discoveredCollectionPaths = new Set();
const pendingCollections = [];

let inspectedDocumentReferences = 0;

/*
 * Agregar una colección a la cola evitando duplicados.
 */

function enqueueCollection(collectionReference) {
  const collectionPath = collectionReference.path;

  if (discoveredCollectionPaths.has(collectionPath)) {
    return;
  }

  discoveredCollectionPaths.add(collectionPath);
  pendingCollections.push(collectionReference);
}

/*
 * Procesa elementos por grupos para evitar demasiadas
 * solicitudes simultáneas.
 */

async function processInBatches(
  items,
  batchSize,
  callback,
) {
  const results = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);

    const batchResults = await Promise.all(
      batch.map(callback),
    );

    results.push(...batchResults);
  }

  return results;
}

/*
 * Inspecciona una colección.
 *
 * listDocuments() obtiene referencias, no llama data()
 * y no exporta los campos del documento.
 */

async function inspectCollection(collectionReference) {
  const documentReferences =
    await collectionReference.listDocuments();

  inspectedDocumentReferences += documentReferences.length;

  const nestedCollectionGroups = await processInBatches(
    documentReferences,
    documentConcurrency,
    async (documentReference) => {
      return documentReference.listCollections();
    },
  );

  return nestedCollectionGroups.flat();
}

/*
 * Recorre toda la base de datos.
 */

async function discoverAllCollectionPaths() {
  const rootCollections = await db.listCollections();

  for (const collectionReference of rootCollections) {
    enqueueCollection(collectionReference);
  }

  while (pendingCollections.length > 0) {
    const collectionBatch = pendingCollections.splice(
      0,
      collectionConcurrency,
    );

    const nestedCollectionGroups = await Promise.all(
      collectionBatch.map(inspectCollection),
    );

    for (const nestedCollections of nestedCollectionGroups) {
      for (const collectionReference of nestedCollections) {
        enqueueCollection(collectionReference);
      }
    }
  }
}

/*
 * Guardar únicamente las rutas encontradas.
 */

async function saveRoutes() {
  const routes = [...discoveredCollectionPaths].sort(
    (firstPath, secondPath) =>
      firstPath.localeCompare(secondPath),
  );

  const outputDirectory = path.resolve(
    process.cwd(),
    "exports",
    "firestore",
  );

  await mkdir(outputDirectory, {
    recursive: true,
  });

  const jsonOutputPath = path.join(
    outputDirectory,
    "firestore-routes.json",
  );

  const textOutputPath = path.join(
    outputDirectory,
    "firestore-routes.txt",
  );

  const result = {
    generatedAt: new Date().toISOString(),
    projectId,
    databaseId: "(default)",
    totalRoutes: routes.length,
    routes,
  };

  await writeFile(
    jsonOutputPath,
    JSON.stringify(result, null, 2),
    "utf8",
  );

  await writeFile(
    textOutputPath,
    `${routes.join("\n")}\n`,
    "utf8",
  );

  return {
    routes,
    jsonOutputPath,
    textOutputPath,
  };
}

/*
 * Ejecución principal
 */

async function main() {
  await discoverAllCollectionPaths();

  const {
    routes,
    jsonOutputPath,
    textOutputPath,
  } = await saveRoutes();

  /*
   * No se muestran rutas ni información de documentos
   * en la terminal.
   */
  console.log("Escaneo completado.");
  console.log(`Rutas encontradas: ${routes.length}`);
  console.log(
    `Referencias inspeccionadas: ${inspectedDocumentReferences}`,
  );
  console.log(`Archivo JSON: ${jsonOutputPath}`);
  console.log(`Archivo TXT: ${textOutputPath}`);
}

main().catch((error) => {
  console.error("No fue posible recorrer Firestore.");

  if (
    error &&
    typeof error === "object" &&
    "code" in error
  ) {
    console.error(`Código: ${error.code}`);
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    console.error(`Mensaje: ${error.message}`);
  } else {
    console.error(String(error));
  }

  process.exit(1);
});