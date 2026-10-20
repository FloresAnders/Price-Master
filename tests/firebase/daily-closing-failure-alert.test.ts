import { describe, expect, it } from "vitest";

import * as dailyClosingTemplates from "@/services/email-templates/daily-closing";

type FailureAlertInput = {
  company: string;
  accountKey: string;
  attemptedAtISO: string;
  closingDateISO: string;
  userEmail: string;
  manager: string;
  turno: "D" | "N";
  totalCRC: number;
  totalUSD: number;
  currentBalanceCRC: number | null;
  currentBalanceUSD: number | null;
  breakdownCRC: Record<number, number>;
  breakdownUSD: Record<number, number>;
  r08: number;
  t11: number;
  tucanCumulative: number;
  tiemposCumulative: number;
  notes: string;
  phase: string;
  outcome: "blocked" | "partial";
  reason: string;
  technicalDetails?: string;
};

type FailureMailJob = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type BuildFailureMailJobs = (input: FailureAlertInput) => FailureMailJob[];
type DeliverFailureMailJobs = (
  jobs: FailureMailJob[],
  deliver: (job: FailureMailJob) => Promise<void>,
) => Promise<{ delivered: string[]; failed: string[] }>;

const getBuilder = (): BuildFailureMailJobs | undefined =>
  (
    dailyClosingTemplates as typeof dailyClosingTemplates & {
      buildDailyClosingFailureMailJobs?: BuildFailureMailJobs;
    }
  ).buildDailyClosingFailureMailJobs;

const getDelivery = (): DeliverFailureMailJobs | undefined =>
  (
    dailyClosingTemplates as typeof dailyClosingTemplates & {
      deliverDailyClosingFailureMailJobs?: DeliverFailureMailJobs;
    }
  ).deliverDailyClosingFailureMailJobs;

const completeAttempt: FailureAlertInput = {
  company: "DELIKOR PALMARES",
  accountKey: "FondoGeneral",
  attemptedAtISO: "2026-10-20T20:15:30.000Z",
  closingDateISO: "2026-10-20T20:14:00.000Z",
  userEmail: "cajero@example.com",
  manager: "María",
  turno: "N",
  totalCRC: 107_000,
  totalUSD: 120,
  currentBalanceCRC: 100_000,
  currentBalanceUSD: 100,
  breakdownCRC: { 20000: 5, 5000: 1, 2000: 1, 1000: 0 },
  breakdownUSD: { 100: 1, 20: 1, 10: 0 },
  r08: 250_000,
  t11: 175_000,
  tucanCumulative: 249_500,
  tiemposCumulative: 174_000,
  notes: "Revisar <script>alert('x')</script>",
  phase: "validación de integridad del ledger",
  outcome: "blocked",
  reason: "No se encontró una apertura para el día operativo.",
  technicalDetails: "opening-missing",
};

describe("alerta por intento fallido de cierre de Fondo General", () => {
  it("genera el correo completo para el superadmin y Price Master", () => {
    const buildJobs = getBuilder();

    expect(buildJobs).toBeTypeOf("function");
    const jobs = buildJobs?.(completeAttempt) ?? [];

    expect(jobs.map((job) => job.to)).toEqual([
      "chavesa698@gmail.com",
      "price.master.srl@gmail.com",
    ]);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].subject).toBe(
      "[ALERTA][CIERRE BLOQUEADO] DELIKOR PALMARES",
    );
    expect(jobs[0].text).toContain("Hora Costa Rica: 20/10/2026, 2:15:30 p. m.");
    expect(jobs[0].text).toContain("Usuario: cajero@example.com");
    expect(jobs[0].text).toContain("Encargado: María");
    expect(jobs[0].text).toContain("Turno: N");
    expect(jobs[0].text).toContain("Total contado CRC: ₡107.000");
    expect(jobs[0].text).toContain("Saldo del ledger CRC: ₡100.000");
    expect(jobs[0].text).toContain("Diferencia CRC: + ₡7.000");
    expect(jobs[0].text).toContain("Total contado USD: US$120");
    expect(jobs[0].text).toContain("Diferencia USD: + US$20");
    expect(jobs[0].text).toContain("₡20.000: 5");
    expect(jobs[0].text).toContain("₡5.000: 1");
    expect(jobs[0].text).toContain("US$100: 1");
    expect(jobs[0].text).toContain("R08: ₡250.000");
    expect(jobs[0].text).toContain("TT / T11: ₡175.000");
    expect(jobs[0].text).toContain("Tucán acumulado: ₡249.500");
    expect(jobs[0].text).toContain("Tiempos acumulado: ₡174.000");
    expect(jobs[0].text).toContain(
      "Motivo exacto: No se encontró una apertura para el día operativo.",
    );
    expect(jobs[0].text).toContain("Detalle técnico: opening-missing");
    expect(jobs[0].text).toContain(
      "Observaciones: Revisar <script>alert('x')</script>",
    );
    expect(jobs[0].html).toContain(
      "Revisar &lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;",
    );
    expect(jobs[0].html).not.toContain("<script>");
  });

  it("identifica un cierre parcial y conserva diferencias no disponibles", () => {
    const buildJobs = getBuilder();

    expect(buildJobs).toBeTypeOf("function");
    const jobs =
      buildJobs?.({
        ...completeAttempt,
        outcome: "partial",
        currentBalanceCRC: null,
        currentBalanceUSD: null,
        technicalDetails: undefined,
        reason: "El cierre se guardó, pero falló su movimiento contable.",
      }) ?? [];

    expect(jobs[0].subject).toBe(
      "[ALERTA][CIERRE INCOMPLETO] DELIKOR PALMARES",
    );
    expect(jobs[0].text).toContain("Saldo del ledger CRC: No disponible");
    expect(jobs[0].text).toContain("Diferencia CRC: No disponible");
    expect(jobs[0].text).not.toContain("NaN");
    expect(jobs[0].text).not.toContain("Detalle técnico:");
  });

  it("intenta ambos destinatarios aunque uno falle", async () => {
    const buildJobs = getBuilder();
    const deliverJobs = getDelivery();

    expect(buildJobs).toBeTypeOf("function");
    expect(deliverJobs).toBeTypeOf("function");
    const attempted: string[] = [];
    const result = await deliverJobs?.(
      buildJobs?.(completeAttempt) ?? [],
      async (job) => {
        attempted.push(job.to);
        if (job.to === "chavesa698@gmail.com") {
          throw new Error("MAIL_WRITE_FAILED");
        }
      },
    );

    expect(attempted).toEqual([
      "chavesa698@gmail.com",
      "price.master.srl@gmail.com",
    ]);
    expect(result).toEqual({
      delivered: ["price.master.srl@gmail.com"],
      failed: ["chavesa698@gmail.com"],
    });
  });
});
