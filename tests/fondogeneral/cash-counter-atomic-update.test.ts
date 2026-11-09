// @vitest-environment jsdom

import { IDBFactory } from "fake-indexeddb";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCashCounterSnapshot,
  getCashCounterSnapshot,
  saveCashCounterSnapshot,
  updateCashCounterSnapshotAtomically,
} from "@/services/cashCounterDb";
import { createLatestCashCounterSaveQueue } from "@/components/business/cash-counter-tabs/saveQueue";

describe("actualizacion atomica del contador", () => {
  beforeAll(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
  });

  beforeEach(async () => {
    await clearCashCounterSnapshot();
  });

  it("serializa dos descuentos concurrentes sin perder ninguno", async () => {
    await saveCashCounterSnapshot({
      counters: [
        {
          accountId: "FondoGeneral",
          name: "Fondo General",
          currency: "CRC",
          bills: { 1000: 2 },
          extraAmount: 0,
          aperturaCaja: 0,
          ventaActual: 0,
        },
      ],
      activeTab: 0,
      lastSaved: "2026-11-09T12:00:00.000Z",
      revision: 0,
    });

    const discountOneBill = () =>
      updateCashCounterSnapshotAtomically((current) => ({
        ...current,
        counters: current.counters.map((counter) => ({
          ...counter,
          bills: {
            ...counter.bills,
            1000: (counter.bills[1000] ?? 0) - 1,
          },
        })),
      }));

    expect(await Promise.all([discountOneBill(), discountOneBill()])).toEqual([
      true,
      true,
    ]);
    expect((await getCashCounterSnapshot())?.counters[0].bills[1000]).toBe(0);
  });

  it("rechaza un guardado completo obsoleto despues de un descuento atomico", async () => {
    const saved = await saveCashCounterSnapshot({
      counters: [
        {
          accountId: "FondoGeneral",
          name: "Fondo General",
          currency: "CRC",
          bills: { 1000: 2 },
          extraAmount: 0,
          aperturaCaja: 0,
          ventaActual: 0,
        },
      ],
      activeTab: 0,
      lastSaved: "2026-11-09T12:00:00.000Z",
      revision: 0,
    });

    await updateCashCounterSnapshotAtomically((current) => ({
      ...current,
      counters: current.counters.map((counter) => ({
        ...counter,
        bills: { ...counter.bills, 1000: 1 },
      })),
    }));

    await expect(saveCashCounterSnapshot(saved)).rejects.toThrow(
      "CASH_COUNTER_SNAPSHOT_CHANGED",
    );
    expect((await getCashCounterSnapshot())?.counters[0].bills[1000]).toBe(1);
  });

  it("espera el guardado activo antes de persistir la edicion mas nueva", async () => {
    let releaseFirstSave: () => void = () => {};
    const persisted: number[] = [];
    const queue = createLatestCashCounterSaveQueue<number>(
      async (value) => {
        persisted.push(value);
        if (value === 1) {
          await new Promise<void>((resolve) => {
            releaseFirstSave = resolve;
          });
        }
      },
      vi.fn(),
    );

    queue.enqueue(1);
    await Promise.resolve();
    queue.enqueue(2);
    queue.enqueue(3);
    releaseFirstSave();
    await queue.whenIdle();

    expect(persisted).toEqual([1, 3]);
  });
});
