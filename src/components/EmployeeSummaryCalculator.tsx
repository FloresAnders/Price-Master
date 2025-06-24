// src/components/EmployeeSummaryCalculator.tsx
'use client';

import React from 'react';
import { Clock, DollarSign, CalendarDays, TrendingUp, Minus } from 'lucide-react';

export interface EmployeeSummary {
  workedDays: number;
  hours: number;
  colones: number;
  ccss: number;
  neto: number;
}

interface EmployeeSummaryCalculatorProps {
  employeeName: string;
  scheduleData: { [employeeName: string]: { [day: string]: string } };
  daysToShow: number[];
  hourlyRate?: number; // Por defecto 1529.62
  ccssAmount?: number; // Por defecto 3672.42
  className?: string;
  showFullDetails?: boolean;
}

interface ScheduleData {
  [employeeName: string]: {
    [day: string]: string;
  };
}

// Hook personalizado para el cálculo
export function useEmployeeSummaryCalculator(
  scheduleData: ScheduleData,
  hourlyRate: number = 1529.62,
  ccssAmount: number = 3672.42
) {
  const calculateEmployeeSummary = (name: string, daysToShow: number[]): EmployeeSummary => {
    const shifts = daysToShow.map((day: number) => scheduleData[name]?.[day.toString()] || '');
    const workedDays = shifts.filter((s: string) => s === 'N' || s === 'D').length;
    const hours = workedDays * 8;
    const colones = hours * hourlyRate;
    const ccss = ccssAmount;
    const neto = colones - ccss;
    
    return {
      workedDays,
      hours,
      colones,
      ccss,
      neto
    };
  };

  return { calculateEmployeeSummary };
}

// Componente para mostrar el resumen visual
export default function EmployeeSummaryCalculator({
  employeeName,
  scheduleData,
  daysToShow,
  hourlyRate = 1529.62,
  ccssAmount = 3672.42,
  className = '',
  showFullDetails = true
}: EmployeeSummaryCalculatorProps) {
  const { calculateEmployeeSummary } = useEmployeeSummaryCalculator(scheduleData, hourlyRate, ccssAmount);
  const summary = calculateEmployeeSummary(employeeName, daysToShow);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: 'CRC',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (!showFullDetails) {
    return (
      <div className={`text-xs text-[var(--tab-text)] ${className}`}>
        <div className="flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />
          <span>{summary.workedDays} días</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{summary.hours}h</span>
        </div>
        <div className="flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          <span className="font-medium text-green-600">
            {formatCurrency(summary.neto)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-blue-600" />
        Resumen - {employeeName}
      </h4>
      
      <div className="grid grid-cols-1 gap-2">
        {/* Días trabajados */}
        <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium">Días trabajados:</span>
          </div>
          <span className="font-bold text-blue-600">{summary.workedDays}</span>
        </div>

        {/* Horas trabajadas */}
        <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium">Horas trabajadas:</span>
          </div>
          <span className="font-bold text-green-600">{summary.hours}h</span>
        </div>

        {/* Salario bruto */}
        <div className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium">Salario bruto:</span>
          </div>
          <span className="font-bold text-yellow-600">
            {formatCurrency(summary.colones)}
          </span>
        </div>

        {/* CCSS */}
        <div className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded">
          <div className="flex items-center gap-2">
            <Minus className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium">CCSS:</span>
          </div>
          <span className="font-bold text-red-600">
            -{formatCurrency(summary.ccss)}
          </span>
        </div>

        {/* Salario neto */}
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-lg border-2 border-emerald-200 dark:border-emerald-700">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-bold">Salario neto:</span>
          </div>
          <span className="font-bold text-lg text-emerald-600">
            {formatCurrency(summary.neto)}
          </span>
        </div>
      </div>

      {/* Información adicional */}
      <div className="text-xs text-[var(--muted-foreground)] space-y-1">
        <div className="flex justify-between">
          <span>Tarifa por hora:</span>
          <span>{formatCurrency(hourlyRate)}</span>
        </div>
        <div className="flex justify-between">
          <span>Horas por día:</span>
          <span>8 horas</span>
        </div>
      </div>
    </div>
  );
}

// Utilidad de cálculo simple para uso directo
export function calculateEmployeeSummary(
  employeeName: string,
  scheduleData: ScheduleData,
  daysToShow: number[],
  hourlyRate: number = 1529.62,
  ccssAmount: number = 3672.42
): EmployeeSummary {
  const shifts = daysToShow.map((day: number) => scheduleData[employeeName]?.[day.toString()] || '');
  const workedDays = shifts.filter((s: string) => s === 'N' || s === 'D').length;
  const hours = workedDays * 8;
  const colones = hours * hourlyRate;
  const ccss = ccssAmount;
  const neto = colones - ccss;
  
  return {
    workedDays,
    hours,
    colones,
    ccss,
    neto
  };
}
