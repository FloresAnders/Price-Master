"use client";

import React from "react";
import { CcssConfigService } from "../../../../services/ccss-config";
import type { EmployeeSummary } from "../types";
import type { CcssConfig } from "../../../../types/firestore";

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findCompanyConfig(configs: CcssConfig[], candidates: string[]) {
  return (configs || [])
    .flatMap((config) => config.companie || [])
    .find((comp) => candidates.includes(normalizeKey(comp.ownerCompanie)));
}

interface Props {
  employeeName: string;
  empresaValue: string;
  empresaLabel?: string;
  empresaOwnerId?: string;
  employeeConfig?: {
    name: string;
    ccssType: "TC" | "MT";
    hoursPerShift: number;
    extraAmount: number;
  };
  shiftsByDay?: { [day: string]: string };
  year: number;
  month: number;
  daysToShow: number[];
  isDelifoodEmpresa?: boolean;
  delifoodHoursData?: {
    [employeeName: string]: { [day: string]: { hours: number } };
  };
  user?: import("../../../../types/firestore").User | null;
}

export default function EmployeeTooltipSummary({
  employeeName,
  empresaValue,
  empresaLabel,
  empresaOwnerId,
  employeeConfig,
  shiftsByDay,
  year,
  month,
  daysToShow,
  isDelifoodEmpresa = false,
  delifoodHoursData = {},
  user,
}: Props) {
  const [summary, setSummary] = React.useState<EmployeeSummary | null>(null);

  React.useEffect(() => {
    const fetchSummary = async () => {
      try {
        const configOwnerId = empresaOwnerId || user?.ownerId || user?.id || "";
        const configs = await CcssConfigService.getAllCcssConfigsByOwner(
          configOwnerId,
        );
        const companyCandidates = [empresaLabel, empresaValue]
          .map(normalizeKey)
          .filter(Boolean);

        let workedDaysInPeriod = 0;
        let totalHours = 0;

        if (isDelifoodEmpresa) {
          totalHours = daysToShow.reduce((total, day) => {
            const hours =
              delifoodHoursData[employeeName]?.[day.toString()]?.hours || 0;
            return total + hours;
          }, 0);
          workedDaysInPeriod = daysToShow.filter((day) => {
            const hours =
              delifoodHoursData[employeeName]?.[day.toString()]?.hours || 0;
            return hours > 0;
          }).length;
        } else {
          const hoursPerDay = Number(employeeConfig?.hoursPerShift) || 0;
          daysToShow.forEach((day) => {
            const shift = shiftsByDay?.[day.toString()] || "";
            if (shift === "N" || shift === "D") {
              workedDaysInPeriod++;
              const savedHours =
                delifoodHoursData[employeeName]?.[day.toString()]?.hours;
              totalHours +=
                savedHours && savedHours > 0 ? savedHours : hoursPerDay;
            }
          });
        }

        const companyConfig = findCompanyConfig(configs, companyCandidates);
        const configuredHourlyRate = Number(companyConfig?.valorhora);
        const fallbackHourlyRate = Number(companyConfig?.pagoTotalPH);
        const hourlyRate =
          configuredHourlyRate > 0
            ? configuredHourlyRate
            : fallbackHourlyRate || 0;

        setSummary({
          workedDays: workedDaysInPeriod,
          hours: totalHours,
          colones: totalHours * hourlyRate,
        });
      } catch (error) {
        console.error("Error fetching employee summary:", error);
        setSummary({
          workedDays: 0,
          hours: 0,
          colones: 0,
        });
      }
    };

    fetchSummary();
  }, [
    employeeName,
    empresaValue,
    empresaLabel,
    empresaOwnerId,
    employeeConfig,
    shiftsByDay,
    year,
    month,
    daysToShow,
    isDelifoodEmpresa,
    delifoodHoursData,
    user?.id,
    user?.ownerId,
  ]);

  if (!summary) {
    return <div>Cargando...</div>;
  }

  return (
    <>
      <div>
        <b>{isDelifoodEmpresa ? "Dias con horas:" : "Dias trabajados:"}</b>{" "}
        {summary.workedDays}
      </div>
      <div>
        <b>Horas trabajadas:</b> {summary.hours}
      </div>
      <div>
        <b>Salario:</b> {"\u20a1"}
        {summary.colones.toLocaleString("es-CR", { minimumFractionDigits: 2 })}
      </div>
    </>
  );
}
