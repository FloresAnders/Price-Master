// src/components/EmployeeSummaryCalculator.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Clock, DollarSign, CalendarDays, TrendingUp, Minus } from 'lucide-react';
import { CcssConfigService } from '../../services/ccss-config';
import { SchedulesService, ScheduleEntry } from '../../services/schedules';
import { EmpresasService } from '../../services/empresas';
import { useAuth } from '../../hooks/useAuth';

interface EmployeeData {
  name: string;
  hoursPerShift: number;
  extraAmount: number;
  ccssType: 'TC' | 'MT';
}

export interface EmployeeSummary {
  workedDays: number;
  hours: number;
  colones: number;
  ccss: number;
  neto: number;
}

interface EmployeeSummaryCalculatorProps {
  employeeName: string;
  locationValue: string;
  year: number;
  month: number;
  daysToShow: number[];
  className?: string;
  showFullDetails?: boolean;
}

interface ScheduleData {
  [employeeName: string]: {
    [day: string]: string;
  };
}

// Hook para obtener datos desde la base de datos
export function useEmployeeData(
  employeeName: string,
  locationValue: string,
  year: number,
  month: number,
  daysToShow: number[],
  employee?: EmployeeData,
  user?: any
) {
  const [scheduleData, setScheduleData] = useState<ScheduleData>({});
  const [ccssConfig, setCcssConfig] = useState({ mt: 3672.46, tc: 11017.39 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Obtener información de la empresa
        const empresas = await EmpresasService.getAllEmpresas();
        const currentEmpresa = empresas.find(e => 
          e.ubicacion === locationValue || e.name === locationValue || e.id === locationValue
        );
        const empresaName = currentEmpresa?.name || locationValue;

        console.log('🔍 CCSS Matching Debug:', {
          locationValue,
          currentEmpresa: currentEmpresa ? { name: currentEmpresa.name, ubicacion: currentEmpresa.ubicacion } : null,
          empresaName
        });

        // Obtener configuración de CCSS
        const userOwnerId = user?.ownerId || user?.id || '';
        const config = await CcssConfigService.getCcssConfig(userOwnerId);
        
        console.log('📋 CCSS Config available:', {
          configExists: !!config,
          companieCount: config?.companie?.length || 0,
          companieList: config?.companie?.map(comp => comp.ownerCompanie) || []
        });
        
        // Buscar la configuración específica para esta empresa por nombre
        const companyConfig = config?.companie?.find(comp => comp.ownerCompanie === empresaName);
        
        console.log('✅ CCSS Match Result:', {
          empresaName,
          companyConfig: companyConfig ? { ownerCompanie: companyConfig.ownerCompanie, mt: companyConfig.mt, tc: companyConfig.tc } : null,
          matched: !!companyConfig
        });

        setCcssConfig({ 
          mt: companyConfig?.mt || 3672.46, 
          tc: companyConfig?.tc || 11017.39 
        });

        // Obtener horarios del empleado para el mes específico
        const schedules = await SchedulesService.getSchedulesByLocationEmployeeMonth(
          locationValue,
          employeeName,
          year,
          month
        );

        // Convertir a formato esperado por el componente
        const formattedSchedules: ScheduleData = {};
        formattedSchedules[employeeName] = {};

        schedules.forEach((schedule: ScheduleEntry) => {
          formattedSchedules[employeeName][schedule.day.toString()] = schedule.shift;
        });

        setScheduleData(formattedSchedules);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading employee data');
        console.error('Error fetching employee data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (employeeName && locationValue && year && month) {
      fetchData();
    }
  }, [employeeName, locationValue, year, month, user?.id, user?.ownerId]);

  const calculateEmployeeSummary = (): EmployeeSummary => {
    const hoursPerShift = employee?.hoursPerShift || 8;
    const ccssType = employee?.ccssType || 'MT';
    const extraAmount = employee?.extraAmount || 0;

    const shifts = daysToShow.map((day: number) => scheduleData[employeeName]?.[day.toString()] || '');
    const workedDays = shifts.filter((s: string) => s === 'N' || s === 'D').length;
    const hours = workedDays * hoursPerShift;

    // Calcular tarifa por hora basada en el tipo de CCSS - usar valores del estado local
    const ccssAmount = ccssType === 'TC' ? ccssConfig.tc : ccssConfig.mt;
    const totalColones = ccssAmount + extraAmount;
    const hourlyRate = totalColones / (22 * hoursPerShift); // Asumiendo 22 días laborales promedio

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

  return {
    scheduleData,
    ccssConfig,
    loading,
    error,
    calculateEmployeeSummary,
    hourlyRate: employee ? (employee.ccssType === 'TC' ? ccssConfig.tc : ccssConfig.mt) / (22 * (employee.hoursPerShift || 8)) : 1529.62
  };
}

// Hook para obtener información del empleado desde la ubicación
export function useEmployeeInfo(employeeName: string, locationValue: string) {
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployeeInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        const empresas = await EmpresasService.getAllEmpresas();
        const empresa = empresas.find(emp => emp.name.toLowerCase() === locationValue.toLowerCase());

        if (empresa && empresa.empleados) {
          const foundEmployee = empresa.empleados.find(emp => emp.Empleado === employeeName);
          setEmployee(foundEmployee ? { name: foundEmployee.Empleado, hoursPerShift: foundEmployee.hoursPerShift, extraAmount: foundEmployee.extraAmount, ccssType: foundEmployee.ccssType } : null);
        } else {
          setEmployee(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading employee info');
        console.error('Error fetching employee info:', err);
        setEmployee(null);
      } finally {
        setLoading(false);
      }
    };

    if (employeeName && locationValue) {
      fetchEmployeeInfo();
    }
  }, [employeeName, locationValue]);

  return { employee, loading, error };
}

// Componente para mostrar el resumen visual
export default function EmployeeSummaryCalculator({
  employeeName,
  locationValue,
  year,
  month,
  daysToShow,
  className = '',
  showFullDetails = true
}: EmployeeSummaryCalculatorProps) {
  const { user } = useAuth();
  
  // Obtener información del empleado desde la ubicación
  const { employee, loading: employeeLoading, error: employeeError } = useEmployeeInfo(employeeName, locationValue);

  // Obtener datos de horarios y CCSS
  const {
    scheduleData, // eslint-disable-line @typescript-eslint/no-unused-vars
    ccssConfig, // eslint-disable-line @typescript-eslint/no-unused-vars
    loading: dataLoading,
    error: dataError,
    calculateEmployeeSummary,
    hourlyRate
  } = useEmployeeData(employeeName, locationValue, year, month, daysToShow, employee || undefined, user);

  const loading = employeeLoading || dataLoading;
  const error = employeeError || dataError;
  const summary = calculateEmployeeSummary();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: 'CRC',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-sm text-[var(--muted-foreground)]">Cargando datos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-700 ${className}`}>
        <p className="text-sm text-red-600 dark:text-red-400">Error: {error}</p>
      </div>
    );
  }

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
      </div>      {/* Información adicional */}
      <div className="text-xs text-[var(--muted-foreground)] space-y-1">
        <div className="flex justify-between">
          <span>Tarifa por hora:</span>
          <span>{formatCurrency(hourlyRate)}</span>
        </div>
        <div className="flex justify-between">
          <span>Horas por turno:</span>
          <span>{employee?.hoursPerShift || 8} horas</span>
        </div>
        <div className="flex justify-between">
          <span>Tipo CCSS:</span>
          <span className={`font-medium ${employee?.ccssType === 'TC' ? 'text-blue-600' : 'text-green-600'}`}>
            {employee?.ccssType === 'TC' ? 'Tiempo Completo' : 'Medio Tiempo'}
          </span>
        </div>
        {employee?.extraAmount && employee.extraAmount > 0 && (
          <div className="flex justify-between">
            <span>Monto extra:</span>
            <span className="text-green-600">{formatCurrency(employee.extraAmount)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Utilidad de cálculo simple para uso directo con datos de la base de datos
export async function calculateEmployeeSummaryFromDB(
  employeeName: string,
  locationValue: string,
  year: number,
  month: number,
  daysToShow: number[],
  employee?: EmployeeData,
  user?: any
): Promise<EmployeeSummary> {
  try {
    // Obtener configuración de CCSS
    const userOwnerId = user?.ownerId || user?.id || '';
    const ccssConfig = await CcssConfigService.getCcssConfig(userOwnerId, locationValue);

    // Obtener horarios del empleado
    const schedules = await SchedulesService.getSchedulesByLocationEmployeeMonth(
      locationValue,
      employeeName,
      year,
      month
    );

    // Convertir a formato de turnos
    const scheduleData: { [day: string]: string } = {};
    schedules.forEach((schedule: ScheduleEntry) => {
      scheduleData[schedule.day.toString()] = schedule.shift;
    });

    const hoursPerShift = employee?.hoursPerShift || 8;
    const ccssType = employee?.ccssType || 'MT';
    const extraAmount = employee?.extraAmount || 0;

    const shifts = daysToShow.map((day: number) => scheduleData[day.toString()] || '');
    const workedDays = shifts.filter((s: string) => s === 'N' || s === 'D').length;
    const hours = workedDays * hoursPerShift;

    // Buscar la configuración específica para esta empresa
    const companyConfig = ccssConfig?.companie?.find(comp => comp.ownerCompanie === locationValue);
    
    // Calcular tarifa por hora basada en el tipo de CCSS
    const ccssAmount = ccssType === 'TC' ? (companyConfig?.tc || 11017.39) : (companyConfig?.mt || 3672.46);
    const totalColones = ccssAmount + extraAmount;
    const hourlyRate = totalColones / (22 * hoursPerShift); // Asumiendo 22 días laborales promedio

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
  } catch (error) {
    console.error('Error calculating employee summary from DB:', error);
    throw error;
  }
}
