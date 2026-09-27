// @vitest-environment node
import { describe, expect, it } from "vitest";
import syncCore from "../extensions/TimemasterGentecrystal/sync-core.js";

const {
  enqueueEvents,
  getReadyRecords,
  buildActivePayload,
  buildDeletedPayload,
  markSending,
  markFailed,
  markSucceeded,
} = syncCore as Record<string, any>;

function salePayload(overrides: Record<string, unknown> = {}) {
  return buildActivePayload({
    ticketId: "1234-56-78901",
    sorteo: "Loteria Nacional",
    monto: 5000,
    saleAt: "2026-09-27T10:00:00.000Z",
    captureOrigin: "indirect",
    status: "active",
    ...overrides,
  });
}

describe("sync-core: cola de la extension (consumo)", () => {
  it("NO crea revision nueva cuando el payload re-encolado es identico", () => {
    const payload = salePayload();
    const t0 = 1_700_000_000_000;

    const first = enqueueEvents({}, [payload], t0);
    const second = enqueueEvents(first, [payload], t0 + 60_000);

    const record = second[payload.ticketId];
    expect(record.revision).toBe(1);
    expect(record.state).toBe("pending");
    expect(Object.keys(second).length).toBe(1);
  });

  it("crea revision nueva solo cuando el payload cambia (monto)", () => {
    const t0 = 1_700_000_000_000;
    const first = enqueueEvents({}, [salePayload()], t0);
    const changed = enqueueEvents(
      first,
      [salePayload({ monto: 6000 })],
      t0 + 60_000,
    );

    expect(changed[payload_ticketId()].revision).toBe(2);
  });

  it("un registro synced no vuelve a enviarse y la cola no crece con re-encolados identicos", () => {
    const t0 = 1_700_000_000_000;
    const payload = salePayload();
    let queue = enqueueEvents({}, [payload], t0);
    const revision = queue[payload.ticketId].revision;

    queue = markSending(queue, payload.ticketId, revision, t0 + 1000);
    queue = markSucceeded(queue, revision, payload.ticketId, t0 + 2000);
    expect(queue[payload.ticketId].state).toBe("synced");
    expect(getReadyRecords(queue, t0 + 3000)).toHaveLength(0);

    // Re-encolado identico (lo que hace cada escaneo del content script):
    const afterRescan = enqueueEvents(queue, [payload], t0 + 4000);
    expect(Object.keys(afterRescan).length).toBe(1);
    expect(getReadyRecords(afterRescan, t0 + 5000)).toHaveLength(0);

    // Borrado del ticket: el deleted SI se encola (revision+1) y queda
    // pendiente de envio. La reaparicion posterior del activo se IGNORA:
    // 'deleted' es terminal en cliente y servidor (mergeGenteCrystalSale
    // responde already_exists), asi que no debe generar reenvios.
    queue = enqueueEvents(queue, [buildDeletedPayload(payload.ticketId)], t0 + 6000);
    const deletedRevision = queue[payload.ticketId].revision;
    expect(deletedRevision).toBe(revision + 1);
    const reaparece = enqueueEvents(queue, [payload], t0 + 7000);
    expect(reaparece[payload.ticketId].revision).toBe(deletedRevision);
    expect(reaparece[payload.ticketId].payload.status).toBe("deleted");
    const ready = getReadyRecords(reaparece, t0 + 8000);
    expect(ready).toHaveLength(1);
    expect(ready[0].payload.status).toBe("deleted");
  });

  it("un fallo retryable reintenta con backoff y se rinde tras el tope de backoff", () => {
    const t0 = 1_700_000_000_000;
    const payload = salePayload();
    let queue = enqueueEvents({}, [payload], t0);
    const revision = queue[payload.ticketId].revision;

    // Fallo 500 -> retryable con backoff
    queue = markFailed(
      queue,
      payload.ticketId,
      revision,
      { status: 500, message: "boom" },
      t0 + 1000,
    );
    let ready = getReadyRecords(queue, t0 + 1000);
    expect(ready).toHaveLength(0); // backoff activo
    ready = getReadyRecords(queue, t0 + 1000 + 5000);
    expect(ready).toHaveLength(1); // 1er backoff = 5 s

    // Serie de fallos: el backoff crece hasta MAX_BACKOFF_MS (15 min)
    for (let attempt = 2; attempt <= 9; attempt++) {
      queue = markSending(queue, payload.ticketId, revision, t0 + attempt * 100_000);
      queue = markFailed(
        queue,
        payload.ticketId,
        revision,
        { status: 500, message: "boom" },
        t0 + attempt * 100_000,
      );
    }
    // Con attempts=9 el backoff ya esta en el tope de 15 minutos
    // (5000 * 2^8 = 1.28M ms > 900_000 ms).
    const last = queue[payload.ticketId];
    expect(last.state).toBe("error");
    expect(last.retryable).toBe(true);
    expect(last.attempts).toBe(9);
    expect(last.nextAttemptAt! - (t0 + 9 * 100_000)).toBe(15 * 60 * 1000);
  });
});

function payload_ticketId() {
  return "1234-56-78901";
}
