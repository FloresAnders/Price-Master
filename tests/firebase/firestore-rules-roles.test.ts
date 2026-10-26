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
  setDoc,
  Timestamp,
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
