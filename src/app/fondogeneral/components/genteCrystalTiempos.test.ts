import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Empresas } from "../../../types/firestore.ts";
import type { GenteCrystalDailySalesResponse } from "../../../services/gente-crystal-sales.ts";
import {
  buildGenteCrystalDisplayResult,
  buildGenteCrystalCompanyOptions,
  createGenteCrystalManualSalesQuery,
  currentCostaRicaDate,
  genteCrystalSaleOriginMarker,
  resolveGenteCrystalCompanySelection,
  type GenteCrystalDisplayResult,
} from "./genteCrystalTiempos.ts";
import { GenteCrystalTiemposPanel } from "./GenteCrystalTiemposPanel.tsx";
import * as ticketTableComponents from "./GenteCrystalTicketTableFrame.ts";

const { GenteCrystalTicketTableFrame } = ticketTableComponents;

test("only indirect sales receive the (i) marker", () => {
  assert.equal(genteCrystalSaleOriginMarker("indirect"), "(i)");
  assert.equal(genteCrystalSaleOriginMarker("local_button"), "");
});

test("daily sales stay idle until refresh is explicitly requested", async () => {
  const calls: Array<{
    companyId: string;
    date: string;
    signal: AbortSignal | undefined;
  }> = [];
  const expected: GenteCrystalDailySalesResponse = {
    ok: true,
    companyId: "DELIKOR PALMARES",
    date: "2026-08-14",
    timezone: "America/Costa_Rica",
    summary: {
      count: 0,
      total: 0,
      indirectCount: 0,
      indirectTotal: 0,
    },
    sales: [],
  };
  const query = createGenteCrystalManualSalesQuery(
    async (companyId: string, date: string, signal?: AbortSignal) => {
      calls.push({ companyId, date, signal });
      return expected;
    },
  );

  assert.equal(calls.length, 0);
  assert.equal(
    await query.refresh("DELIKOR PALMARES", "2026-08-14"),
    expected,
  );
  assert.deepEqual(
    calls.map(({ companyId, date }) => ({ companyId, date })),
    [{ companyId: "DELIKOR PALMARES", date: "2026-08-14" }],
  );
  assert.equal(calls[0]?.signal instanceof AbortSignal, true);
});

test("the initial panel asks for a manual refresh", () => {
  const markup = renderToStaticMarkup(
    createElement(GenteCrystalTiemposPanel, {
      companyId: "DELIKOR PALMARES",
    }),
  );

  assert.match(markup, /Presiona Actualizar para consultar\./);
  assert.doesNotMatch(markup, /No hay movimientos para esta fecha\./);
});

function displayResultFor(
  sales: GenteCrystalDailySalesResponse["sales"],
): GenteCrystalDisplayResult {
  return buildGenteCrystalDisplayResult({
    ok: true,
    companyId: "DELIKOR PALMARES",
    date: "2026-08-14",
    timezone: "America/Costa_Rica",
    summary: {
      count: sales.length,
      total: sales.reduce((total, sale) => total + sale.monto, 0),
      indirectCount: sales.filter(
        (sale) => sale.captureOrigin === "indirect",
      ).length,
      indirectTotal: sales
        .filter((sale) => sale.captureOrigin === "indirect")
        .reduce((total, sale) => total + sale.monto, 0),
    },
    sales,
  });
}

test("a plus-minus pair is displayed and counted as one ticket", () => {
  const result = displayResultFor([
    {
      ticketId: "41831-2204-59203577",
      sorteo: "14/08/2026 TICA DÍA",
      monto: 400,
      saleAt: "2026-08-14T14:29:00.000Z",
      captureOrigin: "local_button",
    },
    {
      ticketId: "41830-2204-59203578",
      sorteo: "14/08/2026 TICA DÍA",
      monto: 400,
      saleAt: "2026-08-14T14:29:00.000Z",
      captureOrigin: "indirect",
    },
  ]);

  assert.deepEqual(result.summary, {
    count: 1,
    total: 800,
    indirectCount: 0,
    indirectTotal: 0,
  });
  assert.deepEqual(result.sales, [
    {
      ticketIds: ["41831-2204-59203577", "41830-2204-59203578"],
      sorteo: "14/08/2026 TICA DÍA",
      monto: 800,
      saleAt: "2026-08-14T14:29:00.000Z",
      captureOrigin: "local_button",
    },
  ]);
});

test("a plus-minus pair is grouped regardless of which sequence is local", () => {
  const result = displayResultFor([
    {
      ticketId: "99999-9999-59203579",
      sorteo: "OTRO SORTEO",
      monto: 900,
      saleAt: "2026-08-14T15:00:00.000Z",
      captureOrigin: "local_button",
    },
    {
      ticketId: "41830-2204-59203578",
      sorteo: "14/08/2026 TICA DÍA",
      monto: 400,
      saleAt: "2026-08-14T14:29:00.000Z",
      captureOrigin: "indirect",
    },
  ]);

  assert.deepEqual(result.summary, {
    count: 1,
    total: 1300,
    indirectCount: 0,
    indirectTotal: 0,
  });
  assert.deepEqual(result.sales, [
    {
      ticketIds: ["99999-9999-59203579", "41830-2204-59203578"],
      sorteo: "OTRO SORTEO",
      monto: 1300,
      saleAt: "2026-08-14T15:00:00.000Z",
      captureOrigin: "local_button",
    },
  ]);
});

test("consecutive indirect tickets stay indirect without a local neighbor", () => {
  const result = displayResultFor([
    {
      ticketId: "41830-2204-59203578",
      sorteo: "14/08/2026 TICA DÍA",
      monto: 400,
      saleAt: "2026-08-14T14:29:00.000Z",
      captureOrigin: "indirect",
    },
    {
      ticketId: "41830-2204-59203579",
      sorteo: "14/08/2026 TICA DÍA",
      monto: 400,
      saleAt: "2026-08-14T14:29:00.000Z",
      captureOrigin: "indirect",
    },
    {
      ticketId: "41831-2204-59203600",
      sorteo: "14/08/2026 NICA 11:00 AM",
      monto: 1000,
      saleAt: "2026-08-14T14:37:00.000Z",
      captureOrigin: "local_button",
    },
  ]);

  assert.equal(result.summary.indirectCount, 2);
  assert.equal(result.summary.indirectTotal, 800);
  assert.deepEqual(
    result.sales.map((sale) => sale.captureOrigin),
    ["indirect", "indirect", "local_button"],
  );
});

test("a plus-minus pair does not absorb a third adjacent indirect ticket", () => {
  const result = displayResultFor([
    {
      ticketId: "41830-2204-59203578",
      sorteo: "14/08/2026 TICA DÍA",
      monto: 100,
      saleAt: "2026-08-14T14:29:00.000Z",
      captureOrigin: "local_button",
    },
    {
      ticketId: "41830-2204-59203577",
      sorteo: "14/08/2026 TICA DÍA",
      monto: 100,
      saleAt: "2026-08-14T14:29:00.000Z",
      captureOrigin: "indirect",
    },
    {
      ticketId: "41830-2204-59203579",
      sorteo: "14/08/2026 TICA DÍA",
      monto: 200,
      saleAt: "2026-08-14T14:29:00.000Z",
      captureOrigin: "indirect",
    },
  ]);

  assert.deepEqual(result.summary, {
    count: 2,
    total: 400,
    indirectCount: 1,
    indirectTotal: 200,
  });
  assert.deepEqual(
    result.sales.map((sale) => [sale.ticketIds, sale.captureOrigin]),
    [
      [
        ["41830-2204-59203578", "41830-2204-59203577"],
        "local_button",
      ],
      [["41830-2204-59203579"], "indirect"],
    ],
  );
});

test("grouping preserves the API total exactly", () => {
  const result = displayResultFor([
    {
      ticketId: "41830-2204-59203580",
      sorteo: "OTRO SORTEO",
      monto: 1000,
      saleAt: "2026-08-14T15:00:00.000Z",
      captureOrigin: "local_button",
    },
    {
      ticketId: "41830-2204-59203577",
      sorteo: "14/08/2026 TICA DÍA",
      monto: 0.01,
      saleAt: "2026-08-14T14:29:00.000Z",
      captureOrigin: "local_button",
    },
    {
      ticketId: "41830-2204-59203578",
      sorteo: "14/08/2026 TICA DÍA",
      monto: 0.06,
      saleAt: "2026-08-14T14:29:00.000Z",
      captureOrigin: "indirect",
    },
  ]);

  assert.equal(result.summary.total, 1000.0699999999999);
});

const palmares: Empresas = {
  id: "DELIKOR PALMARES",
  ownerId: "owner-1",
  name: "DELIKOR",
  ubicacion: "PALMARES",
  empleados: [],
};

const sanVito: Empresas = {
  id: "DELIKOR SAN VITO",
  ownerId: "owner-2",
  name: "DELIKOR",
  ubicacion: "SAN VITO",
  empleados: [],
};

test("regular users receive only their assigned company", () => {
  const options = buildGenteCrystalCompanyOptions(
    { role: "user", ownercompanie: "PALMARES" },
    [palmares, sanVito],
    [],
  );

  assert.deepEqual(options, [
    {
      value: "DELIKOR PALMARES",
      label: "DELIKOR - PALMARES",
      aliases: ["DELIKOR PALMARES", "DELIKOR", "PALMARES"],
    },
  ]);
});

test("admins receive only companies in their owner scope", () => {
  const options = buildGenteCrystalCompanyOptions(
    {
      id: "admin-1",
      role: "admin",
      ownerId: "owner-1",
      eliminate: true,
    },
    [palmares, sanVito],
    ["owner-1"],
  );

  assert.deepEqual(
    options.map((option) => option.value),
    ["DELIKOR PALMARES"],
  );
});

test("superadmins receive every company with a document ID", () => {
  const missingId = { ...sanVito, id: undefined };
  const options = buildGenteCrystalCompanyOptions(
    { role: "superadmin" },
    [palmares, sanVito, missingId],
    [],
  );

  assert.deepEqual(
    options.map((option) => option.value),
    ["DELIKOR PALMARES", "DELIKOR SAN VITO"],
  );
});

test("stored or assigned aliases resolve only inside the allowed options", () => {
  const options = buildGenteCrystalCompanyOptions(
    { role: "superadmin" },
    [palmares, sanVito],
    [],
  );

  assert.equal(
    resolveGenteCrystalCompanySelection("PALMARES", "", options),
    "DELIKOR PALMARES",
  );
  assert.equal(
    resolveGenteCrystalCompanySelection(
      "EMPRESA NO AUTORIZADA",
      "SAN VITO",
      options,
    ),
    "DELIKOR SAN VITO",
  );
  assert.equal(
    resolveGenteCrystalCompanySelection(
      "EMPRESA NO AUTORIZADA",
      "OTRA EMPRESA",
      [options[0]],
    ),
    "DELIKOR PALMARES",
  );
});

test("the default date follows Costa Rica across the UTC day boundary", () => {
  assert.equal(
    currentCostaRicaDate(new Date("2026-08-13T04:30:00.000Z")),
    "2026-08-12",
  );
  assert.equal(
    currentCostaRicaDate(new Date("2026-08-13T06:00:00.000Z")),
    "2026-08-13",
  );
});

test("the ticket table keeps its columns horizontally compact", () => {
  const markup = renderToStaticMarkup(
    createElement(
      GenteCrystalTicketTableFrame,
      null,
      createElement("tbody", null, createElement("tr")),
    ),
  );

  assert.match(markup, /class="w-fit max-w-full/);
  assert.match(markup, /<table class="w-max/);
  assert.doesNotMatch(markup, /min-w-\[620px\]|<table class="w-full/);
});

test("ticket numbers show only their final segments on separate lines", () => {
  const TicketNumbers = Reflect.get(
    ticketTableComponents,
    "GenteCrystalTicketNumbers",
  );
  assert.equal(typeof TicketNumbers, "function");

  const markup = renderToStaticMarkup(
    createElement(TicketNumbers as never, {
      ticketIds: ["41852-2204-59219733", "41851-2204-59219734"],
      showFullTicket: false,
    }),
  );

  assert.match(
    markup,
    /<span[^>]*><span[^>]*>59219733<\/span><span[^>]*>59219734<\/span><\/span>/,
  );
  assert.doesNotMatch(markup, /41852-2204|41851-2204/);
});

test("full ticket mode keeps paired ticket numbers on separate lines", () => {
  const TicketNumbers = Reflect.get(
    ticketTableComponents,
    "GenteCrystalTicketNumbers",
  );
  assert.equal(typeof TicketNumbers, "function");

  const markup = renderToStaticMarkup(
    createElement(TicketNumbers as never, {
      ticketIds: ["41852-2204-59219733", "41851-2204-59219734"],
      showFullTicket: true,
    }),
  );

  assert.match(
    markup,
    /<span[^>]*><span[^>]*>41852-2204-59219733<\/span><span[^>]*>41851-2204-59219734<\/span><\/span>/,
  );
});

test("the ticket view toggle exposes its current display mode", () => {
  const TicketViewToggle = Reflect.get(
    ticketTableComponents,
    "GenteCrystalTicketViewToggle",
  );
  assert.equal(typeof TicketViewToggle, "function");

  const finalOnlyMarkup = renderToStaticMarkup(
    createElement(TicketViewToggle as never, {
      showFullTicket: false,
      onToggle() {},
    }),
  );
  const fullTicketMarkup = renderToStaticMarkup(
    createElement(TicketViewToggle as never, {
      showFullTicket: true,
      onToggle() {},
    }),
  );

  assert.match(finalOnlyMarkup, /aria-pressed="false"/);
  assert.match(finalOnlyMarkup, />Tiquete completo<\/button>/);
  assert.match(fullTicketMarkup, /aria-pressed="true"/);
  assert.match(fullTicketMarkup, />Tiquete completo<\/button>/);
  assert.doesNotMatch(finalOnlyMarkup, /aria-label=/);
  assert.doesNotMatch(fullTicketMarkup, /aria-label=/);
});
