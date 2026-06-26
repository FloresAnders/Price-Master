import { NextRequest, NextResponse } from "next/server";
import { SolicitudesService } from "@/services/solicitudes";
import { verifyCaptchaFromBody } from "@/lib/captcha/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        { success: false, error: "Producto y empresa son requeridos" },
        { status: 400 },
      );
    }
    const captcha = await verifyCaptchaFromBody(payload, request);

    if (!captcha.ok) {
      return NextResponse.json(
        { success: false, error: captcha.error || "Captcha invalido" },
        { status: captcha.status },
      );
    }

    const productName =
      typeof payload.productName === "string" ? payload.productName.trim() : "";
    const empresa =
      typeof payload.empresa === "string" ? payload.empresa.trim() : "";

    if (!productName || !empresa) {
      return NextResponse.json(
        { success: false, error: "Producto y empresa son requeridos" },
        { status: 400 },
      );
    }

    const id = await SolicitudesService.addSolicitud({ productName, empresa });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Error creating solicitud:", error);
    return NextResponse.json(
      { success: false, error: "Error al crear la solicitud" },
      { status: 500 },
    );
  }
}
