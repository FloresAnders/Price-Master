import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => {
  class MockFieldPath {
    readonly segments: string[];

    constructor(...segments: string[]) {
      this.segments = segments;
    }
  }

  const scheduleRef = { path: "schedules/DELIFOOD_2026_9" };
  const monthlyData: Record<string, unknown> = {
    company: "DELIFOOD",
    year: 2026,
    month: 9,
    employees: { Ana: { "1": { shift: "D", horasPorDia: 7 } } },
  };
  const snapshot = {
    exists: vi.fn(() => true),
    data: vi.fn<() => Record<string, unknown>>(() => monthlyData),
  };
  const transaction = {
    get: vi.fn(async () => snapshot),
    update: vi.fn(),
    set: vi.fn(),
  };

  return {
    MockFieldPath,
    scheduleRef,
    monthlyData,
    snapshot,
    transaction,
    doc: vi.fn(() => scheduleRef),
    getDoc: vi.fn(async () => snapshot),
    updateDoc: vi.fn(async () => undefined),
    setDoc: vi.fn(async () => undefined),
    deleteField: vi.fn(() => ({ delete: true })),
    runTransaction: vi.fn(async (_db: unknown, callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    ),
    invalidate: vi.fn(async () => undefined),
  };
});

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  deleteField: firestore.deleteField,
  doc: firestore.doc,
  FieldPath: firestore.MockFieldPath,
  getDoc: firestore.getDoc,
  getDocs: vi.fn(),
  runTransaction: firestore.runTransaction,
  setDoc: firestore.setDoc,
  updateDoc: firestore.updateDoc,
}));

vi.mock("@/config/firebase", () => ({ db: {} }));
vi.mock("@/services/firestore", () => ({ FirestoreService: {} }));
vi.mock("@/services/schedule-fortnight-cache", () => ({
  invalidateScheduleFortnightCache: firestore.invalidate,
}));

import { SchedulesService } from "@/services/schedules";

describe("SchedulesService para turnos DELIFOOD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestore.snapshot.exists.mockReturnValue(true);
    firestore.snapshot.data.mockReturnValue(firestore.monthlyData);
    firestore.transaction.get.mockResolvedValue(firestore.snapshot);
  });

  it("reemplaza la entrada diaria completa al guardar D con 7 horas", async () => {
    await SchedulesService.updateScheduleShift(
      "DELIFOOD",
      "Ana",
      2026,
      9,
      1,
      "D",
      { horasPorDia: 7 },
    );

    expect(firestore.transaction.update).toHaveBeenCalledWith(
      firestore.scheduleRef,
      expect.objectContaining({ segments: ["employees", "Ana", "1"] }),
      { shift: "D", horasPorDia: 7 },
      "updatedAt",
      expect.any(Date),
    );
  });

  it("cambiar a L elimina las horas anteriores", async () => {
    await SchedulesService.updateScheduleShift(
      "DELIFOOD",
      "Ana",
      2026,
      9,
      1,
      "L",
      { horasPorDia: null },
    );

    expect(firestore.transaction.update).toHaveBeenCalledWith(
      firestore.scheduleRef,
      expect.objectContaining({ segments: ["employees", "Ana", "1"] }),
      { shift: "L" },
      "updatedAt",
      expect.any(Date),
    );
  });

  it("personaliza las horas sin cambiar D por L", async () => {
    await SchedulesService.updateScheduleHours(
      "DELIFOOD",
      "Ana",
      2026,
      9,
      1,
      8.5,
    );

    expect(firestore.transaction.update).toHaveBeenCalledWith(
      firestore.scheduleRef,
      expect.objectContaining({ segments: ["employees", "Ana", "1"] }),
      { shift: "D", horasPorDia: 8.5 },
      "updatedAt",
      expect.any(Date),
    );
  });

  it("elimina la asignación completa cuando las horas son 0", async () => {
    await SchedulesService.updateScheduleHours(
      "DELIFOOD",
      "Ana",
      2026,
      9,
      1,
      0,
    );

    expect(firestore.transaction.update).toHaveBeenCalledWith(
      firestore.scheduleRef,
      expect.objectContaining({ segments: ["employees", "Ana", "1"] }),
      { delete: true },
      "updatedAt",
      expect.any(Date),
    );
  });

  it("rechaza horas positivas cuando no existe un turno", async () => {
    firestore.snapshot.data.mockReturnValue({
      company: "DELIFOOD",
      year: 2026,
      month: 9,
      employees: {},
    });

    await expect(
      SchedulesService.updateScheduleHours(
        "DELIFOOD",
        "Ana",
        2026,
        9,
        1,
        8.5,
      ),
    ).rejects.toThrow("No existe un turno asignado");
  });
});
