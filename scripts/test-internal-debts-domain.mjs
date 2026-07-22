import { existsSync, readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import vm from "node:vm";
import ts from "typescript";

const servicePath = "src/services/internal-debts.ts";

assert.ok(existsSync(servicePath), "Internal debts service must exist.");

const source = readFileSync(servicePath, "utf8");

assert.match(source, /export function buildPartyKey/);
assert.match(source, /export function createInternalDebtDraft/);
assert.match(source, /export function applyInternalDebtMovement/);
assert.match(source, /debtorKey === creditorKey/);
assert.match(source, /amount <= 0/);
assert.match(source, /amount > debt\.balance/);
assert.match(source, /COLLECTION_NAME = "internalDebts"/);
assert.match(source, /array-contains/);
assert.match(source, /runTransaction/);
assert.match(source, /startsWith\("user:"\)/);
assert.doesNotMatch(
  source,
  /MovimientosFondos|movimientos-fondos|v2movements/,
  "Internal debts service must not touch Fondo movement modules.",
);

const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;

const sandbox = {
  exports: {},
  require(name) {
    if (name === "firebase/firestore") {
      return {
        doc: () => ({}),
        runTransaction: async () => undefined,
      };
    }
    if (name === "@/config/firebase") return { db: {} };
    if (name === "./firestore") {
      return {
        FirestoreService: {
          query: async () => [],
          add: async () => "new-id",
          getById: async () => null,
          update: async () => undefined,
        },
      };
    }
    throw new Error(`Unexpected require: ${name}`);
  },
  crypto: { randomUUID: () => "movement-id" },
  Date,
  Math,
  console,
};
sandbox.module = { exports: sandbox.exports };
vm.runInNewContext(transpiled, sandbox);

const {
  buildPartyKey,
  createInternalDebtDraft,
  applyInternalDebtMovement,
} = sandbox.module.exports;

const debtor = { type: "empresa", id: "palmares", name: "Delikor Palmares" };
const creditor = { type: "user", id: "diana", name: "Diana Aguilar" };

assert.equal(buildPartyKey(debtor), "empresa:palmares");

const draft = createInternalDebtDraft({
  ownerId: "owner-1",
  debtor,
  creditor,
  amount: 1000,
  reason: "Prestamo",
  date: "2026-07-21",
  createdById: "admin-1",
  createdByName: "Admin",
  actorPartyKeys: ["user:admin-1", "empresa:palmares"],
});

assert.equal(draft.balance, 1000);
assert.equal(draft.movements[0].type, "charge");
assert.equal(
  JSON.stringify(draft.participantIds),
  JSON.stringify(["empresa:palmares", "user:diana", "user:admin-1"]),
);
assert.ok(
  draft.participantIds.includes(buildPartyKey(draft.debtor)),
  "Debt must be visible to debtor party.",
);
assert.ok(
  draft.participantIds.includes(buildPartyKey(draft.creditor)),
  "Debt must be visible to creditor party.",
);

assert.throws(
  () =>
    createInternalDebtDraft({
      ownerId: "owner-1",
      debtor,
      creditor: debtor,
      amount: 1000,
      reason: "X",
      date: "2026-07-21",
      createdById: "admin-1",
      createdByName: "Admin",
      actorPartyKeys: ["empresa:palmares"],
    }),
  /deudor y el acreedor/,
);
assert.throws(
  () =>
    createInternalDebtDraft({
      ownerId: "owner-1",
      debtor,
      creditor,
      amount: 0,
      reason: "X",
      date: "2026-07-21",
      createdById: "admin-1",
      createdByName: "Admin",
      actorPartyKeys: ["empresa:palmares"],
    }),
  /mayor a cero/,
);

const paid = applyInternalDebtMovement(
  { id: "debt-1", ...draft },
  {
    type: "payment",
    amount: 250,
    reason: "Abono",
    date: "2026-07-21",
    createdById: "diana",
    createdByName: "Diana",
  },
  ["user:diana"],
);
assert.equal(paid.balance, 750);
assert.equal(paid.movements.at(-1).type, "payment");

const charged = applyInternalDebtMovement(
  { id: "debt-1", ...paid },
  {
    type: "charge",
    amount: 100,
    reason: "Extra",
    date: "2026-07-21",
    createdById: "admin-1",
    createdByName: "Admin",
  },
  ["empresa:palmares"],
);
assert.equal(charged.balance, 850);

assert.throws(
  () =>
    applyInternalDebtMovement(
      { id: "debt-1", ...draft },
      {
        type: "payment",
        amount: 2000,
        reason: "Abono",
        date: "2026-07-21",
        createdById: "diana",
        createdByName: "Diana",
      },
      ["user:diana"],
    ),
  /exceder/,
);
assert.throws(
  () =>
    applyInternalDebtMovement(
      { id: "debt-1", ...draft },
      {
        type: "payment",
        amount: 100,
        reason: "Abono",
        date: "2026-07-21",
        createdById: "otro",
        createdByName: "Otro",
      },
      ["user:otro"],
    ),
  /acreedor/,
);
