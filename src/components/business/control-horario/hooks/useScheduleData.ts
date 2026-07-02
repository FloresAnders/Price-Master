"use client";

import { useState, useEffect, useRef } from "react";
import { SchedulesService } from "../../../../services/schedules";
import type { ScheduleEntry } from "../../../../services/schedules";
import type { ScheduleData, DelifoodHoursData } from "../types";

interface Props {
  empresa: string;
  year: number;
  month: number;
  selectedPeriod: "1-15" | "16-30" | "monthly";
  fullMonthView: boolean;
  isDelifoodEmpresa: boolean;
  user: { role?: string } | null;
  assignedEmpresaValue: string | null;
  showToast: (msg: string, type: "success" | "error" | "warning") => void;
  namesList: string[];
  daysInMonth: number;
}

export function useScheduleData(props: Props) {
  const {
    empresa, year, month, selectedPeriod, fullMonthView,
    isDelifoodEmpresa, user, assignedEmpresaValue, showToast,
    namesList, daysInMonth,
  } = props;

  const [scheduleData, setScheduleData] = useState<ScheduleData>({});
  const [delifoodHoursData, setDelifoodHoursData] = useState<DelifoodHoursData>({});
  const scheduleLoadInFlightKeyRef = useRef<string | null>(null);

  const isMonthly = fullMonthView || selectedPeriod === "monthly";
  const startDay = isMonthly ? 1 : selectedPeriod === "1-15" ? 1 : 16;
  const endDay = isMonthly ? daysInMonth : selectedPeriod === "1-15" ? 15 : daysInMonth;

  useEffect(() => {
    const loadScheduleData = async () => {
      if (!empresa || !namesList.length) return;

      const loadKey = `${empresa}|${year}|${month}|${isDelifoodEmpresa}|${startDay}-${endDay}`;
      if (scheduleLoadInFlightKeyRef.current === loadKey) return;
      scheduleLoadInFlightKeyRef.current = loadKey;

      if (user?.role === "user" && assignedEmpresaValue && empresa !== assignedEmpresaValue) {
        showToast("Acceso restringido a tu empresa asignada", "error");
        return;
      }

      try {
        const allEntries: ScheduleEntry[] = isMonthly
          ? await SchedulesService.getSchedulesByLocationYearMonth(empresa, year, month)
          : await SchedulesService.getSchedulesByLocationYearMonthDayRange(empresa, year, month, startDay, endDay);

        const newData: ScheduleData = {};
        const newDelifood: DelifoodHoursData = {};

        namesList.forEach((name) => {
          newData[name] = {};
          newDelifood[name] = {};
        });

        (allEntries || []).forEach((entry) => {
          if (!entry.employeeName) return;
          if (!newData[entry.employeeName]) newData[entry.employeeName] = {};
          if (entry.shift?.trim()) {
            newData[entry.employeeName][entry.day.toString()] = entry.shift;
          }
          if (entry.horasPorDia != null && entry.horasPorDia > 0) {
            if (!newDelifood[entry.employeeName]) newDelifood[entry.employeeName] = {};
            newDelifood[entry.employeeName][entry.day.toString()] = { hours: entry.horasPorDia };
          }
        });

        setDelifoodHoursData(newDelifood);
        setScheduleData(newData);
      } catch (error) {
        console.error("Error loading schedule data:", error);
      } finally {
        if (scheduleLoadInFlightKeyRef.current === loadKey) {
          scheduleLoadInFlightKeyRef.current = null;
        }
      }
    };

    loadScheduleData();
  }, [empresa, year, month, isDelifoodEmpresa, startDay, endDay, isMonthly, namesList, user, assignedEmpresaValue, showToast]);

  return { scheduleData, setScheduleData, delifoodHoursData, setDelifoodHoursData, startDay, endDay };
}
