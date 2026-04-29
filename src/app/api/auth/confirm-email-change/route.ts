import { NextRequest, NextResponse } from "next/server";
import { EmailChangeCodeService } from "@/services/emailChangeCodeService";
import { db } from "@/config/firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const isValidEmail = (value: string) => {
  const trimmed = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

export async function POST(request: NextRequest) {
  try {
    const { userId, newEmail, code } = await request.json();

    if (!userId || !newEmail || !code) {
      return NextResponse.json(
        { success: false, error: "userId, newEmail y code son requeridos" },
        { status: 400 },
      );
    }

    if (!isValidEmail(newEmail)) {
      return NextResponse.json(
        { success: false, error: "Correo inválido" },
        { status: 400 },
      );
    }

    const normalizedNewEmail = String(newEmail).trim().toLowerCase();
    const normalizedCode = String(code).trim();

    const validation = await EmailChangeCodeService.validateCode({
      userId: String(userId),
      code: normalizedCode,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error || "Código inválido" },
        { status: 400 },
      );
    }

    // Evitar duplicados (revalidación en confirmación por posibles carreras).
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", normalizedNewEmail));
    const existing = await getDocs(q);
    if (!existing.empty) {
      const otherId = existing.docs[0].id;
      if (String(otherId) !== String(userId)) {
        return NextResponse.json(
          { success: false, error: "Este correo ya está en uso" },
          { status: 400 },
        );
      }
    }

    const userRef = doc(db, "users", String(userId));
    await updateDoc(userRef, {
      email: normalizedNewEmail,
      emailUpdatedAt: Date.now(),
    });

    await EmailChangeCodeService.consumeCode({
      userId: String(userId),
      code: normalizedCode,
    });

    return NextResponse.json({
      success: true,
      message: "Correo actualizado",
      email: normalizedNewEmail,
    });
  } catch (error) {
    console.error("Error en confirm-email-change:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al confirmar el cambio",
      },
      { status: 500 },
    );
  }
}
