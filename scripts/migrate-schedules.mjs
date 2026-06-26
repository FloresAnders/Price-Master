import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COLLECTION = "schedules";

function parseArgs(argv) {
  const args = {
    database: process.env.FIRESTORE_DATABASE_ID || "restauracion",
    serviceAccount: "../serviceAccountKey.json",
    source: "",
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--database") {
      args.database = String(argv[i + 1] || "").trim() || args.database;
      i++;
    } else if (token === "--service-account") {
      args.serviceAccount =
        String(argv[i + 1] || "").trim() || args.serviceAccount;
      i++;
    } else if (token === "--dry-run") {
      args.dryRun = true;
    } else if (!args.source) {
      args.source = token;
    }
  }

  if (!args.source) {
    throw new Error(
      "Uso: node scripts/migrate-schedules.mjs <HORARIOS.json> [--database restauracion] [--service-account ../serviceAccountKey.json] [--dry-run]",
    );
  }

  return args;
}

function initAdmin(serviceAccountArg) {
  if (admin.apps.length) return;

  const serviceAccountPath = path.resolve(__dirname, serviceAccountArg);
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }

  admin.initializeApp();
}
function getDb(databaseId) {
  const db = admin.firestore();
  if (databaseId && databaseId !== "(default)") {
    db.settings({ databaseId });
  }
  return db;
}

function plainFirestoreValue(value) {
  if (value && typeof value === "object") {
    if ("stringValue" in value) return value.stringValue;
    if ("integerValue" in value) return Number(value.integerValue);
    if ("doubleValue" in value) return Number(value.doubleValue);
    if ("booleanValue" in value) return Boolean(value.booleanValue);
    if ("timestampValue" in value) return new Date(value.timestampValue);
    if ("nullValue" in value) return null;
    if ("mapValue" in value) {
      return plainFirestoreData(value.mapValue.fields || {});
    }
    if ("arrayValue" in value) {
      return (value.arrayValue.values || []).map(plainFirestoreValue);
    }
  }
  return value;
}

function plainFirestoreData(fields) {
  return Object.fromEntries(
    Object.entries(fields || {}).map(([key, value]) => [
      key,
      plainFirestoreValue(value),
    ]),
  );
}

function normalizeRawDoc(rawDoc) {
  if (rawDoc.data?.fields) return plainFirestoreData(rawDoc.data.fields);
  if (rawDoc.fields) return plainFirestoreData(rawDoc.fields);
  return rawDoc.data || rawDoc;
}

function loadRows(sourcePath) {
  const resolved = path.resolve(process.cwd(), sourcePath);
  const raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (Array.isArray(raw)) return raw.map(normalizeRawDoc);
  if (Array.isArray(raw.documents)) return raw.documents.map(normalizeRawDoc);
  throw new Error("JSON debe ser array o tener propiedad documents[]");
}

function groupSchedules(rows) {
  const grouped = {};
  let skipped = 0;

  for (const row of rows) {
    const company = row.companieValue || row.company;
    const employeeName = row.employeeName;
    const year = Number(row.year);
    const month = Number(row.month);
    const day = Number(row.day);

    if (
      !company ||
      !employeeName ||
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day)
    ) {
      skipped++;
      continue;
    }

    const id = `${company}_${year}_${month}`;
    grouped[id] ||= {
      company,
      year,
      month,
      employees: {},
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    grouped[id].employees[employeeName] ||= {};
    const entry = { shift: row.shift || "" };
    if (typeof row.horasPorDia === "number") {
      entry.horasPorDia = row.horasPorDia;
    }
    grouped[id].employees[employeeName][String(day)] = entry;
  }

  return { grouped, skipped };
}

async function writeGrouped(db, grouped) {
  const entries = Object.entries(grouped);
  const batchSize = 450;
  let written = 0;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = db.batch();
    const chunk = entries.slice(i, i + batchSize);

    for (const [id, data] of chunk) {
      batch.set(db.collection(COLLECTION).doc(id), data, { merge: true });
    }

    await batch.commit();
    written += chunk.length;
    console.log(`Escritos: ${written}/${entries.length}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = loadRows(args.source);
  const { grouped, skipped } = groupSchedules(rows);
  const entries = Object.entries(grouped);

  console.log(`Docs originales: ${rows.length}`);
  console.log(`Docs agrupados: ${entries.length}`);
  console.log(`Docs omitidos: ${skipped}`);

  if (args.dryRun) {
    console.log("Dry run: no se escribio en Firestore.");
    return;
  }

  initAdmin(args.serviceAccount);
  await writeGrouped(getDb(args.database), grouped);
  console.log("Migracion completada.");
}

main().catch((error) => {
  console.error("Migracion fallida:", error);
  process.exitCode = 1;
});
