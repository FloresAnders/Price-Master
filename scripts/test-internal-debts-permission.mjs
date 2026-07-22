import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import vm from "node:vm";
import ts from "typescript";

const types = readFileSync("src/types/firestore.ts", "utf8");
const permissions = readFileSync("src/utils/permissions.ts", "utf8");
const manager = readFileSync("src/components/auth/UserPermissionsManager.tsx", "utf8");
const dataEditor = readFileSync("src/edit/DataEditor.tsx", "utf8");

assert.match(types, /deudasInternas\?: boolean/);
assert.match(permissions, /deudasInternas: true/);
assert.match(permissions, /deudasInternas: false/);
assert.match(manager, /deudasInternas: "Deudas internas"/);
assert.match(manager, /deudas internas entre empresas y personas/i);
assert.match(dataEditor, /"deudasInternas"/);
assert.match(dataEditor, /deudasInternas: "Deudas internas"/);

const transpiled = ts.transpileModule(permissions, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const sandbox = {
  exports: {},
  require(name) {
    if (name.endsWith("../types/firestore")) return {};
    throw new Error(`Unexpected require: ${name}`);
  },
};
sandbox.module = { exports: sandbox.exports };
vm.runInNewContext(transpiled, sandbox);

const { getDefaultPermissions, getAllPermissions, getNoPermissions } =
  sandbox.module.exports;

assert.equal(getDefaultPermissions("superadmin").deudasInternas, true);
assert.equal(getDefaultPermissions("admin").deudasInternas, true);
assert.equal(getDefaultPermissions("user").deudasInternas, false);
assert.equal(getAllPermissions().deudasInternas, true);
assert.equal(getNoPermissions().deudasInternas, false);
