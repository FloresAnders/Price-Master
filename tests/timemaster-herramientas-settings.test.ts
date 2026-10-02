import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

type Settings = {
  tmhCambioTabEnabled: boolean;
  tmhCerrarImpresionConticaEnabled: boolean;
  tmhSumaTiemposEnabled: boolean;
  tmhMoverEnterEnabled: boolean;
};

type SettingsCore = {
  DEFAULT_SETTINGS: Settings;
  normalizeSettings: (raw?: Record<string, unknown> | null) => Settings;
  readChangedSetting: (
    changes: Record<string, { newValue?: unknown }> | null | undefined,
    key: keyof Settings,
  ) => boolean | undefined;
};

const requireModule = createRequire(import.meta.url);
const settingsPath = resolve(
  process.cwd(),
  "extensions/TimeMasterHerramientas/settings-core.js",
);
const popupPath = resolve(
  process.cwd(),
  "extensions/TimeMasterHerramientas/popup.js",
);
const popupHtmlPath = resolve(
  process.cwd(),
  "extensions/TimeMasterHerramientas/popup.html",
);

const loadSettings = () => requireModule(settingsPath) as SettingsCore;

type ChromeApi = {
  storage: {
    local: {
      get: (
        defaults: Settings,
        callback: (values: Partial<Settings>) => void,
      ) => void;
      set: (
        values: Partial<Settings>,
        callback: () => void,
      ) => void;
    };
  };
  runtime: { lastError: { message: string } | null };
};

type PopupCore = {
  createPopupController: (
    document: Document,
    chromeApi: ChromeApi,
  ) => { start: () => void; destroy: () => void };
};

const popupMarkup = `
  <input id="tmhCambioTabEnabled-toggle" type="checkbox">
  <span id="tmhCambioTabEnabled-status"></span>
  <input id="tmhCerrarImpresionConticaEnabled-toggle" type="checkbox">
  <span id="tmhCerrarImpresionConticaEnabled-status"></span>
  <input id="tmhSumaTiemposEnabled-toggle" type="checkbox">
  <span id="tmhSumaTiemposEnabled-status"></span>
  <input id="tmhMoverEnterEnabled-toggle" type="checkbox">
  <span id="tmhMoverEnterEnabled-status"></span>
`;

function createChromeApi(
  initial: Partial<Settings>,
  options: { failWrites?: boolean } = {},
) {
  const writes: Partial<Settings>[] = [];
  const chromeApi: ChromeApi = {
    storage: {
      local: {
        get(defaults, callback) {
          callback({ ...defaults, ...initial });
        },
        set(values, callback) {
          writes.push(values);
          if (options.failWrites) {
            chromeApi.runtime.lastError = { message: "storage unavailable" };
          } else {
            Object.assign(initial, values);
          }
          callback();
          chromeApi.runtime.lastError = null;
        },
      },
    },
    runtime: { lastError: null },
  };
  return { chromeApi, writes };
}

describe("TimeMaster Herramientas settings", () => {
  it("aplica los cuatro valores iniciales cuando no hay preferencias guardadas", () => {
    const { normalizeSettings } = loadSettings();

    expect(normalizeSettings({})).toEqual({
      tmhCambioTabEnabled: true,
      tmhCerrarImpresionConticaEnabled: false,
      tmhSumaTiemposEnabled: true,
      tmhMoverEnterEnabled: false,
    });
  });

  it("conserva solo booleanos válidos y recupera cada valor inválido por separado", () => {
    const { normalizeSettings } = loadSettings();

    expect(
      normalizeSettings({
        tmhCambioTabEnabled: false,
        tmhCerrarImpresionConticaEnabled: true,
        tmhSumaTiemposEnabled: "false",
        tmhMoverEnterEnabled: true,
      }),
    ).toEqual({
      tmhCambioTabEnabled: false,
      tmhCerrarImpresionConticaEnabled: true,
      tmhSumaTiemposEnabled: true,
      tmhMoverEnterEnabled: true,
    });
    expect(normalizeSettings(null)).toEqual({
      tmhCambioTabEnabled: true,
      tmhCerrarImpresionConticaEnabled: false,
      tmhSumaTiemposEnabled: true,
      tmhMoverEnterEnabled: false,
    });
  });

  it("acepta únicamente cambios booleanos de la clave solicitada", () => {
    const { readChangedSetting } = loadSettings();

    expect(
      readChangedSetting(
        { tmhCambioTabEnabled: { newValue: false } },
        "tmhCambioTabEnabled",
      ),
    ).toBe(false);
    expect(readChangedSetting({}, "tmhCambioTabEnabled")).toBeUndefined();
    expect(
      readChangedSetting(
        { tmhCambioTabEnabled: { newValue: "false" } },
        "tmhCambioTabEnabled",
      ),
    ).toBeUndefined();
  });
});

describe("TimeMaster Herramientas popup", () => {
  it("renderiza los cuatro valores iniciales en controles independientes", () => {
    const dom = new JSDOM(readFileSync(popupHtmlPath, "utf8"));
    const { chromeApi } = createChromeApi({});
    const { createPopupController } = requireModule(popupPath) as PopupCore;
    const controller = createPopupController(dom.window.document, chromeApi);

    controller.start();

    expect(
      (dom.window.document.getElementById(
        "tmhCerrarImpresionConticaEnabled-toggle",
      ) as HTMLInputElement).checked,
    ).toBe(false);
    expect(
      (dom.window.document.getElementById(
        "tmhCambioTabEnabled-toggle",
      ) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (dom.window.document.getElementById(
        "tmhSumaTiemposEnabled-toggle",
      ) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (dom.window.document.getElementById(
        "tmhMoverEnterEnabled-toggle",
      ) as HTMLInputElement).checked,
    ).toBe(false);
    expect(
      dom.window.document.getElementById("tmhCambioTabEnabled-status")
        ?.textContent,
    ).toBe("Activado");
    expect(
      dom.window.document.getElementById(
        "tmhCerrarImpresionConticaEnabled-status",
      )?.textContent,
    ).toBe("Desactivado");
    expect(
      dom.window.document.getElementById("tmhMoverEnterEnabled-status")
        ?.textContent,
    ).toBe("Desactivado");

    controller.destroy();
    dom.window.close();
  });

  it("guarda únicamente la preferencia del interruptor modificado", () => {
    const dom = new JSDOM(popupMarkup);
    const { chromeApi, writes } = createChromeApi({});
    const { createPopupController } = requireModule(popupPath) as PopupCore;
    const controller = createPopupController(dom.window.document, chromeApi);
    controller.start();
    const toggle = dom.window.document.getElementById(
      "tmhSumaTiemposEnabled-toggle",
    ) as HTMLInputElement;

    toggle.checked = false;
    toggle.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

    expect(writes).toEqual([{ tmhSumaTiemposEnabled: false }]);
    expect(
      dom.window.document.getElementById("tmhSumaTiemposEnabled-status")
        ?.textContent,
    ).toBe("Desactivado");

    controller.destroy();
    dom.window.close();
  });

  it("restaura solo el control afectado cuando storage rechaza el cambio", () => {
    const dom = new JSDOM(popupMarkup);
    const { chromeApi } = createChromeApi({}, { failWrites: true });
    const { createPopupController } = requireModule(popupPath) as PopupCore;
    const controller = createPopupController(dom.window.document, chromeApi);
    controller.start();
    const cambioTab = dom.window.document.getElementById(
      "tmhCambioTabEnabled-toggle",
    ) as HTMLInputElement;
    const sumaTiempos = dom.window.document.getElementById(
      "tmhSumaTiemposEnabled-toggle",
    ) as HTMLInputElement;
    const moverEnter = dom.window.document.getElementById(
      "tmhMoverEnterEnabled-toggle",
    ) as HTMLInputElement;

    sumaTiempos.checked = false;
    sumaTiempos.dispatchEvent(
      new dom.window.Event("change", { bubbles: true }),
    );

    expect(sumaTiempos.checked).toBe(true);
    expect(
      dom.window.document.getElementById("tmhSumaTiemposEnabled-status")
        ?.textContent,
    ).toBe("Error al guardar");
    expect(cambioTab.checked).toBe(true);
    expect(moverEnter.checked).toBe(false);

    controller.destroy();
    dom.window.close();
  });
});
