# Encabezado de Impresión Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear una extensión Chrome Manifest V3 independiente que anteponga una imagen y líneas centradas, configuradas una sola vez, a los comprobantes impresos de Tucán y Junta.

**Architecture:** La extensión separa lógica pura y comprobable (`settings-core.js`, `print-core.js`, `site-access.js`, `image-core.js`) de los adaptadores Chrome/DOM (`print-content.js` y `popup.js`). Tucán usa un content script estático con `match_about_blank`; Junta obtiene un content script dinámico para el único origen autorizado desde el panel.

**Tech Stack:** JavaScript ES2020 compatible con Chrome Manifest V3, Chrome Extensions APIs (`storage`, `permissions`, `scripting`), HTML/CSS, Vitest 4, JSDOM 29 y Sharp para generar el icono PNG.

**Spec:** `docs/superpowers/specs/2026-09-29-encabezado-impresion-design.md`

## Global Constraints

- Crear la extensión únicamente en `extensions/EncabezadoImpresion/`; no modificar otras extensiones.
- Compartir una sola configuración local entre Tucán y Junta.
- Aceptar imágenes PNG, JPEG y WebP, reducirlas como máximo a 1200 px de ancho y rechazar resultados mayores de 2 MB.
- Aceptar un límite general entero entre 1 y 200 caracteres y aplicarlo a todas las líneas.
- Insertar imagen primero y después líneas centradas, una por elemento, antes del comprobante original.
- No interceptar ni retrasar `window.print()`.
- Solicitar el permiso de Junta solamente desde una acción explícita y únicamente para el origen configurado.
- No afirmar compatibilidad con sesiones autenticadas, el `about:blank` real de BCR o una impresora térmica hasta comprobarlas en esos entornos.
- Preservar los cambios preexistentes `extensions/ProteccionAutorrelleno.zip` y `extensions/LeerRegistro.zip`.

## Review Focus

- Dos activaciones simultáneas (MutationObserver y `beforeprint`) deben producir exactamente un encabezado; se prueba en Task 2.
- Configuración almacenada corrupta o de una versión desconocida debe degradar a valores seguros sin romper la impresión; se prueba en Task 1.
- Una URL con credenciales, puerto, ruta o consulta debe autorizar solo su `origin`, mientras esquemas no HTTP(S) deben rechazarse; se prueba en Task 3.
- Un fallo al registrar el nuevo sitio de Junta no debe revocar el permiso ni perder el registro anterior; se prueba en Task 3.
- Una selección de imagen inválida o demasiado grande no debe reemplazar la imagen válida guardada; se prueba en Task 4.

---

### Task 1: Modelo y validación de la configuración compartida

**Files:**
- Create: `extensions/EncabezadoImpresion/settings-core.js`
- Create: `tests/extensions/encabezado-impresion-settings.test.ts`

**Interfaces:**
- Consumes: ningún archivo de la extensión.
- Produces: `STORAGE_KEY`, `DEFAULT_SETTINGS`, `normalizeSettings(raw)`, `validateDraft(raw)`, `normalizeJuntaOrigin(value)` y `originPattern(origin)` mediante CommonJS en pruebas y `globalThis.EncabezadoImpresionSettings` en Chrome.

- [ ] **Step 1: Escribir pruebas fallidas para valores predeterminados, recuperación y validación**

```ts
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const requireModule = createRequire(import.meta.url);
const corePath = resolve("extensions/EncabezadoImpresion/settings-core.js");

describe("EncabezadoImpresion settings", () => {
  it("recupera una configuración corrupta con valores seguros", () => {
    const { normalizeSettings } = requireModule(corePath);
    expect(normalizeSettings({ schemaVersion: 99, maxCharacters: 0, lines: "x" }))
      .toEqual({ schemaVersion: 1, imageDataUrl: "", maxCharacters: 40, lines: [], juntaOrigin: "" });
  });

  it("conserva el orden, recorta bordes y omite líneas vacías", () => {
    const { normalizeSettings } = requireModule(corePath);
    expect(normalizeSettings({ maxCharacters: 20, lines: ["  Uno ", " ", "Dos"] }).lines)
      .toEqual(["Uno", "Dos"]);
  });

  it("rechaza límites y líneas que no caben", () => {
    const { validateDraft } = requireModule(corePath);
    expect(validateDraft({ maxCharacters: 4, lines: ["Cinco"] })).toMatchObject({
      ok: false,
      errors: ["La línea 1 supera el límite de 4 caracteres."],
    });
    expect(validateDraft({ maxCharacters: 201, lines: [] }).ok).toBe(false);
  });

  it("solo conserva data URLs de PNG, JPEG y WebP", () => {
    const { normalizeSettings } = requireModule(corePath);
    expect(normalizeSettings({ imageDataUrl: "data:text/html;base64,WA==" }).imageDataUrl).toBe("");
    expect(normalizeSettings({ imageDataUrl: "data:image/png;base64,iVBORw0KGgo=" }).imageDataUrl)
      .toBe("data:image/png;base64,iVBORw0KGgo=");
  });
});
```

- [ ] **Step 2: Ejecutar las pruebas y confirmar el fallo inicial**

Run: `npx vitest run tests/extensions/encabezado-impresion-settings.test.ts`

Expected: FAIL porque `settings-core.js` todavía no existe.

- [ ] **Step 3: Implementar el módulo UMD de configuración**

```js
(function init(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EncabezadoImpresionSettings = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildSettings() {
  "use strict";
  const STORAGE_KEY = "encabezadoImpresionSettingsV1";
  const DEFAULT_SETTINGS = Object.freeze({
    schemaVersion: 1,
    imageDataUrl: "",
    maxCharacters: 40,
    lines: [],
    juntaOrigin: "",
  });
  const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,/i;

  function normalizeJuntaOrigin(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const url = new URL(value.trim());
      return url.protocol === "http:" || url.protocol === "https:" ? url.origin : "";
    } catch { return ""; }
  }

  function originPattern(origin) {
    const normalized = normalizeJuntaOrigin(origin);
    return normalized ? `${normalized}/*` : "";
  }

  function normalizeSettings(raw) {
    const value = raw && typeof raw === "object" ? raw : {};
    const maxCharacters = Number.isInteger(value.maxCharacters) && value.maxCharacters >= 1 && value.maxCharacters <= 200
      ? value.maxCharacters : DEFAULT_SETTINGS.maxCharacters;
    const lines = Array.isArray(value.lines)
      ? value.lines.filter((line) => typeof line === "string").map((line) => line.trim()).filter(Boolean)
      : [];
    return {
      schemaVersion: 1,
      imageDataUrl: typeof value.imageDataUrl === "string" && IMAGE_DATA_URL.test(value.imageDataUrl) ? value.imageDataUrl : "",
      maxCharacters,
      lines: lines.filter((line) => line.length <= maxCharacters),
      juntaOrigin: normalizeJuntaOrigin(value.juntaOrigin),
    };
  }

  function validateDraft(raw) {
    const errors = [];
    const limit = Number(raw?.maxCharacters);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) errors.push("El límite debe ser un entero entre 1 y 200.");
    const lines = Array.isArray(raw?.lines) ? raw.lines : [];
    if (Number.isInteger(limit)) lines.forEach((line, index) => {
      if (String(line).trim().length > limit) errors.push(`La línea ${index + 1} supera el límite de ${limit} caracteres.`);
    });
    return { ok: errors.length === 0, errors, value: errors.length ? null : normalizeSettings(raw) };
  }

  return { STORAGE_KEY, DEFAULT_SETTINGS, normalizeSettings, validateDraft, normalizeJuntaOrigin, originPattern };
});
```

- [ ] **Step 4: Ejecutar la prueba enfocada y confirmar que pasa**

Run: `npx vitest run tests/extensions/encabezado-impresion-settings.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit de la configuración**

```powershell
git add -- extensions/EncabezadoImpresion/settings-core.js tests/extensions/encabezado-impresion-settings.test.ts
git commit -m "feat: add print header settings model"
```

### Task 2: Detección e inserción idempotente en ambos comprobantes

**Files:**
- Create: `extensions/EncabezadoImpresion/print-core.js`
- Create: `extensions/EncabezadoImpresion/print-content.js`
- Create: `extensions/EncabezadoImpresion/print-content.css`
- Create: `tests/extensions/encabezado-impresion-content.test.ts`

**Interfaces:**
- Consumes: `EncabezadoImpresionSettings.STORAGE_KEY` y `normalizeSettings(raw)` de Task 1.
- Produces: `HEADER_ID`, `detectReceipt(document)`, `insertHeader(document, settings)`, y `createPrintController(document, window, storage)` mediante `EncabezadoImpresionPrintCore`/CommonJS; `print-content.js` arranca el controlador con `chrome.storage.local`.

- [ ] **Step 1: Escribir pruebas fallidas usando las capturas HTML reales**

```ts
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const requireModule = createRequire(import.meta.url);
const corePath = resolve("extensions/EncabezadoImpresion/print-core.js");
const tucanHtml = readFileSync(resolve("src/data/ImpresionTucan.md"), "utf8");
const juntaHtml = readFileSync(resolve("src/data/ImpresionJunta.md"), "utf8");
const settings = { schemaVersion: 1, imageDataUrl: "data:image/png;base64,iVBORw0KGgo=", maxCharacters: 40, lines: ["Paga tus servicios", "8565-5655"], juntaOrigin: "" };

describe("EncabezadoImpresion print core", () => {
  it.each([
    ["Tucán", tucanHtml, "#tablaComprobantePago"],
    ["Junta", juntaHtml, ".page"],
  ])("inserta imagen y líneas al inicio de %s", (_name, html, selector) => {
    const dom = new JSDOM(html);
    const { insertHeader, HEADER_ID } = requireModule(corePath);
    expect(insertHeader(dom.window.document, settings)).toBe(true);
    const target = dom.window.document.querySelector(selector)!;
    expect(target.firstElementChild?.id).toBe(HEADER_ID);
    expect(target.querySelectorAll(`#${HEADER_ID}`).length).toBe(1);
    expect(target.querySelector("img")?.getAttribute("src")).toBe(settings.imageDataUrl);
    expect([...target.querySelectorAll(".ei-line")].map((node) => node.textContent))
      .toEqual(settings.lines);
  });

  it("permanece idempotente ante activaciones concurrentes", async () => {
    const dom = new JSDOM(tucanHtml);
    const { insertHeader, HEADER_ID } = requireModule(corePath);
    await Promise.all([Promise.resolve().then(() => insertHeader(dom.window.document, settings)), Promise.resolve().then(() => insertHeader(dom.window.document, settings))]);
    expect(dom.window.document.querySelectorAll(`#${HEADER_ID}`)).toHaveLength(1);
  });

  it("no modifica documentos desconocidos ni crea bloques vacíos", () => {
    const dom = new JSDOM("<main>otro sitio</main>");
    const { insertHeader } = requireModule(corePath);
    expect(insertHeader(dom.window.document, settings)).toBe(false);
    expect(insertHeader(new JSDOM(tucanHtml).window.document, { ...settings, imageDataUrl: "", lines: [] })).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutar la prueba y confirmar que falla por módulo ausente**

Run: `npx vitest run tests/extensions/encabezado-impresion-content.test.ts`

Expected: FAIL porque `print-core.js` no existe.

- [ ] **Step 3: Implementar detección y construcción segura del encabezado**

```js
const HEADER_ID = "encabezado-impresion-extension";

function detectReceipt(documentRef) {
  const tucan = documentRef.querySelector("#tablaComprobantePago");
  if (tucan) return { kind: "tucan", target: tucan };
  const page = documentRef.querySelector(".page");
  if (page?.querySelector(".print-container") && page.querySelector(".table-receipt")) return { kind: "junta", target: page };
  return null;
}

function insertHeader(documentRef, rawSettings) {
  const receipt = detectReceipt(documentRef);
  if (!receipt || documentRef.getElementById(HEADER_ID)) return Boolean(documentRef.getElementById(HEADER_ID));
  const value = settings.normalizeSettings(rawSettings);
  if (!value.imageDataUrl && value.lines.length === 0) return false;
  const section = documentRef.createElement("section");
  section.id = HEADER_ID;
  section.className = "ei-header";
  if (value.imageDataUrl) {
    const image = documentRef.createElement("img");
    image.className = "ei-image";
    image.alt = "";
    image.src = value.imageDataUrl;
    image.addEventListener("error", () => { image.hidden = true; }, { once: true });
    section.append(image);
  }
  for (const text of value.lines) {
    const line = documentRef.createElement("div");
    line.className = "ei-line";
    line.textContent = text;
    section.append(line);
  }
  receipt.target.prepend(section);
  return true;
}
```

Añadir un `createPrintController` que serialice llamadas con una promesa interna, lea `{[STORAGE_KEY]: DEFAULT_SETTINGS}`, observe `document` desde `document_start`, vuelva a ejecutar en `DOMContentLoaded` y `beforeprint`, y desconecte el observador después de una inserción exitosa. `print-content.js` debe crear este controlador sin lanzar errores si `chrome.storage` no está disponible.

- [ ] **Step 4: Añadir estilos aislados y resistentes al ancho térmico**

```css
#encabezado-impresion-extension.ei-header {
  box-sizing: border-box !important;
  width: 100% !important;
  max-width: 80mm !important;
  margin: 0 auto 4mm !important;
  padding: 0 !important;
  text-align: center !important;
  color: #000 !important;
  overflow: hidden !important;
}
#encabezado-impresion-extension .ei-image {
  display: block !important;
  max-width: 100% !important;
  height: auto !important;
  margin: 0 auto 2mm !important;
}
#encabezado-impresion-extension .ei-line {
  display: block !important;
  max-width: 100% !important;
  margin: 0 !important;
  white-space: pre-wrap !important;
  overflow-wrap: anywhere !important;
  text-align: center !important;
}
@media print {
  #encabezado-impresion-extension { break-inside: avoid !important; }
}
```

- [ ] **Step 5: Ampliar la prueba para arranque antes del DOM y `beforeprint`**

Construir el DOM vacío, iniciar `createPrintController`, insertar después `#tablaComprobantePago`, esperar dos microtareas y afirmar un encabezado. Disparar luego `beforeprint` y afirmar que continúa existiendo exactamente uno.

- [ ] **Step 6: Ejecutar pruebas enfocadas**

Run: `npx vitest run tests/extensions/encabezado-impresion-settings.test.ts tests/extensions/encabezado-impresion-content.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit de inserción**

```powershell
git add -- extensions/EncabezadoImpresion/print-core.js extensions/EncabezadoImpresion/print-content.js extensions/EncabezadoImpresion/print-content.css tests/extensions/encabezado-impresion-content.test.ts
git commit -m "feat: inject shared header into print receipts"
```

### Task 3: Permiso opcional y registro dinámico de Junta

**Files:**
- Create: `extensions/EncabezadoImpresion/site-access.js`
- Create: `tests/extensions/encabezado-impresion-site-access.test.ts`

**Interfaces:**
- Consumes: `normalizeJuntaOrigin(value)` y `originPattern(origin)` de Task 1.
- Produces: `JUNTA_SCRIPT_ID`, `buildJuntaRegistration(origin)` y `updateJuntaAccess(chromeApi, previousOrigin, requestedUrl)` mediante `EncabezadoImpresionSiteAccess`/CommonJS.

- [ ] **Step 1: Escribir pruebas fallidas para normalización, alta, reemplazo y rollback**

```ts
it("extrae solo el origin de una URL completa", () => {
  expect(normalizeJuntaOrigin("https://usuario:clave@junta.test:8443/ruta?q=1"))
    .toBe("https://junta.test:8443");
  expect(normalizeJuntaOrigin("file:///tmp/factura.html")).toBe("");
});

it("registra document_start persistente con los tres scripts", async () => {
  const result = await updateJuntaAccess(chromeApi, "", "https://junta.test/imprimir/1");
  expect(result).toEqual({ ok: true, origin: "https://junta.test" });
  expect(calls.register[0]).toMatchObject({
    id: "encabezado-impresion-junta",
    matches: ["https://junta.test/*"],
    js: ["settings-core.js", "print-core.js", "print-content.js"],
    css: ["print-content.css"],
    runAt: "document_start",
    persistAcrossSessions: true,
  });
});

it("no retira el acceso anterior cuando el nuevo registro falla", async () => {
  const api = createChromeApi({ updateFailure: true });
  const result = await updateJuntaAccess(api.chromeApi, "https://viejo.test", "https://nuevo.test");
  expect(result.ok).toBe(false);
  expect(api.calls.remove).toEqual([]);
});
```

El mock debe cubrir `permissions.request/remove`, `scripting.getRegisteredContentScripts/registerContentScripts/updateContentScripts/unregisterContentScripts` y registrar cada llamada.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo inicial**

Run: `npx vitest run tests/extensions/encabezado-impresion-site-access.test.ts`

Expected: FAIL porque `site-access.js` no existe.

- [ ] **Step 3: Implementar la transición atómica del sitio autorizado**

```js
const JUNTA_SCRIPT_ID = "encabezado-impresion-junta";
function buildJuntaRegistration(origin) {
  return {
    id: JUNTA_SCRIPT_ID,
    matches: [settings.originPattern(origin)],
    js: ["settings-core.js", "print-core.js", "print-content.js"],
    css: ["print-content.css"],
    runAt: "document_start",
    persistAcrossSessions: true,
  };
}

async function updateJuntaAccess(chromeApi, previousOrigin, requestedUrl) {
  const previous = settings.normalizeJuntaOrigin(previousOrigin);
  const next = settings.normalizeJuntaOrigin(requestedUrl);
  if (requestedUrl.trim() && !next) return { ok: false, origin: previous, error: "Ingrese una URL HTTP o HTTPS válida." };
  if (!next) {
    await chromeApi.scripting.unregisterContentScripts({ ids: [JUNTA_SCRIPT_ID] }).catch(() => {});
    if (previous) await chromeApi.permissions.remove({ origins: [settings.originPattern(previous)] });
    return { ok: true, origin: "" };
  }
  const granted = await chromeApi.permissions.request({ origins: [settings.originPattern(next)] });
  if (!granted) return { ok: false, origin: previous, error: "Chrome no concedió acceso al sitio de Junta." };
  try {
    const registered = await chromeApi.scripting.getRegisteredContentScripts({ ids: [JUNTA_SCRIPT_ID] });
    if (registered.length) await chromeApi.scripting.updateContentScripts([buildJuntaRegistration(next)]);
    else await chromeApi.scripting.registerContentScripts([buildJuntaRegistration(next)]);
  } catch (error) {
    if (next !== previous) await chromeApi.permissions.remove({ origins: [settings.originPattern(next)] }).catch(() => {});
    return { ok: false, origin: previous, error: "No fue posible activar Junta." };
  }
  if (previous && previous !== next) await chromeApi.permissions.remove({ origins: [settings.originPattern(previous)] });
  return { ok: true, origin: next };
}
```

Antes de `permissions.request`, devolver `{ ok: true, origin: previous }` cuando `next === previous`. Al limpiar, capturar únicamente el error de `unregisterContentScripts` para tolerar un registro inexistente; después retirar el permiso anterior y propagar cualquier fallo real de `permissions.remove` como `{ ok: false, origin: previous, error: "No fue posible desactivar Junta." }`.

- [ ] **Step 4: Ejecutar pruebas enfocadas y confirmar que pasan**

Run: `npx vitest run tests/extensions/encabezado-impresion-site-access.test.ts`

Expected: PASS, incluidos rechazo de permiso, URL inválida, mismo origen, eliminación y rollback.

- [ ] **Step 5: Commit de permisos de Junta**

```powershell
git add -- extensions/EncabezadoImpresion/site-access.js tests/extensions/encabezado-impresion-site-access.test.ts
git commit -m "feat: authorize configurable Junta print site"
```

### Task 4: Panel, imagen, líneas y vista previa

**Files:**
- Create: `extensions/EncabezadoImpresion/image-core.js`
- Create: `extensions/EncabezadoImpresion/popup.html`
- Create: `extensions/EncabezadoImpresion/popup.css`
- Create: `extensions/EncabezadoImpresion/popup.js`
- Create: `tests/extensions/encabezado-impresion-popup.test.ts`

**Interfaces:**
- Consumes: modelo de Task 1 y `updateJuntaAccess` de Task 3.
- Produces: `isAcceptedImageType(type)`, `calculateScaledSize(width, height)`, `estimateDataUrlBytes(dataUrl)` y `createPopupController(document, chrome, browserDeps)`.

- [ ] **Step 1: Escribir pruebas fallidas para imagen y operaciones de líneas**

```ts
it("escala sin ampliar y conserva proporción", () => {
  expect(calculateScaledSize(2400, 1200)).toEqual({ width: 1200, height: 600 });
  expect(calculateScaledSize(600, 300)).toEqual({ width: 600, height: 300 });
});

it("agrega, reordena y elimina líneas conservando sus textos", async () => {
  const controller = createPopupController(document, chromeApi, { processImageFile: vi.fn() });
  await controller.start();
  click("add-line");
  setLine(0, "Primera");
  click("add-line");
  setLine(1, "Segunda");
  clickLineAction(1, "up");
  expect(readLines()).toEqual(["Segunda", "Primera"]);
  clickLineAction(1, "delete");
  expect(readLines()).toEqual(["Segunda"]);
});

it("mantiene la imagen previa si el archivo nuevo falla", async () => {
  const processImageFile = vi.fn().mockRejectedValue(new Error("La imagen supera 2 MB."));
  const controller = createPopupController(document, chromeApiWithStoredImage, { processImageFile });
  await controller.start();
  await controller.selectImage(fakeFile);
  expect(controller.getDraft().imageDataUrl).toBe(savedImage);
  expect(document.querySelector("#message")?.textContent).toBe("La imagen supera 2 MB.");
});
```

El fixture HTML de prueba debe contener exactamente `image-file`, `remove-image`, `max-characters`, `lines`, `add-line`, `junta-url`, `authorize-junta`, `preview`, `save` y `message`, iguales al HTML del Step 4. Añadir estas aserciones: cambiar el límite a `12` establece `maxlength="12"` en cada input y muestra `5/12`; reducirlo por debajo de un texto existente bloquea `storage.local.set`; guardar escribe una sola propiedad con clave `STORAGE_KEY`; `#preview img` precede a `.ei-preview-line`; y un `{ ok: false, error: "Chrome no concedió acceso al sitio de Junta." }` deja `juntaOrigin` intacto y muestra ese mensaje.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo inicial**

Run: `npx vitest run tests/extensions/encabezado-impresion-popup.test.ts`

Expected: FAIL porque los módulos del panel no existen.

- [ ] **Step 3: Implementar utilidades puras y procesamiento real de imagen**

```js
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_WIDTH = 1200;
const MAX_BYTES = 2 * 1024 * 1024;
function calculateScaledSize(width, height) {
  const scale = width > MAX_WIDTH ? MAX_WIDTH / width : 1;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
function estimateDataUrlBytes(dataUrl) {
  const payload = String(dataUrl).split(",")[1] || "";
  return Math.floor((payload.length * 3) / 4) - (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0);
}
```

En `popup.js`, `processImageFile` debe validar MIME, leer con `FileReader`, decodificar con `Image`, dibujar en `canvas` al tamaño calculado, exportar en el mismo formato (calidad `0.9` para JPEG/WebP), verificar `estimateDataUrlBytes <= MAX_BYTES` y resolver la data URL. Ante cualquier error no debe modificar el borrador actual.

- [ ] **Step 4: Construir el panel accesible y su controlador**

El HTML debe incluir:

```html
<input id="image-file" type="file" accept="image/png,image/jpeg,image/webp">
<button id="remove-image" type="button">Quitar imagen</button>
<input id="max-characters" type="number" min="1" max="200" value="40">
<div id="lines" aria-label="Líneas del encabezado"></div>
<button id="add-line" type="button">Añadir línea</button>
<input id="junta-url" type="url" placeholder="https://sitio.ejemplo/ruta">
<button id="authorize-junta" type="button">Autorizar sitio de Junta</button>
<section id="preview" aria-label="Vista previa"></section>
<button id="save" type="button">Guardar configuración</button>
<p id="message" role="status" aria-live="polite"></p>
```

Cada fila de línea tendrá input, contador y botones `Subir`, `Bajar`, `Eliminar`. El controlador mantendrá un solo borrador, actualizará `maxlength` y contadores al cambiar el límite, renderizará la vista previa con `textContent`, y solo escribirá en `chrome.storage.local` después de `validateDraft`. El botón de Junta llamará `updateJuntaAccess`; guardará `juntaOrigin` únicamente si la transición termina correctamente.

- [ ] **Step 5: Ejecutar pruebas del panel y corregir hasta pasar**

Run: `npx vitest run tests/extensions/encabezado-impresion-popup.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit del panel**

```powershell
git add -- extensions/EncabezadoImpresion/image-core.js extensions/EncabezadoImpresion/popup.html extensions/EncabezadoImpresion/popup.css extensions/EncabezadoImpresion/popup.js tests/extensions/encabezado-impresion-popup.test.ts
git commit -m "feat: add shared print header configuration panel"
```

### Task 5: Manifiesto, icono, documentación y paquete instalable

**Files:**
- Create: `extensions/EncabezadoImpresion/manifest.json`
- Create: `extensions/EncabezadoImpresion/icon.svg`
- Create: `extensions/EncabezadoImpresion/icon128.png`
- Create: `extensions/EncabezadoImpresion/README.txt`
- Create: `tests/extensions/encabezado-impresion-package.test.ts`
- Create: `extensions/EncabezadoImpresion.zip`

**Interfaces:**
- Consumes: todos los módulos de Tasks 1-4.
- Produces: extensión cargable y ZIP distribuible.

- [ ] **Step 1: Escribir prueba fallida del contrato Manifest V3**

```ts
it("limita Tucán y deja Junta como permiso opcional", () => {
  const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions).toEqual(expect.arrayContaining(["storage", "scripting"]));
  expect(manifest.host_permissions).toEqual(["https://www.bcrcorresponsal.bancobcr.com/BCRCorresponsalesExterno/*"]);
  expect(manifest.optional_host_permissions).toEqual(["http://*/*", "https://*/*"]);
  expect(manifest.content_scripts[0]).toMatchObject({
    matches: ["https://www.bcrcorresponsal.bancobcr.com/BCRCorresponsalesExterno/*"],
    js: ["settings-core.js", "print-core.js", "print-content.js"],
    css: ["print-content.css"],
    run_at: "document_start",
    match_about_blank: true,
  });
});
```

Añadir aserciones para todos los archivos referenciados, popup, icono PNG 128×128, README con instrucciones de Junta y ausencia de permisos `<all_urls>` permanentes.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo inicial**

Run: `npx vitest run tests/extensions/encabezado-impresion-package.test.ts`

Expected: FAIL porque `manifest.json` no existe.

- [ ] **Step 3: Crear el manifiesto y el icono**

```json
{
  "manifest_version": 3,
  "name": "Encabezado de impresión",
  "version": "1.0.0",
  "description": "Agrega una imagen y líneas configurables a los comprobantes de Tucán y Junta.",
  "permissions": ["storage", "scripting"],
  "host_permissions": ["https://www.bcrcorresponsal.bancobcr.com/BCRCorresponsalesExterno/*"],
  "optional_host_permissions": ["http://*/*", "https://*/*"],
  "action": { "default_popup": "popup.html", "default_icon": { "128": "icon128.png" } },
  "icons": { "128": "icon128.png" },
  "content_scripts": [{
    "matches": ["https://www.bcrcorresponsal.bancobcr.com/BCRCorresponsalesExterno/*"],
    "js": ["settings-core.js", "print-core.js", "print-content.js"],
    "css": ["print-content.css"],
    "run_at": "document_start",
    "match_about_blank": true
  }]
}
```

Crear un SVG cuadrado sencillo con símbolo de recibo/imagen y convertirlo sin instalar dependencias:

Run: `node -e "require('sharp')('extensions/EncabezadoImpresion/icon.svg').resize(128,128).png().toFile('extensions/EncabezadoImpresion/icon128.png')"`

Expected: crea un PNG 128×128.

- [ ] **Step 4: Escribir README de instalación y uso**

Documentar: cargar descomprimida, abrir el panel, elegir imagen, límite y líneas, guardar, autorizar Junta pegando una URL real, reemplazar/revocar la URL, y probar impresión. Indicar de forma explícita que la URL real de Junta, el popup `about:blank` autenticado de BCR y una impresora térmica requieren validación en el equipo del usuario.

- [ ] **Step 5: Ejecutar todas las pruebas de la extensión**

Run: `npx vitest run tests/extensions/encabezado-impresion-settings.test.ts tests/extensions/encabezado-impresion-content.test.ts tests/extensions/encabezado-impresion-site-access.test.ts tests/extensions/encabezado-impresion-popup.test.ts tests/extensions/encabezado-impresion-package.test.ts`

Expected: PASS.

- [ ] **Step 6: Ejecutar lint dirigido y validaciones estáticas**

Run: `npx eslint extensions/EncabezadoImpresion tests/extensions/encabezado-impresion-*.test.ts`

Expected: exit 0.

Run: `git diff --check`

Expected: exit 0 sin alterar los ZIP preexistentes.

- [ ] **Step 7: Cargar la extensión sin empaquetar y verificar copias locales**

En Chrome/Edge de prueba, cargar `extensions/EncabezadoImpresion`, confirmar que el panel restaura datos, impide exceder el límite, conserva la imagen anterior ante un archivo inválido y solicita permiso solo al pulsar `Autorizar sitio de Junta`. Abrir harnesses locales basados exactamente en `src/data/ImpresionTucan.md` y `src/data/ImpresionJunta.md`, confirmar visualmente imagen/líneas centradas antes del comprobante y generar impresión a PDF. Registrar cualquier parte que el entorno no permita comprobar.

- [ ] **Step 8: Empaquetar sin duplicar entradas**

Run: `Compress-Archive -Path 'extensions\EncabezadoImpresion\*' -DestinationPath 'extensions\EncabezadoImpresion.zip' -CompressionLevel Optimal -Force`

Expected: ZIP nuevo que contiene una sola copia de cada archivo de la extensión.

- [ ] **Step 9: Commit final del paquete fuente**

```powershell
git add -- extensions/EncabezadoImpresion tests/extensions/encabezado-impresion-package.test.ts
git commit -m "feat: package configurable print header extension"
```

No agregar otros ZIP al commit. Si `extensions/EncabezadoImpresion.zip` está ignorado, entregarlo como artefacto local y reportarlo sin forzarlo al historial.

### Task 6: Revisión final de alcance y evidencia

**Files:**
- Modify only if a verified defect is found: files created in Tasks 1-5.

**Interfaces:**
- Consumes: extensión y resultados de verificación completos.
- Produces: evidencia final exacta y estado honesto de validación.

- [ ] **Step 1: Comparar implementación contra cada criterio de aceptación del spec**

Confirmar individualmente configuración compartida, orden imagen/texto, centrado, límite general, inserción al inicio, idempotencia, Tucán estático con `match_about_blank`, Junta opcional y tolerancia a fallos.

- [ ] **Step 2: Ejecutar nuevamente la suite enfocada después de cualquier corrección**

Run: `npx vitest run tests/extensions/encabezado-impresion-*.test.ts`

Expected: PASS con el número final de archivos y pruebas reportado literalmente.

- [ ] **Step 3: Revisar estado y diff final**

Run: `git status --short`

Expected: solo los ZIP preexistentes y, si `.gitignore` lo excluye, `extensions/EncabezadoImpresion.zip`; no deben aparecer cambios accidentales.

Run: `git diff --check ec6d492e..HEAD`

Expected: exit 0.

- [ ] **Step 4: Informar límites de comprobación sin convertirlos en éxitos**

Separar pruebas automatizadas, lint, carga sin empaquetar, PDF local, sesión autenticada BCR, URL real de Junta e impresora térmica. Marcar cada una como completada o no verificada según evidencia real.
