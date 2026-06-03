import type { Empresas } from "../../../types/firestore";

interface CompanySelectorContentProps {
  company: string;
  companySelectId: string;
  currentCompanyLabel: string;
  getCompanyKey: (emp: Empresas) => string;
  getCompanyLabel: (emp: Empresas) => string;
  handleAdminCompanyChange: (value: string) => void;
  ownerCompaniesError: string | null;
  ownerCompaniesLoading: boolean;
  sortedOwnerCompanies: Empresas[];
}

export function CompanySelectorContent({
  company,
  companySelectId,
  currentCompanyLabel,
  getCompanyKey,
  getCompanyLabel,
  handleAdminCompanyChange,
  ownerCompaniesError,
  ownerCompaniesLoading,
  sortedOwnerCompanies,
}: CompanySelectorContentProps) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3 text-sm text-[var(--foreground)] xl:flex-row xl:items-end xl:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] ">
          Empresa actual
        </p>
        <p
          className="truncate text-sm font-semibold text-[var(--foreground)]"
          title={currentCompanyLabel}
        >
          {currentCompanyLabel}
        </p>
        {ownerCompaniesError && (
          <p className="text-xs text-red-500 mt-1">{ownerCompaniesError}</p>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <select
          id={companySelectId}
          value={company}
          onChange={(e) => handleAdminCompanyChange(e.target.value)}
          disabled={ownerCompaniesLoading || sortedOwnerCompanies.length === 0}
          className="w-full min-w-0 max-w-full truncate rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors hover:border-[var(--accent)]/60 focus:border-[var(--accent)]"
        >
          {ownerCompaniesLoading && (
            <option value="">Cargando empresas...</option>
          )}
          {!ownerCompaniesLoading && sortedOwnerCompanies.length === 0 && (
            <option value="">Sin empresas disponibles</option>
          )}
          {!ownerCompaniesLoading && sortedOwnerCompanies.length > 0 && (
            <>
              <option value="" disabled hidden>
                Selecciona una empresa
              </option>
              {sortedOwnerCompanies.map((emp, index) => (
                <option
                  key={emp.id || emp.name || emp.ubicacion || `company-${index}`}
                  value={getCompanyKey(emp)}
                >
                  {getCompanyLabel(emp)}
                </option>
              ))}
            </>
          )}
        </select>
      </div>
    </div>
  );
}
