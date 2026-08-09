import { companySelectClass } from "./styles";
import type { EmpresaOption } from "./types";

type RegistroTucanHeaderProps = {
  empresa: string;
  empresaLoading: boolean;
  canSelectEmpresa: boolean;
  empresaOptions: EmpresaOption[];
  selectedEmpresa: string;
  currentEmpresaLabel: string;
  saving: boolean;
  onEmpresaChange: (value: string) => void;
};

export function RegistroTucanHeader({
  empresa,
  empresaLoading,
  canSelectEmpresa,
  empresaOptions,
  selectedEmpresa,
  currentEmpresaLabel,
  saving,
  onEmpresaChange,
}: RegistroTucanHeaderProps) {
  const showSelector = canSelectEmpresa || empresaOptions.length > 1;

  return (
    <div className="flex flex-col gap-3 border-l-4 border-cyan-500/60 pl-5 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Registro Tucan
        </h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {empresaLoading ? "Cargando empresas..." : empresa || "Sin empresa"}
        </p>
      </div>
      {showSelector && (
        <div className="flex w-full min-w-0 flex-col gap-3 text-sm text-[var(--foreground)] md:max-w-md xl:flex-row xl:items-end xl:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
              Empresa actual
            </p>
            <p
              className="truncate text-sm font-semibold text-[var(--foreground)]"
              title={currentEmpresaLabel}
            >
              {empresaLoading ? "Cargando empresas..." : currentEmpresaLabel}
            </p>
          </div>
          <select
            className={companySelectClass}
            value={selectedEmpresa}
            onChange={(event) => onEmpresaChange(event.target.value)}
            disabled={empresaLoading || saving || empresaOptions.length === 0}
          >
            {empresaLoading ? (
              <option value="">Cargando empresas...</option>
            ) : empresaOptions.length === 0 ? (
              <option value="">Sin empresas</option>
            ) : (
              <>
                <option value="" disabled hidden>
                  Selecciona una empresa
                </option>
                {empresaOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
      )}
    </div>
  );
}
