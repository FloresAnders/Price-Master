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
import {
  RegistroTucanAccessDeniedState,
  RegistroTucanLoadingState,
  RegistroTucanMissingEmpresaState,
} from "./registro-tucan/RegistroTucanAccessStates";
import { RegistroTucanForm } from "./registro-tucan/RegistroTucanForm";
import { RegistroTucanHeader } from "./registro-tucan/RegistroTucanHeader";
import { RegistroTucanMetrics } from "./registro-tucan/RegistroTucanMetrics";
import { RegistroTucanRecords } from "./registro-tucan/RegistroTucanRecords";
import type {
  EmpresaOption,
  RegistroTucanMetricCard,
  RegistroTucanSortOrder,
} from "./registro-tucan/types";

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
  const { resolveShiftManagerForNow, resolvePreviousNightManagerForNow } =
    useShiftScheduleResolver({
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
        createdByName: effectiveManager,
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
    return <RegistroTucanLoadingState />;
  }

  if (!hasPermission) {
    return <RegistroTucanAccessDeniedState />;
  }

  if (!empresa && !empresaLoading) {
    return <RegistroTucanMissingEmpresaState />;
  }

  const saveDisabled =
    saving || balanceLoading || serverTimeLoading || empresaLoading || !fecha || !hora;
  const dateTimeValue = fecha && hora ? `${fecha.split("-").reverse().join("/")}  ${hora}` : "";
  const metricCards: RegistroTucanMetricCard[] = [
    {
      label: "Saldo página Tucan",
      value: saldoPaginaTucan,
      icon: FileText,
    },
    {
      label: "Saldo Fondo Tucan",
      value: saldoFondoTucan,
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
      <RegistroTucanHeader
        empresa={empresa}
        empresaLoading={empresaLoading}
        canSelectEmpresa={canSelectEmpresa}
        empresaOptions={empresaOptions}
        selectedEmpresa={selectedEmpresa}
        currentEmpresaLabel={currentEmpresaLabel}
        saving={saving}
        onEmpresaChange={handleEmpresaChange}
      />

      <RegistroTucanMetrics cards={metricCards} formatCRC={formatCRC} />

      <RegistroTucanForm
        dateTimeValue={dateTimeValue}
        serverTimeLoading={serverTimeLoading}
        saldoPaginaTucanInput={saldoPaginaTucanInput}
        pagosHoyInput={pagosHoyInput}
        saldoFondoTucan={saldoFondoTucan}
        balanceLoading={balanceLoading}
        saveDisabled={saveDisabled}
        saving={saving}
        error={error}
        formatCRC={formatCRC}
        formatInputDisplay={formatInputDisplay}
        sanitizeAmountInput={sanitizeAmountInput}
        onSaldoPaginaChange={setSaldoPaginaTucanInput}
        onPagosHoyChange={setPagosHoyInput}
        onRefreshBalance={() => void loadTucanBalance()}
        onSubmit={() => void handleSave()}
      />

      <RegistroTucanRecords
        records={sortedRecords}
        recordsLoading={recordsLoading}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        onRefresh={() => void loadRecentRecords()}
        formatCRC={formatCRC}
      />
    </div>
  );
}
