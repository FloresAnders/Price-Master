import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { pathToFileURL } from "node:url";

export const INITIAL_ANNOUNCEMENT_ID = "maintenance-2026-10-18";
const PROJECT_ID = "pricemaster-4a611";
const DATABASE_ID = "restauracion";

export function buildInitialAnnouncementDocuments({
  actorUid,
  now = FieldValue.serverTimestamp(),
}) {
  const safeActorUid = String(actorUid || "").trim();
  if (!safeActorUid) throw new Error("Falta --actor-uid=<uid Firebase del Superadmin>.");
  const endsAt = Timestamp.fromDate(new Date("2026-10-18T20:00:00.000Z"));
  const shared = {
    title: "Actualización programada",
    detail: "El sistema estará en mantenimiento de 12:00 a. m. a 2:00 p. m.",
    type: "maintenance",
    startsAt: null,
    endsAt,
    allowDismiss: false,
    priority: 50,
    scope: "global",
    version: 1,
  };
  return {
    privateDocument: {
      ...shared,
      active: true,
      archived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: safeActorUid,
      updatedBy: safeActorUid,
    },
    publicDocument: {
      ...shared,
      publishedAt: now,
    },
  };
}

async function run() {
  const apply = process.argv.includes("--apply");
  const actorArg = process.argv.find((value) => value.startsWith("--actor-uid="));
  const actorUid = actorArg?.slice("--actor-uid=".length).trim() || "";
  const documents = buildInitialAnnouncementDocuments({ actorUid });

  if (!apply) {
    console.log(
      `DRY RUN: se crearía ${INITIAL_ANNOUNCEMENT_ID} en ${PROJECT_ID}/${DATABASE_ID}. Añada --apply para escribir.`,
    );
    return;
  }

  const app =
    getApps()[0] ||
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const database = getFirestore(app, DATABASE_ID);
  const actorRef = database.collection("users").doc(actorUid);
  const privateRef = database.collection("systemAnnouncements").doc(INITIAL_ANNOUNCEMENT_ID);
  const publicRef = database
    .collection("publishedSystemAnnouncements")
    .doc(INITIAL_ANNOUNCEMENT_ID);

  const result = await database.runTransaction(async (transaction) => {
    const [actor, existing] = await Promise.all([
      transaction.get(actorRef),
      transaction.get(privateRef),
    ]);
    if (!actor.exists || actor.data()?.role !== "superadmin") {
      throw new Error("El actor indicado no es un Superadmin vigente.");
    }
    if (existing.exists) return "exists";
    transaction.create(privateRef, documents.privateDocument);
    transaction.create(publicRef, documents.publicDocument);
    return "created";
  });

  console.log(
    result === "created"
      ? `Creado ${INITIAL_ANNOUNCEMENT_ID} en ${DATABASE_ID}.`
      : `Sin cambios: ${INITIAL_ANNOUNCEMENT_ID} ya existe en ${DATABASE_ID}.`,
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath === import.meta.url) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
