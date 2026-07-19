import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const dailyClosings = readFileSync("src/services/daily-closings.ts", "utf8");
const emailTemplate = readFileSync("src/services/email-templates/daily-closing.ts", "utf8");
const imageExport = readFileSync("src/data/gereaImagenSuperAdmin/dailyClosingImage.ts", "utf8");

assert.match(
  dailyClosings,
  /const sanitizeCount = \(value: unknown\): number =>/,
  "daily closing persistence must keep money decimals and only truncate count values.",
);
assert.doesNotMatch(
  dailyClosings.match(/const sanitizeMoney[\s\S]*?};/)?.[0] ?? "",
  /Math\.trunc/,
  "sanitizeMoney must not truncate cents.",
);
assert.doesNotMatch(
  emailTemplate,
  /format\(Math\.trunc\(value\)\)/,
  "daily closing email must show cents when money has decimals.",
);
assert.doesNotMatch(
  imageExport,
  /format\(Math\.trunc\(amount\)\)/,
  "daily closing image export must show cents when money has decimals.",
);
assert.doesNotMatch(
  imageExport,
  /r\.contica\.r08}|r\.calculated\.tucanForShift}|String\(tiemposDifference\)|externalSnapshots\.tucanCumulative}/,
  "daily closing image reconciliation values must use the currency formatter.",
);
