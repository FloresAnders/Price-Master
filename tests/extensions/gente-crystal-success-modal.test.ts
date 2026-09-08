import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const syncCore = require(
  "../../extensions/TimemasterGentecrystal/sync-core.js",
);

describe("Gente Crystal sales success modal", () => {
  test("injects the detector on the sales controller page", () => {
    const manifest = JSON.parse(
      readFileSync(
        new URL(
          "../../extensions/TimemasterGentecrystal/manifest.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const detector = manifest.content_scripts.find(
      (script: { js?: string[] }) => script.js?.includes("content.js"),
    );

    expect(detector.matches).toContain(
      "https://gentecrystal.net/controllers/sales/SalesController.php*",
    );
  });

  test("recognizes the new checkout button when its text includes the total", () => {
    expect(
      syncCore.isIngresarVentaControl({
        id: "btn-submit-sale",
        ariaLabel: "Ingresar venta",
        text: "Ingresar venta · ₡ 150.00",
        value: "",
      }),
    ).toBe(true);
  });

  test("reads the two ticket records from the rendered success panel", () => {
    const dom = new JSDOM(`
      <div class="sales-dialog__panel sales-success">
        <strong id="sales-success-total">₡ 150.00</strong>
        <div id="sales-success-split">
          <span id="sales-success-main-label">Nica 11:00 Am</span>
          <strong id="sales-success-main-total">₡ 100.00</strong>
          <span id="sales-success-companion-label">Nica Especial 11:00 Am</span>
          <strong id="sales-success-companion-total">₡ 50.00</strong>
        </div>
        <dd id="sales-success-ticket">
          42662-2204-59894175 · 42661-2204-59894176
        </dd>
        <dd id="sales-success-raffle">
          Nica 11:00 Am + Nica Especial 11:00 Am
        </dd>
      </div>
    `);

    expect(syncCore.readSalesSuccessModal(dom.window.document)).toEqual([
      {
        ticket: "42662-2204-59894175",
        sorteo: "Nica 11:00 Am",
        monto: 100,
      },
      {
        ticket: "42661-2204-59894176",
        sorteo: "Nica Especial 11:00 Am",
        monto: 50,
      },
    ]);
  });

  test("builds one sale from the ticket, raffle, and total", () => {
    expect(
      syncCore.parseSalesSuccessModal({
        ticketsText: "42662-2204-59894174",
        raffleText: "Nica 11:00 Am",
        totalText: "₡ 50.00",
        splitHidden: true,
        mainLabel: "Sorteo",
        mainTotal: "",
        companionLabel: "Sorteo",
        companionTotal: "",
      }),
    ).toEqual([
      {
        ticket: "42662-2204-59894174",
        sorteo: "Nica 11:00 Am",
        monto: 50,
      },
    ]);
  });

  test("pairs each ticket with its own raffle and amount", () => {
    expect(
      syncCore.parseSalesSuccessModal({
        ticketsText:
          "42662-2204-59894175 · 42661-2204-59894176",
        raffleText: "Nica 11:00 Am + Nica Especial 11:00 Am",
        totalText: "₡ 150.00",
        splitHidden: false,
        mainLabel: "Nica 11:00 Am",
        mainTotal: "₡ 100.00",
        companionLabel: "Nica Especial 11:00 Am",
        companionTotal: "₡ 50.00",
      }),
    ).toEqual([
      {
        ticket: "42662-2204-59894175",
        sorteo: "Nica 11:00 Am",
        monto: 100,
      },
      {
        ticket: "42661-2204-59894176",
        sorteo: "Nica Especial 11:00 Am",
        monto: 50,
      },
    ]);
  });

  test("waits for a two-ticket modal to contain both split amounts", () => {
    expect(
      syncCore.parseSalesSuccessModal({
        ticketsText:
          "42662-2204-59894175 · 42661-2204-59894176",
        raffleText: "Nica 11:00 Am + Nica Especial 11:00 Am",
        totalText: "₡ 150.00",
        splitHidden: false,
        mainLabel: "Nica 11:00 Am",
        mainTotal: "₡ 100.00",
        companionLabel: "Nica Especial 11:00 Am",
        companionTotal: "",
      }),
    ).toEqual([]);
  });

  test("keeps the original timestamp when the same modal is observed again", () => {
    const existing = [
      {
        id: "GC-42662-2204-59894175",
        ticket: "42662-2204-59894175",
        sorteo: "Nica 11:00 AM",
        monto: 100,
        fecha: "08/09/2026",
        hora: "01:47:45",
        captureOrigin: "local_button",
        timestamp: 1_000,
      },
    ];

    expect(
      syncCore.upsertSalesSuccessRecords(
        existing,
        [
          {
            ticket: "42662-2204-59894175",
            sorteo: "Nica 11:00 Am",
            monto: 100,
          },
          {
            ticket: "42661-2204-59894176",
            sorteo: "Nica Especial 11:00 Am",
            monto: 50,
          },
        ],
        {
          timestamp: 2_000,
          fecha: "08/09/2026",
          hora: "01:48:00",
        },
      ),
    ).toEqual([
      {
        id: "GC-42662-2204-59894175",
        ticket: "42662-2204-59894175",
        sorteo: "Nica 11:00 Am",
        monto: 100,
        fecha: "08/09/2026",
        hora: "01:47:45",
        captureOrigin: "local_button",
        timestamp: 1_000,
      },
      {
        id: "GC-42661-2204-59894176",
        ticket: "42661-2204-59894176",
        sorteo: "Nica Especial 11:00 Am",
        monto: 50,
        fecha: "08/09/2026",
        hora: "01:48:00",
        captureOrigin: "local_button",
        timestamp: 2_000,
      },
    ]);
  });

  test("does not consume another pending click for an already captured modal", () => {
    expect(
      syncCore.isNewSalesSuccessConfirmation(
        [
          {
            ticket: "42662-2204-59894175",
            captureOrigin: "local_button",
          },
          {
            ticket: "42661-2204-59894176",
            captureOrigin: "local_button",
          },
        ],
        [
          { ticket: "42662-2204-59894175" },
          { ticket: "42661-2204-59894176" },
        ],
      ),
    ).toBe(false);

    expect(
      syncCore.isNewSalesSuccessConfirmation([], [
        { ticket: "42662-2204-59894175" },
      ]),
    ).toBe(true);
  });

  test("serializes sales state operations to prevent stale overwrites", async () => {
    const runSerialized = syncCore.createSerializedRunner();
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = runSerialized(async () => {
      order.push("first:start");
      await firstGate;
      order.push("first:end");
    });
    const second = runSerialized(async () => {
      order.push("second:start");
      order.push("second:end");
    });

    await Promise.resolve();
    expect(order).toEqual(["first:start"]);

    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ]);
  });
});
