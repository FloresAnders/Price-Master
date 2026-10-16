import { deleteApp as deleteAdminApp, getApps, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { deleteApp, initializeApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  terminate,
} from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const describeWithEmulator = emulatorHost ? describe : describe.skip;
const projectId = "demo-pricemaster-report";
const activeApps: Array<ReturnType<typeof initializeApp>> = [];

function firestoreAs(
  uid?: string,
  permissions: Record<string, boolean> = {},
) {
  const app = initializeApp(
    { projectId },
    `${uid || "anonymous"}-${crypto.randomUUID()}`,
  );
  activeApps.push(app);
  const database = getFirestore(app);
  const [host, port] = emulatorHost!.split(":");
  connectFirestoreEmulator(database, host, Number(port), {
    ...(uid
      ? {
          mockUserToken: {
            sub: uid,
            user_id: uid,
            role: "user",
            authPurpose: "timemaster-app",
            permissions,
          },
        }
      : {}),
  });
  return database;
}

describeWithEmulator("report materialization rules", () => {
  const reportId = `report-${crypto.randomUUID()}`;

  beforeEach(async () => {
    const adminApp =
      getApps()[0] || initializeAdminApp({ projectId }, "report-rules-admin");
    const admin = getAdminFirestore(adminApp);
    await Promise.all([
      admin.doc("version/current").set({ maintenance: {} }),
      admin.doc(`reportes_movimientos/${reportId}`).set({
        date: "2026-10-16",
        empresa: "DELIKOR SAN VITO",
        accountId: "FondoGeneral",
      }),
      admin.doc(`reportes_detalle/${reportId}/items/movement-1`).set({
        movementId: "movement-1",
        empresa: "DELIKOR SAN VITO",
        accountId: "FondoGeneral",
        currency: "CRC",
        createdAt: "2026-10-16T12:00:00.000Z",
      }),
    ]);
  });

  afterEach(async () => {
    await Promise.all(
      activeApps.splice(0).map(async (app) => {
        await terminate(getFirestore(app));
        await deleteApp(app);
      }),
    );
    await Promise.all(getApps().map((app) => deleteAdminApp(app)));
  });

  it("allows aggregate reads only with Fondo permission", async () => {
    const allowed = firestoreAs("report-user", { fondogeneral: true });
    const denied = firestoreAs("other-user", {});

    await expect(
      getDoc(doc(allowed, "reportes_movimientos", reportId)),
    ).resolves.toMatchObject({ exists: expect.any(Function) });
    await expect(
      getDoc(doc(denied, "reportes_movimientos", reportId)),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rejects client writes to aggregate reports", async () => {
    const database = firestoreAs("report-user", { fondogeneral: true });
    await expect(
      setDoc(doc(database, "reportes_movimientos", `write-${reportId}`), {
        date: "2026-10-16",
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rejects all client access to detail materialization", async () => {
    const database = firestoreAs("report-user", { fondogeneral: true });
    const detail = doc(
      database,
      "reportes_detalle",
      reportId,
      "items",
      "movement-1",
    );

    await expect(getDoc(detail)).rejects.toMatchObject({
      code: "permission-denied",
    });
    await expect(setDoc(detail, { amountEgreso: 1 })).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects anonymous aggregate reads", async () => {
    await expect(
      getDoc(doc(firestoreAs(), "reportes_movimientos", reportId)),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});
