import React, { useMemo } from "react";

type CierreDBase = {
  conticaCRC: number;
  tucanCRC?: number;
  tiemposCRC?: number;
  conticaTiemposCRC?: number;
} | null | undefined;

type SistemasVerificationSectionProps = {
  turno: "D" | "N";
  cierreDBase?: CierreDBase;
  totalConticaCRC: string;
  totalTucanCRC: string;
  totalConticaTiemposCRC: string;
  totalTiemposCRC: string;
  onConticaChange: (value: string) => void;
  onTucanChange: (value: string) => void;
  onConticaTiemposChange: (value: string) => void;
  onTiemposChange: (value: string) => void;
};

const inputClassName =
  "h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] text-right transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]";

const parseCurrencyInput = (value: string) => Number(value.replace(/\D/g, "")) || 0;

const formatEditableCurrency = (value: string) => {
  const numericValue = parseCurrencyInput(value);
  if (numericValue === 0) return "";
  return numericValue.toLocaleString("es-CR");
};

const formatDiff = (diff: number) => {
  if (diff === 0) return "sin diferencias";
  return `${diff > 0 ? "+" : "-"}₡ ${Math.abs(diff).toLocaleString("es-CR")}`;
};

const diffClassName = (diff: number) => {
  if (diff > 0) {
    return "h-11 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-right text-sm font-semibold text-emerald-300";
  }
  if (diff < 0) {
    return "h-11 rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-right text-sm font-semibold text-red-300";
  }
  return "h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-right text-sm font-semibold text-[var(--foreground)]";
};

const CurrencyField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
}> = ({ label, value, onChange, helper }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
      {label}
    </label>
    <input
      value={formatEditableCurrency(value)}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
      inputMode="numeric"
      placeholder="₡ 0"
      className={inputClassName}
    />
    {helper ? <p className="text-xs text-[var(--muted-foreground)]">{helper}</p> : null}
  </div>
);

const DifferenceField: React.FC<{ diff: number }> = ({ diff }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
      Diferencia
    </label>
    <input
      value={formatDiff(diff)}
      readOnly
      tabIndex={-1}
      className={diffClassName(diff)}
    />
  </div>
);

const SistemasVerificationSection: React.FC<SistemasVerificationSectionProps> = ({
  turno,
  cierreDBase,
  totalConticaCRC,
  totalTucanCRC,
  totalConticaTiemposCRC,
  totalTiemposCRC,
  onConticaChange,
  onTucanChange,
  onConticaTiemposChange,
  onTiemposChange,
}) => {
  const conticaNum = parseCurrencyInput(totalConticaCRC);
  const tucanNum = parseCurrencyInput(totalTucanCRC);
  const conticaTiemposNum = parseCurrencyInput(totalConticaTiemposCRC);
  const tiemposNum = parseCurrencyInput(totalTiemposCRC);

  const cierreDContica = cierreDBase?.conticaCRC ?? 0;
  const cierreDTucan = cierreDBase?.tucanCRC ?? 0;
  const cierreDTiempos = cierreDBase?.tiemposCRC ?? 0;
  const cierreDConticaTiempos = cierreDBase?.conticaTiemposCRC ?? 0;

  const conticaAjustada = useMemo(() => {
    if (turno === "D" || !cierreDBase) return conticaNum;
    return conticaNum - cierreDContica;
  }, [turno, cierreDBase, conticaNum, cierreDContica]);

  const tucanAjustado = useMemo(() => {
    if (turno === "D" || !cierreDBase) return tucanNum;
    return tucanNum - cierreDTucan;
  }, [turno, cierreDBase, tucanNum, cierreDTucan]);

  const conticaTiemposAjustado = useMemo(() => {
    if (turno === "D" || !cierreDBase) return conticaTiemposNum;
    return conticaTiemposNum - cierreDConticaTiempos;
  }, [turno, cierreDBase, conticaTiemposNum, cierreDConticaTiempos]);

  const tiemposAjustado = useMemo(() => {
    if (turno === "D" || !cierreDBase) return tiemposNum;
    return tiemposNum - cierreDTiempos;
  }, [turno, cierreDBase, tiemposNum, cierreDTiempos]);

  const diffConticaTucanCRC = useMemo(() => {
    if (turno === "N" && cierreDBase) {
      return conticaAjustada - tucanAjustado + (cierreDContica - cierreDTucan);
    }
    return conticaNum - tucanNum;
  }, [turno, cierreDBase, conticaAjustada, tucanAjustado, cierreDContica, cierreDTucan, conticaNum, tucanNum]);

  const diffConticaTiemposCRC = useMemo(() => {
    if (turno === "N" && cierreDBase) {
      return conticaTiemposAjustado - tiemposAjustado + (cierreDConticaTiempos - cierreDTiempos);
    }
    return conticaTiemposNum - tiemposNum;
  }, [turno, cierreDBase, conticaTiemposAjustado, tiemposAjustado, cierreDConticaTiempos, cierreDTiempos, conticaTiemposNum, tiemposNum]);

  return (
    <section className="rounded-lg border border-[var(--input-border)] p-4 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-sm font-semibold text-[var(--foreground)]">
          Verificacion de sistemas
        </h4>
        <span
          className={`w-fit rounded-full border px-2 py-0.5 text-xs font-bold ${
            turno === "D"
              ? "border-amber-500/30 bg-amber-500/20 text-amber-300"
              : "border-indigo-500/30 bg-indigo-500/20 text-indigo-300"
          }`}
        >
          Turno {turno}
        </span>
      </div>

      {turno === "N" && !cierreDBase ? (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          No se encontro cierre D. N no descontara acumulado.
        </div>
      ) : null}

      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          <CurrencyField
            label="R08"
            value={totalConticaCRC}
            onChange={onConticaChange}
            helper={turno === "N" && cierreDBase && conticaNum > 0 ? `Ajustado N: ₡ ${conticaAjustada.toLocaleString("es-CR")}` : undefined}
          />
          <CurrencyField
            label="Tucan"
            value={totalTucanCRC}
            onChange={onTucanChange}
            helper={turno === "N" && cierreDBase && tucanNum > 0 ? `Ajustado N: ₡ ${tucanAjustado.toLocaleString("es-CR")}` : undefined}
          />
          <DifferenceField diff={diffConticaTucanCRC} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <CurrencyField
            label="T11"
            value={totalConticaTiemposCRC}
            onChange={onConticaTiemposChange}
            helper={turno === "N" && cierreDBase && conticaTiemposNum > 0 ? `Ajustado N: ₡ ${conticaTiemposAjustado.toLocaleString("es-CR")}` : undefined}
          />
          <CurrencyField
            label="Tiempos"
            value={totalTiemposCRC}
            onChange={onTiemposChange}
            helper={turno === "N" && cierreDBase && tiemposNum > 0 ? `Ajustado N: ₡ ${tiemposAjustado.toLocaleString("es-CR")}` : undefined}
          />
          <DifferenceField diff={diffConticaTiemposCRC} />
        </div>
      </div>
    </section>
  );
};

export default SistemasVerificationSection;
