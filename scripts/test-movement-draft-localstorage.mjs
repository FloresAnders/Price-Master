import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/app/fondogeneral/components/layout/FondoSection.tsx",
  "utf8",
);

const checks = [
  {
    name: "uses a scoped localStorage key for movement draft",
    pattern: /fondogeneral-movement-draft:\$\{draftCompany\}:\$\{accountKey\}:\$\{namespace\}:\$\{draftUserKey\}/,
  },
  {
    name: "persists draft while adding a new movement",
    pattern: /localStorage\.setItem\(movementDraftStorageKey,\s*JSON\.stringify\(\{[\s\S]*selectedProvider[\s\S]*invoiceNumber[\s\S]*movementCurrency/,
  },
  {
    name: "restores draft before opening create drawer",
    pattern: /restoreMovementDraft\(\)[\s\S]*setMovementModalOpen\(true\)/,
  },
  {
    name: "protects restored manual credit notes from dependency reset effect",
    pattern:
      /restoringMovementDraftRef\.current\s*=\s*true[\s\S]*setManualCreditNoteDrafts\([\s\S]*draft\.manualCreditNoteDrafts[\s\S]*if\s*\(restoringMovementDraftRef\.current\)\s*\{[\s\S]*restoringMovementDraftRef\.current\s*=\s*false[\s\S]*return/,
  },
  {
    name: "does not persist draft while editing",
    pattern: /if\s*\(!movementModalOpen\s*\|\|\s*editingEntryId\s*\|\|\s*!movementDraftStorageKey\)\s*return/,
  },
  {
    name: "clears draft only through success reset wrapper",
    pattern: /const resetFondoFormAfterSuccessfulSave = useCallback\([\s\S]*clearMovementDraft\(\)[\s\S]*resetFondoForm\(\)/,
  },
  {
    name: "create persistence receives success reset wrapper",
    pattern: /resetFondoForm:\s*resetFondoFormAfterSuccessfulSave/,
  },
  {
    name: "submit receives success reset wrapper",
    pattern: /resetFondoForm:\s*resetFondoFormAfterSuccessfulSave/,
  },
];

const failures = checks.filter((check) => !check.pattern.test(source));

if (failures.length > 0) {
  console.error("Movement draft localStorage regression failed:");
  for (const failure of failures) {
    console.error(`- ${failure.name}`);
  }
  process.exit(1);
}

console.log("Movement draft localStorage regression passed.");
