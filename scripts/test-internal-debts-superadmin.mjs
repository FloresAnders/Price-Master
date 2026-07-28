import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs
  .readFileSync("src/services/internal-debts.ts", "utf8")
  .replace(/^import .*;\r?\n/gm, "")
  .replace(/\bexport\s+/g, "");

const compiled = ts.transpileModule(
  `${source}
globalThis.__internalDebtTest = { applyInternalDebtMovement };`,
  { compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 } },
).outputText;

const context = {
  crypto: { randomUUID: () => "movement-test-id" },
};
vm.createContext(context);
vm.runInContext(compiled, context);

const { applyInternalDebtMovement } = context.__internalDebtTest;

const baseDebt = {
  id: "debt-1",
  ownerId: "owner-1",
  debtor: { type: "user", id: "debtor-1", name: "User deudor", roleLabel: "Usuario" },
  creditor: { type: "user", id: "admin-1", name: "Admin acreedor", roleLabel: "Admin" },
  participantIds: ["user:debtor-1", "user:admin-1"],
  amountOriginal: 1000,
  balance: 1000,
  reason: "Inicial",
  date: "2026-07-27",
  status: "open",
  movements: [],
  createdAt: new Date("2026-07-27T00:00:00Z"),
  updatedAt: new Date("2026-07-27T00:00:00Z"),
  createdById: "debtor-1",
  createdByName: "User deudor",
};

const adminPayment = applyInternalDebtMovement(
  baseDebt,
  {
    type: "payment",
    amount: 300,
    reason: "Abono superadmin",
    date: "2026-07-27",
    createdById: "super-1",
    createdByName: "Super Admin",
  },
  ["user:super-1", "role:superadmin"],
  true,
);

assert.equal(adminPayment.balance, 700);
assert.equal(adminPayment.movements.at(-1).type, "payment");

const adminCharge = applyInternalDebtMovement(
  baseDebt,
  {
    type: "charge",
    amount: 250,
    reason: "Cargo superadmin",
    date: "2026-07-27",
    createdById: "super-1",
    createdByName: "Super Admin",
  },
  ["user:super-1", "role:superadmin"],
  true,
);

assert.equal(adminCharge.balance, 1250);
assert.equal(adminCharge.movements.at(-1).type, "charge");

assert.throws(
  () =>
    applyInternalDebtMovement(
      baseDebt,
      {
        type: "payment",
        amount: 100,
        reason: "Sentinel falso",
        date: "2026-07-27",
        createdById: "user-falso",
        createdByName: "Usuario falso",
      },
      ["user:user-falso", "role:superadmin"],
    ),
  /Solo el acreedor puede registrar abonos/,
);

console.log("internal debts superadmin movement tests passed");
