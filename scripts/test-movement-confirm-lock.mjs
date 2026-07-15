import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/app/fondogeneral/components/drawers/MovementDrawer.tsx",
  "utf8",
);

function getArrowFunctionBody(name) {
  const declaration = `const ${name} = () => {`;
  const start = source.indexOf(declaration);
  if (start === -1) {
    throw new Error(`Function ${name} not found`);
  }

  const bodyStart = source.indexOf("{", start);
  let depth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(bodyStart + 1, index);
    }
  }

  throw new Error(`Function ${name} body not closed`);
}

const handleConfirmSaveBody = getArrowFunctionBody("handleConfirmSave");

const checks = [
  {
    name: "has synchronous confirm lock ref",
    pattern: /confirmSaveLockedRef\s*=\s*useRef\(false\)/,
    target: source,
  },
  {
    name: "blocks duplicate confirm clicks before submit",
    pattern:
      /if\s*\(\s*confirmSaveLockedRef\.current\s*\|\|\s*isSaving\s*\)\s*return/,
    target: handleConfirmSaveBody,
  },
  {
    name: "locks before invoking submit",
    pattern:
      /confirmSaveLockedRef\.current\s*=\s*true[\s\S]*Promise\.resolve\(\s*onSubmit\?\.\(\)\s*\)/,
    target: handleConfirmSaveBody,
  },
  {
    name: "keeps confirm modal open while submit is running",
    pattern:
      /Promise\.resolve\(\s*onSubmit\?\.\(\)\s*\)[\s\S]*\.finally\(\(\)\s*=>\s*\{[\s\S]*setShowConfirmModal\(false\)/,
    target: handleConfirmSaveBody,
  },
  {
    name: "unlocks after submit settles",
    pattern:
      /\.finally\(\(\)\s*=>\s*\{[\s\S]*confirmSaveLockedRef\.current\s*=\s*false/,
    target: handleConfirmSaveBody,
  },
  {
    name: "confirm modal uses immediate lock as loading state",
    pattern: /loading=\{isSaving\s*\|\|\s*confirmSaveLocked\}/,
    target: source,
  },
];

const failures = checks.filter((check) => !check.pattern.test(check.target));

if (failures.length > 0) {
  console.error("Movement confirm lock regression failed:");
  for (const failure of failures) {
    console.error(`- ${failure.name}`);
  }
  process.exit(1);
}

console.log("Movement confirm lock regression passed.");
