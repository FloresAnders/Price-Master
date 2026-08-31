import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({
  collection: vi.fn((...path: unknown[]) => ({ kind: "collection", path })),
  doc: vi.fn((...path: unknown[]) => ({ kind: "doc", path })),
  limit: vi.fn((value: number) => ({ kind: "limit", value })),
  onSnapshot: vi.fn((...args: unknown[]) => {
    void args;
    return vi.fn();
  }),
  orderBy: vi.fn((field: string, direction?: string) => ({
    kind: "orderBy",
    field,
    direction,
  })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({
    ref,
    constraints,
  })),
  where: vi.fn((field: string, operator: string, value: unknown) => ({
    kind: "where",
    field,
    operator,
    value,
  })),
  writeBatch: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
}));
const firestoreService = vi.hoisted(() => ({
  query: vi.fn(async () => [] as Array<Record<string, unknown>>),
  getAll: vi.fn(async () => [] as Array<Record<string, unknown>>),
}));
const usersService = vi.hoisted(() => ({
  getPrimaryAdminByOwner: vi.fn(async (ownerId: string) => ({
    id: ownerId,
    name: "Owner",
  })),
}));

vi.mock("firebase/firestore", () => firestore);
vi.mock("firebase/storage", () => ({
  ref: vi.fn(),
  listAll: vi.fn(),
  deleteObject: vi.fn(),
  getDownloadURL: vi.fn(),
  getMetadata: vi.fn(),
}));
vi.mock("@/config/firebase", () => ({ db: {}, storage: {} }));
vi.mock("@/services/firestore", () => ({ FirestoreService: firestoreService }));
vi.mock("@/services/fondo-cache", () => ({ invalidateFondoCache: vi.fn() }));
vi.mock("@/services/users", () => ({
  UsersService: usersService,
}));

describe("Firestore listener scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreService.query.mockResolvedValue([]);
  });

  it("subscribes to pending solicitudes with one company-key query", async () => {
    const { SolicitudesService } = await import("@/services/solicitudes");

    SolicitudesService.subscribePendingSolicitudesByEmpresa(" Mi Empresa ", vi.fn());

    expect(firestore.onSnapshot).toHaveBeenCalledTimes(1);
    expect(firestore.where.mock.calls).toEqual([
      ["empresaKey", "==", "mi empresa"],
      ["listo", "==", false],
    ]);
  });

  it("includes pending legacy solicitudes in the initial result without a second listener", async () => {
    const legacy = { id: "legacy-1", empresa: "Mi Empresa", listo: false };
    firestoreService.query.mockResolvedValueOnce([legacy]);
    firestore.onSnapshot.mockImplementationOnce((...args: unknown[]) => {
      const callback = args[1] as (snapshot: { docs: unknown[] }) => void;
      callback({ docs: [] });
      return vi.fn();
    });
    const onRows = vi.fn();
    const { SolicitudesService } = await import("@/services/solicitudes");

    SolicitudesService.subscribePendingSolicitudesByEmpresa("Mi Empresa", onRows);
    await vi.waitFor(() => expect(onRows).toHaveBeenLastCalledWith([legacy]));

    expect(firestore.onSnapshot).toHaveBeenCalledTimes(1);
  });

  it("does not resurrect a modern solicitud after it leaves the live snapshot", async () => {
    const modern = {
      id: "modern-1",
      empresa: "Mi Empresa",
      empresaKey: "mi empresa",
      listo: false,
    };
    firestoreService.query.mockResolvedValueOnce([modern]);
    let publishSnapshot!: (snapshot: { docs: Array<unknown> }) => void;
    firestore.onSnapshot.mockImplementationOnce((...args: unknown[]) => {
      const callback = args[1] as (snapshot: { docs: unknown[] }) => void;
      publishSnapshot = callback;
      callback({
        docs: [{ id: modern.id, data: () => modern }],
      });
      return vi.fn();
    });
    const onRows = vi.fn();
    const { SolicitudesService } = await import("@/services/solicitudes");

    SolicitudesService.subscribePendingSolicitudesByEmpresa("Mi Empresa", onRows);
    await vi.waitFor(() => expect(onRows).toHaveBeenCalledTimes(2));
    publishSnapshot({ docs: [] });

    expect(onRows).toHaveBeenLastCalledWith([]);
  });

  it("refuses to create a scan listener without a company scope", async () => {
    const { ScanningService } = await import("@/services/scanning");

    expect(() => ScanningService.subscribeToScans(vi.fn(), undefined, "session-1", ""))
      .toThrow("empresaId is required");
    expect(firestore.onSnapshot).not.toHaveBeenCalled();
  });

  it("stops the active movement-type listener when its owner scope disappears", async () => {
    const unsubscribe = vi.fn();
    firestore.onSnapshot.mockReturnValueOnce(unsubscribe);
    const { FondoMovementTypesService } = await import(
      "@/services/fondo-movement-types"
    );

    await FondoMovementTypesService.initializeListener("owner-1");
    await FondoMovementTypesService.initializeListener(null);

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not create a movement-type listener if logout occurs while scope resolves", async () => {
    let resolveOwner!: (value: { id: string; name: string }) => void;
    usersService.getPrimaryAdminByOwner.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOwner = resolve;
      }),
    );
    const { FondoMovementTypesService } = await import(
      "@/services/fondo-movement-types"
    );

    const initialization = FondoMovementTypesService.initializeListener("owner-race");
    FondoMovementTypesService.stopListener();
    resolveOwner({ id: "owner-race", name: "Owner" });
    await initialization;

    expect(firestore.onSnapshot).not.toHaveBeenCalled();
  });
});
