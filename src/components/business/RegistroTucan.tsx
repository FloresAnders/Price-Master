"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  FileText,
  Lock,
  RefreshCw,
  Save,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useActorOwnership } from "../../hooks/useActorOwnership";
import useToast from "../../hooks/useToast";
import { getDefaultPermissions } from "../../utils/permissions";
import {
  MovimientosFondosService,
  type MovementStorage,
} from "../../services/movimientos-fondos";
import { EmpresasService } from "../../services/empresas";
import { RegistroTucanService } from "../../services/registro-tucan";
import type { Empresas, RegistroTucanRecord } from "../../types/firestore";
import { useShiftScheduleResolver } from "../../app/fondogeneral/hooks/useShiftScheduleResolver";
import {
  calculateRegistroTucanTotal,
  formatRegistroTucanDateInput,
  formatRegistroTucanTimeInput,
  parseRegistroTucanAmount,
} from "../../utils/registroTucan";
import { getAuthoritativeNow } from "../../utils/serverTime";

type RegistroTucanSortOrder = "desc" | "asc";
type EmpresaOption = { value: string; label: string; empresa: Empresas | null };
const REGISTRO_TUCAN_COMPANY_STORAGE_KEY = "fg_selected_company_shared";

const formatCRC = (value: number) =>
  new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const resolveTucanBalance = (ledger: MovementStorage | null): number => {
  const balance = ledger?.state?.balancesByAccount?.find(
    (item) => item.accountId === "Tucan" && item.currency === "CRC",
  );
  return Number(balance?.currentBalance || 0);
};

const normalizeKey = (value: unknown) => String(value || "").trim().toLowerCase();

const getEmpresaValue = (empresa: Empresas | null | undefined) =>
  String(empresa?.name || empresa?.ubicacion || empresa?.id || "").trim();

const getEmpresaLabel = (empresa: Empresas | null | undefined) => {
  const name = String(empresa?.name || "").trim();
  const ubicacion = String(empresa?.ubicacion || "").trim();
  if (name && ubicacion && normalizeKey(name) !== normalizeKey(ubicacion)) {
    return `${name} - ${ubicacion}`;
  }
  return name || ubicacion || String(empresa?.id || "Empresa").trim();
};

const getEmpresaCandidates = (empresa: Empresas | null | undefined) =>
  [empresa?.id, empresa?.name, empresa?.ubicacion].map(normalizeKey).filter(Boolean);

export default function RegistroTucan() {
  const { user, loading } = useAuth();
  const { ownerIds } = useActorOwnership(user || {});
  const { showToast } = useToast();
  const [fecha, setFecha] = useState(() =>
    formatRegistroTucanDateInput(new Date()),
  );
  const [hora, setHora] = useState(() => formatRegistroTucanTimeInput(new Date()));
  const [saldoPaginaTucanInput, setSaldoPaginaTucanInput] = useState("");
  const [pagosHoyInput, setPagosHoyInput] = useState("");
  const [saldoFondoTucan, setSaldoFondoTucan] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [empresaLoading, setEmpresaLoading] = useState(true);
  const [serverTimeLoading, setServerTimeLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<RegistroTucanRecord[]>([]);
  const [sortOrder, setSortOrder] = useState<RegistroTucanSortOrder>("desc");
  const [empresaOptions, setEmpresaOptions] = useState<EmpresaOption[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState("");

  const resolvedPermissions = user
    ? user.permissions || getDefaultPermissions(user.role || "user")
    : null;
  const hasPermission = Boolean(resolvedPermissions?.registroTucan);
  const assignedEmpresa = String(user?.ownercompanie || "").trim();
  const canSelectEmpresa = user?.role === "admin" || user?.role === "superadmin";
  const empresa = selectedEmpresa.trim();
  const empresaConfig = useMemo(() => {
    const selectedKey = normalizeKey(selectedEmpresa);
    return (
      empresaOptions.find(
        (item) =>
          normalizeKey(item.value) === selectedKey ||
          getEmpresaCandidates(item.empresa).includes(selectedKey),
      )?.empresa || null
    );
  }, [empresaOptions, selectedEmpresa]);
  const currentEmpresaLabel = useMemo(() => {
    if (!empresa) return "Sin empresa seleccionada";
    const selectedKey = normalizeKey(empresa);
    const match = empresaOptions.find(
      (item) =>
        normalizeKey(item.value) === selectedKey ||
        getEmpresaCandidates(item.empresa).includes(selectedKey),
    );
    return match ? match.label.split(" - ")[0] : empresa;
  }, [empresa, empresaOptions]);
  const { resolveShiftManagerForNow } = useShiftScheduleResolver({
    company: empresa,
    empresa: empresaConfig,
    cierreFondoVentasMinutesAfterEnd:
      empresaConfig?.cierreFondoVentasMinutesAfterEnd,
  });

  const saldoPaginaTucan = useMemo(
    () => parseRegistroTucanAmount(saldoPaginaTucanInput),
    [saldoPaginaTucanInput],
  );
  const pagosHoy = useMemo(
    () => parseRegistroTucanAmount(pagosHoyInput),
    [pagosHoyInput],
  );
  const total = useMemo(
    () =>
      calculateRegistroTucanTotal({
        saldoPaginaTucan,
        saldoFondoTucan,
        pagosHoy,
      }),
    [saldoPaginaTucan, saldoFondoTucan, pagosHoy],
  );
  const sortedRecords = useMemo(
    () =>
      records.slice().sort((a, b) => {
        const byDate =
          sortOrder === "asc"
            ? a.dateKey - b.dateKey
            : b.dateKey - a.dateKey;
        const byTime =
          sortOrder === "asc"
            ? String(a.hora || "").localeCompare(String(b.hora || ""))
            : String(b.hora || "").localeCompare(String(a.hora || ""));
        const byId = String(a.id || "").localeCompare(String(b.id || ""));
        return byDate || byTime || byId;
      }),
    [records, sortOrder],
  );

  const inputFormatterCRC = useMemo(
    () =>
      new Intl.NumberFormat("es-CR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const sanitizeAmountInput = useCallback((value: string) => {
    const stripped = value.replace(/\s/g, "").replace(/[^\d.,]/g, "");
    const decimalIndex = Math.max(
      stripped.lastIndexOf(","),
      stripped.lastIndexOf("."),
    );
    if (decimalIndex === -1) return stripped.replace(/[.,]/g, "");
    const integerPart = stripped.slice(0, decimalIndex).replace(/[.,]/g, "");
    const fractionPart = stripped
      .slice(decimalIndex + 1)
      .replace(/[.,]/g, "")
      .slice(0, 2);
    return fractionPart.length > 0
      ? `${integerPart}.${fractionPart}`
      : `${integerPart}.`;
  }, []);

  const formatInputDisplay = useCallback(
    (raw: string) => {
      if (!raw || raw.trim().length === 0) return "";
      const normalized = sanitizeAmountInput(raw);
      const [integerPart, fractionPart] = normalized.split(".");
      const integerValue = Number(integerPart || "0");
      const formattedInteger = inputFormatterCRC.format(integerValue);
      const suffix = normalized.includes(",") || normalized.includes(".")
        ? `,${fractionPart ?? ""}`
        : "";
      return `₡ ${formattedInteger}${suffix}`;
    },
    [inputFormatterCRC, sanitizeAmountInput],
  );

  const handleEmpresaChange = useCallback(
    (value: string) => {
      const previousValue = selectedEmpresa;
      setSelectedEmpresa(value);
      try {
        localStorage.setItem(REGISTRO_TUCAN_COMPANY_STORAGE_KEY, value);
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: REGISTRO_TUCAN_COMPANY_STORAGE_KEY,
            newValue: value,
            oldValue: previousValue,
            storageArea: localStorage,
          }),
        );
      } catch (err) {
        console.error("Error saving Registro Tucan empresa:", err);
      }
    },
    [selectedEmpresa],
  );

  const loadRecentRecords = useCallback(async () => {
    if (!empresa || !hasPermission) {
      setRecords([]);
      return;
    }
    setRecordsLoading(true);
    try {
      const recent = await RegistroTucanService.getRecentRecords(empresa, 20);
      setRecords(recent);
    } catch (err) {
      console.error("Error loading Registro Tucan records:", err);
      setError("No se pudieron cargar los registros.");
    } finally {
      setRecordsLoading(false);
    }
  }, [empresa, hasPermission]);

  const loadTucanBalance = useCallback(async () => {
    if (!empresa || !hasPermission) {
      setSaldoFondoTucan(0);
      return;
    }
    setBalanceLoading(true);
    setError("");
    try {
      const docKey = MovimientosFondosService.buildCompanyMovementsKey(empresa);
      const ledger = await MovimientosFondosService.getDocument(docKey);
      setSaldoFondoTucan(resolveTucanBalance(ledger));
    } catch (err) {
      console.error("Error loading Fondo Tucan balance:", err);
      setError("No se pudo cargar el saldo del Fondo Tucan.");
    } finally {
      setBalanceLoading(false);
    }
  }, [empresa, hasPermission]);

  useEffect(() => {
    void loadTucanBalance();
    void loadRecentRecords();
  }, [loadTucanBalance, loadRecentRecords]);

  useEffect(() => {
    if (!user || !hasPermission) {
      setEmpresaOptions([]);
      setSelectedEmpresa("");
      setEmpresaLoading(false);
      return;
    }

    let cancelled = false;
    setEmpresaLoading(true);
    EmpresasService.getAllEmpresas()
      .then((empresas) => {
        if (cancelled) return;

        const assignedKey = normalizeKey(assignedEmpresa);
        const ownerSet = new Set(ownerIds.map((id) => String(id).trim()).filter(Boolean));
        const filtered =
          user.role === "superadmin"
            ? empresas
            : user.role === "admin"
              ? empresas.filter((item) => {
                  const owner = String(item.ownerId || "").trim();
                  return owner.length > 0 && ownerSet.has(owner);
                })
              : empresas.filter((item) =>
                  getEmpresaCandidates(item).includes(assignedKey),
                );

        const mapped: EmpresaOption[] = filtered.reduce<EmpresaOption[]>(
          (acc, item) => {
            const value = getEmpresaValue(item);
            if (!value) return acc;
            acc.push({
              value,
              label: getEmpresaLabel(item),
              empresa: item,
            });
            return acc;
          },
          [],
        );

        const fallback: EmpresaOption[] =
          assignedEmpresa && mapped.length === 0
            ? [{ value: assignedEmpresa, label: assignedEmpresa, empresa: null }]
            : [];
        const nextOptions = mapped.length > 0 ? mapped : fallback;

        setEmpresaOptions(nextOptions);
        setSelectedEmpresa((current) => {
          const currentKey = normalizeKey(current);
          const storedEmpresa =
            typeof window !== "undefined"
              ? window.localStorage.getItem(REGISTRO_TUCAN_COMPANY_STORAGE_KEY) || ""
              : "";
          const storedKey = normalizeKey(storedEmpresa);
          const assignedOption = assignedKey
            ? nextOptions.find((item) =>
                getEmpresaCandidates(item.empresa).includes(assignedKey),
              )
            : undefined;
          const storedOption = storedKey
            ? nextOptions.find(
                (item) =>
                  normalizeKey(item.value) === storedKey ||
                  getEmpresaCandidates(item.empresa).includes(storedKey),
              )
            : undefined;
          const currentExists =
            currentKey &&
            nextOptions.some(
              (item) =>
                normalizeKey(item.value) === currentKey ||
                getEmpresaCandidates(item.empresa).includes(currentKey),
            );
          if (currentExists) return current;
          if (storedOption) return storedOption.value;
          return assignedOption?.value || nextOptions[0]?.value || "";
        });
      })
      .catch((err) => {
        console.error("Error loading Registro Tucan empresas:", err);
        if (cancelled) return;
        const fallback = assignedEmpresa
          ? [{ value: assignedEmpresa, label: assignedEmpresa, empresa: null }]
          : [];
        setEmpresaOptions(fallback);
        setSelectedEmpresa(fallback[0]?.value || "");
      })
      .finally(() => {
        if (!cancelled) setEmpresaLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assignedEmpresa, hasPermission, ownerIds, user]);

  const refreshServerDateTime = useCallback(async () => {
    setServerTimeLoading(true);
    setError("");
    try {
      const now = await getAuthoritativeNow();
      setFecha(formatRegistroTucanDateInput(now));
      setHora(formatRegistroTucanTimeInput(now));
      return now;
    } catch (err) {
      console.error("Error loading server time:", err);
      setError("No se pudo cargar la hora del servidor.");
      return null;
    } finally {
      setServerTimeLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshServerDateTime();
  }, [refreshServerDateTime]);

  const handleSave = async () => {
    if (
      !user ||
      !hasPermission ||
      !empresa ||
      balanceLoading ||
      serverTimeLoading ||
      empresaLoading
    ) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (saldoPaginaTucan <= 0) {
        setError("Saldo página Tucan debe ser mayor a 0.");
        return;
      }

      const serverNow = await refreshServerDateTime();
      if (!serverNow) return;

      const serverFecha = formatRegistroTucanDateInput(serverNow);
      const serverHora = formatRegistroTucanTimeInput(serverNow);
      const shiftResolution = await resolveShiftManagerForNow(
        serverNow.toISOString(),
      );
      if (!shiftResolution) {
        setError("No se pudo resolver el usuario del turno.");
        return;
      }
      if (shiftResolution.mode === "missing") {
        setError(
          `No se encontro usuario asignado para el turno ${shiftResolution.expectedShift}.`,
        );
        return;
      }
      if (shiftResolution.mode !== "auto") {
        setError("No se pudo resolver el usuario segun el turno.");
        return;
      }
      const dateKey = new Date(`${serverFecha}T00:00:00`).getTime();
      if (!Number.isFinite(dateKey)) {
        setError("Fecha inválida.");
        return;
      }

      await RegistroTucanService.createRecord({
        empresa,
        dateKey,
        fecha: serverFecha,
        hora: serverHora,
        saldoPaginaTucan,
        saldoFondoTucan,
        pagosHoy,
        saldoSinpesRecibidos: pagosHoy,
        total,
        createdById: user.id,
        createdByName: shiftResolution.manager,
      });

      setSaldoPaginaTucanInput("");
      setPagosHoyInput("");
      showToast("Registro guardado.", "success");
      await loadRecentRecords();
    } catch (err) {
      console.error("Error saving Registro Tucan record:", err);
      setError("No se pudo guardar el registro.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl py-10 text-center text-[var(--muted-foreground)]">
        Cargando...
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-8 text-center">
        <Lock className="mx-auto mb-4 h-10 w-10 text-[var(--muted-foreground)]" />
        <h2 className="text-xl font-semibold text-[var(--foreground)]">
          Acceso restringido
        </h2>
        <p className="mt-2 text-[var(--muted-foreground)]">
          No tienes permisos para acceder a Registro Tucan.
        </p>
      </div>
    );
  }

  if (!empresa && !empresaLoading) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-8 text-center">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">
          Empresa requerida
        </h2>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Tu usuario no tiene empresa asignada.
        </p>
      </div>
    );
  }

  const saveDisabled =
    saving || balanceLoading || serverTimeLoading || empresaLoading || !fecha || !hora;
  const dateTimeValue = fecha && hora ? `${fecha.split("-").reverse().join("/")}  ${hora}` : "";
  const metricCards = [
    {
      label: "Saldo página Tucan",
      value: saldoPaginaTucan,
      icon: FileText,
      color: "text-[var(--primary)] bg-[var(--muted)] border-[var(--input-border)]",
    },
    {
      label: "Saldo Fondo Tucan",
      value: saldoFondoTucan,
      icon: WalletCards,
      color: "text-[var(--primary)] bg-[var(--muted)] border-[var(--input-border)]",
    },
    {
      label: "Pagos hoy",
      value: pagosHoy,
      icon: TrendingUp,
      color: "text-[var(--success)] bg-[var(--muted)] border-[var(--input-border)]",
    },
    {
      label: "Total",
      value: total,
      icon: Clock3,
      color: "text-[var(--accent)] bg-[var(--muted)] border-[var(--input-border)]",
    },
  ];
  const fieldBase =
    "h-11 w-full rounded border border-cyan-700/35 bg-cyan-950/25 px-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-cyan-100/70 hover:border-cyan-500/45 focus:border-[var(--accent)]";
  const sectionClass =
    "rounded-xl border border-cyan-700/25 bg-cyan-950/10 p-3 sm:p-4";
  const labelClass =
    "mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-100/70";
  const iconBoxClass =
    "flex h-7 w-7 items-center justify-center rounded border border-cyan-700/35 bg-cyan-900/25 text-cyan-100/80";
  const saveButtonClass =
    "inline-flex h-11 min-w-[148px] items-center justify-center gap-2 rounded border border-cyan-400/45 bg-cyan-500/20 px-5 text-sm font-semibold text-cyan-50 shadow-sm shadow-cyan-950/20 transition-all duration-150 hover:-translate-y-0.5 hover:border-cyan-300/70 hover:bg-cyan-500/30 hover:shadow-md hover:shadow-cyan-950/30 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:translate-y-0 disabled:border-[var(--input-border)] disabled:bg-cyan-950/15 disabled:text-[var(--muted-foreground)] disabled:opacity-60";

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 border-l-4 border-cyan-500/60 pl-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Registro Tucan
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {empresaLoading ? "Cargando empresas..." : empresa || "Sin empresa"}
          </p>
        </div>
        {(canSelectEmpresa || empresaOptions.length > 1) && (
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
              className="w-full min-w-0 max-w-full truncate rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors hover:border-[var(--accent)]/60 focus:border-[var(--accent)] xl:flex-1"
              value={selectedEmpresa}
              onChange={(event) => handleEmpresaChange(event.target.value)}
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {metricCards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className={sectionClass}
          >
            <div className="flex items-center gap-3">
            <div className={iconBoxClass}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--muted-foreground)]">{label}</p>
              <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
                {formatCRC(value)}
              </p>
            </div>
            </div>
          </div>
        ))}
      </div>

      <form
        className={sectionClass}
        onSubmit={(e) => {
          e.preventDefault();
          if (!saveDisabled) void handleSave();
        }}
      >
        <div className="mb-7 flex items-center gap-4">
          <div className={iconBoxClass}>
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--foreground)]">Nuevo registro</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Complete la información para registrar el movimiento.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_1fr_1fr_1.15fr]">
          <label>
            <span className={labelClass}>
              Fecha y hora
            </span>
            <div className={`flex items-center ${fieldBase}`}>
              {serverTimeLoading ? "Cargando hora servidor..." : dateTimeValue}
            </div>
          </label>

          <label>
            <span className={labelClass}>
              Saldo página Tucan
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={formatInputDisplay(saldoPaginaTucanInput)}
              onChange={(e) =>
                setSaldoPaginaTucanInput(sanitizeAmountInput(e.target.value))
              }
              placeholder={formatCRC(0)}
              className={`${fieldBase} text-lg font-semibold`}
            />
          </label>

          <label>
            <span className={labelClass}>
              Pagos hoy
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={formatInputDisplay(pagosHoyInput)}
              onChange={(e) =>
                setPagosHoyInput(sanitizeAmountInput(e.target.value))
              }
              placeholder={formatCRC(0)}
              className={`${fieldBase} text-lg font-semibold`}
            />
          </label>

          <label>
            <span className={labelClass}>
              Fondo Tucan
            </span>
            <div className="flex gap-2">
              <input
                value={balanceLoading ? "Cargando..." : formatCRC(saldoFondoTucan)}
                readOnly
                className={`${fieldBase} font-semibold`}
              />
              <button
                type="button"
                onClick={() => void loadTucanBalance()}
                disabled={balanceLoading}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-cyan-700/35 bg-cyan-950/25 text-cyan-100/80 transition-colors hover:border-cyan-500/45 hover:bg-cyan-900/25 disabled:opacity-50"
                title="Actualizar saldo Fondo Tucan"
                aria-label="Actualizar saldo Fondo Tucan"
              >
                <RefreshCw className={`h-4 w-4 ${balanceLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </label>
        </div>

        {error && (
          <p className="mt-4 text-sm text-[var(--error)]">
            {error}
          </p>
        )}

        <div className="mt-7 flex justify-end">
          <button
            type="submit"
            disabled={saveDisabled}
            className={saveButtonClass}
          >
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>

      <section className={sectionClass}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={iconBoxClass}>
              <Clock3 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--foreground)]">
                Registros recientes
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Aquí se mostrarán los registros guardados.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div
              className="inline-flex rounded-full border border-cyan-700/35 bg-cyan-950/25 p-1"
              aria-label="Ordenar registros"
            >
              <button
                type="button"
                onClick={() => setSortOrder("asc")}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  sortOrder === "asc"
                    ? "bg-cyan-400 text-slate-950"
                    : "text-cyan-100/60 hover:text-cyan-50"
                }`}
                aria-pressed={sortOrder === "asc"}
              >
                Más antiguo
              </button>
              <button
                type="button"
                onClick={() => setSortOrder("desc")}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  sortOrder === "desc"
                    ? "bg-cyan-400 text-slate-950"
                    : "text-cyan-100/60 hover:text-cyan-50"
                }`}
                aria-pressed={sortOrder === "desc"}
              >
                Más reciente
              </button>
            </div>
            <button
              type="button"
              onClick={() => void loadRecentRecords()}
              disabled={recordsLoading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded border border-[var(--input-border)] px-4 text-sm font-semibold text-[var(--foreground)] transition-all duration-150 hover:border-cyan-500/45 hover:bg-cyan-950/25 active:scale-[0.99] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${recordsLoading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>

        {recordsLoading ? (
          <p className="text-sm text-[var(--muted-foreground)]">Cargando...</p>
        ) : sortedRecords.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--input-border)] bg-[var(--card-bg)]/60 px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
            No hay registros guardados.
          </p>
        ) : (
          <div className="relative overflow-hidden rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/80 text-white shadow-sm">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-xs sm:text-sm">
              <thead className="sticky top-0 z-10 bg-cyan-950/35 text-xs uppercase tracking-wide text-cyan-50/80">
                <tr>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Hora</th>
                  <th className="py-2 pr-3">Página Tucan</th>
                  <th className="py-2 pr-3">Fondo Tucan</th>
                  <th className="py-2 pr-3">pagosHoy</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="transition-colors hover:bg-[var(--muted)]/35 [&>td]:border-b [&>td]:border-cyan-900/35"
                  >
                    <td className="px-3 py-2 text-[var(--foreground)]">
                      {record.fecha}
                    </td>
                    <td className="px-3 py-2 text-[var(--foreground)]">
                      {record.hora || "-"}
                    </td>
                    <td className="px-3 py-2 text-[var(--foreground)]">
                      {formatCRC(record.saldoPaginaTucan)}
                    </td>
                    <td className="px-3 py-2 text-[var(--foreground)]">
                      {formatCRC(record.saldoFondoTucan)}
                    </td>
                    <td className="px-3 py-2 text-[var(--foreground)]">
                      {formatCRC(record.pagosHoy ?? record.saldoSinpesRecibidos)}
                    </td>
                    <td className="px-3 py-2 font-semibold text-[var(--foreground)]">
                      {formatCRC(record.total)}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">
                      {record.createdByName || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
