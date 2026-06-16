"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ref, deleteObject } from "firebase/storage";
import { storage } from "@/config/firebase";
import { SchedulesService } from "../../../../services/schedules";
import type { QrState, ScheduleData, DelifoodHoursData } from "../types";

interface Props {
  user: { name?: string; role?: string } | null;
  names: string[];
  empresa: string;
  empresas: { value: string; label?: string }[];
  daysToShow: number[];
  fullMonthView: boolean;
  viewMode: "first" | "second";
  monthName: string;
  month: number;
  year: number;
  selectedPeriod: "1-15" | "16-30" | "monthly";
  isDelifoodEmpresa: boolean;
  scheduleData: ScheduleData;
  delifoodHoursData: DelifoodHoursData;
  showToast: (msg: string, type: "success" | "error" | "warning") => void;
}

export interface WorkedRangeRow {
  employeeName: string;
  workedDays: number;
  totalHours: number;
  dayDetails: WorkedRangeDayDetail[];
}

export interface WorkedRangeDayDetail {
  dateKey: string;
  day: number;
  month: number;
  year: number;
  quincena: "1-15" | "16-fin";
  hours: number;
}

const isPrivilegedUser = (user: { role?: string } | null) =>
  user?.role === "admin" || user?.role === "superadmin";

const toInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseInputDate = (value: string | null) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatInputDateToDisplay = (value: string | null) => {
  if (!value) return "dd/mm/yyyy";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "dd/mm/yyyy";
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const dateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export function useScheduleExport(props: Props) {
  const {
    user, names, empresa, empresas, daysToShow, fullMonthView, viewMode,
    monthName, month, year, selectedPeriod, isDelifoodEmpresa, scheduleData, delifoodHoursData, showToast,
  } = props;

  const [isExporting, setIsExporting] = useState(false);
  const [workedRangeModalOpen, setWorkedRangeModalOpen] = useState(false);
  const [workedRangeStartDate, setWorkedRangeStartDate] = useState<string | null>("");
  const [workedRangeEndDate, setWorkedRangeEndDate] = useState<string | null>("");
  const [workedRangeRows, setWorkedRangeRows] = useState<WorkedRangeRow[]>([]);
  const [workedRangeGenerated, setWorkedRangeGenerated] = useState(false);
  const [isGeneratingWorkedRange, setIsGeneratingWorkedRange] = useState(false);
  const [workedRangeQuickRange, setWorkedRangeQuickRange] = useState<string | null>(null);
  const [workedRangeFromCalendarOpen, setWorkedRangeFromCalendarOpen] = useState(false);
  const [workedRangeToCalendarOpen, setWorkedRangeToCalendarOpen] = useState(false);
  const [workedRangeFromCalendarMonth, setWorkedRangeFromCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [workedRangeToCalendarMonth, setWorkedRangeToCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const workedRangeFromCalendarRef = useRef<HTMLDivElement | null>(null);
  const workedRangeToCalendarRef = useRef<HTMLDivElement | null>(null);
  const workedRangeFromButtonRef = useRef<HTMLButtonElement | null>(null);
  const workedRangeToButtonRef = useRef<HTMLButtonElement | null>(null);
  const [qrState, setQrState] = useState<QrState>({
    show: false, dataURL: "", storageRef: "", imageBlob: null, countdown: null,
  });
  const workedRangeTodayKey = useMemo(() => toInputDate(new Date()), []);

  useEffect(() => {
    if (!workedRangeFromCalendarOpen && !workedRangeToCalendarOpen) return;

    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (workedRangeFromCalendarOpen) {
        if (workedRangeFromCalendarRef.current?.contains(target)) return;
        if (workedRangeFromButtonRef.current?.contains(target)) return;
        setWorkedRangeFromCalendarOpen(false);
      }
      if (workedRangeToCalendarOpen) {
        if (workedRangeToCalendarRef.current?.contains(target)) return;
        if (workedRangeToButtonRef.current?.contains(target)) return;
        setWorkedRangeToCalendarOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [workedRangeFromCalendarOpen, workedRangeToCalendarOpen]);

  // QR countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (qrState.countdown !== null && qrState.countdown > 0) {
      interval = setInterval(() => {
        setQrState((prev) => (prev.countdown !== null ? { ...prev, countdown: prev.countdown - 1 } : prev));
      }, 1000);
    } else if (qrState.countdown === 0) {
      setQrState({ show: false, dataURL: "", storageRef: "", imageBlob: null, countdown: null });
    }
    return () => clearInterval(interval);
  }, [qrState.countdown]);

  // QR cleanup effect
  useEffect(() => {
    if (!qrState.show && qrState.storageRef) {
      deleteObject(ref(storage, qrState.storageRef)).catch(() => {});
      setQrState({ show: false, dataURL: "", storageRef: "", imageBlob: null, countdown: null });
    }
  }, [qrState.show, qrState.storageRef]);

  const closeQR = useCallback(() => {
    if (qrState.storageRef) {
      deleteObject(ref(storage, qrState.storageRef)).catch(() => {});
    }
    setQrState({ show: false, dataURL: "", storageRef: "", imageBlob: null, countdown: null });
  }, [qrState.storageRef]);

  const openWorkedRangeModal = useCallback(() => {
    if (!isPrivilegedUser(user)) {
      showToast("Solo Admin o SuperAdmin puede exportar dias/horas", "error");
      return;
    }

    const firstDay = daysToShow[0] || 1;
    const lastDay = daysToShow[daysToShow.length - 1] || firstDay;
    const start = new Date(year, month, firstDay);
    const end = new Date(year, month, lastDay);
    setWorkedRangeStartDate(toInputDate(start));
    setWorkedRangeEndDate(toInputDate(end));
    setWorkedRangeFromCalendarMonth(new Date(start.getFullYear(), start.getMonth(), 1));
    setWorkedRangeToCalendarMonth(new Date(end.getFullYear(), end.getMonth(), 1));
    setWorkedRangeQuickRange(null);
    setWorkedRangeFromCalendarOpen(false);
    setWorkedRangeToCalendarOpen(false);
    setWorkedRangeRows([]);
    setWorkedRangeGenerated(false);
    setWorkedRangeModalOpen(true);
  }, [daysToShow, month, showToast, user, year]);

  const closeWorkedRangeModal = useCallback(() => {
    setWorkedRangeModalOpen(false);
    setWorkedRangeFromCalendarOpen(false);
    setWorkedRangeToCalendarOpen(false);
  }, []);

  const generateWorkedRange = useCallback(async () => {
    if (!isPrivilegedUser(user)) {
      showToast("Solo Admin o SuperAdmin puede generar dias/horas", "error");
      return;
    }
    if (!empresa) {
      showToast("Selecciona una empresa", "error");
      return;
    }

    const start = parseInputDate(workedRangeStartDate);
    const end = parseInputDate(workedRangeEndDate);
    if (!start || !end) {
      showToast("Selecciona fecha de inicio y fecha final", "error");
      return;
    }
    if (end < start) {
      showToast("La fecha final debe ser mayor o igual a la inicial", "error");
      return;
    }

    try {
      setIsGeneratingWorkedRange(true);
      setWorkedRangeGenerated(false);

      const visibleNames = new Set(names);
      const employeeHours = new Map<string, Map<string, WorkedRangeDayDetail>>();
      const employeeConfig = new Map(
        (empresas.find((item) => item.value === empresa) as any)?.employees?.map(
          (employee: { name: string; hoursPerShift?: number }) => [
            employee.name,
            employee.hoursPerShift ?? 8,
          ],
        ) || [],
      );

      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

      while (cursor <= endMonth) {
        const currentYear = cursor.getFullYear();
        const currentMonth = cursor.getMonth();
        const startDay =
          currentYear === start.getFullYear() && currentMonth === start.getMonth()
            ? start.getDate()
            : 1;
        const endDay =
          currentYear === end.getFullYear() && currentMonth === end.getMonth()
            ? end.getDate()
            : new Date(currentYear, currentMonth + 1, 0).getDate();

        const monthEntries = await SchedulesService.getSchedulesByLocationYearMonthDayRange(
          empresa,
          currentYear,
          currentMonth,
          startDay,
          endDay,
        );

        monthEntries.forEach((entry) => {
          const entryDate = new Date(entry.year, entry.month, entry.day);
          if (entryDate < start || entryDate > end || !entry.employeeName) return;
          if (!visibleNames.has(entry.employeeName)) return;

          let hours = 0;
          if (isDelifoodEmpresa) {
            const rawHours = Number(entry.horasPorDia);
            if (Number.isFinite(rawHours) && rawHours > 0) hours = rawHours;
          } else if (entry.shift === "D" || entry.shift === "N") {
            const rawHours = Number(entry.horasPorDia);
            hours =
              Number.isFinite(rawHours) && rawHours > 0
                ? rawHours
                : Number(employeeConfig.get(entry.employeeName) || 8);
          }

          if (hours <= 0) return;

          const employeeDays =
            employeeHours.get(entry.employeeName) ||
            new Map<string, WorkedRangeDayDetail>();
          const key = dateKey(entry.year, entry.month, entry.day);
          const previous = employeeDays.get(key);
          employeeDays.set(key, {
            dateKey: key,
            day: entry.day,
            month: entry.month,
            year: entry.year,
            quincena: entry.day <= 15 ? "1-15" : "16-fin",
            hours: (previous?.hours || 0) + hours,
          });
          employeeHours.set(entry.employeeName, employeeDays);
        });

        cursor.setMonth(cursor.getMonth() + 1);
      }

      const rows = Array.from(employeeHours.entries())
        .map(([employeeName, days]) => ({
          employeeName,
          workedDays: days.size,
          totalHours: Array.from(days.values()).reduce((sum, value) => sum + value.hours, 0),
          dayDetails: Array.from(days.values()).sort((a, b) =>
            a.dateKey.localeCompare(b.dateKey),
          ),
        }))
        .filter((row) => row.workedDays > 0 || row.totalHours > 0)
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "es"));

      setWorkedRangeRows(rows);
      setWorkedRangeGenerated(true);
      showToast("Dias/horas generados", "success");
    } catch (error) {
      console.error("Error generating worked range:", error);
      showToast("Error al generar dias/horas", "error");
    } finally {
      setIsGeneratingWorkedRange(false);
    }
  }, [
    empresa,
    empresas,
    isDelifoodEmpresa,
    names,
    showToast,
    user,
    workedRangeEndDate,
    workedRangeStartDate,
  ]);

  const exportWorkedRangeImage = useCallback(async () => {
    if (!workedRangeGenerated) {
      showToast("Genera los dias/horas primero", "error");
      return;
    }
    if (!workedRangeRows.length) {
      showToast("No hay datos para exportar", "error");
      return;
    }

    let div: HTMLDivElement | null = null;
    try {
      setIsExporting(true);
      const companyLabel = empresas.find((item) => item.value === empresa)?.label || empresa;
      const startLabel = formatInputDateToDisplay(workedRangeStartDate);
      const endLabel = formatInputDateToDisplay(workedRangeEndDate);
      div = document.createElement("div");
      div.style.cssText = "position:absolute;left:-9999px;top:0;z-index:-1000;background:#fff;color:#171717;padding:32px;border-radius:18px;font-family:Arial,sans-serif;min-width:520px";
      div.innerHTML = `
        <h2 style="font-size:1.35rem;font-weight:700;text-align:center;margin:0 0 0.75rem;">Dias/horas trabajados</h2>
        <div style="text-align:center;margin-bottom:1rem;color:#4b5563;">
          <div><strong>Empresa:</strong> ${escapeHtml(companyLabel)}</div>
          <div><strong>Rango:</strong> ${escapeHtml(startLabel)} - ${escapeHtml(endLabel)}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:1rem;">
          <thead>
            <tr>
              <th style="border:1px solid #d1d5db;padding:8px 12px;background:#f3f4f6;text-align:left;">Empleado</th>
              <th style="border:1px solid #d1d5db;padding:8px 12px;background:#f3f4f6;text-align:right;">Dias</th>
              <th style="border:1px solid #d1d5db;padding:8px 12px;background:#f3f4f6;text-align:right;">Horas</th>
            </tr>
          </thead>
          <tbody>
            ${workedRangeRows
              .map(
                (row) => `
                  <tr>
                    <td style="border:1px solid #d1d5db;padding:8px 12px;font-weight:600;">${escapeHtml(row.employeeName)}</td>
                    <td style="border:1px solid #d1d5db;padding:8px 12px;text-align:right;">${row.workedDays}</td>
                    <td style="border:1px solid #d1d5db;padding:8px 12px;text-align:right;">${row.totalHours}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
        <div style="margin-top:1rem;text-align:right;font-size:0.9rem;color:#6b7280;">${new Date().toLocaleString("es-CR")}</div>
      `;

      document.body.appendChild(div);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(div, {
        useCORS: true,
        allowTaint: true,
        width: div.scrollWidth,
        height: div.scrollHeight,
        logging: false,
        background: "#ffffff",
      });
      if (div.parentNode) document.body.removeChild(div);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) {
        showToast("Error al generar imagen", "error");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dias_horas_${empresa}_${workedRangeStartDate || "inicio"}_${workedRangeEndDate || "final"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Imagen exportada", "success");
    } catch (error) {
      console.error("Error exporting worked range image:", error);
      showToast("Error al exportar imagen", "error");
    } finally {
      if (div?.parentNode) document.body.removeChild(div);
      setIsExporting(false);
    }
  }, [
    empresa,
    empresas,
    showToast,
    workedRangeEndDate,
    workedRangeGenerated,
    workedRangeRows,
    workedRangeStartDate,
  ]);

  const exportScheduleAsImage = async () => {
    if (user?.role !== "superadmin") {
      showToast("Solo SuperAdmin puede exportar como imagen", "error");
      return;
    }

    try {
      setIsExporting(true);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No ctx");

      const employeeCount = names.length;
      const dayCount = daysToShow.length;
      const baseWidth = 1400;
      const baseHeight = 800 + employeeCount * 50;
      canvas.width = Math.max(baseWidth, 300 + dayCount * 60);
      canvas.height = Math.max(baseHeight, 600 + employeeCount * 50);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const marginX = 60;
      const marginY = 80;
      const empNameW = 200;
      const summaryW = 120;
      const availW = canvas.width - marginX * 2 - empNameW - summaryW;
      const cellW = Math.max(50, availW / dayCount);
      const cellH = 50;
      let yPos = marginY;

      ctx.font = "bold 36px Arial";
      ctx.fillStyle = "#1f2937";
      ctx.textAlign = "center";
      ctx.fillText("Control de Horarios - Time Master", canvas.width / 2, yPos);
      yPos += 50;

      ctx.font = "20px Arial";
      ctx.fillStyle = "#4b5563";
      const periodText = fullMonthView ? "Mes Completo" : viewMode === "first" ? "Primera Quincena (1-15)" : "Segunda Quincena (16-fin)";
      ctx.fillText(`Empresa: ${empresas.find((l) => l.value === empresa)?.label || empresa}`, canvas.width / 2, yPos); yPos += 35;
      ctx.fillText(`Período: ${monthName} - ${periodText}`, canvas.width / 2, yPos); yPos += 35;
      ctx.fillText(`Exportado por: ${user?.name} (SuperAdmin)`, canvas.width / 2, yPos); yPos += 35;
      ctx.fillText(new Date().toLocaleDateString("es-CR", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }), canvas.width / 2, yPos);
      yPos += 60;
      ctx.textAlign = "left";

      const tableY = yPos;
      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(marginX, tableY, empNameW, cellH);
      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 2;
      ctx.strokeRect(marginX, tableY, empNameW, cellH);
      ctx.textAlign = "center";
      ctx.fillText("Empleado", marginX + empNameW / 2, tableY + cellH / 2 + 6);

      const daysX = marginX + empNameW;
      daysToShow.forEach((day, idx) => {
        const x = daysX + idx * cellW;
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(x, tableY, cellW, cellH);
        ctx.strokeRect(x, tableY, cellW, cellH);
        ctx.fillStyle = "#1f2937";
        ctx.fillText(day.toString(), x + cellW / 2, tableY + cellH / 2 + 6);
      });

      const sumX = daysX + dayCount * cellW;
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(sumX, tableY, summaryW, cellH);
      ctx.strokeRect(sumX, tableY, summaryW, cellH);
      ctx.fillStyle = "#1f2937";
      ctx.fillText(isDelifoodEmpresa ? "Total Horas" : "Días Trab.", sumX + summaryW / 2, tableY + cellH / 2 + 6);

      yPos = tableY + cellH;
      names.forEach((empName, ei) => {
        let sv = 0;
        if (isDelifoodEmpresa) {
          sv = daysToShow.reduce((t, d) => t + (delifoodHoursData[empName]?.[d.toString()]?.hours || 0), 0);
        } else {
          sv = daysToShow.filter((d) => ["N", "D"].includes(scheduleData[empName]?.[d.toString()] || "")).length;
        }

        ctx.fillStyle = ei % 2 === 0 ? "#f8fafc" : "#ffffff";
        ctx.fillRect(marginX, yPos, empNameW, cellH);
        ctx.strokeRect(marginX, yPos, empNameW, cellH);
        ctx.fillStyle = "#374151";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "left";
        ctx.fillText(empName, marginX + 10, yPos + cellH / 2 + 6);

        daysToShow.forEach((day, di) => {
          const x = daysX + di * cellW;
          if (isDelifoodEmpresa) {
            const h = delifoodHoursData[empName]?.[day.toString()]?.hours || 0;
            const bg = h > 0 ? "#d1fae5" : ei % 2 === 0 ? "#f8fafc" : "#ffffff";
            ctx.fillStyle = bg; ctx.fillRect(x, yPos, cellW, cellH); ctx.strokeRect(x, yPos, cellW, cellH);
            if (h > 0) { ctx.fillStyle = "#065f46"; ctx.font = "bold 16px Arial"; ctx.textAlign = "center"; ctx.fillText(h.toString(), x + cellW / 2, yPos + cellH / 2 + 6); }
          } else {
            const shift = scheduleData[empName]?.[day.toString()] || "";
            const colorMap: Record<string, [string, string]> = { N: ["#87CEEB", "#000"], D: ["#FFFF00", "#000"], L: ["#FF00FF", "#fff"], V: ["#28a745", "#fff"], I: ["#fd7e14", "#fff"] };
            const [bg, fg] = colorMap[shift] || [ei % 2 === 0 ? "#f8fafc" : "#ffffff", "#000"];
            ctx.fillStyle = bg; ctx.fillRect(x, yPos, cellW, cellH); ctx.strokeRect(x, yPos, cellW, cellH);
            if (shift) { ctx.fillStyle = fg; ctx.font = "bold 18px Arial"; ctx.textAlign = "center"; ctx.fillText(shift, x + cellW / 2, yPos + cellH / 2 + 6); }
          }
        });

        ctx.fillStyle = ei % 2 === 0 ? "#e0f2fe" : "#f0f8ff";
        ctx.fillRect(sumX, yPos, summaryW, cellH); ctx.strokeRect(sumX, yPos, summaryW, cellH);
        ctx.fillStyle = "#1565c0";
        ctx.font = "bold 18px Arial";
        ctx.textAlign = "center";
        ctx.fillText(isDelifoodEmpresa ? `${sv}h` : sv.toString(), sumX + summaryW / 2, yPos + cellH / 2 + 6);
        yPos += cellH;
      });

      yPos += 40;
      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "#1f2937";
      ctx.textAlign = "center";
      ctx.fillText(isDelifoodEmpresa ? "Leyenda de Horas" : "Leyenda de Turnos", canvas.width / 2, yPos);
      yPos += 40;

      const legendItems = isDelifoodEmpresa
        ? [{ label: "Verde = Con horas", color: "#d1fae5" }, { label: "Vacío = Sin horas", color: "#f9fafb" }, { label: "Número = Horas", color: "#ffffff" }]
        : [{ label: "N = Nocturno", color: "#87CEEB" }, { label: "D = Diurno", color: "#FFFF00" }, { label: "L = Libre", color: "#FF00FF" }, { label: "Vacío = Sin asignar", color: "#f9fafb" }];

      const liW = isDelifoodEmpresa ? 250 : 200;
      const liSX = (canvas.width - legendItems.length * liW) / 2;
      legendItems.forEach((item, i) => {
        const x = liSX + i * liW;
        ctx.fillStyle = item.color; ctx.fillRect(x, yPos - 15, 25, 25);
        ctx.strokeStyle = "#d1d5db"; ctx.lineWidth = 1; ctx.strokeRect(x, yPos - 15, 25, 25);
        ctx.fillStyle = "#374151"; ctx.font = "14px Arial"; ctx.textAlign = "left";
        ctx.fillText(item.label, x + 35, yPos);
      });

      yPos = canvas.height - 60;
      ctx.font = "12px Arial";
      ctx.fillStyle = "#9ca3af";
      ctx.textAlign = "center";
      ctx.fillText("Generated by Time Master - Control de Horarios", canvas.width / 2, yPos);
      ctx.fillText(`Empleados: ${names.length} | ${isDelifoodEmpresa ? "Horas" : "Días"}: ${dayCount}`, canvas.width / 2, yPos + 20);
      ctx.fillText("Documento confidencial", canvas.width / 2, yPos + 40);

      canvas.toBlob((blob) => {
        if (!blob) { showToast("Error al generar imagen", "error"); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${isDelifoodEmpresa ? "horas-delifood" : "horarios"}-${empresa}-${monthName.replace(/\s+/g, "_")}-${new Date().toISOString().split("T")[0]}.png`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showToast("Horarios exportados como imagen", "success");
      }, "image/png");
    } catch (error) {
      showToast("Error al exportar", "error");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportQuincenaToPNG = async () => {
    if (!empresa) { showToast("Selecciona una empresa", "error"); return; }
    if (!names.length) { showToast("No hay empleados", "error"); return; }
    if (!daysToShow.length) { showToast("No hay días", "error"); return; }

    setIsExporting(true);
    try {
      const div = document.createElement("div");
      div.style.cssText = "position:absolute;left:-9999px;top:0;z-index:-1000;background:#fff;color:#171717;padding:32px;border-radius:18px;font-family:Arial,sans-serif;min-width:340px";

      let html = `<h2 style="font-size:1.2rem;font-weight:bold;text-align:center;margin-bottom:1rem;">Horario - ${empresa}</h2><table style="width:100%;border-collapse:collapse;font-size:1rem;"><thead><tr><th style="border:1px solid #d1d5db;padding:6px 10px;background:#f3f4f6;">Nombre</th>`;
      daysToShow.forEach((d) => { html += `<th style="border:1px solid #d1d5db;padding:6px 10px;background:#f3f4f6;">${d}</th>`; });
      html += `<th style="border:1px solid #d1d5db;padding:6px 10px;background:#e0f2fe;color:#1565c0;font-weight:bold;">${isDelifoodEmpresa ? "Total Horas" : "Días Trab."}</th></tr></thead><tbody>`;

      names.forEach((name) => {
        let sv = 0;
        if (isDelifoodEmpresa) {
          sv = daysToShow.reduce((t, d) => t + (delifoodHoursData?.[name]?.[d.toString()]?.hours || 0), 0);
        } else {
          sv = daysToShow.filter((d) => ["N", "D"].includes(scheduleData?.[name]?.[d.toString()] || "")).length;
        }
        html += `<tr><td style="border:1px solid #d1d5db;padding:6px 10px;font-weight:bold;background:#f3f4f6;">${name}</td>`;
        daysToShow.forEach((d) => {
          if (isDelifoodEmpresa) {
            const h = delifoodHoursData?.[name]?.[d.toString()]?.hours || 0;
            html += `<td style="border:1px solid #d1d5db;padding:6px 10px;background:${h > 0 ? "#d1fae5" : "#fff"};text-align:center;color:#065f46;font-weight:${h > 0 ? "bold" : "normal"};">${h > 0 ? h : ""}</td>`;
          } else {
            const v = scheduleData?.[name]?.[d.toString()] || "";
            const colorMap: Record<string, string> = { N: "#87CEEB", D: "#FFFF00", L: "#FF00FF", V: "#28a745", I: "#fd7e14" };
            html += `<td style="border:1px solid #d1d5db;padding:6px 10px;background:${colorMap[v] || "#fff"};text-align:center;">${v}</td>`;
          }
        });
        html += `<td style="border:1px solid #d1d5db;padding:6px 10px;background:#e0f2fe;text-align:center;font-weight:bold;color:#1565c0;">${isDelifoodEmpresa ? `${sv}h` : sv}</td></tr>`;
      });

      html += `</tbody></table><div style="margin-top:1.2rem;text-align:right;font-size:0.95rem;opacity:0.7;">${new Date().toLocaleString("es-CR")}</div>`;
      div.innerHTML = html;
      document.body.appendChild(div);
      await new Promise((r) => setTimeout(r, 100));

      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(div, { useCORS: true, allowTaint: true, width: div.scrollWidth, height: div.scrollHeight, logging: false });
      document.body.removeChild(div);

      const blob = await (await fetch(canvas.toDataURL("image/png"))).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const suffix = selectedPeriod === "monthly" ? "mensual" : selectedPeriod === "1-15" ? "primera_quincena" : "segunda_quincena";
      a.download = `${isDelifoodEmpresa ? "horas_delifood" : "horario"}_${empresa}_${monthName}_${year}_${suffix}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      showToast("Exportado exitosamente", "success");
    } catch (error) {
      showToast(`Error: ${error instanceof Error ? error.message : "desconocido"}`, "error");
    } finally {
      setIsExporting(false);
    }
  };

  // Need selectedPeriod from outside — get it from the return of useCalendarState
  // We'll handle this by accepting it as a prop... but html2canvas export uses it.
  // Actually let me just inline the exported function to use whatever selectedPeriod is available.

  return {
    isExporting,
    qrState,
    setQrState,
    closeQR,
    exportScheduleAsImage,
    exportQuincenaToPNG,
    workedRangeModalOpen,
    workedRangeStartDate,
    workedRangeEndDate,
    workedRangeRows,
    workedRangeGenerated,
    isGeneratingWorkedRange,
    workedRangeQuickRange,
    workedRangeTodayKey,
    workedRangeFromCalendarOpen,
    workedRangeToCalendarOpen,
    workedRangeFromCalendarMonth,
    workedRangeToCalendarMonth,
    workedRangeFromCalendarRef,
    workedRangeToCalendarRef,
    workedRangeFromButtonRef,
    workedRangeToButtonRef,
    openWorkedRangeModal,
    closeWorkedRangeModal,
    setWorkedRangeStartDate,
    setWorkedRangeEndDate,
    setWorkedRangeQuickRange,
    setWorkedRangeFromCalendarOpen,
    setWorkedRangeToCalendarOpen,
    setWorkedRangeFromCalendarMonth,
    setWorkedRangeToCalendarMonth,
    generateWorkedRange,
    exportWorkedRangeImage,
    formatWorkedRangeDateToDisplay: formatInputDateToDisplay,
  };
}
