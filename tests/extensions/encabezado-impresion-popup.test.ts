import { createRequire } from "node:module";
import { resolve } from "node:path";

import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

const requireModule = createRequire(import.meta.url);
const imagePath = resolve(
  "extensions/EncabezadoImpresion/image-core.js",
);
const popupPath = resolve("extensions/EncabezadoImpresion/popup.js");
const STORAGE_KEY = "encabezadoImpresionSettingsV1";
const savedImage = "data:image/png;base64,iVBORw0KGgo=";

const popupMarkup = `
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
`;

type StoredSettings = {
  schemaVersion: number;
  imageDataUrl: string;
  maxCharacters: number;
  lines: Array<
    string | { text: string; fontFamily: string; fontSize: number }
  >;
  juntaOrigin: string;
};

function createChromeApi(
  initial: Partial<StoredSettings> = {},
  options: {
    failWrites?: boolean;
    fonts?: Array<{ fontId: string; displayName: string }>;
  } = {},
) {
  const current: StoredSettings = {
    schemaVersion: 1,
    imageDataUrl: "",
    maxCharacters: 40,
    lines: [],
    juntaOrigin: "",
    ...initial,
  };
  const writes: Record<string, unknown>[] = [];
  return {
    chromeApi: {
      fontSettings: {
        getFontList: vi.fn().mockResolvedValue(
          options.fonts || [
            { fontId: "Arial", displayName: "Arial" },
            { fontId: "Courier New", displayName: "Courier New" },
          ],
        ),
      },
      storage: {
        local: {
          async get() {
            return { [STORAGE_KEY]: { ...current, lines: [...current.lines] } };
          },
          async set(value: Record<string, StoredSettings>) {
            if (options.failWrites) throw new Error("storage failed");
            writes.push(value);
            Object.assign(current, value[STORAGE_KEY]);
          },
        },
      },
    },
    current,
    writes,
  };
}

function input(dom: JSDOM, selector: string, value: string) {
  const element = dom.window.document.querySelector(selector) as HTMLInputElement;
  element.value = value;
  element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function lineValues(dom: JSDOM) {
  return [...dom.window.document.querySelectorAll<HTMLInputElement>(".line-input")]
    .map((element) => element.value);
}

describe("EncabezadoImpresion image core", () => {
  it("escala sin ampliar y conserva proporción", () => {
    const { calculateScaledSize } = requireModule(imagePath);

    expect(calculateScaledSize(2400, 1200)).toEqual({
      width: 1200,
      height: 600,
    });
    expect(calculateScaledSize(600, 300)).toEqual({
      width: 600,
      height: 300,
    });
  });

  it("acepta solo los formatos definidos y calcula bytes base64", () => {
    const { isAcceptedImageType, estimateDataUrlBytes } =
      requireModule(imagePath);

    expect(isAcceptedImageType("image/png")).toBe(true);
    expect(isAcceptedImageType("image/svg+xml")).toBe(false);
    expect(estimateDataUrlBytes("data:image/png;base64,QUJDRA==")).toBe(4);
  });
});

describe("EncabezadoImpresion popup", () => {
  it("agrega, reordena y elimina líneas conservando sus textos", async () => {
    const dom = new JSDOM(popupMarkup);
    const { chromeApi } = createChromeApi();
    const { createPopupController } = requireModule(popupPath);
    const controller = createPopupController(dom.window.document, chromeApi, {
      processImageFile: vi.fn(),
    });
    await controller.start();

    (dom.window.document.querySelector("#add-line") as HTMLButtonElement).click();
    input(dom, ".line-input[data-index='0']", "Primera");
    (dom.window.document.querySelector("#add-line") as HTMLButtonElement).click();
    input(dom, ".line-input[data-index='1']", "Segunda");
    (
      dom.window.document.querySelector(
        "[data-index='1'][data-action='up']",
      ) as HTMLButtonElement
    ).click();
    expect(lineValues(dom)).toEqual(["Segunda", "Primera"]);

    (
      dom.window.document.querySelector(
        "[data-index='1'][data-action='delete']",
      ) as HTMLButtonElement
    ).click();
    expect(lineValues(dom)).toEqual(["Segunda"]);
    dom.window.close();
  });

  it("mantiene la imagen previa si el archivo nuevo falla", async () => {
    const dom = new JSDOM(popupMarkup);
    const { chromeApi } = createChromeApi({ imageDataUrl: savedImage });
    const processImageFile = vi
      .fn()
      .mockRejectedValue(new Error("La imagen supera 2 MB."));
    const { createPopupController } = requireModule(popupPath);
    const controller = createPopupController(dom.window.document, chromeApi, {
      processImageFile,
    });
    await controller.start();

    const fakeFile = new dom.window.File(["x"], "grande.png", {
      type: "image/png",
    });
    await controller.selectImage(fakeFile);

    expect(controller.getDraft().imageDataUrl).toBe(savedImage);
    expect(dom.window.document.querySelector("#message")?.textContent).toBe(
      "La imagen supera 2 MB.",
    );
    dom.window.close();
  });

  it("permite elegir una fuente instalada y tamaño para cada línea", async () => {
    const dom = new JSDOM(popupMarkup);
    const { chromeApi, writes } = createChromeApi(
      {
        lines: [
          { text: "Título", fontFamily: "Courier New", fontSize: 22 },
        ],
      },
      {
        fonts: [
          { fontId: "Arial", displayName: "Arial" },
          { fontId: "Courier New", displayName: "Courier New" },
        ],
      },
    );
    const { createPopupController } = requireModule(popupPath);
    const controller = createPopupController(dom.window.document, chromeApi, {
      processImageFile: vi.fn(),
    });
    await controller.start();

    const font = dom.window.document.querySelector(
      ".line-font",
    ) as HTMLSelectElement;
    const size = dom.window.document.querySelector(
      ".line-font-size",
    ) as HTMLInputElement;
    const preview = dom.window.document.querySelector(
      ".ei-preview-line",
    ) as HTMLElement;

    expect(chromeApi.fontSettings.getFontList).toHaveBeenCalledOnce();
    expect([...font.options].map((option) => option.value)).toEqual([
      "Arial",
      "Courier New",
    ]);
    expect(font.value).toBe("Courier New");
    expect(size.value).toBe("22");
    expect(preview.style.fontFamily).toContain("Courier New");
    expect(preview.style.fontSize).toBe("22px");

    font.value = "Arial";
    font.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    input(dom, ".line-font-size", "18");
    await controller.save();

    expect(writes.at(-1)?.[STORAGE_KEY]).toMatchObject({
      lines: [{ text: "Título", fontFamily: "Arial", fontSize: 18 }],
    });
    dom.window.close();
  });

  it("aplica el límite global a cada línea y actualiza contadores", async () => {
    const dom = new JSDOM(popupMarkup);
    const { chromeApi } = createChromeApi({ lines: ["Cinco", "Dos"] });
    const { createPopupController } = requireModule(popupPath);
    const controller = createPopupController(dom.window.document, chromeApi, {
      processImageFile: vi.fn(),
    });
    await controller.start();

    input(dom, "#max-characters", "12");

    const inputs = [
      ...dom.window.document.querySelectorAll<HTMLInputElement>(".line-input"),
    ];
    expect(inputs.map((element) => element.maxLength)).toEqual([12, 12]);
    expect(dom.window.document.querySelector(".line-count")?.textContent).toBe(
      "5/12",
    );
    dom.window.close();
  });

  it("bloquea el guardado cuando una línea supera el límite nuevo", async () => {
    const dom = new JSDOM(popupMarkup);
    const { chromeApi, writes } = createChromeApi({ lines: ["Demasiado"] });
    const { createPopupController } = requireModule(popupPath);
    const controller = createPopupController(dom.window.document, chromeApi, {
      processImageFile: vi.fn(),
    });
    await controller.start();

    input(dom, "#max-characters", "4");
    (dom.window.document.querySelector("#save") as HTMLButtonElement).click();
    await vi.waitFor(() => {
      expect(dom.window.document.querySelector("#message")?.textContent).toBe(
        "La línea 1 supera el límite de 4 caracteres.",
      );
    });
    expect(writes).toEqual([]);
    dom.window.close();
  });

  it("guarda una sola configuración y previsualiza imagen antes del texto", async () => {
    const dom = new JSDOM(popupMarkup);
    const { chromeApi, writes } = createChromeApi({
      imageDataUrl: savedImage,
      lines: ["Texto"],
    });
    const { createPopupController } = requireModule(popupPath);
    const controller = createPopupController(dom.window.document, chromeApi, {
      processImageFile: vi.fn(),
    });
    await controller.start();

    const preview = dom.window.document.querySelector("#preview")!;
    expect(preview.firstElementChild?.tagName).toBe("IMG");
    expect(preview.lastElementChild?.className).toBe("ei-preview-line");

    (dom.window.document.querySelector("#save") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(writes).toHaveLength(1));
    expect(Object.keys(writes[0])).toEqual([STORAGE_KEY]);
    dom.window.close();
  });

  it("conserva Junta cuando Chrome rechaza el sitio nuevo", async () => {
    const dom = new JSDOM(popupMarkup);
    const { chromeApi, writes } = createChromeApi({
      juntaOrigin: "https://viejo.test",
    });
    const updateJuntaAccess = vi.fn().mockResolvedValue({
      ok: false,
      origin: "https://viejo.test",
      error: "Chrome no concedió acceso al sitio de Junta.",
    });
    const { createPopupController } = requireModule(popupPath);
    const controller = createPopupController(dom.window.document, chromeApi, {
      processImageFile: vi.fn(),
      updateJuntaAccess,
    });
    await controller.start();

    input(dom, "#junta-url", "https://nuevo.test/factura");
    (
      dom.window.document.querySelector(
        "#authorize-junta",
      ) as HTMLButtonElement
    ).click();

    await vi.waitFor(() => {
      expect(dom.window.document.querySelector("#message")?.textContent).toBe(
        "Chrome no concedió acceso al sitio de Junta.",
      );
    });
    expect(controller.getDraft().juntaOrigin).toBe("https://viejo.test");
    expect(writes).toEqual([]);
    dom.window.close();
  });

  it("no autoriza Junta si el borrador tiene una línea fuera del límite", async () => {
    const dom = new JSDOM(popupMarkup);
    const { chromeApi, writes } = createChromeApi({ lines: ["Demasiado"] });
    const updateJuntaAccess = vi.fn();
    const { createPopupController } = requireModule(popupPath);
    const controller = createPopupController(dom.window.document, chromeApi, {
      processImageFile: vi.fn(),
      updateJuntaAccess,
    });
    await controller.start();

    input(dom, "#max-characters", "4");
    input(dom, "#junta-url", "https://junta.test/factura");
    await controller.authorizeJunta();

    expect(updateJuntaAccess).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
    expect(dom.window.document.querySelector("#message")?.textContent).toBe(
      "La línea 1 supera el límite de 4 caracteres.",
    );
    expect(controller.getDraft().lines).toEqual([
      { text: "Demasiado", fontFamily: "Arial", fontSize: 14 },
    ]);
    dom.window.close();
  });

  it("restaura el acceso anterior si falla guardar el nuevo origen", async () => {
    const dom = new JSDOM(popupMarkup);
    const { chromeApi } = createChromeApi(
      { juntaOrigin: "https://viejo.test" },
      { failWrites: true },
    );
    const updateJuntaAccess = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, origin: "https://nuevo.test" })
      .mockResolvedValueOnce({ ok: true, origin: "https://viejo.test" });
    const { createPopupController } = requireModule(popupPath);
    const controller = createPopupController(dom.window.document, chromeApi, {
      processImageFile: vi.fn(),
      updateJuntaAccess,
    });
    await controller.start();

    input(dom, "#junta-url", "https://nuevo.test/factura");
    await controller.authorizeJunta();

    expect(updateJuntaAccess).toHaveBeenNthCalledWith(
      1,
      chromeApi,
      "https://viejo.test",
      "https://nuevo.test/factura",
    );
    expect(updateJuntaAccess).toHaveBeenNthCalledWith(
      2,
      chromeApi,
      "https://nuevo.test",
      "https://viejo.test",
    );
    expect(controller.getDraft().juntaOrigin).toBe("https://viejo.test");
    expect(dom.window.document.querySelector("#message")?.textContent).toBe(
      "No fue posible guardar el sitio de Junta.",
    );
    dom.window.close();
  });
});
