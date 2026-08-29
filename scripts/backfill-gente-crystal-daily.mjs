import path from "node:path";
import { pathToFileURL } from "node:url";
import { FieldValue } from "firebase-admin/firestore";
import {
  buildGenteCrystalDailyEntry,
  genteCrystalCostaRicaDateKey,
} from "../src/lib/gente-crystal/daily-sales.ts";

const USAGE =
  'Usage: npm run backfill:gente-crystal-daily -- --company "<id>" (--apply | --verify-only)';

function readDocumentSegment(value, flag) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 160 || normalized.includes("/")) {
    throw new Error(`${flag} must be a non-empty Firestore document segment.`);
  }
  return normalized;
}

export function parseBackfillArgs(argv) {
  let companyId;
  let apply = false;
  let verifyOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--company") {
      if (companyId !== undefined) {
        throw new Error(`--company may be provided only once. ${USAGE}`);
      }
      companyId = argv[index + 1];
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
  if (apply && verifyOnly) {
    throw new Error("--apply and --verify-only cannot be combined.");
  }
  if (!apply && !verifyOnly) {
    throw new Error(`Exactly one of --apply or --verify-only is required. ${USAGE}`);
  }

  return {
    companyId: normalizedCompanyId,
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

export function compareDailyTotals(individualDocuments, dailyDocuments) {
  const individualTotals = new Map();
  for (const document of individualDocuments) {
    const data = readDocumentData(document);
    const entry = buildGenteCrystalDailyEntry(data);
    const date = genteCrystalCostaRicaDateKey(data?.saleAt);
    if (entry && date) addTotal(individualTotals, date, entry.monto);
  }

  const dailyTotals = new Map();
  for (const document of dailyDocuments) {
    const date = typeof document?.id === "string" ? document.id : "";
    const data = readDocumentData(document);
    const sales =
      data?.sales && typeof data.sales === "object" && !Array.isArray(data.sales)
        ? Object.values(data.sales)
        : [];
    for (const sale of sales) {
      const entry = buildGenteCrystalDailyEntry(sale);
      if (date && entry) addTotal(dailyTotals, date, entry.monto);
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

  return {
    ok: mismatches.length === 0,
    individual,
    daily,
    mismatches,
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

async function loadFirestore() {
  const nextEnv = await import("@next/env");
  const loadEnvConfig = nextEnv.loadEnvConfig || nextEnv.default?.loadEnvConfig;
  if (typeof loadEnvConfig !== "function") {
    throw new Error("Next.js environment loader is unavailable.");
  }
  loadEnvConfig(process.cwd());

  const [{ cert, getApps, initializeApp }, { getFirestore }] = await Promise.all([
    import("firebase-admin/app"),
    import("firebase-admin/firestore"),
  ]);
  const serviceAccount = readServiceAccount(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
  );
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  const databaseId =
    process.env.FIRESTORE_DATABASE_ID?.trim() ||
    (process.env.NODE_ENV === "production" ? "restauracion" : "");
  return {
    databaseId: databaseId || "(default)",
    firestore: databaseId ? getFirestore(app, databaseId) : getFirestore(app),
  };
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

async function applyBackfill(firestore, companyId, individualDocuments) {
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
      transaction.set(firestore.doc(mutation.dailyPath), mutation.data, {
        merge: true,
      });
    });
  }
}

async function main(argv = process.argv.slice(2)) {
  const options = parseBackfillArgs(argv);
  const { databaseId, firestore } = await loadFirestore();
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
        databaseId,
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
