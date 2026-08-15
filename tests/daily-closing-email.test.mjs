import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import ts from "typescript";

const loadTypeScriptModule = (file) => {
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: file,
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", source)(
    (request) => {
      throw new Error(`Dependencia inesperada al cargar la plantilla: ${request}`);
    },
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
};

const { buildDailyClosingEmailTemplate } = loadTypeScriptModule(
  "src/services/email-templates/daily-closing.ts",
);
const { reconcileClosing } = loadTypeScriptModule(
  "src/domain/reconciliation.ts",
);

const daytimeReconciliation = reconcileClosing({
  r08: 7450,
  t11: 31300,
  tucanCumulative: 7450,
  tiemposCumulative: 28100,
  cumulativeR08: 7450,
  cumulativeT11: 31300,
  isFinalShift: false,
});

const reconciliation = reconcileClosing({
  r08: 149572,
  t11: 67100,
  tucanCumulative: 163008,
  tiemposCumulative: 96900,
  previous: daytimeReconciliation,
  cumulativeR08: daytimeReconciliation.calculated.cumulativeR08 + 149572,
  cumulativeT11: daytimeReconciliation.calculated.cumulativeT11 + 67100,
  isFinalShift: true,
});

const renderEmail = () =>
  buildDailyClosingEmailTemplate({
    company: "Empresa de ejemplo",
    accountKey: "FondoGeneral",
    closingDateISO: "2026-08-14T18:00:00.000Z",
    manager: "Ana Vargas",
    totalCRC: 250000,
    totalUSD: 120,
    recordedBalanceCRC: 250000,
    recordedBalanceUSD: 120,
    diffCRC: 0,
    diffUSD: 0,
    reconciliation,
  });

const normalizeText = (value) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

test("separa los cuatro saldos digitados de los valores calculados del turno", () => {
  const rendered = renderEmail();
  const text = normalizeText(rendered.text);
  const html = normalizeText(rendered.html);

  for (const output of [text, html]) {
    assert.match(output, /Saldos digitados en la verificaci[oó]n de sistemas/);
    assert.match(output, /Contica[^₡]*R08[^₡]*₡149 572/);
    assert.match(output, /Contica[^₡]*T11[^₡]*₡67 100/);
    assert.match(output, /Tuc[aá]n[^₡]*saldo acumulado[^₡]*₡163 008/i);
    assert.match(output, /Tiempos[^₡]*saldo acumulado[^₡]*₡96 900/i);
    assert.match(output, /Comparaci[oó]n del turno \(Contica [−-] sistema\)/);
    assert.match(output, /Tuc[aá]n registra ₡5 986 m[aá]s que Contica/);
    assert.match(output, /Tiempos registra ₡1 700 m[aá]s que Contica/);

    assert.ok(
      output.indexOf("Saldos digitados") < output.indexOf("Comparación del turno"),
      "Los datos ingresados deben mostrarse antes que los cálculos",
    );
  }
});

test("ordena cada saldo externo antes de su dato correspondiente en Contica", () => {
  const rendered = renderEmail();

  for (const output of [normalizeText(rendered.text), normalizeText(rendered.html)]) {
    const positions = [
      /Tuc[aá]n(?: —)? ?saldo acumulado:? ₡163 008/i,
      /Contica(?: —)? ?R08:? ₡149 572/,
      /Tiempos(?: —)? ?saldo acumulado:? ₡96 900/i,
      /Contica(?: —)? ?T11:? ₡67 100/,
    ].map((pattern) => output.search(pattern));

    assert.ok(
      positions.every((position) => position >= 0),
      `Falta un saldo digitado en el correo: ${positions.join(", ")}`,
    );
    assert.ok(
      positions.every((position, index) => index === 0 || positions[index - 1] < position),
      `Orden incorrecto de saldos digitados: ${positions.join(", ")}`,
    );
  }
});

test("explica por separado el ajuste de Tiempos entre turnos", () => {
  const rendered = renderEmail();
  const text = normalizeText(rendered.text);
  const html = normalizeText(rendered.html);

  for (const output of [text, html]) {
    assert.match(output, /Ajuste de Tiempos entre turnos/);
    assert.match(output, /Pendiente del turno anterior[^₡]*₡3 200/);
    assert.match(output, /Diferencia del turno actual[^₡]*-₡1 700/);
    assert.match(output, /Monto compensado[^₡]*₡1 700/);
    assert.match(output, /Diferencia final de Tiempos[^₡]*₡1 500/);
    assert.match(output, /El acumulado diario mantiene una diferencia sin resolver/);
  }
});

const cleanPreviewText = (value) =>
  value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const previewRows = (section) =>
  [...section.querySelectorAll("tr")].map((row) =>
    [...row.children].map((cell) => cleanPreviewText(cell.textContent)),
  );

const findPreviewSection = (document, heading) => {
  const title = [...document.querySelectorAll(".scenario > h2")].find(
    (element) => cleanPreviewText(element.textContent) === heading,
  );
  assert.ok(title, `Falta el escenario: ${heading}`);
  const section = title.closest("section");
  assert.ok(section, `El escenario ${heading} debe estar agrupado en una sección`);
  return section;
};

test("la vista local simula los cierres diurno y nocturno con sus saldos reales", () => {
  const document = new JSDOM(
    readFileSync("src/data/dailyClosingEmailPreview.html", "utf8"),
  ).window.document;
  const day = findPreviewSection(document, "Correo simulado: cierre diurno (D)");
  const night = findPreviewSection(document, "Correo simulado: cierre nocturno (N)");

  assert.equal(
    cleanPreviewText(document.querySelector(".page-heading h1")?.textContent || ""),
    "Vista local de los correos de cierre",
  );
  assert.equal(
    document.querySelectorAll("table thead th:not([scope='col'])").length,
    0,
    "Cada encabezado de columna debe declarar scope=col",
  );
  assert.equal(
    document.querySelectorAll("table tbody tr > :first-child:not(th[scope='row'])").length,
    0,
    "Cada fila debe comenzar con un encabezado scope=row",
  );

  const dayRows = previewRows(day);
  assert.deepEqual(
    dayRows.filter((row) => row.length === 3 && row[0] !== "Sistema"),
    [
      ["Tucán", "Saldo acumulado", "₡155 962"],
      ["Contica", "R08", "₡155 960"],
      ["Tiempos", "Saldo acumulado", "₡35 350"],
      ["Contica", "T11", "₡45 150"],
    ],
  );
  for (const expected of [
    ["Contica", "R08", "₡155 960"],
    ["Contica", "T11", "₡45 150"],
    ["Tucán", "Saldo acumulado", "₡155 962"],
    ["Tiempos", "Saldo acumulado", "₡35 350"],
    ["Pendiente del turno anterior", "₡0"],
    ["Diferencia del turno actual", "₡9 800"],
    ["Monto compensado", "₡0"],
    ["Diferencia final de Tiempos", "₡9 800"],
  ]) {
    assert.ok(
      dayRows.some((actual) => JSON.stringify(actual) === JSON.stringify(expected)),
      `Falta fila diurna: ${expected.join(" | ")}`,
    );
  }
  assert.match(cleanPreviewText(day.textContent), /Tucán registra ₡2 más que Contica/);
  assert.match(cleanPreviewText(day.textContent), /Contica registra ₡9 800 más que Tiempos/);
  assert.deepEqual(
    dayRows.find((row) => row[0] === "Tucán" && row.length === 4),
    ["Tucán", "R08: ₡155 960", "₡155 962", "-₡2Tucán registra ₡2 más que Contica."],
  );
  assert.deepEqual(
    dayRows.find((row) => row[0] === "Tiempos" && row.length === 4),
    [
      "Tiempos",
      "T11: ₡45 150",
      "₡35 350",
      "₡9 800Contica registra ₡9 800 más que Tiempos.",
    ],
  );
  assert.match(
    cleanPreviewText(day.textContent),
    /La diferencia queda pendiente para validarla en el cierre nocturno/,
  );

  const nightRows = previewRows(night);
  assert.deepEqual(
    nightRows.filter((row) => row.length === 3 && row[0] !== "Sistema"),
    [
      ["Tucán", "Saldo acumulado", "₡402 123,76"],
      ["Contica", "R08", "₡246 163"],
      ["Tiempos", "Saldo acumulado", "₡147 650"],
      ["Contica", "T11", "₡104 500"],
    ],
  );
  for (const expected of [
    ["Contica", "R08", "₡246 163"],
    ["Contica", "T11", "₡104 500"],
    ["Tucán", "Saldo acumulado", "₡402 123,76"],
    ["Tiempos", "Saldo acumulado", "₡147 650"],
    ["Pendiente del turno anterior", "₡9 800"],
    ["Diferencia del turno actual", "-₡7 800"],
    ["Monto compensado", "₡7 800"],
    ["Diferencia final de Tiempos", "₡2 000"],
  ]) {
    assert.ok(
      nightRows.some((actual) => JSON.stringify(actual) === JSON.stringify(expected)),
      `Falta fila nocturna: ${expected.join(" | ")}`,
    );
  }
  assert.match(cleanPreviewText(night.textContent), /Contica registra ₡1,24 más que Tucán/);
  assert.match(cleanPreviewText(night.textContent), /Tiempos registra ₡7 800 más que Contica/);
  assert.deepEqual(
    nightRows.find((row) => row[0] === "Tucán" && row.length === 4),
    [
      "Tucán",
      "R08: ₡246 163",
      "₡246 161,76",
      "₡1,24Contica registra ₡1,24 más que Tucán.",
    ],
  );
  assert.deepEqual(
    nightRows.find((row) => row[0] === "Tiempos" && row.length === 4),
    [
      "Tiempos",
      "T11: ₡104 500",
      "₡112 300",
      "-₡7 800Tiempos registra ₡7 800 más que Contica.",
    ],
  );
  assert.match(
    cleanPreviewText(night.textContent),
    /El acumulado diario mantiene una diferencia sin resolver/,
  );
});
