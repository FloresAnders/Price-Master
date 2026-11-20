import path from "node:path";
import { pathToFileURL } from "node:url";

const DATABASE_IDS = new Set(["(default)", "restauracion"]);
const ACCESS_FIELDS = [
  "accessAccountId",
  "accessEmployeeId",
  "accessEnabled",
  "accessUsername",
  "inheritedFromUserId",
  "inheritedFromUserName",
];

export function parseCleanAccessArgs(argv) {
  let databaseId;
  let apply = false;
  let allowProduction = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--database") {
      if (databaseId !== undefined) {
        throw new Error("--database may be provided only once.");
      }
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--database requires (default) or restauracion.");
      }
      databaseId = value.trim();
      if (databaseId.toLowerCase() === "default") databaseId = "(default)";
      index += 1;
      continue;
    }
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (argument === "--allow-production") {
      allowProduction = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!databaseId) throw new Error("--database is required.");
  if (!DATABASE_IDS.has(databaseId)) {
    throw new Error("--database must be exactly (default) or restauracion.");
  }
  if (databaseId === "(default)" && !allowProduction) {
    throw new Error(
      "Refusing production database: add --allow-production and review first.",
    );
  }
  return { databaseId, apply };
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase();
}

function normalizeCompany(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

async function main() {
  const options = parseCleanAccessArgs(process.argv.slice(2));
  const nextEnv = await import("@next/env");
  const loadEnvConfig =
    nextEnv.loadEnvConfig || nextEnv.default?.loadEnvConfig;
  if (typeof loadEnvConfig !== "function") {
    throw new Error("Next.js environment loader is unavailable.");
  }
  loadEnvConfig(process.cwd());

  const [{ cert, getApps, initializeApp }, firestoreAdmin] = await Promise.all([
    import("firebase-admin/app"),
    import("firebase-admin/firestore"),
  ]);
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!rawServiceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is required.");
  }
  const parsed = JSON.parse(rawServiceAccount);
  const projectId = parsed.project_id || parsed.projectId;
  const clientEmail = parsed.client_email || parsed.clientEmail;
  const rawPrivateKey = parsed.private_key || parsed.privateKey;
  const privateKey =
    typeof rawPrivateKey === "string"
      ? rawPrivateKey.replace(/\\n/g, "\n")
      : null;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_KEY.");
  }

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  const db =
    options.databaseId === "(default)"
      ? firestoreAdmin.getFirestore(app)
      : firestoreAdmin.getFirestore(app, options.databaseId);

  const [companySnapshot, userSnapshot] = await Promise.all([
    db.collection("empresas").get(),
    db.collection("users").get(),
  ]);
  const users = new Map(
    userSnapshot.docs.map((doc) => [
      doc.id,
      { id: doc.id, ...doc.data() },
    ]),
  );

  const report = [];
  for (const companyDoc of companySnapshot.docs) {
    const companyId = companyDoc.id;
    const company = companyDoc.data() || {};
    const employees = Array.isArray(company.empleados) ? company.empleados : [];
    let changed = false;
    const cleanedEmployees = employees.map((rawEmployee) => {
      const employee =
        rawEmployee && typeof rawEmployee === "object"
          ? { ...rawEmployee }
          : rawEmployee;
      if (!employee || typeof employee !== "object") return employee;

      const accountId = String(employee.accessAccountId || "").trim();
      const hasAccessFields = ACCESS_FIELDS.some(
        (field) => employee[field] !== undefined,
      );
      if (!accountId) {
        if (!hasAccessFields) return employee;
        ACCESS_FIELDS.forEach((field) => delete employee[field]);
        changed = true;
        report.push({
          companyId,
          employee:
            String(employee.Empleado || employee.name || "").trim(),
          reason: "Sin accessAccountId.",
        });
        return employee;
      }

      const account = users.get(accountId);
      const employeeName = normalizeName(
        employee.Empleado || employee.name,
      );
      const accountName = normalizeName(account?.name);
      const accountFullName = normalizeName(account?.fullName);
      const matchesCompany =
        account &&
        normalizeCompany(account.collaboratorEmpresaId) ===
          normalizeCompany(companyId);
      const matchesEmployee =
        account &&
        account.accountType === "collaborator" &&
        (
          accountName === employeeName ||
          accountFullName === employeeName
        );

      if (!account || !matchesCompany || !matchesEmployee) {
        ACCESS_FIELDS.forEach((field) => delete employee[field]);
        changed = true;
        report.push({
          companyId,
          employee:
            String(employee.Empleado || employee.name || "").trim(),
          accountId,
          reason: account
            ? "Cuenta no corresponde a empresa o colaborador."
            : "Cuenta colaborador inexistente.",
        });
      }
      return employee;
    });

    if (changed && options.apply) {
      await companyDoc.ref.set(
        { empleados: cleanedEmployees, updatedAt: new Date() },
        { merge: true },
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        databaseId: options.databaseId,
        mode: options.apply ? "apply" : "dry-run",
        changedCompanies: report.length,
        report,
      },
      null,
      2,
    ),
  );
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
