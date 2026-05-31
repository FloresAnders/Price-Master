"use client";

import { useEffect, useRef, useState } from "react";
import { getIncompletePastDaysForMonth, formatIncompletePastDaysMessage } from "../utils";
import { DUP_WINDOW_MS, STORAGE_KEY_SIGNATURE } from "../constants";
import type { ScheduleData } from "../types";

interface Props {
  empresa: string;
  isDelifoodEmpresa: boolean;
  year: number;
  month: number;
  selectedPeriod: "1-15" | "16-30" | "monthly";
  fullMonthView: boolean;
  daysInMonth: number;
  scheduleData: ScheduleData;
  empresas: { value: string; names?: string[] }[];
  showToast: (msg: string, type: "warning", duration?: number) => void;
}

export function useIncompleteDaysAlert(props: Props) {
  const {
    empresa, isDelifoodEmpresa, year, month,
    selectedPeriod, fullMonthView, daysInMonth,
    scheduleData, empresas, showToast,
  } = props;

  const [incompletePastDaysSignature, setIncompletePastDaysSignature] = useState("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!empresa || isDelifoodEmpresa) return;

    const empresaEmployees = empresas.find((l) => l.value === empresa)?.names;
    if (!empresaEmployees?.length) return;

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = window.setTimeout(() => {
      const today = new Date();
      if (year !== today.getFullYear() || month !== today.getMonth()) return;

      const isCurrentFirst = today.getDate() <= 15;
      const isViewingCurrent = isCurrentFirst
        ? selectedPeriod === "1-15" && !fullMonthView
        : selectedPeriod === "16-30" && !fullMonthView;
      if (!isViewingCurrent) return;

      const isMonthly = fullMonthView || selectedPeriod === "monthly";
      const startDay = isMonthly ? 1 : selectedPeriod === "1-15" ? 1 : 16;
      const endDay = isMonthly ? daysInMonth : selectedPeriod === "1-15" ? 15 : daysInMonth;

      const incompleteDays = getIncompletePastDaysForMonth(scheduleData, year, month, today, startDay, endDay);

      if (!incompleteDays.length) {
        setIncompletePastDaysSignature("");
        try { sessionStorage.removeItem(STORAGE_KEY_SIGNATURE); } catch { }
        return;
      }

      const sig = `${empresa}|${year}|${month}|${startDay}-${endDay}|${incompleteDays.join(",")}`;
      if (sig === incompletePastDaysSignature) return;

      try {
        const stored = sessionStorage.getItem(STORAGE_KEY_SIGNATURE);
        const now = Date.now();
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed?.sig === sig && typeof parsed?.at === "number" && now - parsed.at < DUP_WINDOW_MS) return;
          } catch { }
        }
        sessionStorage.setItem(STORAGE_KEY_SIGNATURE, JSON.stringify({ sig, at: now }));
      } catch { }

      showToast(formatIncompletePastDaysMessage(incompleteDays), "warning", 30000);
      setIncompletePastDaysSignature(sig);
    }, 250);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [empresa, isDelifoodEmpresa, year, month, selectedPeriod, fullMonthView, daysInMonth, scheduleData, empresas, showToast, incompletePastDaysSignature]);
}
