"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileSpreadsheet,
  Lock,
  Mail,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { dateKeyFromDate } from "../utils/helpers";
import { useAuth } from "@/hooks/useAuth";
import { useActorOwnership } from "@/hooks/useActorOwnership";
import { EmpresasService } from "@/services/empresas";
import { SchedulesService, type ScheduleEntry } from "@/services/schedules";
import type { Empresas } from "@/types/firestore";
import { getDefaultPermissions } from "@/utils/permissions";

const todayValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const displayDate = (value: string) => {
  if (!value) return "--/--/----";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const formatTime12 = (value: string) => {
  const [hourValue = "0", minute = "00"] = value.split(":");
  const hour24 = Number(hourValue);
  const period = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute.padStart(2, "0")} ${period}`;
};

const formatDateTime12 = (value: string) =>
  new Date(value).toLocaleString("es-CR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

const toTime12Parts = (value: string) => {
  const [hourValue = "0", minute = "00"] = value.split(":");
  const hour24 = Number(hourValue);
  return {
    hour: String(hour24 % 12 || 12),
    minute: minute.padStart(2, "0"),
    period: hour24 >= 12 ? "pm" : "am",
  };
};

const fromTime12Parts = (hour: string, minute: string, period: string) => {
  const hourNumber = Number(hour);
  const hour24 =
    period === "pm"
      ? hourNumber === 12
        ? 12
        : hourNumber + 12
      : hourNumber === 12
        ? 0
        : hourNumber;
  return `${String(hour24).padStart(2, "0")}:${minute}`;
};

const Time12Select = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  const parts = toTime12Parts(value);
  const hours = Array.from({ length: 12 }, (_, index) => String(index + 1));
  const minutes = Array.from({ length: 60 }, (_, index) =>
    String(index).padStart(2, "0"),
  );

  const update = (next: Partial<typeof parts>) => {
    const merged = { ...parts, ...next };
    onChange(fromTime12Parts(merged.hour, merged.minute, merged.period));
  };

  return (
    <div className="grid w-full grid-cols-[1fr_1fr_auto] gap-2">
      <select
        aria-label="Hora"
        value={parts.hour}
        onChange={(event) => update({ hour: event.target.value })}
        className="min-w-0 rounded-xl border border-white/10 bg-[#0f1d38] px-3 py-2 text-sm text-white outline-none"
      >
        {hours.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
      <select
        aria-label="Minutos"
        value={parts.minute}
        onChange={(event) => update({ minute: event.target.value })}
        className="min-w-0 rounded-xl border border-white/10 bg-[#0f1d38] px-3 py-2 text-sm text-white outline-none"
      >
        {minutes.map((minute) => (
          <option key={minute} value={minute}>
            {minute}
          </option>
        ))}
      </select>
      <select
        aria-label="AM o PM"
        value={parts.period}
        onChange={(event) => update({ period: event.target.value })}
        className="rounded-xl border border-white/10 bg-[#0f1d38] px-3 py-2 text-sm text-white outline-none"
      >
        <option value="am">am</option>
        <option value="pm">pm</option>
      </select>
    </div>
  );
};

type QueryShift = "full" | "D" | "N" | "custom";
type ShiftRange = {
  start: string;
  end: string;
  startDayOffset: number;
  endDayOffset: number;
};

const FALLBACK_SHIFT_RANGES = {
  full: { start: "06:00", end: "23:59", startDayOffset: 0, endDayOffset: 0 },
  D: { start: "06:00", end: "13:59", startDayOffset: 0, endDayOffset: 0 },
  N: { start: "14:00", end: "23:59", startDayOffset: 0, endDayOffset: 0 },
} satisfies Record<Exclude<QueryShift, "custom">, ShiftRange>;

const parseHHMMToMinutes = (value: unknown): number | null => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
};

const minutesToHHMM = (minutes: number) => {
  const normalized = ((Math.trunc(minutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const addDaysToDateKey = (value: string, days: number) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return dateKeyFromDate(date);
};

const getDateKeyParts = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month0: month - 1, day };
};

const getCompanyKeysToTry = (empresa: Empresas | undefined) => {
  const keys = new Set<string>();
  [empresa?.ubicacion, empresa?.name, empresa?.id]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .forEach((value) => keys.add(value));
  return Array.from(keys);
};

const findScheduleForShift = (
  schedules: ScheduleEntry[],
  shiftDateKey: string,
  shift: "D" | "N",
) => {
  const { day } = getDateKeyParts(shiftDateKey);
  return schedules
    .filter((entry) => entry.day === day && String(entry.shift || "").trim() === shift)
    .sort((a, b) => {
      const score = (entry: ScheduleEntry) =>
        (String(entry.employeeName || "").trim() ? 2 : 0) +
        (Number(entry.horasPorDia) > 0 ? 1 : 0);
      return score(b) - score(a);
    })[0];
};

const getScheduleHours = (
  schedule: ScheduleEntry | undefined,
  empresa: Empresas | undefined,
  fallback = 8,
) => {
  const employeeName = String(schedule?.employeeName || "").trim();
  const employeeHours = empresa?.empleados?.find(
    (empleado) => empleado.Empleado === employeeName,
  )?.hoursPerShift;
  const parsedEmployeeHours = Number(employeeHours);
  if (Number.isFinite(parsedEmployeeHours) && parsedEmployeeHours > 0) {
    return parsedEmployeeHours;
  }
  const scheduledHours = Number(schedule?.horasPorDia);
  return Number.isFinite(scheduledHours) && scheduledHours > 0
    ? scheduledHours
    : fallback;
};

const getEmpresaShiftRanges = (
  empresa: Empresas | undefined,
  schedules: ScheduleEntry[],
  shiftDateKey: string,
) => {
  const openMin = parseHHMMToMinutes(empresa?.horarioApertura);
  const closeMin = parseHHMMToMinutes(empresa?.horarioCierre);
  if (openMin === null || closeMin === null) return FALLBACK_SHIFT_RANGES;

  const daySchedule = findScheduleForShift(schedules, shiftDateKey, "D");
  const nightSchedule = findScheduleForShift(schedules, shiftDateKey, "N");
  const dayHours = getScheduleHours(daySchedule, empresa);
  const nightHours = getScheduleHours(nightSchedule, empresa);
  const fullEndOffset = closeMin <= openMin ? 1 : 0;
  const closeAbsoluteMin = closeMin + fullEndOffset * 1440;
  const shiftChangeMin = openMin + Math.round(dayHours * 60);
  const dayEndMin = shiftChangeMin - 1;
  const nightStartMin = closeAbsoluteMin - Math.round(nightHours * 60);
  const dayStartOffset = Math.floor(openMin / 1440);
  const dayEndOffset = Math.floor(dayEndMin / 1440);
  const nightStartOffset = Math.floor(nightStartMin / 1440);
  const nightEndOffset = fullEndOffset;

  return {
    full: {
      start: minutesToHHMM(openMin),
      end: minutesToHHMM(closeMin),
      startDayOffset: 0,
      endDayOffset: fullEndOffset,
    },
    D: {
      start: minutesToHHMM(openMin),
      end: minutesToHHMM(dayEndMin),
      startDayOffset: dayStartOffset,
      endDayOffset: dayEndOffset,
    },
    N: {
      start: minutesToHHMM(nightStartMin),
      end: minutesToHHMM(closeMin),
      startDayOffset: nightStartOffset,
      endDayOffset: nightEndOffset,
    },
  } satisfies Record<Exclude<QueryShift, "custom">, ShiftRange>;
};

export default function ReportesSinpePage() {
  const { user, loading } = useAuth();
  const { ownerIds } = useActorOwnership(user);
  const permissions =
    user?.permissions || getDefaultPermissions(user?.role || "user");
  const canUse = Boolean(permissions.reportessinpe);

  const [empresas, setEmpresas] = useState<Empresas[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [startDate, setStartDate] = useState(todayValue);
  const [shiftDate, setShiftDate] = useState(todayValue);
  const [endDate, setEndDate] = useState(todayValue);
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("23:59");
  const [queryShift, setQueryShift] = useState<QueryShift>("full");
  const [report, setReport] = useState<{
    processedEmails: number;
    validTransactions: number;
    total: number;
    transactions: Array<{
      uid: number;
      date: string;
      reference: string | null;
      amount: number;
    }>;
  } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [startCalOpen, setStartCalOpen] = useState(false);
  const [endCalOpen, setEndCalOpen] = useState(false);
  const [startCalMonth, setStartCalMonth] = useState(() => new Date());
  const [endCalMonth, setEndCalMonth] = useState(() => new Date());
  const startCalRef = useRef<HTMLDivElement | null>(null);
  const endCalRef = useRef<HTMLDivElement | null>(null);
  const startBtnRef = useRef<HTMLButtonElement | null>(null);
  const endBtnRef = useRef<HTMLButtonElement | null>(null);
  const selectedEmpresa = useMemo(
    () => empresas.find((empresa) => empresa.id === empresaId),
    [empresas, empresaId],
  );
  const shiftRanges = useMemo(
    () => getEmpresaShiftRanges(selectedEmpresa, scheduleEntries, shiftDate),
    [scheduleEntries, selectedEmpresa, shiftDate],
  );

  useEffect(() => {
    if (!canUse || !user) return;

    let mounted = true;
    EmpresasService.getAllEmpresas()
      .then((list) => {
        if (!mounted) return;
        const allowed = new Set(ownerIds.map((id) => String(id)));
        const assigned = String(user.ownercompanie || "").trim();
        const filtered =
          user.role === "superadmin"
            ? list
            : user.role === "admin"
              ? list.filter((empresa) => {
                  const ownerMatch =
                    empresa.ownerId && allowed.has(String(empresa.ownerId));
                  return Boolean(ownerMatch);
                })
              : list.filter((empresa) => {
                  const companyMatch =
                    assigned &&
                    (empresa.name === assigned || empresa.ubicacion === assigned);
                  return Boolean(companyMatch);
                });
        setEmpresas(filtered);
        setEmpresaId((current) => current || filtered[0]?.id || "");
      })
      .catch(() => setError("No se pudieron cargar empresas."));

    return () => {
      mounted = false;
    };
  }, [canUse, ownerIds, user]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        startCalOpen &&
        startCalRef.current &&
        !startCalRef.current.contains(event.target as Node) &&
        startBtnRef.current &&
        !startBtnRef.current.contains(event.target as Node)
      )
        setStartCalOpen(false);
      if (
        endCalOpen &&
        endCalRef.current &&
        !endCalRef.current.contains(event.target as Node) &&
        endBtnRef.current &&
        !endBtnRef.current.contains(event.target as Node)
      )
        setEndCalOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [startCalOpen, endCalOpen]);

  useEffect(() => {
    if (!selectedEmpresa) {
      setScheduleEntries([]);
      setSchedulesLoading(false);
      return;
    }

    let mounted = true;
    const { year, month0 } = getDateKeyParts(shiftDate);
    const keys = getCompanyKeysToTry(selectedEmpresa);
    setSchedulesLoading(true);
    setScheduleEntries([]);

    Promise.all(
      keys.map((key) =>
        SchedulesService.getSchedulesByLocationYearMonth(key, year, month0),
      ),
    )
      .then((lists) => {
        if (mounted) setScheduleEntries(lists.flat());
      })
      .catch(() => {
        if (mounted) setScheduleEntries([]);
      })
      .finally(() => {
        if (mounted) setSchedulesLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedEmpresa, shiftDate]);

  useEffect(() => {
    if (queryShift === "custom") return;
    const range = shiftRanges[queryShift];
    setStartTime(range.start);
    setEndTime(range.end);
    setStartDate(addDaysToDateKey(shiftDate, range.startDayOffset));
    setEndDate(addDaysToDateKey(shiftDate, range.endDayOffset));
  }, [queryShift, shiftRanges, shiftDate]);

  const renderMonthCells = (
    monthDate: Date,
    selectedKey: string | null,
    onSelectDay: (key: string) => void,
  ) => {
    const cells: ReactNode[] = [];
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const first = new Date(year, month, 1);
    const start = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = dateKeyFromDate(new Date());

    for (let i = 0; i < start; i++)
      cells.push(<div key={`pad-${i}`} />);

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const key = dateKeyFromDate(d);
      const isFuture = key > todayKey;
      const isSelected = selectedKey === key;

      if (isFuture) {
        cells.push(
          <div key={key} className="py-1 text-white/40 opacity-60">
            {day}
          </div>,
        );
      } else {
        cells.push(
          <button
            key={key}
            type="button"
            onClick={() => onSelectDay(key)}
            className={`rounded py-1 ${
              isSelected
                ? "bg-cyan-500/30 text-white"
                : "hover:bg-white/10"
            }`}
          >
            {day}
          </button>,
        );
      }
    }
    return cells;
  };

  const CalendarDropdown = ({
    open,
    month,
    selected,
    onSelect,
    onClose,
    onMonthChange,
    calRef,
  }: {
    open: boolean;
    month: Date;
    selected: string;
    onSelect: (key: string) => void;
    onClose: () => void;
    onMonthChange: (m: Date) => void;
    calRef: React.RefObject<HTMLDivElement | null>;
  }) => {
    if (!open) return null;
    return (
      <div
        ref={calRef}
        className="absolute left-0 top-full mt-2 z-50 w-full min-w-[280px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="w-full rounded-2xl border border-white/10 bg-[#0b1730] p-4 text-white shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const m = new Date(month);
                m.setMonth(m.getMonth() - 1);
                onMonthChange(new Date(m));
              }}
              className="rounded p-1 hover:bg-white/10"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold capitalize">
              {month.toLocaleString("es-CR", {
                month: "long",
                year: "numeric",
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                const m = new Date(month);
                m.setMonth(m.getMonth() + 1);
                onMonthChange(new Date(m));
              }}
              className="rounded p-1 hover:bg-white/10"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-white/50">
            {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
              <div key={`${d}-${i}`} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-sm">
            {renderMonthCells(month, selected, (key) => {
              onSelect(key);
              onClose();
            })}
          </div>
          <div className="mt-3 flex justify-between">
            <button
              type="button"
              onClick={() => {
                onSelect(dateKeyFromDate(new Date()));
                onClose();
              }}
              className="rounded border border-white/10 px-2 py-1 text-xs text-white/60 hover:bg-white/10"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-white/10 px-2 py-1 text-xs text-white/60 hover:bg-white/10"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const summary = useMemo(
    () => ({
      emails: report?.processedEmails || 0,
      valid: report?.validTransactions || 0,
      total: report?.total || 0,
    }),
    [report],
  );

  const applyQueryShift = (shift: QueryShift) => {
    setQueryShift(shift);
    if (shift === "custom") return;
    const range = shiftRanges[shift];
    setStartTime(range.start);
    setEndTime(range.end);
    setStartDate(addDaysToDateKey(shiftDate, range.startDayOffset));
    setEndDate(addDaysToDateKey(shiftDate, range.endDayOffset));
  };

  const setQueryStartDate = (dateKey: string) => {
    if (queryShift === "custom") {
      setStartDate(dateKey);
      return;
    }
    const range = shiftRanges[queryShift];
    setShiftDate(dateKey);
    setStartDate(addDaysToDateKey(dateKey, range.startDayOffset));
    setEndDate(addDaysToDateKey(dateKey, range.endDayOffset));
  };

  const generateReport = async () => {
    if (schedulesLoading) return;
    setBusy(true);
    setError("");
    setReport(null);
    setDetailsOpen(false);

    try {
      const response = await fetch("/api/reportes-sinpe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId,
          startDate,
          startTime,
          endDate,
          endTime,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Error generando reporte.");
      setReport(data);
      setDetailsOpen(Boolean(data.transactions?.length));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generando reporte.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-3xl border border-white/10 bg-[#071120] p-8 text-center text-white/70">
          Cargando permisos...
        </div>
      </div>
    );
  }

  if (!canUse) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-3xl border border-white/10 bg-[#071120] p-10 text-center">
          <Lock className="mx-auto mb-4 h-10 w-10 text-white/40" />
          <h2 className="text-xl font-semibold text-white">
            Acceso restringido
          </h2>
          <p className="mt-2 text-sm text-white/60">
            No tienes permisos para usar Reportes SINPE.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-white">
      {busy && (
        <div className="fixed inset-0 z-[9999] flex min-h-dvh items-center justify-center bg-[#020817]/90 px-4 py-6 backdrop-blur-md sm:px-6">
          <div className="w-full max-w-[min(92vw,720px)] rounded-[36px] border border-white/10 bg-[#071120] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.6)] sm:p-9">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-5 h-20 w-20 animate-pulse rounded-3xl bg-cyan-400/20 sm:h-24 sm:w-24" />
              <div className="flex-1">
                <div className="mx-auto h-5 w-56 animate-pulse rounded-full bg-white/20 sm:h-6 sm:w-72" />
                <div className="mx-auto mt-4 h-4 w-40 animate-pulse rounded-full bg-white/10 sm:w-52" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-20 animate-pulse rounded-3xl bg-white/10 sm:h-24" />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="h-24 animate-pulse rounded-3xl bg-white/10 sm:h-32" />
                <div className="h-24 animate-pulse rounded-3xl bg-white/10 sm:h-32" />
                <div className="h-24 animate-pulse rounded-3xl bg-white/10 sm:h-32" />
              </div>
              <div className="mx-auto h-4 w-2/3 animate-pulse rounded-full bg-cyan-300/20" />
            </div>
            <p className="mt-8 text-center text-xl font-semibold text-white/85 sm:text-2xl">
              Leyendo correos SINPE...
            </p>
            <p className="mt-2 text-center text-sm text-white/50 sm:text-base">
              Esto puede tardar unos segundos.
            </p>
          </div>
        </div>
      )}
      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(83,193,255,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(165,61,255,0.24),_transparent_28%),linear-gradient(180deg,_#071120_0%,_#090f1d_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-8">
        <div className="mb-8 text-center flex items-center justify-center flex-col">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
            <Mail className="h-7 w-7 text-violet-300" />
          </div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold">
            Reportes SINPE
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Genera reportes a partir de transacciones SINPE en el rango
            seleccionado.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#091426]/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-6">
          <div className="mb-5 flex items-center gap-2 text-cyan-300">
            <CalendarDays className="h-5 w-5" />
            <span className="text-sm font-semibold">Rango de consulta</span>
          </div>

          <label className="mb-4 block">
            <span className="mb-2 block text-sm text-white/70">Empresa</span>
            <select
              value={empresaId}
              onChange={(event) => setEmpresaId(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0b1730] px-4 py-3 text-sm text-white outline-none"
            >
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.name || empresa.ubicacion || empresa.id}
                </option>
              ))}
            </select>
          </label>

          <label className="mb-4 block">
            <span className="mb-2 block text-sm text-white/70">Turno</span>
            <select
              value={queryShift}
              onChange={(event) => applyQueryShift(event.target.value as QueryShift)}
              className="w-full rounded-2xl border border-white/10 bg-[#0b1730] px-4 py-3 text-sm text-white outline-none"
            >
              <option value="full">
                Completo ({formatTime12(shiftRanges.full.start)} - {formatTime12(shiftRanges.full.end)})
              </option>
              <option value="D">
                Diurno ({formatTime12(shiftRanges.D.start)} - {formatTime12(shiftRanges.D.end)})
              </option>
              <option value="N">
                Nocturno ({formatTime12(shiftRanges.N.start)} - {formatTime12(shiftRanges.N.end)})
              </option>
              <option value="custom">Personalizado</option>
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative block">
              <span className="mb-2 block text-sm text-white/70">
                Fecha inicio
              </span>
              <button
                type="button"
                ref={startBtnRef}
                onClick={() => setStartCalOpen((prev) => !prev)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1730] px-4 py-3 text-sm text-white outline-none"
              >
                <span className="flex-1 text-left">
                  {displayDate(queryShift === "custom" ? startDate : shiftDate)}
                </span>
                <CalendarDays className="h-4 w-4 text-cyan-300" />
              </button>
              <CalendarDropdown
                open={startCalOpen}
                month={startCalMonth}
                selected={queryShift === "custom" ? startDate : shiftDate}
                onSelect={setQueryStartDate}
                onClose={() => setStartCalOpen(false)}
                onMonthChange={setStartCalMonth}
                calRef={startCalRef}
              />
            </div>

            <div className="block">
              <span className="mb-2 block text-sm text-white/70">
                Hora inicio
              </span>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1730] px-4 py-3">
                <Time12Select
                  value={startTime}
                  onChange={(value) => {
                    setStartTime(value);
                    setQueryShift("custom");
                  }}
                />
                <Clock3 className="h-4 w-4 text-cyan-300" />
              </div>
              <span className="mt-1 block text-xs text-white/45">
                {formatTime12(startTime)}
              </span>
            </div>

            <div className="relative block">
              <span className="mb-2 block text-sm text-white/70">
                Fecha fin
              </span>
              <button
                type="button"
                ref={endBtnRef}
                onClick={() => setEndCalOpen((prev) => !prev)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1730] px-4 py-3 text-sm text-white outline-none"
              >
                <span className="flex-1 text-left">{displayDate(endDate)}</span>
                <CalendarDays className="h-4 w-4 text-cyan-300" />
              </button>
              <CalendarDropdown
                open={endCalOpen}
                month={endCalMonth}
                selected={endDate}
                onSelect={(dateKey) => {
                  setEndDate(dateKey);
                  setQueryShift("custom");
                }}
                onClose={() => setEndCalOpen(false)}
                onMonthChange={setEndCalMonth}
                calRef={endCalRef}
              />
            </div>

            <div className="block">
              <span className="mb-2 block text-sm text-white/70">Hora fin</span>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1730] px-4 py-3">
                <Time12Select
                  value={endTime}
                  onChange={(value) => {
                    setEndTime(value);
                    setQueryShift("custom");
                  }}
                />
                <Clock3 className="h-4 w-4 text-cyan-300" />
              </div>
              <span className="mt-1 block text-xs text-white/45">
                {formatTime12(endTime)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={generateReport}
            disabled={busy || schedulesLoading || !empresaId}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,_#2ab5ff_0%,_#9d4edd_100%)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {busy
              ? "Leyendo correos..."
              : schedulesLoading
                ? "Cargando turno..."
                : "Generar"}
          </button>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </div>

        <div className="mt-5 rounded-[28px] border border-white/10 bg-[#091426]/90 p-5 sm:p-6">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            {report
              ? `Listo para generar ${displayDate(startDate)} - ${displayDate(endDate)}`
              : "Configura el rango para generar"}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-[#0b1730] p-4">
              <div className="mb-3 flex items-center gap-3 text-cyan-300">
                <Mail className="h-5 w-5" />
                <span className="text-sm text-white/70">
                  Correos procesados
                </span>
              </div>
              <div className="text-3xl font-semibold">{summary.emails}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0b1730] p-4">
              <div className="mb-3 flex items-center gap-3 text-violet-300">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-sm text-white/70">
                  Transacciones válidas
                </span>
              </div>
              <div className="text-3xl font-semibold">{summary.valid}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0b1730] p-4">
              <div className="mb-3 flex items-center gap-3 text-emerald-300">
                <Wallet className="h-5 w-5" />
                <span className="text-sm text-white/70">Monto total</span>
              </div>
              <div className="text-3xl font-semibold">
                ₡{summary.total.toLocaleString("es-CR")}
              </div>
            </div>
          </div>
        </div>

        {report && (
          <div className="mt-5 rounded-[28px] border border-white/10 bg-[#091426]/90 p-5 sm:p-6">
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span>
                <span className="block text-sm font-semibold text-white">
                  Correos encontrados
                </span>
                <span className="mt-1 block text-xs text-white/50">
                  {report.transactions.length} transacciones SINPE
                </span>
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-cyan-300">
                {detailsOpen ? "Ocultar" : "Ver lista"}
              </span>
            </button>

            {detailsOpen && (
              <div className="mt-4 space-y-3">
                {report.transactions.length > 0 ? (
                  report.transactions.map((transaction) => (
                    <div
                      key={transaction.uid}
                      className="rounded-2xl border border-white/10 bg-[#0b1730] p-4"
                    >
                      <div className="grid gap-3 text-sm md:grid-cols-3">
                        <div>
                          <div className="text-white/45">Monto</div>
                          <div className="mt-1 font-semibold text-emerald-300">
                            ₡{transaction.amount.toLocaleString("es-CR")}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/45">
                            Número de referencia
                          </div>
                          <div className="mt-1 break-all text-white/85">
                            {transaction.reference || "No disponible"}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/45">Hora recibido</div>
                          <div className="mt-1 text-white/85">
                            {formatDateTime12(transaction.date)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-[#0b1730] p-4 text-sm text-white/60">
                    No hay correos SINPE válidos en el rango.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
