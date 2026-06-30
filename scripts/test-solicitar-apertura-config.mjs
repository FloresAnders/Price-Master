import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const typeSource = read("src/types/firestore.ts");
assert.match(
  typeSource,
  /solicitarApertura\?: boolean/,
  "Empresas debe exponer solicitarApertura",
);

const empresasServiceSource = read("src/services/empresas.ts");
assert.match(
  empresasServiceSource,
  /normalizeSolicitarApertura/,
  "EmpresasService debe normalizar solicitarApertura",
);
assert.match(
  empresasServiceSource,
  /solicitarApertura:\s*EmpresasService\.normalizeSolicitarApertura/,
  "EmpresasService debe guardar default true",
);

const editorSource = read("src/edit/components/EmpresasEditorSection.tsx");
assert.match(editorSource, /solicitarApertura:\s*true/, "Alta debe default true");
assert.match(editorSource, /Solicitar apertura/, "UI debe mostrar checkbox");

const fondoSource = read("src/app/fondogeneral/components/layout/FondoSection.tsx");
assert.match(
  fondoSource,
  /empresaSolicitaApertura/,
  "FondoSection debe usar flag de empresa",
);
assert.match(
  fondoSource,
  /requiresOpening:\s*empresaSolicitaApertura/,
  "Cierre debe respetar flag al setear pendiente local",
);

const dailyClosingSource = read("src/app/fondogeneral/utils/closing/dailyClosing.ts");
assert.match(
  dailyClosingSource,
  /solicitarApertura/,
  "handleConfirmDailyClosing debe recibir flag",
);
assert.match(
  dailyClosingSource,
  /requiresOpening:\s*solicitarApertura/,
  "Movimientos de cierre deben respetar flag",
);
