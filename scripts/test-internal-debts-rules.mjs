import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const rules = readFileSync("firestore.rules", "utf8");
const internalDebtsIndex = rules.indexOf("match /internalDebts/{debtId}");
const catchallIndex = rules.indexOf("match /{collection}/{document=**}");

assert.ok(internalDebtsIndex >= 0, "internalDebts rules must exist.");
assert.ok(
  catchallIndex > internalDebtsIndex,
  "internalDebts rules must be before catchall.",
);
const helperIndex = rules.indexOf("function internalDebtUserPartyKey()");
const block = rules.slice(
  helperIndex >= 0 ? helperIndex : internalDebtsIndex,
  catchallIndex,
);

assert.match(block, /participantIds/);
assert.match(block, /request\.auth\.uid/);
assert.match(block, /hasInternalDebtsPermission/);
assert.match(block, /deudasInternas/);
assert.match(block, /documents\/users\/\$\(request\.auth\.uid\)/);
assert.match(block, /allow create/);
assert.match(block, /allow update/);
assert.match(block, /diff\(resource\.data\)\.affectedKeys\(\)/);
assert.match(block, /hasOnly\(\['balance', 'status', 'movements', 'updatedAt'\]\)/);
assert.match(block, /allow delete: if isAdmin\(\)/);
assert.match(
  rules.slice(catchallIndex),
  /collection != 'internalDebts'/,
  "catchall must exclude internalDebts.",
);
