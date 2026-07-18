import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "app", "fondogeneral", "utils", "submitFondo.ts"),
  "utf8",
);

const editPaymentUsesRounding =
  /const\s+nextAmountPayment\s*=\s*[\s\S]{0,300}roundCreditNotePaymentAmount\s*\(/.test(
    source,
  );

if (!editPaymentUsesRounding) {
  throw new Error(
    "Edit movement must persist rounded amountPayment, e.g. 15001 -> 15000.",
  );
}

