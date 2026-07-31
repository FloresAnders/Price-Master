import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs
  .readFileSync("src/app/fondogeneral/deudasinternas/paidDebtReceipt.ts", "utf8")
  .replace(/^import .*;\r?\n/gm, "")
  .replace(/\bexport\s+/g, "");

const compiled = ts.transpileModule(
`${source}
globalThis.__paidDebtReceiptTest = {
  buildPaidInternalDebtReceiptData,
  buildPaidInternalDebtReceiptFileName,
  buildPaidInternalDebtReceiptStoragePath,
};`,
  {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;

const context = {};
vm.createContext(context);
vm.runInContext(compiled, context);

const {
  buildPaidInternalDebtReceiptData,
  buildPaidInternalDebtReceiptFileName,
  buildPaidInternalDebtReceiptStoragePath,
} = context.__paidDebtReceiptTest;

const paidDebt = {
  id: "debt-1",
  ownerId: "owner-1",
  debtor: { type: "user", id: "debtor-1", name: "Ana Maria", roleLabel: "Usuario" },
  creditor: { type: "user", id: "creditor-1", name: "Luis Nunez", roleLabel: "Admin" },
  participantIds: ["user:debtor-1", "user:creditor-1"],
  amountOriginal: 12500,
  balance: 0,
  reason: "Compra interna",
  reference: "FAC 001",
  date: "2026-07-31",
  status: "paid",
  movements: [
    {
      id: "m1",
      type: "charge",
      amount: 12500,
      reason: "Deuda inicial",
      date: "2026-07-31",
      createdAt: new Date("2026-07-31T08:00:00Z"),
      createdById: "debtor-1",
      createdByName: "Ana Maria",
    },
    {
      id: "m2",
      type: "payment",
      amount: 12500,
      reason: "Pago total",
      reference: "SINPE 123",
      date: "2026-07-31",
      createdAt: new Date("2026-07-31T09:00:00Z"),
      createdById: "creditor-1",
      createdByName: "Luis Nunez",
    },
  ],
  createdAt: new Date("2026-07-31T08:00:00Z"),
  updatedAt: new Date("2026-07-31T09:00:00Z"),
  createdById: "debtor-1",
  createdByName: "Ana Maria",
};

const data = buildPaidInternalDebtReceiptData(
  paidDebt,
  new Date("2026-07-31T18:30:00.000Z"),
);

assert.equal(data.title, "Comprobante de deuda pagada");
assert.equal(data.routeLabel, "Ana Maria debe a Luis Nunez");
assert.equal(data.statusLabel, "Pagada");
assert.equal(data.amountOriginal, 12500);
assert.equal(data.balance, 0);
assert.equal(data.reference, "FAC 001");
assert.equal(data.exportedAtISO, "2026-07-31T18:30:00.000Z");
assert.equal(data.movements.length, 2);
assert.equal(data.movements[0].typeLabel, "Cargo");
assert.equal(data.movements[0].signedAmountPrefix, "+");
assert.equal(data.movements[1].typeLabel, "Abono");
assert.equal(data.movements[1].signedAmountPrefix, "-");
assert.equal(data.movements[1].reference, "SINPE 123");

assert.equal(
  buildPaidInternalDebtReceiptFileName(data),
  "DeudaInternaPagada-Ana_Maria-Luis_Nunez-2026-07-31.png",
);
assert.equal(
  buildPaidInternalDebtReceiptStoragePath("recibo.png", 1775000000000),
  "exports/internal-debts/1775000000000_recibo.png",
);

console.log("paid internal debt receipt tests passed");
