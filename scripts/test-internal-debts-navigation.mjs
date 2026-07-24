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
assert.match(
  route,
  /const debtorActors = useMemo/,
  "Internal debts page must keep a restricted debtor list.",
);
assert.match(
  route,
  /const creditorActors = useMemo/,
  "Internal debts page must keep a separate creditor list.",
);
assert.match(
  route,
  /actor\.type !== "user" \|\| actor\.id === user\?\.id/,
  "Debtor selector must only include the logged user/admin and collaborators.",
);
assert.match(
  route,
  /activeCompanyKey/,
  "Debtor selector must be scoped to the logged user's assigned company.",
);
assert.match(
  route,
  /actor\.empresaId === activeCompanyEmpresaId/,
  "Debtor collaborators must belong to the logged user's assigned company.",
);
assert.match(
  route,
  /actor\.type === "empleado" \|\| actor\.type === "user"/,
  "Creditor selector must include same-owner users, admins, and collaborators.",
);
assert.doesNotMatch(
  route,
  /creditorActors[\s\S]*actor\.type === "empresa"/,
  "Creditor selector must not include companies.",
);
assert.match(route, /actors=\{debtorActors\}/);
assert.match(route, /actors=\{creditorActors\}/);
assert.match(
  route,
  /function getActorSortRank/,
  "Actor selectors must be ordered by role group.",
);
assert.match(route, /roleLabel === "Admin"/);
assert.match(route, /roleLabel === "Usuario"/);
assert.match(route, /roleLabel === "Colaborador"/);
assert.match(route, /getActorSortRank\(a\) - getActorSortRank\(b\)/);
assert.match(
  route,
  /function isDebtPaid/,
  "Internal debts page must detect fully paid debts.",
);
assert.match(
  route,
  /const activeDebts = useMemo/,
  "Active grid must exclude fully paid debts.",
);
assert.match(
  route,
  /const paidDebts = useMemo/,
  "Fully paid debts must be available in a separate modal.",
);
assert.match(route, /setShowPaidDebts\(true\)/);
assert.match(route, /Deudas pagadas/);
assert.match(route, /Solo visualizacion/);
assert.match(route, /import useToast from "@\/hooks\/useToast"/);
assert.match(route, /const \{ showToast \} = useToast\(\)/);
assert.match(route, /function parseMoneyInput/);
assert.match(route, /function formatMoneyInput/);
assert.match(route, /value=\{formatMoneyInput\(debtForm\.amount\)\}/);
assert.match(route, /value=\{formatMoneyInput\(movementForm\.amount\)\}/);
assert.match(route, /inputMode="numeric"/);
assert.doesNotMatch(
  route,
  /formatMoneyPreview/,
  "Money format must live inside the input, not in a separate preview label.",
);
assert.match(route, /showToast\([^)]*, "error"/);
assert.match(
  route,
  /const selectedDebtRole = useMemo/,
  "Detail must know whether current actor is debtor or creditor.",
);
assert.match(
  route,
  /const selectedMovementType: InternalDebtMovementType/,
  "Movement type must be derived from viewer role.",
);
assert.match(route, /selectedDebtRole === "creditor" \? "payment" : "charge"/);
assert.doesNotMatch(
  route,
  /<option value="payment">Registrar abono<\/option>[\s\S]*<option value="charge">Agregar cargo<\/option>/,
  "Detail must not show both movement actions to one actor.",
);
assert.doesNotMatch(route, /typeFilter/);
assert.doesNotMatch(route, /setTypeFilter/);
assert.doesNotMatch(route, /Empresa \/ Persona/);
assert.doesNotMatch(
  route,
  /error && \(/,
  "Internal debts alerts must use toast, not inline alert blocks.",
);
assert.doesNotMatch(
  route,
  /selectedDebt &&[\s\S]*isDebtPaid\(selectedDebt\)[\s\S]*<form onSubmit=\{handleAddMovement\}/,
  "Fully paid detail must not render the movement form.",
);
assert.match(homeMenu, /id: "deudasinternas"/);
assert.match(standaloneHome, /id: "deudasinternas"/);
assert.match(favoritesCatalog, /id: "deudasinternas"/);
assert.doesNotMatch(
  route,
  /MovimientosFondos|movimientos-fondos|v2movements|fondogeneral-lastMovement/,
  "Internal debts page must not touch Fondo movement modules or state keys.",
);
