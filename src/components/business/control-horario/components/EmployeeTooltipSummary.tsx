"use client";

import React from "react";
import { CcssConfigService } from "../../../../services/ccss-config";
import type { EmployeeSummary } from "../types";

interface Props {
  employeeName: string;
  empresaValue: string;
  empresaLabel?: string;
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
        const employee = employeeConfig;
        const userOwnerId = user?.ownerId || user?.id || "";
        const ccssConfig = await CcssConfigService.getCcssConfig(userOwnerId);
        const empresaName = empresaLabel || empresaValue;

        let workedDaysInPeriod = 0;
        let totalHours = 0;

        if (isDelifoodEmpresa) {
          totalHours = daysToShow.reduce((total, day) => {
            const hours = delifoodHoursData[employeeName]?.[day.toString()]?.hours || 0;
            return total + hours;
          }, 0);
          workedDaysInPeriod = daysToShow.filter((day) => {
            const hours = delifoodHoursData[employeeName]?.[day.toString()]?.hours || 0;
            return hours > 0;
          }).length;
        } else {
          const hoursPerDay = employee?.hoursPerShift ?? 8;
          daysToShow.forEach((day) => {
            const shift = shiftsByDay?.[day.toString()] || "";
            if (shift === "N" || shift === "D") {
              workedDaysInPeriod++;
              totalHours += hoursPerDay;
            }
          });
        }

        const ccssType = employee?.ccssType || "MT";
        const extraAmount = employee?.extraAmount || 0;

        let grossSalary = 0;
        let ccssDeduction = 0;
        let netSalary = 0;

        if (totalHours > 0) {
          const companyConfig = ccssConfig?.companie?.find(
            (comp) => comp.ownerCompanie === empresaName,
          );
          const hourlyRate = companyConfig?.horabruta || 1529.62;
          grossSalary = totalHours * hourlyRate;
          const ccssAmount =
            ccssType === "TC"
              ? companyConfig?.tc || 11017.39
              : companyConfig?.mt || 3672.46;
          ccssDeduction = ccssAmount;
          netSalary = grossSalary - ccssDeduction + extraAmount;
        } else {
          netSalary = extraAmount;
        }

        setSummary({
          workedDays: workedDaysInPeriod,
          hours: totalHours,
          colones: grossSalary,
          ccss: ccssDeduction,
          neto: netSalary,
          extraAmount: extraAmount,
        });
      } catch (error) {
        console.error("Error fetching employee summary:", error);
        setSummary({
          workedDays: 0,
          hours: 0,
          colones: 0,
          ccss: 0,
          neto: 0,
          extraAmount: 0,
        });
      }
    };

    fetchSummary();
  }, [
    employeeName,
    empresaValue,
    empresaLabel,
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
        <b>{isDelifoodEmpresa ? "Días con horas:" : "Días trabajados:"}</b>{" "}
        {summary.workedDays}
      </div>
      <div>
        <b>Horas trabajadas:</b> {summary.hours}
      </div>
      <div>
        <b>Total bruto:</b> ₡{summary.colones.toLocaleString("es-CR")}
      </div>
      <div>
        <b>CCSS:</b> -₡
        {summary.ccss.toLocaleString("es-CR", { minimumFractionDigits: 2 })}
      </div>
      {summary.extraAmount > 0 && (
        <div>
          <b>Monto extra:</b> +₡
          {summary.extraAmount.toLocaleString("es-CR", {
            minimumFractionDigits: 2,
          })}
        </div>
      )}
      <div>
        <b>Salario neto:</b> ₡
        {summary.neto.toLocaleString("es-CR", { minimumFractionDigits: 2 })}
      </div>
    </>
  );
}
