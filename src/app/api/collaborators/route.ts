import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { readAuthSession } from "@/lib/auth/session-store.server";
import { getAdminDb } from "@/lib/firebase-admin";
import { hashPasswordServer } from "@/lib/auth/password.server";
import type { User } from "@/types/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "Cache-Control": "no-store" };

function normalizeUsername(value: unknown): string {
  return typeof value === "string"
    ? value.trim().normalize("NFKC").toLocaleLowerCase()
    : "";
}

function normalizeCompanyName(value: unknown): string {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function slugify(value: unknown): string {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "colaborador";
}

async function readActor(request: NextRequest) {
  return readAuthSession(request.headers.get("cookie"));
}

function actorOwnsOwner(actor: User | undefined, ownerId: string): boolean {
  if (!actor) return false;
  if (actor.role === "superadmin") return true;
  if (actor.role !== "admin") return false;
  if (actor.eliminate === false) {
    return ownerId === actor.id || ownerId === actor.ownerId;
  }
  return ownerId === actor.ownerId;
}

function rejectUnsafeLocalDatabase(request: NextRequest): NextResponse | null {
  const hostname = request.nextUrl.hostname.toLowerCase();
  const isLocalRequest =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";
  if (!isLocalRequest) return null;

  const databaseId =
    process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim() ||
    process.env.FIRESTORE_DATABASE_ID?.trim();
  if (databaseId?.toLowerCase() === "restauracion") return null;

  return NextResponse.json(
    {
      error:
        "Protección de datos: localhost no puede escribir en la base `(default)`.",
    },
    { status: 409, headers: noStore },
  );
}

export async function POST(request: NextRequest) {
  try {
    const unsafeDatabaseResponse = rejectUnsafeLocalDatabase(request);
    if (unsafeDatabaseResponse) return unsafeDatabaseResponse;

    const authenticated = await readActor(request);
    const actor = authenticated?.user;
    if (!actor?.id) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401, headers: noStore });
    }

    const body = await request.json();
    const empresaId = String(body.empresaId || "").trim();
    const employeeName = String(body.employeeName || "").trim();
    const employeeId = String(body.employeeId || "").trim() || slugify(employeeName);
    const username = String(body.username || "").trim();
    const password = typeof body.password === "string" ? body.password : "";
    const accountId = String(body.accountId || "").trim();
    const requestedParentId = String(body.inheritedFromUserId || "").trim();

    if (!empresaId || !employeeName || !username || !password) {
      return NextResponse.json(
        { error: "Empresa, colaborador, usuario y contraseña son requeridos." },
        { status: 400, headers: noStore },
      );
    }
    if (username.length > 80 || password.length > 1024) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400, headers: noStore });
    }

    const db = getAdminDb();
    const empresaRef = db.collection("empresas").doc(empresaId);
    const empresaSnapshot = await empresaRef.get();
    if (!empresaSnapshot.exists) {
      return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404, headers: noStore });
    }
    const empresa = empresaSnapshot.data() || {};
    const ownerId = String(empresa.ownerId || "").trim();
    if (!actorOwnsOwner(actor, ownerId)) {
      return NextResponse.json({ error: "No autorizado para esta empresa." }, { status: 403, headers: noStore });
    }

    const companyNames = new Set(
      [empresa.name, empresa.ubicacion, empresaId]
        .map(normalizeCompanyName)
        .filter(Boolean),
    );
    const isExactCompanyParent = (data: Record<string, unknown> | undefined) =>
      companyNames.has(normalizeCompanyName(data?.ownercompanie));
    const allUsers = await db.collection("users").get();
    let parentSnapshot: FirebaseFirestore.QueryDocumentSnapshot |
      FirebaseFirestore.DocumentSnapshot | null =
      allUsers.docs.find((doc) => {
        const data = doc.data();
        return data?.role !== "superadmin" &&
          data?.isActive !== false &&
          isExactCompanyParent(data);
      }) || null;

    if (
      !parentSnapshot &&
      requestedParentId
    ) {
      const requestedSnapshot = await db.collection("users").doc(requestedParentId).get();
      if (
        requestedSnapshot.exists &&
        requestedSnapshot.data()?.role !== "superadmin" &&
        requestedSnapshot.data()?.isActive !== false &&
        isExactCompanyParent(requestedSnapshot.data())
      ) {
        parentSnapshot = requestedSnapshot;
      }
    }
    if (
      !parentSnapshot ||
      !parentSnapshot.exists ||
      parentSnapshot.data()?.role === "superadmin" ||
      parentSnapshot.data()?.isActive === false
    ) {
      return NextResponse.json(
        {
          error:
            `No existe una cuenta empresarial asignada a ${empresa.ubicacion || empresa.name || empresaId}.`,
        },
        { status: 409, headers: noStore },
      );
    }

    const parent = {
      id: parentSnapshot.id,
      ...(parentSnapshot.data() || {}),
    } as User;
    const normalizedUsername = normalizeUsername(username);
    const sameNameMatches = await db
      .collection("users")
      .where("nameNormalized", "==", normalizedUsername)
      .limit(10)
      .get();
    if (
      sameNameMatches.docs.some(
        (doc) => doc.id !== accountId && doc.data()?.isActive !== false,
      )
    ) {
      return NextResponse.json(
        { error: "Ese nombre de usuario ya está registrado." },
        { status: 409, headers: noStore },
      );
    }

    const passwordHash = await hashPasswordServer(password);
    let collaboratorRef = accountId
      ? db.collection("users").doc(accountId)
      : db.collection("users").doc();

    const existingSnapshot = await collaboratorRef.get();
    const existing = existingSnapshot.exists ? existingSnapshot.data() || {} : {};
    if (
      accountId &&
      existing.accountType !== "collaborator"
    ) {
      return NextResponse.json({ error: "Cuenta colaborador inválida." }, { status: 409, headers: noStore });
    }
    if (
      accountId &&
      (
        existing.collaboratorEmpresaId &&
        String(existing.collaboratorEmpresaId) !== empresaId
      )
    ) {
      return NextResponse.json(
        { error: "La cuenta pertenece a otra empresa." },
        { status: 409, headers: noStore },
      );
    }

    const collaboratorData: Record<string, unknown> = {
      name: username,
      nameNormalized: normalizedUsername,
      password: passwordHash,
      role: "user",
      isActive: true,
      eliminate: false,
      ownerId: parent.ownerId || parent.id,
      ownercompanie: String(empresa.name || empresa.ubicacion || empresaId),
      createdById: actor.id,
      accountType: "collaborator",
      inheritedFromUserId: parent.id,
      collaboratorEmpresaId: empresaId,
      collaboratorEmployeeId: employeeId,
      fullName: employeeName,
      permissions: FieldValue.delete(),
      updatedAt: new Date(),
    };
    await collaboratorRef.set(
      {
        ...collaboratorData,
        ...(!existingSnapshot.exists ? { createdAt: new Date() } : {}),
      },
      { merge: true },
    );

    const empleados = Array.isArray(empresa.empleados) ? [...empresa.empleados] : [];
    let foundIndex = empleados.findIndex(
      (item: any) =>
        String(item?.accessEmployeeId || "") === employeeId ||
        String(item?.Empleado || "").trim() === employeeName,
    );
    if (foundIndex < 0) foundIndex = empleados.length;
    if (foundIndex === empleados.length) empleados.push({ Empleado: employeeName });
    empleados[foundIndex] = {
      ...empleados[foundIndex],
      Empleado: employeeName,
      accessEnabled: true,
      accessUsername: username,
      accessAccountId: collaboratorRef.id,
      accessEmployeeId: employeeId,
      inheritedFromUserId: parent.id,
      inheritedFromUserName: String(
        parent.fullName || parent.name || parent.email || parent.id,
      ),
    };
    await empresaRef.set({ empleados, updatedAt: new Date() }, { merge: true });

    return NextResponse.json(
      {
        ok: true,
        accountId: collaboratorRef.id,
        employeeId,
        inheritedFromUserId: parent.id,
        inheritedFromUserName: String(
          parent.fullName || parent.name || parent.email || parent.id,
        ),
      },
      { headers: noStore },
    );
  } catch (error) {
    console.error("Collaborator provision error:", error);
    return NextResponse.json(
      { error: "No se pudo guardar el acceso." },
      { status: 500, headers: noStore },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const unsafeDatabaseResponse = rejectUnsafeLocalDatabase(request);
    if (unsafeDatabaseResponse) return unsafeDatabaseResponse;

    const authenticated = await readActor(request);
    const actor = authenticated?.user;
    if (!actor?.id) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401, headers: noStore });
    }
    const { empresaId, accountId, employeeId } =
      await request.json();
    if (!empresaId || !accountId) {
      return NextResponse.json({ error: "Datos requeridos." }, { status: 400, headers: noStore });
    }

    const db = getAdminDb();
    const empresaSnapshot = await db.collection("empresas").doc(String(empresaId)).get();
    if (!empresaSnapshot.exists) {
      return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404, headers: noStore });
    }
    const empresa = empresaSnapshot.data() || {};
    const empresaOwnerId = String(empresa.ownerId || "");
    if (!actorOwnsOwner(actor, empresaOwnerId)) {
      return NextResponse.json({ error: "No autorizado para esta empresa." }, { status: 403, headers: noStore });
    }

    const accountRef = db.collection("users").doc(String(accountId));
    const accountSnapshot = await accountRef.get();
    if (!accountSnapshot.exists || accountSnapshot.data()?.accountType !== "collaborator") {
      return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404, headers: noStore });
    }
    const account = accountSnapshot.data() || {};
    if (
      String(account.collaboratorEmpresaId || "") !== String(empresaId) ||
      String(account.ownerId || "") !== empresaOwnerId
    ) {
      return NextResponse.json(
        { error: "Cuenta colaborador no pertenece a esta empresa." },
        { status: 409, headers: noStore },
      );
    }
    await accountRef.set(
      { isActive: false, updatedAt: new Date() },
      { merge: true },
    );

    const empleados = Array.isArray(empresa.empleados) ? [...empresa.empleados] : [];
    const index = empleados.findIndex(
      (item: any) =>
        String(item?.accessAccountId || "") === String(accountId) ||
        (employeeId && String(item?.accessEmployeeId || "") === String(employeeId)),
    );
    if (index >= 0) {
      empleados[index] = {
        ...empleados[index],
        accessEnabled: false,
      };
      await db.collection("empresas").doc(String(empresaId)).set(
        { empleados, updatedAt: new Date() },
        { merge: true },
      );
    }
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error("Collaborator disable error:", error);
    return NextResponse.json(
      { error: "No se pudo deshabilitar el acceso." },
      { status: 500, headers: noStore },
    );
  }
}
