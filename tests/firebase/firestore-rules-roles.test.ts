import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const describeWithEmulator = emulatorHost ? describe : describe.skip;

const claims = {
  user: {
    role: "user",
    ownercompanie: "EMPRESA A",
    ownercompanieNormalized: "EMPRESA A",
    permissions: {},
  },
  userB: {
    role: "user",
    ownercompanie: "EMPRESA B",
    ownercompanieNormalized: "EMPRESA B",
    permissions: {},
  },
  fondoUser: {
    role: "user",
    ownercompanie: "EMPRESA A",
    ownercompanieNormalized: "EMPRESA A",
    permissions: { fondogeneral: true },
  },
  tiemposUser: {
    role: "user",
    ownercompanie: "EMPRESA A",
    ownercompanieNormalized: "EMPRESA A",
    permissions: { tiempos: true },
  },
  admin: {
    role: "admin",
    ownerId: "owner-a",
    eliminate: false,
    permissions: {},
  },
  adminB: {
    role: "admin",
    ownerId: "owner-b",
    eliminate: false,
    permissions: {},
  },
  superadmin: {
    role: "superadmin",
    permissions: {},
  },
} as const;

const festivityIds = [
  "new-year",
  "holy-thursday",
  "good-friday",
  "juan-santamaria",
  "workers-day",
  "nicoya",
  "virgen-angeles",
  "mothers-day",
  "afro-culture",
  "army-abolition",
  "christmas",
  "year-end",
] as const;

const validSeasonalEffects = () => ({
  schemaVersion: 1,
  enabled: false,
  festivities: Object.fromEntries(
    festivityIds.map((id) => [
      id,
      {
        enabled: true,
        title: `Tema ${id}`,
        message: "Mensaje",
        intensity: "normal",
        showBanner: true,
        priority: 10,
        startOffsetDays: 0,
        endOffsetDays: 0,
      },
    ]),
  ),
  updatedAt: Timestamp.now(),
  updatedBy: "root",
});

describeWithEmulator("reglas Firestore por acceso y rol", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const [host, portText] = emulatorHost!.split(":");
    testEnv = await initializeTestEnvironment({
      projectId: "price-master-cutover-tests",
      firestore: {
        host,
        port: Number(portText),
        rules: readFileSync("firestore.rules", "utf8"),
      },
    });
  }, 30_000);

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "version", "current"), {
        maintenance: {
          global: { enabled: false },
          activeCompanyIdentifiers: [],
        },
      });
      await setDoc(doc(context.firestore(), "reportes_movimientos", "reporte-1"), {
        empresa: "EMPRESA A",
      });
      await setDoc(doc(context.firestore(), "empresas", "EMPRESA A"), {
        ownerId: "owner-a",
        name: "EMPRESA A",
        ubicacion: "EMPRESA A",
        empleados: [],
      });
      await setDoc(doc(context.firestore(), "empresas", "EMPRESA B"), {
        ownerId: "owner-b",
        name: "EMPRESA B",
        ubicacion: "EMPRESA B",
        empleados: [],
      });
      await setDoc(doc(context.firestore(), "empresas", "EMPRESA A2"), {
        ownerId: "owner-a",
        name: "EMPRESA A2",
        ubicacion: "EMPRESA A2",
        empleados: [],
      });
      await setDoc(doc(context.firestore(), "Facturas", "EMPRESA_A", "movements", "fac-a"), {
        empresa: "EMPRESA A",
        createdAt: "2026-10-26T08:00:00.000Z",
        amount: 100,
      });
      await setDoc(doc(context.firestore(), "Facturas", "EMPRESA_B", "movements", "fac-b"), {
        empresa: "EMPRESA B",
        createdAt: "2026-10-26T08:00:00.000Z",
        amount: 200,
      });
      await setDoc(doc(context.firestore(), "proveedores", "EMPRESA A"), {
        company: "EMPRESA A",
        nextCode: 2,
      });
      await setDoc(doc(context.firestore(), "proveedores", "EMPRESA A", "items", "0001"), {
        code: "0001",
        name: "PROVEEDOR A",
        company: "EMPRESA A",
        movementCount: 0,
      });
      await setDoc(doc(context.firestore(), "proveedores", "EMPRESA A", "names", "PROVEEDOR%20A"), {
        code: "0001",
        name: "PROVEEDOR A",
      });
      await setDoc(doc(context.firestore(), "proveedores", "EMPRESA B"), {
        company: "EMPRESA B",
        nextCode: 2,
      });
      await setDoc(doc(context.firestore(), "proveedores", "EMPRESA B", "items", "0001"), {
        code: "0001",
        name: "PROVEEDOR B",
        company: "EMPRESA B",
        movementCount: 0,
      });
      await setDoc(doc(context.firestore(), "proveedores", "EMPRESA B", "names", "PROVEEDOR%20B"), {
        code: "0001",
        name: "PROVEEDOR B",
      });
      await setDoc(doc(context.firestore(), "proveedores", "EMPRESA A2"), {
        company: "EMPRESA A2",
        nextCode: 2,
      });
      await setDoc(doc(context.firestore(), "proveedores", "EMPRESA A2", "items", "0001"), {
        code: "0001",
        name: "PROVEEDOR A2",
        company: "EMPRESA A2",
        movementCount: 0,
      });
      await setDoc(doc(context.firestore(), "MovimientosFondos", "ledger-test"), {
        company: "EMPRESA A",
      });
      await setDoc(doc(context.firestore(), "MovimientosFondos", "ledger-test", "movements", "seed-a"), {
        empresa: "EMPRESA A",
        amountIngreso: 1,
      });
      await setDoc(doc(context.firestore(), "MovimientosFondos", "ledger-b"), {
        company: "EMPRESA B",
      });
      await setDoc(doc(context.firestore(), "MovimientosFondos", "ledger-b", "movements", "seed-b"), {
        empresa: "EMPRESA B",
        amountIngreso: 2,
      });
      await setDoc(
        doc(context.firestore(), "reportes_detalle", "reporte-1", "items", "mov-1"),
        { empresa: "EMPRESA A" },
      );
      await setDoc(doc(context.firestore(), "users", "user-a"), {
        name: "Usuario A",
        email: "user-a@example.com",
        password: "legacy-plaintext-password",
        role: "user",
        ownerId: "owner-a",
      });
      await setDoc(doc(context.firestore(), "users", "user-b"), {
        name: "Usuario B",
        email: "user-b@example.com",
        password: "$argon2id$secret-hash",
        role: "user",
        ownerId: "owner-a",
      });
      await setDoc(doc(context.firestore(), "recovery_tokens", "token-1"), {
        token: "known-token-hash",
        email: "victim@example.com",
        userId: "victim",
        expiresAt: Date.now() + 60_000,
        used: false,
      });
      await setDoc(doc(context.firestore(), "email_change_codes", "code-1"), {
        code: "123456",
        userId: "victim",
      });
      await setDoc(doc(context.firestore(), "security_logs", "log-1"), {
        type: "password_recovery_request",
        userId: "victim",
      });
      await setDoc(doc(context.firestore(), "mail", "mail-1"), {
        to: "victim@example.com",
        subject: "Ataque",
        text: "Contenido",
      });
    });
  });

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  const authenticated = (uid: string, token: Record<string, unknown>): RulesTestContext =>
    testEnv.authenticatedContext(uid, token);

  it("rechaza acceso sin sesion despues de ventana de compatibilidad", async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(db, "MovimientosFondos", "ledger-test")));
  });

  it("permite movimiento general a usuario autenticado", async () => {
    const db = authenticated("user-a", claims.user).firestore();

    await assertSucceeds(
      setDoc(doc(db, "MovimientosFondos", "ledger-test", "movements", "mov-1"), {
        empresa: "EMPRESA A",
        amountIngreso: 1,
      }),
    );
  });

  it("aísla facturas proveedores y fondos por empresa para usuarios", async () => {
    const db = authenticated("user-a", claims.user).firestore();
    const dbB = authenticated("user-b", claims.userB).firestore();

    await assertSucceeds(
      getDoc(doc(db, "Facturas", "EMPRESA_A", "movements", "fac-a")),
    );
    await assertFails(
      getDoc(doc(db, "Facturas", "EMPRESA_B", "movements", "fac-b")),
    );
    await assertSucceeds(
      getDoc(doc(db, "proveedores", "EMPRESA A", "items", "0001")),
    );
    await assertFails(
      getDoc(doc(db, "proveedores", "EMPRESA B", "items", "0001")),
    );
    await assertFails(
      getDoc(doc(db, "proveedores", "EMPRESA B", "names", "PROVEEDOR%20B")),
    );
    await assertSucceeds(
      getDoc(doc(db, "MovimientosFondos", "ledger-test", "movements", "seed-a")),
    );
    await assertFails(
      getDoc(doc(db, "MovimientosFondos", "ledger-b", "movements", "seed-b")),
    );
    await assertSucceeds(
      getDoc(doc(dbB, "Facturas", "EMPRESA_B", "movements", "fac-b")),
    );
    await assertSucceeds(
      getDoc(doc(dbB, "proveedores", "EMPRESA B", "items", "0001")),
    );

    await assertFails(
      setDoc(doc(db, "proveedores", "EMPRESA B", "items", "0099"), {
        code: "0099",
        name: "ATAQUE",
        company: "EMPRESA B",
        movementCount: 0,
      }),
    );
    await assertFails(
      setDoc(doc(db, "Facturas", "EMPRESA_B", "movements", "attack"), {
        empresa: "EMPRESA B",
        createdAt: "2026-10-26T09:00:00.000Z",
      }),
    );
    await assertFails(
      setDoc(doc(db, "proveedores", "EMPRESA B", "names", "ATAQUE"), {
        code: "0099",
        name: "ATAQUE",
      }),
    );
    await assertFails(
      setDoc(doc(db, "MovimientosFondos", "ledger-b", "movements", "attack"), {
        empresa: "EMPRESA B",
        amountIngreso: 999,
      }),
    );
    await assertFails(
      setDoc(doc(db, "MovimientosFondos", "orphan", "movements", "attack"), {
        empresa: "EMPRESA A",
        amountIngreso: 999,
      }),
    );
  });

  it("permite al admin cambiar solo entre empresas de su owner", async () => {
    const adminA = authenticated("admin-a", claims.admin).firestore();
    const adminB = authenticated("admin-b", claims.adminB).firestore();

    await assertSucceeds(
      getDoc(doc(adminA, "proveedores", "EMPRESA A", "items", "0001")),
    );
    await assertSucceeds(
      getDoc(doc(adminA, "proveedores", "EMPRESA A2", "items", "0001")),
    );
    await assertFails(
      getDoc(doc(adminA, "proveedores", "EMPRESA B", "items", "0001")),
    );
    await assertFails(
      getDoc(
        doc(
          authenticated("user-a", claims.user).firestore(),
          "proveedores",
          "EMPRESA A2",
          "items",
          "0001",
        ),
      ),
    );
    await assertSucceeds(
      getDoc(doc(adminB, "MovimientosFondos", "ledger-b", "movements", "seed-b")),
    );
    await assertFails(
      getDoc(doc(adminB, "MovimientosFondos", "ledger-test", "movements", "seed-a")),
    );
    await assertFails(
      deleteDoc(doc(adminA, "Facturas", "EMPRESA_B", "movements", "fac-b")),
    );
  });

  it("mantiene acceso global de superadmin", async () => {
    const db = authenticated("root", claims.superadmin).firestore();

    await assertSucceeds(
      getDoc(doc(db, "Facturas", "EMPRESA_B", "movements", "fac-b")),
    );
    await assertSucceeds(
      getDoc(doc(db, "proveedores", "EMPRESA B", "items", "0001")),
    );
    await assertSucceeds(
      getDoc(doc(db, "MovimientosFondos", "ledger-b", "movements", "seed-b")),
    );
    await assertSucceeds(
      updateDoc(doc(db, "empresas", "EMPRESA B"), { ownerId: "owner-a" }),
    );
  });

  it("impide secuestrar ownerId o mover datos entre empresas", async () => {
    const userDb = authenticated("user-a", claims.user).firestore();
    const adminDb = authenticated("admin-a", claims.admin).firestore();

    await assertFails(
      updateDoc(doc(userDb, "empresas", "EMPRESA B"), { ownerId: "owner-a" }),
    );
    await assertFails(
      updateDoc(doc(adminDb, "empresas", "EMPRESA A"), { ownerId: "owner-b" }),
    );
    await assertSucceeds(
      updateDoc(doc(adminDb, "empresas", "EMPRESA A"), { name: "EMPRESA A EDITADA" }),
    );
    await assertFails(
      updateDoc(doc(userDb, "Facturas", "EMPRESA_A", "movements", "fac-a"), {
        empresa: "EMPRESA B",
      }),
    );
    await assertFails(
      updateDoc(doc(userDb, "proveedores", "EMPRESA A", "items", "0001"), {
        company: "EMPRESA B",
      }),
    );
    await assertFails(
      updateDoc(doc(userDb, "MovimientosFondos", "ledger-test"), {
        company: "EMPRESA B",
      }),
    );
  });

  it("exige filtro de empresa para listar facturas", async () => {
    const db = authenticated("user-a", claims.user).firestore();
    const movements = collection(db, "Facturas", "EMPRESA_A", "movements");

    await assertFails(getDocs(movements));
    await assertSucceeds(
      getDocs(query(movements, where("empresa", "==", "EMPRESA A"))),
    );
  });

  it("exige permiso tiempos para movimientos de tiempos", async () => {
    const deniedDb = authenticated("user-a", claims.user).firestore();
    const allowedDb = authenticated("user-b", claims.tiemposUser).firestore();

    await assertFails(
      setDoc(doc(deniedDb, "MovimientosFondos", "ledger-test", "tiempos", "mov-1"), {
        empresa: "EMPRESA A",
      }),
    );
    await assertSucceeds(
      setDoc(doc(allowedDb, "MovimientosFondos", "ledger-test", "tiempos", "mov-2"), {
        empresa: "EMPRESA A",
      }),
    );
  });

  it("limita reportes agregados a Fondo General o superadmin", async () => {
    const deniedDb = authenticated("user-a", claims.user).firestore();
    const fondoDb = authenticated("user-b", claims.fondoUser).firestore();
    const superDb = authenticated("root", claims.superadmin).firestore();

    await assertFails(getDoc(doc(deniedDb, "reportes_movimientos", "reporte-1")));
    await assertSucceeds(getDoc(doc(fondoDb, "reportes_movimientos", "reporte-1")));
    await assertSucceeds(getDoc(doc(superDb, "reportes_movimientos", "reporte-1")));
  });

  it("mantiene detalle financiero exclusivo del servidor", async () => {
    const db = authenticated("root", claims.superadmin).firestore();

    await assertFails(
      getDoc(doc(db, "reportes_detalle", "reporte-1", "items", "mov-1")),
    );
  });

  it("impide que admin cree superadmin fuera de su alcance", async () => {
    const adminDb = authenticated("admin-a", claims.admin).firestore();
    const superDb = authenticated("root", claims.superadmin).firestore();
    const promotedProfile = {
      role: "superadmin",
      ownerId: "owner-a",
      permissions: {},
      isActive: true,
    };

    await assertFails(setDoc(doc(adminDb, "users", "new-root"), promotedProfile));
    await assertSucceeds(setDoc(doc(superDb, "users", "new-root"), promotedProfile));
  });

  it("mantiene documentos users con credenciales exclusivos del servidor", async () => {
    const userDb = authenticated("user-a", claims.user).firestore();
    const adminDb = authenticated("admin-a", claims.admin).firestore();
    const superDb = authenticated("root", claims.superadmin).firestore();

    await assertFails(getDoc(doc(userDb, "users", "user-a")));
    await assertFails(getDoc(doc(userDb, "users", "user-b")));
    await assertFails(getDoc(doc(adminDb, "users", "user-a")));
    await assertFails(getDoc(doc(superDb, "users", "user-a")));
    await assertFails(getDocs(collection(superDb, "users")));
  });

  it("bloquea lectura y escritura cliente de tokens logs y cola de correo", async () => {
    const userDb = authenticated("user-a", claims.user).firestore();
    const superDb = authenticated("root", claims.superadmin).firestore();
    const serverOnlyDocuments = [
      ["recovery_tokens", "token-1"],
      ["email_change_codes", "code-1"],
      ["security_logs", "log-1"],
      ["mail", "mail-1"],
    ] as const;

    for (const [collectionName, documentId] of serverOnlyDocuments) {
      await assertFails(getDoc(doc(userDb, collectionName, documentId)));
      await assertFails(
        setDoc(doc(userDb, collectionName, `forged-${documentId}`), {
          token: "known-token-hash",
          userId: "victim",
          to: "attacker@example.com",
          subject: "Ataque",
          text: "Contenido",
        }),
      );
      await assertFails(getDoc(doc(superDb, collectionName, documentId)));
    }
  });

  it("bloquea usuario durante mantenimiento pero conserva acceso admin", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "version", "current"), {
        maintenance: {
          global: { enabled: true },
          activeCompanyIdentifiers: [],
        },
      });
    });

    const userDb = authenticated("user-a", claims.user).firestore();
    const adminDb = authenticated("admin-a", claims.admin).firestore();

    await assertFails(getDoc(doc(userDb, "MovimientosFondos", "ledger-test")));
    await assertSucceeds(getDoc(doc(adminDb, "MovimientosFondos", "ledger-test")));
  });

  it("permite leer celebraciones solo con sesion autenticada", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "system_config", "seasonal_effects"),
        validSeasonalEffects(),
      );
    });
    const userDb = authenticated("user-a", claims.user).firestore();
    const publicDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(userDb, "system_config", "seasonal_effects")));
    await assertFails(getDoc(doc(publicDb, "system_config", "seasonal_effects")));
  });

  it("reserva escrituras de celebraciones para SuperAdmin", async () => {
    const userDb = authenticated("user-a", claims.user).firestore();
    const adminDb = authenticated("admin-a", claims.admin).firestore();
    const superDb = authenticated("root", claims.superadmin).firestore();
    const path = ["system_config", "seasonal_effects"] as const;

    await assertFails(setDoc(doc(userDb, ...path), validSeasonalEffects()));
    await assertFails(setDoc(doc(adminDb, ...path), validSeasonalEffects()));
    await assertSucceeds(setDoc(doc(superDb, ...path), validSeasonalEffects()));
    await assertFails(deleteDoc(doc(superDb, ...path)));
  });

  it("rechaza esquemas de celebraciones incompletos, extras o fuera de limite", async () => {
    const superDb = authenticated("root", claims.superadmin).firestore();
    const seasonalRef = doc(superDb, "system_config", "seasonal_effects");
    const missing = validSeasonalEffects();
    delete missing.festivities.christmas;
    const extra = { ...validSeasonalEffects(), unexpected: true };
    const oversized = validSeasonalEffects();
    oversized.festivities["new-year"].title = "x".repeat(81);
    const wrongType = validSeasonalEffects();
    wrongType.festivities["year-end"].enabled = "yes" as unknown as boolean;

    await assertFails(setDoc(seasonalRef, missing));
    await assertFails(setDoc(seasonalRef, extra));
    await assertFails(setDoc(seasonalRef, oversized));
    await assertFails(setDoc(seasonalRef, wrongType));
  });
});

describe("ejecucion de reglas", () => {
  it("explica como activar la suite cuando emulador no esta presente", () => {
    if (emulatorHost) return;

    expect(emulatorHost).toBeUndefined();
  });
});
