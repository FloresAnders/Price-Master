import assert from "node:assert/strict";
import test from "node:test";
import type { Empresas } from "../../../types/firestore.ts";
import {
  buildGenteCrystalCompanyOptions,
  currentCostaRicaDate,
  resolveGenteCrystalCompanySelection,
} from "./genteCrystalTiempos.ts";

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
