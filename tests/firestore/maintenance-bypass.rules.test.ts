import { deleteApp, initializeApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  terminate,
} from "firebase/firestore";
import { afterEach, describe, expect, it } from "vitest";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const describeWithEmulator = emulatorHost ? describe : describe.skip;
const activeApps: Array<ReturnType<typeof initializeApp>> = [];

function firestoreAs(
  uid: string,
  role: "admin" | "user" | "superadmin",
  extraClaims: Record<string, unknown> = {},
) {
  const app = initializeApp(
    { projectId: "demo-pricemaster-maintenance" },
    `${role}-${uid}-${crypto.randomUUID()}`,
  );
  activeApps.push(app);
  const database = getFirestore(app);
  const [host, port] = emulatorHost!.split(":");
  connectFirestoreEmulator(database, host, Number(port), {
    mockUserToken: {
      sub: uid,
      user_id: uid,
      role,
      authPurpose: "timemaster-app",
      ownercompanieNormalized: "delikor sinai",
      ...extraClaims,
    },
  });
  return database;
}

describeWithEmulator("reglas de bypass de mantenimiento", () => {
  afterEach(async () => {
    await Promise.all(
      activeApps.splice(0).map(async (app) => {
        const database = getFirestore(app);
        await terminate(database);
        await deleteApp(app);
      }),
    );
  });

  it("bloquea al user sin pase y mantiene admin/superadmin operativos", async () => {
    const superadmin = firestoreAs("super-1", "superadmin");
    await setDoc(doc(superadmin, "version/current"), {
      maintenance: {
        global: { enabled: true, message: "Actualizando" },
        companies: {},
        activeCompanyIdentifiers: [],
      },
    });
    await setDoc(doc(superadmin, "maintenanceProbe/value"), { value: 1 });

    const blockedUser = firestoreAs("user-1", "user");
    await expect(
      getDoc(doc(blockedUser, "maintenanceProbe/value")),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(
      getDoc(doc(blockedUser, "version/current")),
    ).resolves.toBeDefined();

    const admin = firestoreAs("admin-1", "admin");
    await expect(getDoc(doc(admin, "maintenanceProbe/value"))).resolves.toBeDefined();
  }, 15_000);

  it("permite al user solo mientras el claim temporal no ha expirado", async () => {
    const superadmin = firestoreAs("super-2", "superadmin");
    await setDoc(doc(superadmin, "version/current"), {
      maintenance: {
        global: { enabled: true, message: "Actualizando" },
        companies: {},
        activeCompanyIdentifiers: [],
      },
    });
    await setDoc(doc(superadmin, "maintenanceProbe/value-2"), { value: 2 });

    const allowedUser = firestoreAs("user-2", "user", {
      maintenanceBypassExpiresAt: Date.now() + 60_000,
    });
    await expect(
      getDoc(doc(allowedUser, "maintenanceProbe/value-2")),
    ).resolves.toBeDefined();

    const expiredUser = firestoreAs("user-3", "user", {
      maintenanceBypassExpiresAt: Date.now() - 60_000,
    });
    await expect(
      getDoc(doc(expiredUser, "maintenanceProbe/value-2")),
    ).rejects.toMatchObject({ code: "permission-denied" });
  }, 15_000);

  it("bloquea únicamente a la empresa marcada para mantenimiento", async () => {
    const superadmin = firestoreAs("super-3", "superadmin");
    await setDoc(doc(superadmin, "version/current"), {
      maintenance: {
        global: { enabled: false, message: "Disponible" },
        companies: {},
        activeCompanyIdentifiers: ["delikor sinai"],
      },
    });
    await setDoc(doc(superadmin, "maintenanceProbe/company"), { value: 3 });

    const blockedCompany = firestoreAs("user-4", "user");
    await expect(
      getDoc(doc(blockedCompany, "maintenanceProbe/company")),
    ).rejects.toMatchObject({ code: "permission-denied" });

    const availableCompany = firestoreAs("user-5", "user", {
      ownercompanieNormalized: "delikor palmares",
    });
    await expect(
      getDoc(doc(availableCompany, "maintenanceProbe/company")),
    ).resolves.toBeDefined();
  }, 15_000);

  it("niega secretos y controles de tasa a todo cliente", async () => {
    const superadmin = firestoreAs("super-4", "superadmin");

    await expect(
      setDoc(doc(superadmin, "totpSecrets/super-4-maintenance"), {
        secretEncrypted: "never-client-visible",
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(
      getDoc(doc(superadmin, "maintenanceRateLimits/ip-hash")),
    ).rejects.toMatchObject({ code: "permission-denied" });
  }, 15_000);
});
