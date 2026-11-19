import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn(() => ({ type: "collection" })),
  deleteDoc: vi.fn(),
  doc: vi.fn(() => ({ type: "document" })),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
}));

vi.mock("firebase/firestore", () => firestore);
vi.mock("@/config/firebase", () => ({ db: {} }));

describe("RegistroTucanService offline sync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("navigator", { onLine: false });
    firestore.addDoc.mockResolvedValue({ id: "server-record-1" });
  });

  it("sends a queued record once after connectivity returns", async () => {
    const { RegistroTucanService } = await import("@/services/registro-tucan");

    const offlineId = await RegistroTucanService.createRecord({
      empresa: "DELIKOR PALMARES",
      dateKey: new Date("2026-11-19T00:00:00-06:00").getTime(),
      fecha: "2026-11-19",
      hora: "17:35:59",
      saldoPaginaTucan: 1000,
      saldoFondoTucan: 258000,
      pagosHoy: 0,
      saldoSinpesRecibidos: 0,
      total: 259000,
      createdById: "user-1",
      createdByName: "Usuario Prueba",
    });

    expect(offlineId).toMatch(/^offline-/);
    expect(await RegistroTucanService.getPendingCount()).toBe(1);

    Object.defineProperty(globalThis.navigator, "onLine", {
      configurable: true,
      value: true,
    });

    await RegistroTucanService.syncPending();
    await RegistroTucanService.syncPending();

    expect(firestore.addDoc).toHaveBeenCalledTimes(1);
    expect(await RegistroTucanService.getPendingCount()).toBe(0);
  });
});
