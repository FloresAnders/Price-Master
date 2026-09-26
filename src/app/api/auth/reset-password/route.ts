import { NextRequest, NextResponse } from "next/server";
import { RecoveryTokenService } from "@/services/recoveryTokenService";
import { EmailService } from "@/services/email";
import { hashPasswordServer } from "@/lib/auth/password.server";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword, confirmPassword } = await request.json();

    if (!token || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: "Todos los campos son requeridos" },
        { status: 400 },
      );
    }

    // Validar que las contraseñas coincidan
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: "Las contraseñas no coinciden" },
        { status: 400 },
      );
    }

    // Validar requisitos de contraseña
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial",
        },
        { status: 400 },
      );
    }

    // 1. Valida el token
    const validationResult = await RecoveryTokenService.validateToken(token);

    if (!validationResult.valid) {
      return NextResponse.json(
        { success: false, error: validationResult.error || "Token inválido" },
        { status: 400 },
      );
    }

    const { email, userId } = validationResult;

    if (!userId || !email) {
      return NextResponse.json(
        { success: false, error: "Datos del token incompletos" },
        { status: 400 },
      );
    }

    // 2. Hashea la nueva contraseña
    const hashedPassword = await hashPasswordServer(newPassword);

    // 3. Actualiza en Firestore
    await getAdminDb().collection("users").doc(userId).update({
      password: hashedPassword,
      lastPasswordChange: Date.now(),
      passwordResetRequired: false,
    });

    // 4. Marca el token como usado
    await RecoveryTokenService.markTokenAsUsed(token);

    // 5. Envía email de confirmación
    await EmailService.sendPasswordChangedNotification(email);

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada exitosamente",
    });
  } catch (error) {
    console.error("Error en reset-password:", error);
    return NextResponse.json(
      {
        success: false,
        error: "No se pudo restablecer la contraseña.",
      },
      { status: 500 },
    );
  }
}
