# SumaTiempos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear una extensión Manifest V3 independiente que muestre en tiempo real el total agregado del tiquete más la proyección de los números y montos todavía escritos en Gente Crystal.

**Architecture:** Un núcleo UMD/CommonJS concentra el parseo, el cálculo y un controlador DOM idempotente para poder probarlo con JSDOM. Un content script mínimo inicia el controlador y una hoja CSS posiciona la tarjeta junto a `.sales-capture`, con una variante compacta cuando no existe espacio lateral.

**Tech Stack:** JavaScript ES2020 compatible con Manifest V3, Chrome/Edge content scripts, DOM/MutationObserver, Vitest 4 y JSDOM 29, PowerShell `Compress-Archive`.

**Spec:** `docs/superpowers/specs/2026-09-14-sumatiempos-extension-design.md`

## Global Constraints

- Crear la extensión solamente dentro de `extensions/SumaTiempos/` y su prueba en `tests/sumatiempos.test.ts`.
- Inyectar únicamente en `https://gentecrystal.net/controllers/sales/SalesController.php*`.
- No modificar `TimeMasterGentecrystal`, `moverenter` ni otras extensiones.
- No solicitar permisos de almacenamiento, red o navegación.
- Calcular `total agregado + cantidad de números válidos × (monto normal + monto reventado activo)`.
- Reiniciar inmediatamente al pulsar `#btn-submit-sale`, sin esperar confirmación del servidor.
- No cancelar ni alterar eventos de Gente Crystal.
- Mantener la extensión funcional cuando falten nodos opcionales.

---

### Task 1: Núcleo de parseo y cálculo

**Files:**
- Create: `extensions/SumaTiempos/sumatiempos-core.js`
- Create: `tests/sumatiempos.test.ts`

**Interfaces:**
- Consumes: texto de números, textos monetarios y bandera de monto reventado activo.
- Produces: `parseCurrency(value): number`, `parseNumbers(value): string[]` y `calculateTotals(input): { numberCount, mainPerNumber, companionPerNumber, ticketTotal, captureTotal, grandTotal }` mediante `globalThis.SumaTiemposCore` y `module.exports`.

- [ ] **Step 1: Escribir las pruebas fallidas del cálculo**

Crear `tests/sumatiempos.test.ts` con imports de Vitest, `createRequire` y estos casos iniciales:

```ts
import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const {
  calculateTotals,
  parseCurrency,
  parseNumbers,
} = require("../extensions/SumaTiempos/sumatiempos-core.js");

describe("SumaTiempos calculations", () => {
  test("counts valid one and two digit numbers including 00", () => {
    expect(parseNumbers("55  22,33; 00 | 66")).toEqual(["55", "22", "33", "00", "66"]);
    expect(parseNumbers("100 foo")).toEqual([]);
  });

  test.each([
    ["₡ 1,250.50", 1250.5],
    ["1250", 1250],
    ["1.250,50", 1250.5],
    ["", 0],
    ["abc", 0],
  ])("parses currency %s", (value, expected) => {
    expect(parseCurrency(value)).toBe(expected);
  });

  test("combines ticket, normal and active companion amounts", () => {
    expect(calculateTotals({
      numbersText: "55 22 33",
      mainAmount: "100",
      companionAmount: "50",
      companionActive: true,
      ticketTotal: "₡ 200.00",
    })).toEqual({
      numberCount: 3,
      mainPerNumber: 100,
      companionPerNumber: 50,
      ticketTotal: 200,
      captureTotal: 450,
      grandTotal: 650,
    });
  });

  test("ignores a hidden companion amount", () => {
    expect(calculateTotals({
      numbersText: "05 06",
      mainAmount: "100",
      companionAmount: "500",
      companionActive: false,
      ticketTotal: "₡ 0.00",
    }).grandTotal).toBe(200);
  });
});
```

- [ ] **Step 2: Ejecutar la prueba para comprobar que falla**

Run: `npm test -- tests/sumatiempos.test.ts`

Expected: FAIL porque `extensions/SumaTiempos/sumatiempos-core.js` todavía no existe.

- [ ] **Step 3: Implementar las funciones puras mínimas**

Crear el módulo con envoltura UMD y estas reglas exactas:

```js
(function initializeSumaTiemposCore(root, factory) {
  const api = factory();
  root.SumaTiemposCore = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSumaTiemposCore() {
  "use strict";

  function parseNumbers(value) {
    return String(value ?? "")
      .trim()
      .split(/[\s,;|/\\-]+/)
      .filter((token) => /^\d{1,2}$/.test(token));
  }

  function parseCurrency(value) {
    let normalized = String(value ?? "").replace(/[^\d,.-]/g, "");
    if (!normalized || !/\d/.test(normalized)) return 0;
    const comma = normalized.lastIndexOf(",");
    const dot = normalized.lastIndexOf(".");
    if (comma >= 0 && dot >= 0) {
      const decimal = comma > dot ? "," : ".";
      const thousands = decimal === "," ? /\./g : /,/g;
      normalized = normalized.replace(thousands, "").replace(decimal, ".");
    } else if (comma >= 0) {
      normalized = /^-?\d{1,3}(,\d{3})+$/.test(normalized)
        ? normalized.replace(/,/g, "")
        : normalized.replace(",", ".");
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(normalized)) {
      normalized = normalized.replace(/\./g, "");
    }
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : 0;
  }

  function calculateTotals(input) {
    const numberCount = parseNumbers(input.numbersText).length;
    const mainPerNumber = parseCurrency(input.mainAmount);
    const companionPerNumber = input.companionActive
      ? parseCurrency(input.companionAmount)
      : 0;
    const ticketTotal = parseCurrency(input.ticketTotal);
    const captureTotal = numberCount * (mainPerNumber + companionPerNumber);
    return {
      numberCount,
      mainPerNumber,
      companionPerNumber,
      ticketTotal,
      captureTotal,
      grandTotal: ticketTotal + captureTotal,
    };
  }

  return { calculateTotals, parseCurrency, parseNumbers };
});
```

- [ ] **Step 4: Ejecutar la prueba enfocada**

Run: `npm test -- tests/sumatiempos.test.ts`

Expected: PASS para todos los casos de parseo y cálculo.

- [ ] **Step 5: Confirmar sintaxis y guardar el avance**

Run: `node --check extensions/SumaTiempos/sumatiempos-core.js`

Expected: exit code 0.

```powershell
git add extensions/SumaTiempos/sumatiempos-core.js tests/sumatiempos.test.ts
git commit -m "Add SumaTiempos calculation core"
```

---

### Task 2: Controlador DOM y tarjeta flotante

**Files:**
- Modify: `extensions/SumaTiempos/sumatiempos-core.js`
- Modify: `tests/sumatiempos.test.ts`
- Create: `extensions/SumaTiempos/content.js`
- Create: `extensions/SumaTiempos/content.css`

**Interfaces:**
- Consumes: `document`, `window`, los selectores del formulario de venta y las funciones de Task 1.
- Produces: `createSumaTiemposController(document, window): { start(): void, update(): void, destroy(): void }`, además de una sola tarjeta `#sumatiempos-panel`.

- [ ] **Step 1: Agregar pruebas DOM fallidas**

Importar `JSDOM`, extraer `createSumaTiemposController` y crear una fixture con `.sales-capture`, los tres inputs, `#total-amount`, `#btn-add`, `#btn-clear-numbers` y `#btn-submit-sale`. Añadir casos que comprueben:

```ts
test("shows live total and breakdown while typing", () => {
  const { dom, controller } = createFixture();
  controller.start();
  setValue(dom, "#ticket-amount", "100");
  setValue(dom, "#ticket-amount-companion", "50");
  setValue(dom, "#ticket-numbers", "55 22 33");
  expect(text(dom, "[data-sumatiempos=grand-total]")).toBe("₡ 450.00");
  expect(text(dom, "[data-sumatiempos=count]")).toBe("3 números");
});

test("keeps the amount through the real footer after Add", async () => {
  const { dom, controller } = createFixture();
  controller.start();
  setValue(dom, "#ticket-amount", "100");
  setValue(dom, "#ticket-numbers", "55 22");
  dom.window.document.querySelector("#ticket-numbers").value = "";
  dom.window.document.querySelector("#total-amount").textContent = "₡ 200.00";
  await flushMutations();
  expect(text(dom, "[data-sumatiempos=grand-total]")).toBe("₡ 200.00");
});

test("recalculates when a ticket line is removed", async () => {
  const { dom, controller } = createFixture({ ticketTotal: "₡ 300.00" });
  controller.start();
  dom.window.document.querySelector("#total-amount").textContent = "₡ 100.00";
  await flushMutations();
  expect(text(dom, "[data-sumatiempos=grand-total]")).toBe("₡ 100.00");
});

test("resets immediately on submit and ignores the stale footer", async () => {
  const { dom, controller } = createFixture({ ticketTotal: "₡ 300.00" });
  controller.start();
  dom.window.document.querySelector("#btn-submit-sale").click();
  dom.window.document.querySelector("#total-amount").textContent = "₡ 300.00";
  await flushMutations();
  expect(dom.window.document.querySelector("#sumatiempos-panel").hidden).toBe(true);
});

test("start is idempotent", () => {
  const { dom, controller } = createFixture();
  controller.start();
  controller.start();
  expect(dom.window.document.querySelectorAll("#sumatiempos-panel")).toHaveLength(1);
});
```

La fixture debe poder marcar `#ticket-companion-wrap` como oculto y comprobar que su valor queda excluido. `setValue` debe asignar `.value` y emitir `new Event("input", { bubbles: true })`; `flushMutations` debe resolver después de un `setTimeout(..., 0)`.

- [ ] **Step 2: Ejecutar para comprobar que el controlador falta**

Run: `npm test -- tests/sumatiempos.test.ts`

Expected: FAIL porque `createSumaTiemposController` no está exportado.

- [ ] **Step 3: Implementar el controlador y su estado de reinicio**

Extender `sumatiempos-core.js` con:

```js
function createSumaTiemposController(document, window) {
  let started = false;
  let observer = null;
  let ignoredTicketTotal = 0;
  let suppressOldTicket = false;

  function companionIsActive(input) {
    const wrap = document.querySelector("#ticket-companion-wrap");
    if (!input || input.disabled || !wrap || wrap.hidden) return false;
    return wrap.style.display !== "none" && window.getComputedStyle(wrap).display !== "none";
  }

  function readTotals() {
    const companion = document.querySelector("#ticket-amount-companion");
    const rawTicket = parseCurrency(document.querySelector("#total-amount")?.textContent);
    if (suppressOldTicket && rawTicket === 0) {
      suppressOldTicket = false;
      ignoredTicketTotal = 0;
    }
    const effectiveTicket = suppressOldTicket
      ? Math.max(0, rawTicket - ignoredTicketTotal)
      : rawTicket;
    return calculateTotals({
      numbersText: document.querySelector("#ticket-numbers")?.value,
      mainAmount: document.querySelector("#ticket-amount")?.value,
      companionAmount: companion?.value,
      companionActive: companionIsActive(companion),
      ticketTotal: effectiveTicket,
    });
  }
```

El controlador también debe:

- Crear una tarjeta estática con `role="status"`, `aria-live="polite"`, cuatro nodos `data-sumatiempos` (`grand-total`, `ticket-total`, `capture-total`, `count`) y textos iniciales en cero.
- Formatear importes como `` `₡ ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` `` para producir `₡ 450.00` de manera estable en pruebas y navegador.
- Mostrar la tarjeta cuando `numberCount > 0 || grandTotal > 0`; actualizar texto solo cuando cambie para no disparar ciclos del observer.
- En captura de `click` sobre `#btn-submit-sale`, guardar el total actual en `ignoredTicketTotal`, activar `suppressOldTicket`, limpiar textos y ocultar inmediatamente.
- En `input` y `change`, recalcular si el origen coincide con cualquiera de los tres inputs.
- Tras clic en `#btn-add` o `#btn-clear-numbers`, programar `update()` con `window.setTimeout(update, 0)`.
- Observar `document.body` con `childList`, `subtree`, `characterData` y atributos `style`, `class`, `hidden`, `disabled`, ignorando mutaciones cuyo objetivo esté dentro de `#sumatiempos-panel`.
- Reposicionar en `resize` y `scroll`. Aplicar clase `sumatiempos-panel--side` si quedan al menos 280 px a la derecha de `.sales-capture`; en caso contrario usar `sumatiempos-panel--compact`.
- En `destroy()`, desconectar observer, remover listeners y retirar la tarjeta.
- Exportar `createSumaTiemposController` junto con las funciones puras.

- [ ] **Step 4: Crear el arranque mínimo y estilos**

Crear `content.js`:

```js
(function initializeSumaTiempos(global) {
  "use strict";
  global.SumaTiemposCore
    .createSumaTiemposController(global.document, global)
    .start();
})(globalThis);
```

Crear `content.css` con reglas limitadas a `#sumatiempos-panel`: ancho lateral de 300 px, fondo blanco, borde azul grisáceo, radio de 14 px, sombra ligera, total principal de al menos 28 px, desglose legible y `pointer-events: none`. La variante lateral debe usar `position: fixed` con `left`, `top` y `width` asignados por el controlador; la compacta debe usar `position: fixed; right: 16px; bottom: 16px; width: min(300px, calc(100vw - 32px));`. El panel oculto debe respetar `[hidden] { display: none !important; }`.

- [ ] **Step 5: Ejecutar pruebas y sintaxis**

Run:

```powershell
npm test -- tests/sumatiempos.test.ts
node --check extensions/SumaTiempos/sumatiempos-core.js
node --check extensions/SumaTiempos/content.js
```

Expected: todos los casos PASS y ambos chequeos con exit code 0.

- [ ] **Step 6: Guardar el controlador comprobado**

```powershell
git add extensions/SumaTiempos/sumatiempos-core.js extensions/SumaTiempos/content.js extensions/SumaTiempos/content.css tests/sumatiempos.test.ts
git commit -m "Add SumaTiempos live total panel"
```

---

### Task 3: Manifiesto, documentación y paquete distribuible

**Files:**
- Modify: `tests/sumatiempos.test.ts`
- Create: `extensions/SumaTiempos/manifest.json`
- Create: `extensions/SumaTiempos/README.txt`
- Create: `extensions/SumaTiempos/SumaTiempos.zip`

**Interfaces:**
- Consumes: `sumatiempos-core.js`, `content.js` y `content.css` de las tareas anteriores.
- Produces: extensión cargable desde `extensions/SumaTiempos/` y archivo distribuible `SumaTiempos.zip` con los cinco archivos fuente requeridos en la raíz del ZIP.

- [ ] **Step 1: Añadir una prueba fallida del manifiesto**

Agregar al archivo de pruebas:

```ts
import { readFileSync } from "node:fs";

test("manifest is permissionless and limited to the sales controller", () => {
  const manifest = JSON.parse(readFileSync(
    new URL("../extensions/SumaTiempos/manifest.json", import.meta.url),
    "utf8",
  ));
  expect(manifest).toMatchObject({
    manifest_version: 3,
    name: "SumaTiempos",
    version: "1.0.0",
  });
  expect(manifest.permissions).toBeUndefined();
  expect(manifest.host_permissions).toBeUndefined();
  expect(manifest.content_scripts).toEqual([{
    matches: ["https://gentecrystal.net/controllers/sales/SalesController.php*"],
    js: ["sumatiempos-core.js", "content.js"],
    css: ["content.css"],
    run_at: "document_idle",
  }]);
});
```

- [ ] **Step 2: Ejecutar para comprobar que falta el manifiesto**

Run: `npm test -- tests/sumatiempos.test.ts`

Expected: FAIL con error de archivo inexistente para `manifest.json`.

- [ ] **Step 3: Crear manifiesto y guía de instalación**

Crear `manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "SumaTiempos",
  "version": "1.0.0",
  "description": "Muestra la suma total del tiquete y los números pendientes en Gente Crystal.",
  "content_scripts": [
    {
      "matches": ["https://gentecrystal.net/controllers/sales/SalesController.php*"],
      "js": ["sumatiempos-core.js", "content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ]
}
```

Crear `README.txt` con instrucciones numeradas para abrir `chrome://extensions` o `edge://extensions`, activar modo desarrollador, cargar `extensions/SumaTiempos`, recargar la URL de ventas y explicar la fórmula con el ejemplo `3 × (₡100 + ₡50) + ₡200 = ₡650`. Documentar que el panel se reinicia al pulsar Ingresar venta.

- [ ] **Step 4: Ejecutar la prueba enfocada completa**

Run: `npm test -- tests/sumatiempos.test.ts`

Expected: todos los casos PASS.

- [ ] **Step 5: Construir y revisar el ZIP**

Run:

```powershell
$files = @(
  'extensions\SumaTiempos\manifest.json',
  'extensions\SumaTiempos\sumatiempos-core.js',
  'extensions\SumaTiempos\content.js',
  'extensions\SumaTiempos\content.css',
  'extensions\SumaTiempos\README.txt'
)
Compress-Archive -LiteralPath $files -DestinationPath 'extensions\SumaTiempos\SumaTiempos.zip' -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::OpenRead((Resolve-Path 'extensions\SumaTiempos\SumaTiempos.zip')).Entries.FullName
```

Expected: exactamente `manifest.json`, `sumatiempos-core.js`, `content.js`, `content.css` y `README.txt`, sin rutas externas ni otros archivos.

- [ ] **Step 6: Guardar el paquete**

```powershell
git add extensions/SumaTiempos/manifest.json extensions/SumaTiempos/README.txt extensions/SumaTiempos/SumaTiempos.zip tests/sumatiempos.test.ts
git commit -m "Package SumaTiempos extension"
```

---

### Task 4: Verificación integral y entrega

**Files:**
- Verify only: `extensions/SumaTiempos/*`
- Verify only: `tests/sumatiempos.test.ts`

**Interfaces:**
- Consumes: la extensión completa de Tasks 1 a 3.
- Produces: evidencia final de pruebas, sintaxis, manifiesto, ZIP y limpieza del diff.

- [ ] **Step 1: Ejecutar la prueba enfocada en un proceso limpio**

Run: `npm test -- tests/sumatiempos.test.ts`

Expected: todos los casos PASS.

- [ ] **Step 2: Ejecutar la suite completa del repositorio**

Run: `npm test -- --pool=threads --maxWorkers=1`

Expected: exit code 0. Si falla fuera de `tests/sumatiempos.test.ts`, registrar por separado el fallo preexistente y no atribuirlo a la extensión.

- [ ] **Step 3: Validar scripts, manifiesto y ZIP**

Run:

```powershell
node --check extensions/SumaTiempos/sumatiempos-core.js
node --check extensions/SumaTiempos/content.js
Get-Content -Raw extensions/SumaTiempos/manifest.json | ConvertFrom-Json | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path 'extensions\SumaTiempos\SumaTiempos.zip'))
$zip.Entries.FullName
$zip.Dispose()
```

Expected: scripts válidos, JSON válido y cinco entradas correctas en el ZIP.

- [ ] **Step 4: Revisar exclusivamente el cambio autorizado**

Run:

```powershell
git diff --check HEAD~3..HEAD
git status --short
git log -4 --oneline --decorate
```

Expected: ningún error de espacios. `moverenter` puede continuar apareciendo como trabajo ajeno sin seguimiento; no debe estar incluido en los commits de SumaTiempos.

- [ ] **Step 5: Realizar verificación visual cuando haya sesión disponible**

Cargar `extensions/SumaTiempos/` como extensión descomprimida, abrir la URL de ventas, introducir tres números con `₡100` normal y `₡50` reventado, y comprobar la tarjeta `₡450.00`. Agregar una línea previa de `₡200` para comprobar `₡650.00`, eliminarla para comprobar el recálculo y pulsar Ingresar venta para comprobar que la tarjeta desaparece inmediatamente.

Si la sesión autenticada no está disponible, entregar el resto de verificaciones aprobadas e indicar explícitamente que esta comprobación visual quedó pendiente.
