import { NextRequest, NextResponse } from "next/server";
import { EmpresasService } from "@/services/empresas";
import { readBcrSinpeReport } from "@/services/sinpe-imap.server";

export const runtime = "nodejs";

const parseRangeDate = (date: unknown, time: unknown) => {
  if (typeof date !== "string" || typeof time !== "string") return null;
  const parsed = new Date(`${date}T${time}:00-06:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      empresaId?: string;
      startDate?: string;
      startTime?: string;
      endDate?: string;
      endTime?: string;
    };

    const empresaId = String(body.empresaId || "").trim();
    const start = parseRangeDate(body.startDate, body.startTime);
    const end = parseRangeDate(body.endDate, body.endTime);

    if (!empresaId || !start || !end) {
      return NextResponse.json(
        { error: "Datos de consulta incompletos." },
        { status: 400 },
      );
    }

    if (start > end) {
      return NextResponse.json(
        { error: "Rango inválido: inicio mayor que fin." },
        { status: 400 },
      );
    }

    const empresa = await EmpresasService.getEmpresaById(empresaId);
    const email = empresa?.correoConfigEmail?.trim();
    const password = empresa?.correoConfigPassword?.trim();

    if (!empresa || !email || !password) {
      return NextResponse.json(
        { error: "Empresa sin configuración de correo." },
        { status: 400 },
      );
    }

    const report = await readBcrSinpeReport({
      email,
      password,
      start,
      end,
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("[REPORTES-SINPE] Error:", error);
    return NextResponse.json(
      { error: "No se pudo leer el correo SINPE." },
      { status: 500 },
    );
  }
}
