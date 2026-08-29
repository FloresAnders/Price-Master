import path from "node:path";
import { pathToFileURL } from "node:url";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import {
  buildGenteCrystalDailyEntry,
  genteCrystalCostaRicaDateKey,
} from "../src/lib/gente-crystal/daily-sales.ts";

const USAGE =
  'Usage: npm run backfill:gente-crystal-daily -- --company "<id>" --database "<id>" (--apply | --verify-only)';

function readDocumentSegment(value, flag) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 160 || normalized.includes("/")) {
    throw new Error(`${flag} must be a non-empty Firestore document segment.`);
  }
  return normalized;
}

export function parseBackfillArgs(argv) {
  let companyId;
  let databaseId;
  let apply = false;
  let verifyOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--company") {
      if (companyId !== undefined) {
        throw new Error(`--company may be provided only once. ${USAGE}`);
      }
      const value = argv[index + 1];
      if (typeof value !== "string" || value.startsWith("--")) {
        throw new Error("--company requires a value that is not another flag.");
      }
      companyId = value;
      index += 1;
      continue;
    }
    if (argument === "--database") {
      if (databaseId !== undefined) {
        throw new Error(`--database may be provided only once. ${USAGE}`);
      }
      const value = argv[index + 1];
      if (typeof value !== "string" || value.startsWith("--")) {
        throw new Error("--database requires a value that is not another flag.");
      }
      databaseId = value;
      index += 1;
      continue;
    }
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (argument === "--verify-only") {
      verifyOnly = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}. ${USAGE}`);
  }

  const normalizedCompanyId = readDocumentSegment(companyId, "--company");
  const normalizedDatabaseId = readDocumentSegment(databaseId, "--database");
  if (apply && verifyOnly) {
    throw new Error("--apply and --verify-only cannot be combined.");
  }
  if (!apply && !verifyOnly) {
    throw new Error(`Exactly one of --apply or --verify-only is required. ${USAGE}`);
  }

  return {
    companyId: normalizedCompanyId,
    databaseId: normalizedDatabaseId,
    mode: apply ? "apply" : "verify-only",
  };
}

export function buildBackfillMutation(companyId, ticketId, record) {
  const normalizedCompanyId = readDocumentSegment(companyId, "companyId");
  const normalizedTicketId = readDocumentSegment(ticketId, "ticketId");
  const date = genteCrystalCostaRicaDateKey(record?.saleAt);
  if (!date) return null;

  let dailyValue;
  if (record?.status === "deleted") {
    dailyValue = FieldValue.delete();
  } else {
    dailyValue = buildGenteCrystalDailyEntry(record);
    if (!dailyValue) return null;
  }

  return {
    dailyPath: `genteCrystalSales/${normalizedCompanyId}/daily/${date}`,
    data: {
      sales: {
        [normalizedTicketId]: dailyValue,
      },
    },
    options: {
      mergeFields: [new FieldPath("sales", normalizedTicketId)],
    },
  };
}

function readDocumentData(document) {
  if (!document || typeof document !== "object") return undefined;
  return typeof document.data === "function" ? document.data() : document.data;
}

function addTotal(totals, date, monto) {
  const current = totals.get(date) ?? { count: 0, total: 0 };
  current.count += 1;
  current.total += monto;
  totals.set(date, current);
}

function sortedTotals(totals) {
  return Object.fromEntries(
    [...totals.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

const MINIMAL_ENTRY_FIELDS = [
  "captureOrigin",
  "monto",
  "saleAt",
  "sorteo",
  "status",
];

function canonicalEntry(record) {
  const entry = buildGenteCrystalDailyEntry(record);
  if (!entry) return null;
  return {
    sorteo: entry.sorteo,
    captureOrigin: entry.captureOrigin,
    monto: entry.monto,
    saleAt: entry.saleAt.toISOString(),
    status: entry.status,
  };
}

function isExactMinimalEntry(record, entry) {
  if (!record || typeof record !== "object" || !entry) return false;
  const fields = Object.keys(record).sort((left, right) =>
    left.localeCompare(right),
  );
  return (
    fields.length === MINIMAL_ENTRY_FIELDS.length &&
    fields.every((field, index) => field === MINIMAL_ENTRY_FIELDS[index]) &&
    record.sorteo === entry.sorteo &&
    record.captureOrigin === entry.captureOrigin &&
    record.monto === entry.monto &&
    record.status === entry.status
  );
}

function entriesMatch(expected, actual) {
  return (
    expected.sorteo === actual.sorteo &&
    expected.captureOrigin === actual.captureOrigin &&
    expected.monto === actual.monto &&
    expected.saleAt === actual.saleAt &&
    expected.status === actual.status
  );
}

export function compareDailyTotals(individualDocuments, dailyDocuments) {
  const individualTotals = new Map();
  const expectedEntries = new Map();
  for (const document of individualDocuments) {
    const data = readDocumentData(document);
    const entry = buildGenteCrystalDailyEntry(data);
    const date = genteCrystalCostaRicaDateKey(data?.saleAt);
    if (entry && date) {
      addTotal(individualTotals, date, entry.monto);
      expectedEntries.set(document.id, {
        date,
        entry: canonicalEntry(data),
      });
    }
  }

  const dailyTotals = new Map();
  const actualEntries = new Map();
  for (const document of dailyDocuments) {
    const date = typeof document?.id === "string" ? document.id : "";
    const data = readDocumentData(document);
    const sales =
      data?.sales && typeof data.sales === "object" && !Array.isArray(data.sales)
        ? Object.entries(data.sales)
        : [];
    for (const [ticketId, sale] of sales) {
      const entry = buildGenteCrystalDailyEntry(sale);
      if (date && entry) addTotal(dailyTotals, date, entry.monto);
      const canonical = canonicalEntry(sale);
      const locations = actualEntries.get(ticketId) ?? [];
      locations.push({
        date,
        exactMinimalEntry: isExactMinimalEntry(sale, canonical),
        entry: canonical,
      });
      actualEntries.set(ticketId, locations);
    }
  }

  const individual = sortedTotals(individualTotals);
  const daily = sortedTotals(dailyTotals);
  const dates = [...new Set([...individualTotals.keys(), ...dailyTotals.keys()])]
    .sort((left, right) => left.localeCompare(right));
  const mismatches = dates.flatMap((date) => {
    const expected = individual[date] ?? { count: 0, total: 0 };
    const actual = daily[date] ?? { count: 0, total: 0 };
    return expected.count === actual.count && expected.total === actual.total
      ? []
      : [{ date, individual: expected, daily: actual }];
  });
  const ticketIds = [
    ...new Set([...expectedEntries.keys(), ...actualEntries.keys()]),
  ].sort((left, right) => left.localeCompare(right));
  const entryMismatches = ticketIds.flatMap((ticketId) => {
    const expected = expectedEntries.get(ticketId) ?? null;
    const actual = actualEntries.get(ticketId) ?? [];
    const matches =
      expected &&
      actual.length === 1 &&
      actual[0].date === expected.date &&
      actual[0].exactMinimalEntry &&
      actual[0].entry &&
      entriesMatch(expected.entry, actual[0].entry);
    return matches ? [] : [{ ticketId, expected, actual }];
  });

  return {
    ok: mismatches.length === 0 && entryMismatches.length === 0,
    individual,
    daily,
    mismatches,
    entryMismatches,
  };
}

function readServiceAccount(raw) {
  if (!raw?.trim()) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is required.");
  }
  const parsed = JSON.parse(raw);
  const projectId = parsed.project_id || parsed.projectId;
  const clientEmail = parsed.client_email || parsed.clientEmail;
  const rawPrivateKey = parsed.private_key || parsed.privateKey;
  const privateKey =
    typeof rawPrivateKey === "string"
      ? rawPrivateKey.replace(/\\n/g, "\n")
      : undefined;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is missing required service-account fields.",
    );
  }
  return { projectId, clientEmail, privateKey };
}

async function loadFirestoreRuntime() {
  const nextEnv = await import("@next/env");
  const loadEnvConfig = nextEnv.loadEnvConfig || nextEnv.default?.loadEnvConfig;
  if (typeof loadEnvConfig !== "function") {
    throw new Error("Next.js environment loader is unavailable.");
  }

  const [{ cert, getApps, initializeApp }, { getFirestore }] = await Promise.all([
    import("firebase-admin/app"),
    import("firebase-admin/firestore"),
  ]);
  return { loadEnvConfig, cert, getApps, initializeApp, getFirestore };
}

export async function loadFirestore(databaseId, dependencies = {}) {
  const normalizedDatabaseId = readDocumentSegment(databaseId, "databaseId");
  const runtime = await (dependencies.loadRuntime ?? loadFirestoreRuntime)();
  runtime.loadEnvConfig(process.cwd());
  const env = dependencies.env ?? process.env;
  const serviceAccount = readServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_KEY);
  const app =
    runtime.getApps()[0] ??
    runtime.initializeApp({
      credential: runtime.cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  return runtime.getFirestore(app, normalizedDatabaseId);
}

async function readBackfillDocuments(firestore, companyId) {
  const companyRef = firestore.collection("genteCrystalSales").doc(companyId);
  const [individualSnapshot, dailySnapshot] = await Promise.all([
    companyRef.collection("sales").get(),
    companyRef.collection("daily").get(),
  ]);
  return {
    individualDocuments: individualSnapshot.docs,
    dailyDocuments: dailySnapshot.docs,
  };
}

export async function applyBackfill(
  firestore,
  companyId,
  individualDocuments,
) {
  for (const saleDocument of individualDocuments) {
    const saleRef = saleDocument.ref;
    await firestore.runTransaction(async (transaction) => {
      const current = await transaction.get(saleRef);
      if (!current.exists) return;
      const mutation = buildBackfillMutation(
        companyId,
        current.id,
        current.data(),
      );
      if (!mutation) return;
      transaction.set(
        firestore.doc(mutation.dailyPath),
        mutation.data,
        mutation.options,
      );
    });
  }
}

async function main(argv = process.argv.slice(2)) {
  const options = parseBackfillArgs(argv);
  const firestore = await loadFirestore(options.databaseId);
  let documents = await readBackfillDocuments(firestore, options.companyId);

  if (options.mode === "apply") {
    await applyBackfill(
      firestore,
      options.companyId,
      documents.individualDocuments,
    );
    documents = await readBackfillDocuments(firestore, options.companyId);
  }

  const comparison = compareDailyTotals(
    documents.individualDocuments,
    documents.dailyDocuments,
  );
  console.log(
    JSON.stringify(
      {
        ok: comparison.ok,
        mode: options.mode,
        companyId: options.companyId,
        databaseId: options.databaseId,
        individualDocuments: documents.individualDocuments.length,
        dailyDocuments: documents.dailyDocuments.length,
        comparison,
      },
      null,
      2,
    ),
  );
  if (!comparison.ok) process.exitCode = 1;
}

const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
