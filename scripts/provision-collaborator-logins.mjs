import argon2 from "argon2";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DATABASE_IDS = new Set(["(default)", "restauracion"]);

export function normalizeName(value) {
  return String(value || "")
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase();
}

export function normalizeCompanyName(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

export function slugifyEmployee(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "colaborador";
}

export function parseCollaboratorProvisionArgs(argv) {
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
      if (databaseId.toLowerCase() === "default") {
        databaseId = "(default)";
      }
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

  if (!databaseId) {
    throw new Error("--database is required.");
  }
  if (!DATABASE_IDS.has(databaseId)) {
    throw new Error("--database must be exactly (default) or restauracion.");
  }
  if (databaseId === "(default)" && !allowProduction) {
    throw new Error(
      "Refusing production database: add --allow-production and review first.",
    );
  }

  return { databaseId, apply, allowProduction };
}

function companyIdentityMatches(companyId, company, data) {
  const identifiers = new Set(
    [companyId, company.name, company.ubicacion]
      .map(normalizeCompanyName)
      .filter(Boolean),
  );
  return identifiers.has(normalizeCompanyName(data.ownercompanie));
}

function resolveParentAccount(companyId, company, users) {
  const exact = users.filter((user) => {
    if (user.role === "superadmin" || user.isActive === false) return false;
    return companyIdentityMatches(companyId, company, user);
  });
  if (exact.length > 0) {
    const assignedUser = exact.find(
      (user) => user.role === "user" && user.eliminate !== true,
    );
    if (assignedUser) return assignedUser;

    if (exact.length === 1) return exact[0];

    const activeAdmin = exact.find(
      (user) => user.eliminate !== true && user.role === "admin",
    );
    if (activeAdmin) return activeAdmin;
  }

  const ownerId = String(company.ownerId || "").trim();
  if (ownerId) {
    const sameOwner = users.find(
      (user) =>
        user.role !== "superadmin" &&
        user.isActive !== false &&
        (
          String(user.ownerId || "").trim() === ownerId ||
          String(user.id || "").trim() === ownerId
        ),
    );
    if (sameOwner) return sameOwner;
  }

  return null;
}

async function main() {
  const options = parseCollaboratorProvisionArgs(process.argv.slice(2));
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
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is missing project_id, client_email, or private_key.",
    );
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
  const users = userSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const activeCompanies = companySnapshot.docs
    .filter((doc) => doc.data().isActive !== false)
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

  const candidates = [];
  for (const company of activeCompanies) {
    const parent = resolveParentAccount(company.id, company, users);
    const embedded = Array.isArray(company.empleados) ? company.empleados : [];

    const collectionSnapshot = await db
      .collection("empleados")
      .where("empresaId", "==", company.id)
      .get();
    const collectionEmployees = collectionSnapshot.docs.map((doc) => ({
      ...doc.data(),
      Empleado: doc.data().Empleado || doc.data().name || "",
      accessEmployeeId: doc.id,
    }));

    const employeesByName = new Map();
    for (const employee of [...embedded, ...collectionEmployees]) {
      const name = String(employee.Empleado || employee.name || "").trim();
      if (!name) continue;
      const normalized = normalizeName(name);
      if (!employeesByName.has(normalized)) {
        employeesByName.set(normalized, employee);
      }
    }

    for (const [normalizedName, employee] of employeesByName) {
      candidates.push({
        company,
        parent,
        employee,
        name: String(employee.Empleado || employee.name || "").trim(),
        normalizedName,
      });
    }
  }

  const namesCount = new Map();
  for (const candidate of candidates) {
    namesCount.set(
      candidate.normalizedName,
      (namesCount.get(candidate.normalizedName) || 0) + 1,
    );
  }

  const existingByNormalizedName = new Map();
  for (const user of users) {
    const normalized =
      normalizeName(user.nameNormalized || user.name);
    if (normalized) existingByNormalizedName.set(normalized, user);
  }

  const report = [];
  for (const candidate of candidates) {
    if (!candidate.parent) {
      report.push({
        action: "conflict",
        companyId: candidate.company.id,
        employee: candidate.name,
        reason: "No existe cuenta empresarial activa asignada a esta empresa.",
      });
      continue;
    }

    const loginName =
      namesCount.get(candidate.normalizedName) > 1
        ? `${candidate.name}-${slugifyEmployee(candidate.company.id)}`
        : candidate.name;
    const normalizedLoginName = normalizeName(loginName);
    const existing = existingByNormalizedName.get(normalizedLoginName);
    if (
      existing &&
      existing.accountType !== "collaborator"
    ) {
      report.push({
        action: "conflict",
        companyId: candidate.company.id,
        employee: candidate.name,
        reason: `La credencial ${loginName} coincide con una cuenta empresarial existente.`,
      });
      continue;
    }

    report.push({
      action: existing ? "update" : "create",
      companyId: candidate.company.id,
      employee: candidate.name,
      loginName,
      accountId: existing?.id || null,
      inheritedFromUserId: candidate.parent.id,
      inheritedFromUserName:
        candidate.parent.fullName ||
        candidate.parent.name ||
        candidate.parent.email ||
        candidate.parent.id,
    });
  }

  if (!options.apply) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          databaseId: options.databaseId,
          mode: "dry-run",
          activeCompanies: activeCompanies.length,
          collaborators: candidates.length,
          report,
        },
        null,
        2,
      ),
    );
    return;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const item = report.find(
      (entry) =>
        entry.companyId === candidate.company.id &&
        normalizeName(entry.employee) === candidate.normalizedName,
    );
    if (!item || item.action === "conflict") {
      skipped += 1;
      continue;
    }

    const loginName = item.loginName || candidate.name;
    const normalizedLoginName = normalizeName(loginName);
    const passwordHash = await argon2.hash(loginName, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
    const employeeId =
      candidate.employee.accessEmployeeId ||
      `${slugifyEmployee(candidate.company.id)}__${slugifyEmployee(candidate.name)}`;
    const accountRef = item.accountId
      ? db.collection("users").doc(item.accountId)
      : db.collection("users").doc();

    await db.runTransaction(async (transaction) => {
      const accountSnapshot = await transaction.get(accountRef);
      const companyRef = db.collection("empresas").doc(candidate.company.id);
      const companySnapshot = await transaction.get(companyRef);

      const accountData = {
        name: loginName,
        nameNormalized: normalizedLoginName,
        password: passwordHash,
        role: "user",
        isActive: true,
        eliminate: false,
        ownerId: candidate.parent.ownerId || candidate.parent.id,
        ownercompanie:
          candidate.company.name ||
          candidate.company.ubicacion ||
          candidate.company.id,
        createdById: candidate.parent.id,
        accountType: "collaborator",
        inheritedFromUserId: candidate.parent.id,
        collaboratorEmpresaId: candidate.company.id,
        collaboratorEmployeeId: employeeId,
        fullName: candidate.name,
        permissions: firestoreAdmin.FieldValue.delete(),
        updatedAt: new Date(),
        ...(accountSnapshot.exists ? {} : { createdAt: new Date() }),
      };
      if (!companySnapshot.exists) return;

      transaction.set(accountRef, accountData, { merge: true });

      const companyData = companySnapshot.data() || {};
      const empleados = Array.isArray(companyData.empleados)
        ? [...companyData.empleados]
        : [];
      const employeeIndex = empleados.findIndex(
        (employee) =>
          normalizeName(employee.Empleado || employee.name) ===
            candidate.normalizedName ||
          String(employee.accessEmployeeId || "") ===
            String(employeeId),
      );
      const employeeData = {
        ...(employeeIndex >= 0 ? empleados[employeeIndex] : candidate.employee),
        Empleado: candidate.name,
        accessEnabled: true,
        accessUsername: loginName,
        accessAccountId: accountRef.id,
        accessEmployeeId: employeeId,
        inheritedFromUserId: candidate.parent.id,
        inheritedFromUserName:
          candidate.parent.fullName ||
          candidate.parent.name ||
          candidate.parent.email ||
          candidate.parent.id,
      };
      if (employeeIndex >= 0) empleados[employeeIndex] = employeeData;
      else empleados.push(employeeData);
      transaction.set(
        companyRef,
        { empleados, updatedAt: new Date() },
        { merge: true },
      );
    });

    if (item.action === "create") created += 1;
    else updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        databaseId: options.databaseId,
        mode: "apply",
        activeCompanies: activeCompanies.length,
        collaborators: candidates.length,
        created,
        updated,
        skipped,
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
