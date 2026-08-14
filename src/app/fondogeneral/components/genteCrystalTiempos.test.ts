import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Empresas } from "../../../types/firestore.ts";
import type { GenteCrystalDailySalesResponse } from "../../../services/gente-crystal-sales.ts";
import {
  buildGenteCrystalDisplayResult,
  buildGenteCrystalCompanyOptions,
  currentCostaRicaDate,
  genteCrystalSaleOriginMarker,
  resolveGenteCrystalCompanySelection,
} from "./genteCrystalTiempos.ts";
import { GenteCrystalTicketTableFrame } from "./GenteCrystalTicketTableFrame.ts";

test("only indirect sales receive the (i) marker", () => {
  assert.equal(genteCrystalSaleOriginMarker("indirect"), "(i)");
  assert.equal(genteCrystalSaleOriginMarker("local_button"), "");
});

function displayResultFor(
  sales: GenteCrystalDailySalesResponse["sales"],
): GenteCrystalDailySalesResponse {
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

test("an indirect ticket one sequence above a local ticket is omitted", () => {
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
    count: 2,
    total: 800,
    indirectCount: 0,
    indirectTotal: 0,
  });
  assert.deepEqual(
    result.sales.map((sale) => sale.captureOrigin),
    ["local_button", "local_button"],
  );
});

test("an indirect ticket one sequence below a local ticket is omitted", () => {
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

  assert.equal(result.summary.indirectCount, 0);
  assert.equal(result.summary.indirectTotal, 0);
  assert.equal(result.sales[1].captureOrigin, "local_button");
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
