const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadHelper() {
  const helperPath = path.join(__dirname, "providerTypesOwner.ts");
  const source = fs.readFileSync(helperPath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
    },
  }).outputText;
  const mod = { exports: {} };
  const fn = new Function(
    "exports",
    "require",
    "module",
    "__filename",
    "__dirname",
    compiled,
  );
  fn(mod.exports, require, mod, helperPath, __dirname);
  return mod.exports;
}

const { resolveProviderTypesOwnerId } = loadHelper();

test("selected company owner wins over superadmin allowed owner", () => {
  const ownerId = resolveProviderTypesOwnerId({
    adminCompany: "Empresa B",
    allowedOwnerIds: new Set(["superadmin-owner"]),
    canSelectCompany: true,
    ownerCompanies: [
      { id: "a", name: "Empresa A", ownerId: "owner-a" },
      { id: "b", name: "Empresa B", ownerId: "owner-b" },
    ],
    user: { id: "superadmin", ownerId: "superadmin-owner" },
  });

  assert.equal(ownerId, "owner-b");
});

test("selected company with no matching owner returns empty for company selector", () => {
  const ownerId = resolveProviderTypesOwnerId({
    adminCompany: "Empresa C",
    allowedOwnerIds: new Set(["superadmin-owner"]),
    canSelectCompany: true,
    ownerCompanies: [
      { id: "a", name: "Empresa A", ownerId: "owner-a" },
      { id: "b", name: "Empresa B", ownerId: "owner-b" },
    ],
    user: { id: "superadmin", ownerId: "superadmin-owner" },
  });

  assert.equal(ownerId, "");
});

test("selected company with blank owner returns empty for company selector", () => {
  const ownerId = resolveProviderTypesOwnerId({
    adminCompany: "Empresa B",
    allowedOwnerIds: new Set(["superadmin-owner"]),
    canSelectCompany: true,
    ownerCompanies: [{ id: "b", name: "Empresa B", ownerId: "  " }],
    user: { id: "superadmin", ownerId: "superadmin-owner" },
  });

  assert.equal(ownerId, "");
});

test("non selector user keeps direct owner fallback", () => {
  const ownerId = resolveProviderTypesOwnerId({
    adminCompany: "",
    allowedOwnerIds: new Set(["owner-a"]),
    canSelectCompany: false,
    ownerCompanies: [],
    user: { id: "user-a", ownerId: "owner-a" },
  });

  assert.equal(ownerId, "owner-a");
});

test("selected company match ignores case and repeated spaces", () => {
  const ownerId = resolveProviderTypesOwnerId({
    adminCompany: "  empresa   b  ",
    allowedOwnerIds: new Set(["superadmin-owner"]),
    canSelectCompany: true,
    ownerCompanies: [{ id: "b", name: "Empresa B", ownerId: "owner-b" }],
    user: { id: "superadmin", ownerId: "superadmin-owner" },
  });

  assert.equal(ownerId, "owner-b");
});
