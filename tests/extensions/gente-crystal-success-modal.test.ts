import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const syncCore = require(
  "../../extensions/TimemasterGentecrystal/sync-core.js",
);

describe("Gente Crystal sales success modal", () => {
  test("does not show a floating notification after capturing a new sale", async () => {
    const dom = new JSDOM(
      `
        <select id="sorteo">
          <option selected>Nica Noche</option>
        </select>
      `,
      { runScripts: "outside-only", url: "https://gentecrystal.net/" },
    );
    const storage: Record<string, unknown> = {
      ventasGenteCrystal: [],
      genteCrystalConfirmedLocalTickets: [],
      genteCrystalPendingLocalConfirmations: [],
    };
    Object.assign(dom.window, {
      TimeMasterGenteCrystalSync: syncCore,
      chrome: {
        storage: {
          local: {
            get: async (keys: string | string[]) => {
              const wanted = Array.isArray(keys) ? keys : [keys];
              return Object.fromEntries(
                wanted.map((key) => [key, storage[key]]),
              );
            },
            set: async (values: Record<string, unknown>) => {
              Object.assign(storage, values);
            },
          },
        },
        runtime: {
          sendMessage: async () => ({ ok: true }),
          onMessage: { addListener: () => undefined },
        },
      },
    });
    const contentSource = readFileSync(
      new URL(
        "../../extensions/TimemasterGentecrystal/content.js",
        import.meta.url,
      ),
      "utf8",
    );
    dom.window.eval(contentSource);
    await new Promise((resolve) => setTimeout(resolve, 700));

    dom.window.document.body.insertAdjacentHTML(
      "beforeend",
      `
        <dialog id="sales-success-dialog" open>
          <div class="sales-dialog__panel sales-success">
            <strong id="sales-success-total">₡ 50.00</strong>
            <div id="sales-success-split" hidden></div>
            <dd id="sales-success-ticket">42662-2204-59898071</dd>
            <dd id="sales-success-raffle">Nica Noche</dd>
          </div>
        </dialog>
      `,
    );
    await new Promise((resolve) => setTimeout(resolve, 500));

    const hasFloatingNotification = Boolean(
      dom.window.document.querySelector("#tm-gc-toast"),
    );
    dom.window.close();
    expect(hasFloatingNotification).toBe(false);
  });

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

  test("reads tickets from the new sales-history cards layout", () => {
    const dom = new JSDOM(`
      <section class="sales-surface sales-history" aria-label="Ventas del sorteo">
        <div class="sales-surface__body sales-surface__body--scroll" id="sales-history-panel">
          <div class="sales-history__list">
            <div class="sales-history-pair" data-group-id="main-59894181" aria-label="Venta en dos sorteos">
              <article class="sales-history-card is-expanded" data-ticket-pk="59894181" aria-label="Tiquete 42662-2204-59894181">
                <div class="sales-history-card__row">
                  <div class="sales-history-card__main">
                    <span class="sales-history-card__raffle">Nica 11:00 Am</span>
                    <span class="sales-history-card__ticket-id">42662-2204-59894181</span>
                    <span class="sales-history-card__client">Anonimo</span>
                  </div>
                  <div class="sales-history-card__meta">
                    <span class="sales-history-card__total">₡ 100.00</span>
                  </div>
                </div>
              </article>
              <article class="sales-history-card" data-ticket-pk="59894182" aria-label="Tiquete 42661-2204-59894182">
                <div class="sales-history-card__row">
                  <div class="sales-history-card__main">
                    <span class="sales-history-card__raffle">Nica Especial 11:00 Am</span>
                    <span class="sales-history-card__ticket-id">42661-2204-59894182</span>
                  </div>
                  <div class="sales-history-card__meta">
                    <span class="sales-history-card__total">₡ 100.00</span>
                  </div>
                </div>
              </article>
            </div>
            <article class="sales-history-card is-deleted" data-ticket-pk="59894177" aria-label="Tiquete 42662-2204-59894177">
              <div class="sales-history-card__row">
                <div class="sales-history-card__main">
                  <span class="sales-history-card__raffle">Nica 11:00 Am</span>
                  <span class="sales-history-card__ticket-id">42662-2204-59894177</span>
                </div>
                <div class="sales-history-card__meta">
                  <span class="sales-history-card__total">₡ 50.00</span>
                  <div class="sales-history-card__actions"><span class="sales-history-card__badge">Borrado</span></div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
    `);
    const panel = dom.window.document.querySelector("#sales-history-panel");

    const result = syncCore.readSalesHistoryCards(panel);

    expect(result.ventas).toEqual([
      {
        ticket: "42662-2204-59894181",
        sorteo: "Nica 11:00 Am",
        monto: 100,
        fecha: null,
        hora: null,
        timestamp: null,
        timestampPrecisionMs: null,
      },
      {
        ticket: "42661-2204-59894182",
        sorteo: "Nica Especial 11:00 Am",
        monto: 100,
        fecha: null,
        hora: null,
        timestamp: null,
        timestampPrecisionMs: null,
      },
    ]);
    expect(result.borrados).toEqual(["42662-2204-59894177"]);
    expect(result.diagnostico).toEqual({
      tablaEncontrada: true,
      filas: 3,
      filasConTicket: 3,
      ventasValidas: 2,
      borrados: 1,
    });
  });

  test("skips cards without a ticket or without a visible total", () => {
    const dom = new JSDOM(`
      <div id="sales-history-panel">
        <div class="sales-history__list">
          <article class="sales-history-card" aria-label="Sin tiquete">
            <span class="sales-history-card__total">₡ 500.00</span>
          </article>
          <article class="sales-history-card" data-ticket-pk="59894199" aria-label="Tiquete 42662-2204-59894199">
            <span class="sales-history-card__ticket-id">42662-2204-59894199</span>
          </article>
          <article class="sales-history-card" data-ticket-pk="59894170" aria-label="Tiquete 42662-2204-59894170">
            <div class="sales-history-card__main">
              <span class="sales-history-card__raffle">Nica 11:00 Am</span>
              <span class="sales-history-card__ticket-id">42662-2204-59894170</span>
            </div>
            <div class="sales-history-card__meta">
              <span class="sales-history-card__total">₡ 200.00</span>
            </div>
          </article>
        </div>
      </div>
    `);
    const panel = dom.window.document.querySelector("#sales-history-panel");

    const result = syncCore.readSalesHistoryCards(panel);

    expect(result.ventas).toEqual([
      {
        ticket: "42662-2204-59894170",
        sorteo: "Nica 11:00 Am",
        monto: 200,
        fecha: null,
        hora: null,
        timestamp: null,
        timestampPrecisionMs: null,
      },
    ]);
    expect(result.borrados).toEqual([]);
    expect(result.diagnostico.filasConTicket).toBe(2);
  });

  test("returns an empty reading when there are no sales-history cards", () => {
    const dom = new JSDOM(`
      <div id="sales-history-panel">
        <table><tr><td>42662-2204-59894181</td></tr></table>
      </div>
    `);
    const panel = dom.window.document.querySelector("#sales-history-panel");

    const result = syncCore.readSalesHistoryCards(panel);

    expect(result.ventas).toEqual([]);
    expect(result.borrados).toEqual([]);
    expect(result.diagnostico.filas).toBe(0);
  });

  test("keeps a deleted tombstone when an active event for the same ticket arrives", () => {
    const deleted = syncCore.enqueueEvents(
      {},
      [{ ticketId: "42662-2204-59894181", status: "deleted" }],
      1000,
    );

    const unchanged = syncCore.enqueueEvents(
      deleted,
      [
        {
          ticketId: "42662-2204-59894181",
          sorteo: "Nica 11:00 Am",
          monto: 100,
          saleAt: new Date(2000).toISOString(),
          captureOrigin: "indirect",
          status: "active",
        },
      ],
      2000,
    );

    expect(unchanged).toBe(deleted);
    expect(unchanged["42662-2204-59894181"].payload.status).toBe("deleted");
    expect(unchanged["42662-2204-59894181"].revision).toBe(1);
  });

  test("keeps the deleted tombstone when another deleted event arrives", () => {
    const deleted = syncCore.enqueueEvents(
      {},
      [{ ticketId: "42662-2204-59894181", status: "deleted" }],
      1000,
    );
    const again = syncCore.enqueueEvents(
      deleted,
      [{ ticketId: "42662-2204-59894181", status: "deleted" }],
      2000,
    );

    expect(again["42662-2204-59894181"].payload.status).toBe("deleted");
    expect(again["42662-2204-59894181"].revision).toBe(1);
  });

  test("returns the complete local sale pair before the historical backlog", () => {
    const saleAt = "2026-09-08T16:34:53.755Z";
    let queue = syncCore.enqueueEvents(
      {},
      [
        {
          ticketId: "42662-2204-59897000",
          sorteo: "Nica 11:00 Am",
          monto: 500,
          saleAt: "2026-09-08T16:30:00.000Z",
          captureOrigin: "indirect",
          status: "active",
        },
      ],
      1000,
    );
    queue = syncCore.enqueueEvents(
      queue,
      [
        {
          ticketId: "42661-2204-59898072",
          sorteo: "Nica Especial 11:00 Am",
          monto: 50,
          saleAt,
          captureOrigin: "local_button",
          status: "active",
        },
      ],
      2000,
    );
    queue = syncCore.enqueueEvents(
      queue,
      [
        {
          ticketId: "42662-2204-59898071",
          sorteo: "Nica 11:00 Am",
          monto: 50,
          saleAt,
          captureOrigin: "local_button",
          status: "active",
        },
      ],
      3000,
    );

    expect(syncCore.getReadyRecords(queue, 4000).map((record) => record.ticketId)).toEqual([
      "42662-2204-59898071",
      "42661-2204-59898072",
      "42662-2204-59897000",
    ]);
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
