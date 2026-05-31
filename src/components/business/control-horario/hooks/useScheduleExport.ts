"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, deleteObject } from "firebase/storage";
import { storage } from "@/config/firebase";
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
  year: number;
  selectedPeriod: "1-15" | "16-30" | "monthly";
  isDelifoodEmpresa: boolean;
  scheduleData: ScheduleData;
  delifoodHoursData: DelifoodHoursData;
  showToast: (msg: string, type: "success" | "error" | "warning") => void;
}

export function useScheduleExport(props: Props) {
  const {
    user, names, empresa, empresas, daysToShow, fullMonthView, viewMode,
    monthName, year, selectedPeriod, isDelifoodEmpresa, scheduleData, delifoodHoursData, showToast,
  } = props;

  const [isExporting, setIsExporting] = useState(false);
  const [qrState, setQrState] = useState<QrState>({
    show: false, dataURL: "", storageRef: "", imageBlob: null, countdown: null,
  });

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

  return { isExporting, qrState, setQrState, closeQR, exportScheduleAsImage, exportQuincenaToPNG };
}
