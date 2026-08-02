"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock3,
  FileText,
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
import { RegistroTiemposService } from "../../services/registro-tiempos";
import type { Empresas, RegistroTiemposRecord } from "../../types/firestore";
import { useShiftScheduleResolver } from "../../app/fondogeneral/hooks/useShiftScheduleResolver";
import {
  calculateRegistroTiemposTotal,
  formatRegistroTiemposDateInput,
  formatRegistroTiemposTimeInput,
  parseRegistroTiemposAmount,
} from "../../utils/registroTiempos";
import { getAuthoritativeNow } from "../../utils/serverTime";
import {
  RegistroTiemposAccessDeniedState,
  RegistroTiemposLoadingState,
  RegistroTiemposMissingEmpresaState,
} from "./registro-tiempos/RegistroTiemposAccessStates";
import { RegistroTiemposForm } from "./registro-tiempos/RegistroTiemposForm";
import { RegistroTiemposHeader } from "./registro-tiempos/RegistroTiemposHeader";
import { RegistroTiemposMetrics } from "./registro-tiempos/RegistroTiemposMetrics";
import { RegistroTiemposRecords } from "./registro-tiempos/RegistroTiemposRecords";
import type {
  EmpresaOption,
  RegistroTiemposMetricCard,
  RegistroTiemposSortOrder,
} from "./registro-tiempos/types";

const REGISTRO_TIEMPOS_COMPANY_STORAGE_KEY = "fg_selected_company_shared";

const formatCRC = (value: number) =>
  new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const resolveTiemposBalance = (ledger: MovementStorage | null): number => {
  const balance = ledger?.state?.balancesByAccount?.find(
    (item) => item.accountId === "Tiempos" && item.currency === "CRC",
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

export default function RegistroTiempos() {
  const { user, loading } = useAuth();
  const { ownerIds } = useActorOwnership(user || {});
  const { showToast } = useToast();
  const [fecha, setFecha] = useState(() =>
    formatRegistroTiemposDateInput(new Date()),
  );
  const [hora, setHora] = useState(() => formatRegistroTiemposTimeInput(new Date()));
  const [saldoPaginaTiemposInput, setSaldoPaginaTiemposInput] = useState("");
  const [pagosHoyInput, setPagosHoyInput] = useState("");
  const [motivoInput, setMotivoInput] = useState("");
  const [showMotivoInput, setShowMotivoInput] = useState(false);
  const [saldoFondoTiempos, setSaldoFondoTiempos] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [empresaLoading, setEmpresaLoading] = useState(true);
  const [serverTimeLoading, setServerTimeLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<RegistroTiemposRecord[]>([]);
  const [sortOrder, setSortOrder] = useState<RegistroTiemposSortOrder>("desc");
  const [empresaOptions, setEmpresaOptions] = useState<EmpresaOption[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState("");

  const resolvedPermissions = user
    ? user.permissions || getDefaultPermissions(user.role || "user")
    : null;
  const hasPermission = Boolean(resolvedPermissions?.registroTiempos);
  const assignedEmpresa = String(user?.ownercompanie || "").trim();
  const canSelectEmpresa = user?.role === "admin" || user?.role === "superadmin";
  const canDeleteRecords = user?.role === "admin" || user?.role === "superadmin";
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
  const { resolveShiftManagerForNow, resolvePreviousNightManagerForNow } =
    useShiftScheduleResolver({
    company: empresa,
    empresa: empresaConfig,
    cierreFondoVentasMinutesAfterEnd:
      empresaConfig?.cierreFondoVentasMinutesAfterEnd,
  });

  const saldoPaginaTiempos = useMemo(
    () => parseRegistroTiemposAmount(saldoPaginaTiemposInput),
    [saldoPaginaTiemposInput],
  );
  const pagosHoy = useMemo(
    () => parseRegistroTiemposAmount(pagosHoyInput),
    [pagosHoyInput],
  );
  const total = useMemo(
    () =>
      calculateRegistroTiemposTotal({
        saldoPaginaTiempos,
        saldoFondoTiempos,
        pagosHoy,
      }),
    [saldoPaginaTiempos, saldoFondoTiempos, pagosHoy],
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
        localStorage.setItem(REGISTRO_TIEMPOS_COMPANY_STORAGE_KEY, value);
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: REGISTRO_TIEMPOS_COMPANY_STORAGE_KEY,
            newValue: value,
            oldValue: previousValue,
            storageArea: localStorage,
          }),
        );
      } catch (err) {
        console.error("Error saving Registro Tiempos empresa:", err);
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
      const recent = await RegistroTiemposService.getRecentRecords(empresa, 20);
      setRecords(recent);
    } catch (err) {
      console.error("Error loading Registro Tiempos records:", err);
      setError("No se pudieron cargar los registros.");
    } finally {
      setRecordsLoading(false);
    }
  }, [empresa, hasPermission]);

  const loadTiemposBalance = useCallback(async () => {
    if (!empresa || !hasPermission) {
      setSaldoFondoTiempos(0);
      return;
    }
    setBalanceLoading(true);
    setError("");
    try {
      const docKey = MovimientosFondosService.buildCompanyMovementsKey(empresa);
      const ledger = await MovimientosFondosService.getDocument(docKey);
      setSaldoFondoTiempos(resolveTiemposBalance(ledger));
    } catch (err) {
      console.error("Error loading Fondo Tiempos balance:", err);
      setError("No se pudo cargar el saldo del Fondo Tiempos.");
    } finally {
      setBalanceLoading(false);
    }
  }, [empresa, hasPermission]);

  useEffect(() => {
    void loadTiemposBalance();
    void loadRecentRecords();
  }, [loadTiemposBalance, loadRecentRecords]);

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
              ? window.localStorage.getItem(REGISTRO_TIEMPOS_COMPANY_STORAGE_KEY) || ""
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
        console.error("Error loading Registro Tiempos empresas:", err);
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
      setFecha(formatRegistroTiemposDateInput(now));
      setHora(formatRegistroTiemposTimeInput(now));
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
      if (saldoPaginaTiempos <= 0) {
        setError("Saldo página Tiempos debe ser mayor a 0.");
        return;
      }

      const serverNow = await refreshServerDateTime();
      if (!serverNow) return;

      const serverFecha = formatRegistroTiemposDateInput(serverNow);
      const serverHora = formatRegistroTiemposTimeInput(serverNow);
      const shiftResolution = await resolveShiftManagerForNow(
        serverNow.toISOString(),
      );
      if (!shiftResolution) {
        setError("No se pudo resolver el usuario del turno.");
        return;
      }
      const nightFallback =
        shiftResolution.mode === "manual" &&
        shiftResolution.reason === "outside_horario"
          ? await resolvePreviousNightManagerForNow(serverNow.toISOString())
          : null;
      const effectiveManager =
        shiftResolution.mode === "auto"
          ? shiftResolution.manager
          : nightFallback?.mode === "auto"
            ? nightFallback.manager
            : "";
      if (shiftResolution.mode === "missing") {
        setError(
          `No se encontro usuario asignado para el turno ${shiftResolution.expectedShift}.`,
        );
        return;
      }
      if (!effectiveManager) {
        if (nightFallback?.mode === "missing") {
          setError("No se encontro usuario asignado para el turno N.");
          return;
        }
        setError("No se pudo resolver el usuario segun el turno.");
        return;
      }
      const dateKey = new Date(`${serverFecha}T00:00:00`).getTime();
      if (!Number.isFinite(dateKey)) {
        setError("Fecha inválida.");
        return;
      }
      const motivo = motivoInput.trim();

      await RegistroTiemposService.createRecord({
        empresa,
        dateKey,
        fecha: serverFecha,
        hora: serverHora,
        saldoPaginaTiempos,
        saldoFondoTiempos,
        pagosHoy,
        saldoSinpesRecibidos: pagosHoy,
        total,
        ...(motivo ? { motivo } : {}),
        createdById: user.id,
        createdByName: effectiveManager,
      });

      setSaldoPaginaTiemposInput("");
      setPagosHoyInput("");
      setMotivoInput("");
      setShowMotivoInput(false);
      showToast("Registro guardado.", "success");
      await loadRecentRecords();
    } catch (err) {
      console.error("Error saving Registro Tiempos record:", err);
      setError("No se pudo guardar el registro.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async (record: RegistroTiemposRecord) => {
    if (!canDeleteRecords || !empresa || !record.id) return;
    const confirmed = window.confirm("Eliminar este registro de Tiempos?");
    if (!confirmed) return;

    setRecordsLoading(true);
    setError("");
    try {
      await RegistroTiemposService.deleteRecord(empresa, record.id);
      showToast("Registro eliminado.", "success");
      await loadRecentRecords();
    } catch (err) {
      console.error("Error deleting Registro Tiempos record:", err);
      setError("No se pudo eliminar el registro.");
    } finally {
      setRecordsLoading(false);
    }
  };

  if (loading) {
    return <RegistroTiemposLoadingState />;
  }

  if (!hasPermission) {
    return <RegistroTiemposAccessDeniedState />;
  }

  if (!empresa && !empresaLoading) {
    return <RegistroTiemposMissingEmpresaState />;
  }

  const saveDisabled =
    saving || balanceLoading || serverTimeLoading || empresaLoading || !fecha || !hora;
  const dateTimeValue = fecha && hora ? `${fecha.split("-").reverse().join("/")}  ${hora}` : "";
  const metricCards: RegistroTiemposMetricCard[] = [
    {
      label: "Saldo página Tiempos",
      value: saldoPaginaTiempos,
      icon: FileText,
    },
    {
      label: "Saldo Fondo Tiempos",
      value: saldoFondoTiempos,
      icon: WalletCards,
    },
    {
      label: "Pagos hoy",
      value: pagosHoy,
      icon: TrendingUp,
    },
    {
      label: "Total",
      value: total,
      icon: Clock3,
    },
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <RegistroTiemposHeader
        empresa={empresa}
        empresaLoading={empresaLoading}
        canSelectEmpresa={canSelectEmpresa}
        empresaOptions={empresaOptions}
        selectedEmpresa={selectedEmpresa}
        currentEmpresaLabel={currentEmpresaLabel}
        saving={saving}
        onEmpresaChange={handleEmpresaChange}
      />

      <RegistroTiemposMetrics cards={metricCards} formatCRC={formatCRC} />

      <RegistroTiemposForm
        dateTimeValue={dateTimeValue}
        serverTimeLoading={serverTimeLoading}
        saldoPaginaTiemposInput={saldoPaginaTiemposInput}
        pagosHoyInput={pagosHoyInput}
        motivoInput={motivoInput}
        showMotivoInput={showMotivoInput}
        saldoFondoTiempos={saldoFondoTiempos}
        balanceLoading={balanceLoading}
        saveDisabled={saveDisabled}
        saving={saving}
        error={error}
        formatCRC={formatCRC}
        formatInputDisplay={formatInputDisplay}
        sanitizeAmountInput={sanitizeAmountInput}
        onSaldoPaginaChange={setSaldoPaginaTiemposInput}
        onPagosHoyChange={setPagosHoyInput}
        onMotivoChange={setMotivoInput}
        onToggleMotivoInput={() => setShowMotivoInput((value) => !value)}
        onRefreshBalance={() => void loadTiemposBalance()}
        onSubmit={() => void handleSave()}
      />

      <RegistroTiemposRecords
        records={sortedRecords}
        recordsLoading={recordsLoading}
        sortOrder={sortOrder}
        canDeleteRecords={canDeleteRecords}
        onSortOrderChange={setSortOrder}
        onRefresh={() => void loadRecentRecords()}
        onDelete={(record) => void handleDeleteRecord(record)}
        formatCRC={formatCRC}
      />
    </div>
  );
}
