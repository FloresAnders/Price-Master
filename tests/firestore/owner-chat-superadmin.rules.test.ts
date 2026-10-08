import { deleteApp, initializeApp } from "firebase/app";
import {
  Timestamp,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getFirestore,
  setDoc,
  terminate,
} from "firebase/firestore";
import { afterEach, describe, expect, it } from "vitest";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const describeWithEmulator = emulatorHost ? describe : describe.skip;
const activeApps: Array<ReturnType<typeof initializeApp>> = [];

function firestoreAs(uid: string, role: "admin" | "user" | "superadmin", ownerId?: string) {
  const app = initializeApp(
    { projectId: "demo-pricemaster-owner-chat" },
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
      ...(ownerId ? { ownerId } : {}),
    },
  });
  return database;
}

function validMessage(ownerId: string, senderId: string, senderRole: string) {
  return {
    ownerId,
    senderId,
    senderName: "Ada Super",
    senderRole,
    text: "Mensaje de soporte",
    createdAt: Timestamp.now(),
  };
}

describeWithEmulator("reglas del chat para superadmin", () => {
  afterEach(async () => {
    await Promise.all(
      activeApps.splice(0).map(async (app) => {
        const database = getFirestore(app);
        await terminate(database);
        await deleteApp(app);
      }),
    );
  });

  it(
    "permite al superadmin crear un mensaje en el chat seleccionado",
    async () => {
      const database = firestoreAs("super-1", "superadmin");
      const messageRef = doc(
        database,
        "ownerChats/admin-1/messages/message-superadmin",
      );

      await expect(
        setDoc(messageRef, validMessage("admin-1", "super-1", "superadmin")),
      ).resolves.toBeUndefined();
    },
    15_000,
  );

  it("mantiene bloqueado a un usuario fuera de su propio chat", async () => {
    const database = firestoreAs("user-1", "user", "admin-2");
    const messageRef = doc(
      database,
      "ownerChats/admin-1/messages/message-cross-owner",
    );

    await expect(
      setDoc(messageRef, validMessage("admin-1", "user-1", "user")),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rechaza que el superadmin suplante otro rol", async () => {
    const database = firestoreAs("super-1", "superadmin");
    const messageRef = doc(
      database,
      "ownerChats/admin-1/messages/message-spoofed-role",
    );

    await expect(
      setDoc(messageRef, validMessage("admin-1", "super-1", "admin")),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rechaza que el superadmin suplante otro remitente", async () => {
    const database = firestoreAs("super-1", "superadmin");
    const messageRef = doc(
      database,
      "ownerChats/admin-1/messages/message-spoofed-sender",
    );

    await expect(
      setDoc(messageRef, validMessage("admin-1", "otro-usuario", "superadmin")),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rechaza campos adicionales y mensajes mayores a 2000 caracteres", async () => {
    const database = firestoreAs("super-1", "superadmin");
    const pollutedRef = doc(
      database,
      "ownerChats/admin-1/messages/message-extra-field",
    );
    const oversizedRef = doc(
      database,
      "ownerChats/admin-1/messages/message-oversized",
    );

    await expect(
      setDoc(pollutedRef, {
        ...validMessage("admin-1", "super-1", "superadmin"),
        extraData: "no permitido",
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(
      setDoc(oversizedRef, {
        ...validMessage("admin-1", "super-1", "superadmin"),
        text: "x".repeat(2001),
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("mantiene bloqueadas la actualización y eliminación de mensajes", async () => {
    const database = firestoreAs("super-1", "superadmin");
    const messageRef = doc(
      database,
      "ownerChats/admin-1/messages/message-immutable",
    );

    await setDoc(
      messageRef,
      validMessage("admin-1", "super-1", "superadmin"),
    );
    await expect(
      setDoc(messageRef, {
        ...validMessage("admin-1", "super-1", "superadmin"),
        text: "Mensaje modificado",
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(deleteDoc(messageRef)).rejects.toMatchObject({
      code: "permission-denied",
    });
  });
});
