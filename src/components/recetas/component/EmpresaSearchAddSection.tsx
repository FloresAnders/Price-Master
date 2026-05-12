"use client";

import React from "react";
import { Plus, Search } from "lucide-react";

import { EmpresaSelector } from "@/components/recetas/component/EmpresaSelector";

type EmpresaSearchAddSectionProps = {
  authLoading: boolean;
  isAdminLike: boolean;
  userRole?: string;
  actorOwnerIds?: Array<string | number>;
  companyFromUser: string;

  showEmpresaSelector?: boolean;

  selectedEmpresa: string;
  setSelectedEmpresa: (next: string) => void;
  setEmpresaError?: (msg: string | null) => void;
  onCompanyChanged?: (next: string) => void;

  searchValue: string;
  onSearchValueChange: (next: string) => void;
  searchPlaceholder: string;
  searchAriaLabel: string;
  searchDisabled?: boolean;

  addButtonText?: string;
  onAddClick?: () => void;
  addDisabled?: boolean;

  onRefreshClick?: () => void;
  refreshDisabled?: boolean;
  refreshButtonText?: string;
};

export function EmpresaSearchAddSection({
  authLoading,
  isAdminLike,
  userRole,
  actorOwnerIds,
  companyFromUser,
  showEmpresaSelector = true,
  selectedEmpresa,
  setSelectedEmpresa,
  setEmpresaError,
  onCompanyChanged,
  searchValue,
  onSearchValueChange,
  searchPlaceholder,
  searchAriaLabel,
  searchDisabled,
  addButtonText,
  onAddClick,
  addDisabled,

  onRefreshClick,
  refreshDisabled,
  refreshButtonText = "Actualizar",
}: EmpresaSearchAddSectionProps) {
  return (
    <>
      {showEmpresaSelector && (
        <EmpresaSelector
          authLoading={authLoading}
          isAdminLike={isAdminLike}
          userRole={userRole}
          actorOwnerIds={actorOwnerIds}
          companyFromUser={companyFromUser}
          selectedEmpresa={selectedEmpresa}
          setSelectedEmpresa={setSelectedEmpresa}
          setEmpresaError={setEmpresaError}
          onCompanyChanged={onCompanyChanged}
        />
      )}

      <div className="flex w-full md:flex-1 flex-col md:flex-row md:flex-nowrap items-stretch md:items-end gap-2 md:gap-3">
        <div className="w-full md:w-auto md:flex-1 md:min-w-0 lg:min-w-[260px]">
          <label className="text-[10px] sm:text-xs text-[var(--muted-foreground)] md:invisible">
            Buscar
          </label>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <input
              value={searchValue}
              onChange={(e) => onSearchValueChange(e.target.value)}
              className="w-full px-4 py-2.5 pr-10 bg-[var(--card-bg)] border-2 border-[var(--input-border)] rounded-lg text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              placeholder={searchPlaceholder}
              aria-label={searchAriaLabel}
              disabled={Boolean(searchDisabled)}
            />
          </div>
        </div>

        {onRefreshClick && (
          <button
            type="button"
            onClick={onRefreshClick}
            disabled={Boolean(refreshDisabled)}
            className="w-full md:w-auto flex items-center justify-center px-4 py-2.5 border-2 border-[var(--input-border)] rounded-lg bg-[var(--card-bg)] text-[var(--foreground)] hover:border-cyan-500 hover:bg-[var(--muted)] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-all whitespace-nowrap"
          >
            {refreshButtonText}
          </button>
        )}

        {addButtonText && onAddClick ? (
          <button
            type="button"
            onClick={onAddClick}
            disabled={Boolean(addDisabled)}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:shadow-lg transition-all border border-cyan-600 hover:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{addButtonText}</span>
          </button>
        ) : null}
      </div>
    </>
  );
}
