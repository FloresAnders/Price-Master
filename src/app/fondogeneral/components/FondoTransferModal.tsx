"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import type { FondoAccountTab } from "@/lib/fondoAccountTabs";
import type { MovementAccountKey } from "@/services/movimientos-fondos";
import {
  resolveCashTransferBreakdown,
  transferCashCounterAmount,
} from "@/components/business/cash-counter-tabs/accountCounters";
import {
  getOrCreateCashCounterSnapshot,
  type CashCounterSnapshot,
} from "@/services/cashCounterDb";
import { MovimientosFondosService } from "@/services/movimientos-fondos";
import type { FondoEntry } from "../types";
import { EmpresasService } from "@/services/empresas";
import { SchedulesService } from "@/services/schedules";
import { getControlHorarioShiftTiming } from "@/utils/controlHorarioManager";
import { ProvidersService } from "@/services/providers";
import type { ProviderEntry } from "@/types/firestore";

type Props = {
  open: boolean;
  accounts: readonly FondoAccountTab[];
  initialAccountId: MovementAccountKey;
  userName: string;
  companyKey?: string;
  onClose: () => void;
};

const COMPANY_STORAGE_KEY = "fg_selected_company_shared";

function formatAmount(value: number) {
  return new Intl.NumberFormat("es-CR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCRCInput(value: number) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseCRCInput(value: string): number | null {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!normalized || normalized === "-" || normalized === ".") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function FondoTransferModal({
  open,
  accounts,
  initialAccountId,
  userName,
  companyKey = "",
  onClose,
}: Props) {
  const [sourceId, setSourceId] = useState(initialAccountId);
  const [destinationId, setDestinationId] = useState<MovementAccountKey>(
    accounts.find((account) => account.accountId !== initialAccountId)
      ?.accountId ?? "FondoGeneral",
  );
  const [sourceProviderSearch, setSourceProviderSearch] = useState("");
  const [destinationProviderSearch, setDestinationProviderSearch] = useState("");
  const [sourceProviderCode, setSourceProviderCode] = useState("");
  const [destinationProviderCode, setDestinationProviderCode] = useState("");
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [sourceProviderMenuOpen, setSourceProviderMenuOpen] = useState(false);
  const [destinationProviderMenuOpen, setDestinationProviderMenuOpen] =
    useState(false);
  const [amount, setAmount] = useState("");
  const [manager, setManager] = useState(userName);
  const [managerSelection, setManagerSelection] = useState(userName);
  const [managerOptions, setManagerOptions] = useState<string[]>([]);
  const [withinSchedule, setWithinSchedule] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sourceAccount = accounts.find((account) => account.accountId === sourceId);
  const destinationAccount = accounts.find(
    (account) => account.accountId === destinationId,
  );
  const sourceProvider = providers.find(
    (provider) => provider.code === sourceProviderCode,
  );
  const destinationProvider = providers.find(
    (provider) => provider.code === destinationProviderCode,
  );
  const providersForAccount = (accountId: MovementAccountKey) => {
    const isGeneralAccount = accountId === "FondoGeneral";
    return providers
      .filter((provider) =>
        provider.active !== false &&
        (isGeneralAccount
          ? (!provider.accountId || provider.accountId === "FondoGeneral") &&
            provider.category === "Egreso" &&
            provider.type?.trim().toUpperCase() !== "COMPRA INVENTARIO"
          : provider.accountId === accountId),
      )
      .sort((a, b) => {
        const usageDifference =
          (b.movementCount ?? 0) - (a.movementCount ?? 0);
        if (usageDifference !== 0) return usageDifference;
        return a.name.localeCompare(b.name, "es", {
          sensitivity: "base",
        });
      });
  };
  const filteredSourceProviders = providersForAccount(sourceId).filter((provider) => {
    const search = sourceProviderSearch.trim().toLocaleLowerCase();
    return (
      !search ||
      provider.name.toLocaleLowerCase().includes(search) ||
      provider.code.toLocaleLowerCase().includes(search)
    );
  });
  const filteredDestinationProviders = providersForAccount(destinationId).filter(
    (provider) => {
      const search = destinationProviderSearch.trim().toLocaleLowerCase();
      return (
        !search ||
        provider.name.toLocaleLowerCase().includes(search) ||
        provider.code.toLocaleLowerCase().includes(search)
      );
    },
  );
  const amountNumber = parseCRCInput(amount) ?? 0;
  const [snapshot, setSnapshot] = useState<CashCounterSnapshot | null>(null);
  useEffect(() => {
    if (!open) return;
    void getOrCreateCashCounterSnapshot()
      .then(setSnapshot)
      .catch((caught) => {
        console.error("Error cargando contadores para transferencia:", caught);
        setSnapshot(null);
      });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const loadSchedule = async () => {
      const selectedCompanyKey =
        window.localStorage.getItem(COMPANY_STORAGE_KEY)?.trim() ||
        companyKey.trim();
      const empresas = await EmpresasService.getAllEmpresas();
      const empresa =
        empresas.find((item) =>
          [item.id, item.name, item.ubicacion].some(
            (value) => String(value || "").trim() === selectedCompanyKey,
          ),
        ) ?? null;
      if (!empresa) {
        if (!cancelled) setWithinSchedule(false);
        return;
      }
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Costa_Rica",
        year: "numeric",
        month: "2-digit",
      }).formatToParts(now);
      const year = Number(parts.find((part) => part.type === "year")?.value);
      const month = Number(parts.find((part) => part.type === "month")?.value);
      const keys = [empresa.id, empresa.name, empresa.ubicacion]
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      const schedules = (
        await Promise.all(
          Array.from(new Set(keys)).map((key) =>
            SchedulesService.getSchedulesByLocationYearMonth(key, year, month - 1),
          ),
        )
      ).flat();
      const timing = getControlHorarioShiftTiming({
        nowISO: now.toISOString(),
        empresa,
        monthSchedules: schedules,
      });
      if (cancelled) return;
      if (!timing.withinHorario) {
        setWithinSchedule(false);
        setManagerOptions(
          (empresa.empleados ?? [])
            .map((employee) => String(employee.Empleado || "").trim())
            .filter(Boolean),
        );
        setManager("");
        setManagerSelection("other");
        return;
      }
      const automaticManager = timing.expectedShift === "D"
        ? timing.entryD?.employeeName
        : timing.entryN?.employeeName;
      const options = [automaticManager, ...(empresa.empleados ?? []).map(
        (employee) => String(employee.Empleado || "").trim(),
      )].filter((value): value is string => Boolean(value));
      setWithinSchedule(Boolean(automaticManager));
      setManagerOptions(Array.from(new Set(options)));
      setManager(automaticManager || userName);
      setManagerSelection(automaticManager || "");
    };
    void loadSchedule().catch((caught) => {
      console.error("Error resolviendo encargado de transferencia:", caught);
      if (!cancelled) setWithinSchedule(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyKey, open, userName]);
  useEffect(() => {
    if (!open) return;
    const company =
      window.localStorage.getItem(COMPANY_STORAGE_KEY)?.trim() ||
      companyKey.trim();
    if (!company) return;
    let cancelled = false;
    setProvidersLoading(true);
    void ProvidersService.getProviders(company)
      .then((loadedProviders) => {
        if (!cancelled) setProviders(loadedProviders);
      })
      .catch((caught) => {
        console.error("Error cargando proveedores de transferencia:", caught);
        if (!cancelled) setProviders([]);
      })
      .finally(() => {
        if (!cancelled) setProvidersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyKey, open]);
  const sourceCounter = snapshot?.counters.find(
    (counter) => counter.accountId === sourceId,
  );
  const breakdown = useMemo(() => {
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return null;
    return resolveCashTransferBreakdown(sourceCounter, amountNumber);
  }, [amountNumber, sourceCounter]);

  if (!open) return null;

  const save = async () => {
    setError("");
    if (!sourceAccount || !destinationAccount || sourceId === destinationId) {
      setError("Selecciona fondos distintos.");
      return;
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError("Ingresa monto válido.");
      return;
    }
    if (!manager.trim()) {
      setError("Selecciona encargado.");
      return;
    }
    if (!sourceProvider || !destinationProvider) {
      setError("Selecciona proveedor de origen y proveedor de destino.");
      return;
    }
    setSaving(true);
    try {
      const currentSnapshot = snapshot ?? (await getOrCreateCashCounterSnapshot());
      const source = currentSnapshot.counters.find(
        (counter) => counter.accountId === sourceId,
      );
      const resolvedBreakdown = resolveCashTransferBreakdown(source, amountNumber);
      if (!resolvedBreakdown) {
        setError("No existen billetes disponibles para entregar monto exacto.");
        return;
      }
      const company =
        window.localStorage.getItem(COMPANY_STORAGE_KEY)?.trim() ||
        companyKey.trim() ||
        "global";
      const createdAt = new Date().toISOString();
      const transferId = crypto.randomUUID();
      const sourceMovement: FondoEntry = {
        id: `${transferId}-out`,
        providerCode: sourceProvider.code,
        invoiceNumber: "",
        paymentType: sourceProvider.type || "EGRESOS VARIOS",
        amount: amountNumber,
        amountEgreso: amountNumber,
        amountIngreso: 0,
        manager: manager.trim(),
        notes: `Transferencia a ${destinationAccount.label} (${destinationProvider.name})`,
        createdAt,
        accountId: sourceId,
        currency: "CRC",
        breakdown: resolvedBreakdown.bills,
        empresa: company,
      };
      const destinationMovement: FondoEntry = {
        id: `${transferId}-in`,
        providerCode: destinationProvider.code,
        invoiceNumber: "",
        paymentType: destinationProvider.type || "OTROS INGRESOS",
        amount: amountNumber,
        amountEgreso: 0,
        amountIngreso: amountNumber,
        manager: manager.trim(),
        notes: `Transferencia desde ${sourceAccount.label} (${sourceProvider.name})`,
        createdAt,
        accountId: destinationId,
        currency: "CRC",
        breakdown: resolvedBreakdown.bills,
        empresa: company,
      };
      await MovimientosFondosService.commitFundTransfer({
        docId: MovimientosFondosService.buildCompanyMovementsKey(company),
        company,
        sourceAccountId: sourceId,
        destinationAccountId: destinationId,
        sourceMovement,
        destinationMovement,
        nowISO: createdAt,
      });
      await transferCashCounterAmount({
        sourceAccountId: sourceId,
        destinationAccountId: destinationId,
        amount: amountNumber,
        breakdown: resolvedBreakdown.bills,
      });
      window.dispatchEvent(
        new CustomEvent("fondo-transfer-committed", {
          detail: {
            sourceAccountId: sourceId,
            destinationAccountId: destinationId,
          },
        }),
      );
      onClose();
      setAmount("");
    } catch (caught) {
      console.error("Error guardando transferencia entre fondos:", caught);
      setError("No se pudo guardar transferencia.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl border border-white/20 bg-[#0b1016] text-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-white/10 p-6">
          <div>
            <h2 className="text-xl font-bold uppercase">Movimiento entre fondos</h2>
            <p className="mt-1 text-sm text-slate-400">
              Transferir dinero entre fondos de la empresa
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/20 p-2">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
            <label className="rounded-xl border border-orange-400/60 p-4">
              <span className="mb-2 flex items-center gap-2 font-semibold"><ArrowUpRight className="text-orange-300" /> Fondo de origen</span>
              <select value={sourceId} onChange={(event) => {
                setSourceId(event.target.value as MovementAccountKey);
                setSourceProviderCode("");
                setSourceProviderSearch("");
              }} className="w-full rounded-md border border-white/20 bg-[#111923] p-2">
                {accounts.map((account) => <option key={account.accountId} value={account.accountId}>{account.label}</option>)}
              </select>
            </label>
            <ArrowRight className="mx-auto hidden h-7 w-7 text-cyan-300 md:block" />
            <label className="rounded-xl border border-emerald-400/60 p-4">
              <span className="mb-2 flex items-center gap-2 font-semibold"><ArrowDownRight className="text-emerald-300" /> Fondo de destino</span>
              <select value={destinationId} onChange={(event) => {
                setDestinationId(event.target.value as MovementAccountKey);
                setDestinationProviderCode("");
                setDestinationProviderSearch("");
              }} className="w-full rounded-md border border-white/20 bg-[#111923] p-2">
                {accounts.map((account) => <option key={account.accountId} value={account.accountId}>{account.label}</option>)}
              </select>
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold uppercase text-slate-300">
                Proveedor de salida
              </span>
              <div className="relative">
                <input
                  value={sourceProviderSearch}
                  onChange={(event) => {
                    setSourceProviderSearch(event.target.value);
                    setSourceProviderCode("");
                    setSourceProviderMenuOpen(true);
                  }}
                  onFocus={() => setSourceProviderMenuOpen(true)}
                  onBlur={() =>
                    window.setTimeout(() => setSourceProviderMenuOpen(false), 200)
                  }
                  className="w-full rounded-md border border-white/20 bg-[#111923] p-3"
                  placeholder={
                    providersLoading ? "Cargando proveedores..." : "Buscar proveedor"
                  }
                />
                {sourceProviderMenuOpen && filteredSourceProviders.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-cyan-600/45 bg-[#0d1117] shadow-xl">
                    {filteredSourceProviders.map((provider) => (
                      <button
                        key={provider.code}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setSourceProviderCode(provider.code);
                          setSourceProviderSearch(`${provider.name} (${provider.code})`);
                          setSourceProviderMenuOpen(false);
                        }}
                        className="block w-full border-b border-white/10 p-3 text-left text-sm hover:bg-cyan-950/70"
                      >
                        {provider.name} ({provider.code})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold uppercase text-slate-300">
                Proveedor de destino
              </span>
              <div className="relative">
                <input
                  value={destinationProviderSearch}
                  onChange={(event) => {
                    setDestinationProviderSearch(event.target.value);
                    setDestinationProviderCode("");
                    setDestinationProviderMenuOpen(true);
                  }}
                  onFocus={() => setDestinationProviderMenuOpen(true)}
                  onBlur={() =>
                    window.setTimeout(
                      () => setDestinationProviderMenuOpen(false),
                      200,
                    )
                  }
                  className="w-full rounded-md border border-white/20 bg-[#111923] p-3"
                  placeholder={
                    providersLoading ? "Cargando proveedores..." : "Buscar proveedor"
                  }
                />
                {destinationProviderMenuOpen &&
                  filteredDestinationProviders.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-cyan-600/45 bg-[#0d1117] shadow-xl">
                    {filteredDestinationProviders.map((provider) => (
                      <button
                        key={provider.code}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setDestinationProviderCode(provider.code);
                          setDestinationProviderSearch(
                            `${provider.name} (${provider.code})`,
                          );
                          setDestinationProviderMenuOpen(false);
                        }}
                        className="block w-full border-b border-white/10 p-3 text-left text-sm hover:bg-cyan-950/70"
                      >
                        {provider.name} ({provider.code})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold uppercase text-slate-300">Monto a transferir</span>
            <input
              value={amount}
              onChange={(event) => {
                const nextValue = event.target.value;
                const nextAmount = parseCRCInput(nextValue);
                setAmount(
                  nextAmount === null ? "" : formatCRCInput(nextAmount),
                );
              }}
              inputMode="decimal"
              className="w-full rounded-md border border-white/20 bg-[#111923] p-3 text-lg"
              placeholder="₡ 0,00"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold uppercase text-slate-300">Encargado</span>
            {withinSchedule ? (
              <input
                value={manager}
                readOnly
                className="w-full rounded-md border border-white/20 bg-[#111923] p-3 text-slate-300"
              />
            ) : (
              <select
                value={managerSelection}
                onChange={(event) => {
                  const next = event.target.value;
                  setManagerSelection(next);
                  setManager(next);
                }}
                className="w-full rounded-md border border-white/20 bg-[#111923] p-3"
              >
                <option value="">Seleccionar encargado</option>
                {managerOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            )}
            {!withinSchedule && managerSelection === "" && (
              <input
                value={manager}
                onChange={(event) => setManager(event.target.value)}
                className="mt-2 w-full rounded-md border border-white/20 bg-[#111923] p-3"
                placeholder="Nombre del encargado"
              />
            )}
          </label>
          {breakdown && (
            <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4">
              <p className="font-semibold">Billetes requeridos: ₡ {formatAmount(breakdown.total)}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-cyan-100">
                {Object.entries(breakdown.bills)
                  .sort(([a], [b]) => Number(b) - Number(a))
                  .map(([denomination, count]) => (
                    <span key={denomination} className="rounded-md border border-cyan-300/20 px-2 py-1">
                      {count} x ₡ {formatAmount(Number(denomination))}
                    </span>
                  ))}
              </div>
            </div>
          )}
          {error && <p className="rounded-md border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        </div>
        <footer className="flex justify-end gap-3 border-t border-white/10 p-5">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/30 px-5 py-2">Cancelar</button>
          <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-cyan-500 px-5 py-2 font-semibold text-slate-950 disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar movimiento"}
          </button>
        </footer>
      </div>
    </div>
  );
}
