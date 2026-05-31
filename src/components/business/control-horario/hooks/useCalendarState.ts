"use client";

import { useState } from "react";
import { getDaysToShow } from "../utils";

export function useCalendarState() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"first" | "second">(() => {
    return new Date().getDate() > 15 ? "second" : "first";
  });
  const [selectedPeriod, setSelectedPeriod] = useState<"1-15" | "16-30" | "monthly">(() => {
    return new Date().getDate() > 15 ? "16-30" : "1-15";
  });
  const [fullMonthView, setFullMonthView] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString("es-CR", { month: "long", year: "numeric" });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysToShow = getDaysToShow(viewMode, fullMonthView, daysInMonth);

  const changeMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + (direction === "prev" ? -1 : 1));
      return next;
    });
  };

  return {
    currentDate, setCurrentDate,
    viewMode, setViewMode,
    selectedPeriod, setSelectedPeriod,
    fullMonthView, setFullMonthView,
    changeMonth,
    year, month, monthName, daysInMonth, daysToShow,
  };
}
