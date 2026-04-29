import { NextRequest, NextResponse } from "next/server";
import { EmailService } from "@/services/email";
import { EmailChangeCodeService } from "@/services/emailChangeCodeService";
import { buildEmailChangeVerificationTemplate } from "@/services/email-templates/cambio-correo";
import { db } from "@/config/firebase";
import { doc, getDoc } from "firebase/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const isValidEmail = (value: string) => {
  const trimmed = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId es requerido" },
        { status: 400 },
      );
    }

    const userRef = doc(db, "users", String(userId));
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    const currentEmailRaw = (userSnap.data()?.email ?? "") as string;
    const currentEmail = String(currentEmailRaw || "")
      .trim()
      .toLowerCase();
    if (!currentEmail || !isValidEmail(currentEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: "El usuario no tiene un correo válido configurado",
        },
        { status: 400 },
      );
    }

    const { code, expiresAt } = await EmailChangeCodeService.createCode(
      String(userId),
    );

    const template = buildEmailChangeVerificationTemplate({
      code,
      expiresAt,
    });

    await EmailService.queueEmail({
      // Seguridad: envía el código al correo actual (propietario de la cuenta).
      // Así se evita que alguien cambie el correo de otra cuenta apuntando el código a su propio correo.
      to: currentEmail,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    return NextResponse.json({
      success: true,
      message: "Código enviado",
      expiresAt,
    });
  } catch (error) {
    console.error("Error en request-email-change:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al procesar la solicitud",
      },
      { status: 500 },
    );
  }
}
