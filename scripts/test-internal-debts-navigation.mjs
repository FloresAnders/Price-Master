import { existsSync, readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const routePath = "src/app/fondogeneral/deudasinternas/page.tsx";

assert.ok(existsSync(routePath), "Internal debts page route must exist.");

const page = readFileSync("src/app/page.tsx", "utf8");
const header = readFileSync("src/components/layout/Header.tsx", "utf8");
const wrapper = readFileSync("src/components/layout/HeaderWrapper.tsx", "utf8");
const homeMenu = readFileSync("src/components/layout/HomeMenu.tsx", "utf8");
const standaloneHome = readFileSync("src/app/home/page.tsx", "utf8");
const favoritesCatalog = readFileSync(
  "src/components/layout/homeMenuFavoritesCatalog.ts",
  "utf8",
);
const route = readFileSync(routePath, "utf8");

assert.match(page, /InternalDebtsPage/);
assert.match(page, /fondogeneral\/deudasinternas\/page/);
assert.match(page, /\|\s*"deudasinternas"/);
assert.match(page, /activeTab === "deudasinternas"/);
assert.match(header, /\|\s*"deudasinternas"/);
assert.match(header, /currentHash === "#deudasinternas"/);
assert.match(header, /Deudas internas/);
assert.match(header, /deudasInternas/);
assert.match(header, /canUseInternalDebts/);
assert.match(header, /canShowFondoActions/);
assert.match(wrapper, /"deudasinternas"/);
assert.match(route, /InternalDebtsService/);
assert.match(route, /Agregar deuda/);
assert.match(route, /Registrar abono/);
assert.match(homeMenu, /id: "deudasinternas"/);
assert.match(standaloneHome, /id: "deudasinternas"/);
assert.match(favoritesCatalog, /id: "deudasinternas"/);
assert.doesNotMatch(
  route,
  /MovimientosFondos|movimientos-fondos|v2movements|fondogeneral-lastMovement/,
  "Internal debts page must not touch Fondo movement modules or state keys.",
);
