import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const fondoSection = readFileSync(
  "src/app/fondogeneral/components/layout/FondoSection.tsx",
  "utf8",
);
const submitFondo = readFileSync(
  "src/app/fondogeneral/utils/submitFondo.ts",
  "utf8",
);

assert.match(
  fondoSection,
  /const canBypassClosingWindows = isAdminUser \|\| isSuperAdminUser;/,
  "FondoSection must let admin and superadmin bypass closing/opening windows.",
);
assert.match(
  fondoSection,
  /if \(!cashOpeningEditingEntry && !canBypassClosingWindows\)/,
  "Cash opening submit must skip window validation for admin/superadmin.",
);
assert.match(
  fondoSection,
  /if \(!canBypassClosingWindows && !isInReferenceWindow\)/,
  "Cierre fondo ventas UI window must only block non-admin users.",
);
assert.match(
  submitFondo,
  /const canBypassClosingWindows = isAdminUser \|\| isSuperAdminUser;/,
  "submitFondo must define admin/superadmin bypass.",
);
assert.match(
  submitFondo,
  /!canBypassClosingWindows &&\s*isInNightClosingWindow/,
  "submitFondo single-closing reason must only block non-admin users.",
);
