import path from "node:path";
import { pathToFileURL } from "node:url";
import { isFacturaPendingForClosing } from "../src/lib/factura-pending.ts";

const USAGE =
  'Usage: npm run backfill:factura-pending-index -- --company "<name>" --database "<id>" (--apply | --verify-only)';

const readDocumentSegment = (value, flag) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 200 || normalized.includes("/")) {
    throw new Error(`${flag} must be a non-empty Firestore document segment.`);
  }
  return normalized;
};

export function parsePendingBackfillArgs(argv) {
  let company;
  let databaseId;
  let apply = false;
  let verifyOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--company" || argument === "--database") {
      const value = argv[index + 1];
      if (typeof value !== "string" || value.startsWith("--")) {
        throw new Error(`${argument} requires a value that is not another flag.`);
      }
      if (argument === "--company") {
        if (company !== undefined) throw new Error(`--company may be provided only once. ${USAGE}`);
        company = value;
      } else {
        if (databaseId !== undefined) throw new Error(`--database may be provided only once. ${USAGE}`);
        databaseId = value;
      }
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

  const normalizedCompany = readDocumentSegment(company, "--company");
  const normalizedDatabaseId = readDocumentSegment(databaseId, "--database");
  if (apply && verifyOnly) {
    throw new Error("--apply and --verify-only cannot be combined.");
  }
  if (!apply && !verifyOnly) {
    throw new Error(`Exactly one of --apply or --verify-only is required. ${USAGE}`);
  }

  return {
    company: normalizedCompany,
    databaseId: normalizedDatabaseId,
    mode: apply ? "apply" : "verify-only",
  };
}

export function buildFacturaEmpresaDocId(company) {
  const normalized = readDocumentSegment(company, "company");
  return normalized
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/\//g, "-")
    .slice(0, 200);
}

const readDocumentData = (document) => {
  if (!document || typeof document !== "object") return {};
  return typeof document.data === "function" ? document.data() : document.data || {};
};

export function comparePendingIndex(allDocuments, indexedDocuments) {
  const expectedPendingIds = [];
  const flagMismatches = [];

  for (const document of allDocuments) {
    const data = readDocumentData(document);
    const expected = isFacturaPendingForClosing(data);
    const actual = data?.isPendingForClosing;
    if (expected) expectedPendingIds.push(document.id);
    if (actual !== expected) {
      flagMismatches.push({ id: document.id, expected, actual });
    }
  }

  expectedPendingIds.sort((left, right) => left.localeCompare(right));
  const indexedPendingIds = indexedDocuments
    .map((document) => String(document?.id || ""))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const expectedSet = new Set(expectedPendingIds);
  const indexedSet = new Set(indexedPendingIds);
  const missingFromIndex = expectedPendingIds.filter((id) => !indexedSet.has(id));
  const unexpectedInIndex = indexedPendingIds.filter((id) => !expectedSet.has(id));

  return {
    ok:
      flagMismatches.length === 0 &&
      missingFromIndex.length === 0 &&
      unexpectedInIndex.length === 0,
    expectedPendingIds,
    indexedPendingIds,
    missingFromIndex,
    unexpectedInIndex,
    flagMismatches,
  };
}

export async function applyPendingBackfill(firestore, documents) {
  const totals = { scanned: 0, changed: 0, unchanged: 0 };
  for (const document of documents) {
    totals.scanned += 1;
    await firestore.runTransaction(async (transaction) => {
      const current = await transaction.get(document.ref);
      if (!current.exists) {
        totals.unchanged += 1;
        return;
      }
      const data = current.data();
      const expected = isFacturaPendingForClosing(data);
      if (data?.isPendingForClosing === expected) {
        totals.unchanged += 1;
        return;
      }
      transaction.set(
        document.ref,
        { isPendingForClosing: expected },
        { merge: true },
      );
      totals.changed += 1;
    });
  }
  return totals;
}

const readServiceAccount = (raw) => {
  if (!raw?.trim()) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is required.");
  const parsed = JSON.parse(raw);
  const projectId = parsed.project_id || parsed.projectId;
  const clientEmail = parsed.client_email || parsed.clientEmail;
  const rawPrivateKey = parsed.private_key || parsed.privateKey;
  const privateKey =
    typeof rawPrivateKey === "string"
      ? rawPrivateKey.replace(/\\n/g, "\n")
      : undefined;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is missing required service-account fields.");
  }
  return { projectId, clientEmail, privateKey };
};

const loadFirestoreRuntime = async () => {
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
};

export async function loadPendingBackfillFirestore(databaseId, dependencies = {}) {
  const normalizedDatabaseId = readDocumentSegment(databaseId, "databaseId");
  const runtime = await (dependencies.loadRuntime ?? loadFirestoreRuntime)();
  runtime.loadEnvConfig(process.cwd());
  const account = readServiceAccount(
    (dependencies.env ?? process.env).FIREBASE_SERVICE_ACCOUNT_KEY,
  );
  const app =
    runtime.getApps()[0] ??
    runtime.initializeApp({
      credential: runtime.cert(account),
      projectId: account.projectId,
    });
  return {
    firestore: runtime.getFirestore(app, normalizedDatabaseId),
    projectId: account.projectId,
  };
}

export async function readPendingBackfillDocuments(firestore, company) {
  const companyId = buildFacturaEmpresaDocId(company);
  const movements = firestore
    .collection("Facturas")
    .doc(companyId)
    .collection("movements");
  const [allSnapshot, indexedSnapshot] = await Promise.all([
    movements.get(),
    movements
      .where("isPendingForClosing", "==", true)
      .orderBy("createdAt", "desc")
      .get(),
  ]);
  return {
    allDocuments: allSnapshot.docs,
    indexedDocuments: indexedSnapshot.docs,
  };
}

export async function runPendingBackfill(options, dependencies = {}) {
  const loaded = dependencies.firestore
    ? {
        firestore: dependencies.firestore,
        projectId: dependencies.projectId || "injected-project",
      }
    : await loadPendingBackfillFirestore(options.databaseId, dependencies);
  const readDocuments =
    dependencies.readDocuments ?? readPendingBackfillDocuments;

  console.log(
    JSON.stringify({
      projectId: loaded.projectId,
      databaseId: options.databaseId,
      company: options.company,
      mode: options.mode,
    }),
  );

  let documents = await readDocuments(loaded.firestore, options.company);
  let application = null;
  if (options.mode === "apply") {
    application = await applyPendingBackfill(
      loaded.firestore,
      documents.allDocuments,
    );
    documents = await readDocuments(loaded.firestore, options.company);
  }
  const comparison = comparePendingIndex(
    documents.allDocuments,
    documents.indexedDocuments,
  );
  return {
    ok: comparison.ok,
    projectId: loaded.projectId,
    databaseId: options.databaseId,
    company: options.company,
    mode: options.mode,
    scannedDocuments: documents.allDocuments.length,
    indexedDocuments: documents.indexedDocuments.length,
    application,
    comparison,
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parsePendingBackfillArgs(argv);
  const result = await runPendingBackfill(options);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
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
