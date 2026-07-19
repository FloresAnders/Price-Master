import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  applicationDefault,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import {
  FieldPath,
  getFirestore,
} from "firebase-admin/firestore";

/*
 * Configuración
 */

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT?.trim() || "pricemaster-4a611";

const databaseId =
  process.env.FIRESTORE_DATABASE_ID?.trim() || "(default)";

const collectionPath = process.argv[2]?.trim();

const limitArgument = process.argv[3]?.trim().toLowerCase() || "10";

const batchSize = 500;

/*
 * Validar la ruta recibida
 */

if (!collectionPath) {
  console.error("Debes indicar la ruta de una colección.");
  console.error("");
  console.error("Ejemplos:");
  console.error(
    'npm run firebase:read -- "MovimientosFondos/movements_ALCHACAS/movements" 10'
  );
  console.error(
    'npm run firebase:read -- "MovimientosFondos/movements_ALCHACAS/movements" all'
  );

  process.exit(1);
}

const pathSegments = collectionPath
  .split("/")
  .map((segment) => segment.trim())
  .filter(Boolean);

/*
 * Una ruta de colección tiene una cantidad impar de segmentos:
 *
 * coleccion
 * coleccion/documento/subcoleccion
 */
if (pathSegments.length % 2 === 0) {
  console.error("La ruta no corresponde a una colección:");
  console.error(collectionPath);
  console.error("");
  console.error(
    "La ruta debe terminar con el nombre de una colección."
  );

  process.exit(1);
}

const normalizedCollectionPath = pathSegments.join("/");

/*
 * Determinar si se leerán todos los documentos
 * o solamente una cantidad específica.
 */

const readAll = limitArgument === "all";

let requestedLimit = null;

if (!readAll) {
  requestedLimit = Number.parseInt(limitArgument, 10);

  if (!Number.isFinite(requestedLimit) || requestedLimit < 1) {
    console.error(
      'El límite debe ser un número mayor que 0 o la palabra "all".'
    );

    process.exit(1);
  }
}

/*
 * Convierte valores especiales de Firestore en valores
 * que puedan guardarse correctamente como JSON.
 */

function normalizeFirestoreValue(value) {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (
    typeof value === "object" &&
    typeof value.latitude === "number" &&
    typeof value.longitude === "number"
  ) {
    return {
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }

  if (
    typeof value === "object" &&
    typeof value.path === "string" &&
    value.firestore
  ) {
    return {
      referencePath: value.path,
    };
  }

  if (Buffer.isBuffer(value)) {
    return {
      type: "Buffer",
      base64: value.toString("base64"),
    };
  }

  if (Array.isArray(value)) {
    return value.map(normalizeFirestoreValue);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        normalizeFirestoreValue(nestedValue),
      ])
    );
  }

  return value;
}

function normalizeDocument(document) {
  return {
    id: document.id,
    path: document.ref.path,
    data: normalizeFirestoreValue(document.data()),
  };
}

function createSafeFileName(value) {
  return value
    .replaceAll("\\", "_")
    .replaceAll("/", "__")
    .replaceAll(":", "_")
    .replaceAll("*", "_")
    .replaceAll("?", "_")
    .replaceAll('"', "_")
    .replaceAll("<", "_")
    .replaceAll(">", "_")
    .replaceAll("|", "_");
}

function createTimestampForFileName() {
  return new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");
}

/*
 * Leer una cantidad limitada de documentos.
 */

async function readLimitedDocuments(collectionReference, limit) {
  const snapshot = await collectionReference
    .orderBy(FieldPath.documentId())
    .limit(limit)
    .get();

  return snapshot.docs.map(normalizeDocument);
}

/*
 * Leer toda la colección por bloques.
 */

async function readAllDocuments(collectionReference) {
  const documents = [];

  let lastDocument = null;
  let batchNumber = 0;

  while (true) {
    let query = collectionReference
      .orderBy(FieldPath.documentId())
      .limit(batchSize);

    if (lastDocument) {
      query = query.startAfter(lastDocument);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      break;
    }

    batchNumber += 1;

    const normalizedDocuments =
      snapshot.docs.map(normalizeDocument);

    documents.push(...normalizedDocuments);

    lastDocument =
      snapshot.docs[snapshot.docs.length - 1];

    console.error(
      `Lote ${batchNumber}: ${snapshot.size} documentos leídos. ` +
      `Total acumulado: ${documents.length}.`
    );

    if (snapshot.size < batchSize) {
      break;
    }
  }

  return documents;
}

/*
 * Ejecución principal
 */

async function main() {
  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: applicationDefault(),
          projectId,
        });

  /*
   * Para la base predeterminada se utiliza getFirestore(app)
   * sin pasar "(default)" como segundo argumento.
   */
  const db =
    databaseId === "(default)" ||
    databaseId.toLowerCase() === "default"
      ? getFirestore(app)
      : getFirestore(app, databaseId);

  const collectionReference = db.collection(
    normalizedCollectionPath
  );

  console.error("Consultando Firestore...");
  console.error(`Proyecto: ${projectId}`);
  console.error(`Base: ${databaseId}`);
  console.error(`Colección: ${normalizedCollectionPath}`);
  console.error(
    `Cantidad: ${readAll ? "todos los documentos" : requestedLimit}`
  );
  console.error("");

  const documents = readAll
    ? await readAllDocuments(collectionReference)
    : await readLimitedDocuments(
        collectionReference,
        requestedLimit
      );

  const result = {
    success: true,
    generatedAt: new Date().toISOString(),
    projectId,
    databaseId: "(default)",
    collectionPath: normalizedCollectionPath,
    mode: readAll ? "all" : "limited",
    requestedLimit: readAll ? null : requestedLimit,
    total: documents.length,
    documents,
  };

  /*
   * Para consultas pequeñas se imprime el JSON completo.
   */
  if (!readAll) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  /*
   * Para leer toda la colección se guarda el resultado
   * en un archivo dentro del proyecto.
   */
  const exportDirectory = path.resolve(
    process.cwd(),
    "exports",
    "firestore"
  );

  await mkdir(exportDirectory, {
    recursive: true,
  });

  const safeCollectionName = createSafeFileName(
    normalizedCollectionPath
  );

  const outputFile = path.join(
    exportDirectory,
    `${safeCollectionName}_${createTimestampForFileName()}.json`
  );

  await writeFile(
    outputFile,
    JSON.stringify(result, null, 2),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        success: true,
        projectId,
        databaseId: "(default)",
        collectionPath: normalizedCollectionPath,
        total: documents.length,
        outputFile,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("");
  console.error("No fue posible leer Firestore.");

  if (error && typeof error === "object") {
    if ("code" in error && error.code !== undefined) {
      console.error(`Código: ${error.code}`);
    }

    if ("message" in error && error.message) {
      console.error(`Mensaje: ${error.message}`);
    }

    if ("details" in error && error.details) {
      console.error(`Detalles: ${error.details}`);
    }
  } else {
    console.error(String(error));
  }

  process.exit(1);
});