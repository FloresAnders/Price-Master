// src/components/PayrollExporter.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, Calculator, DollarSign } from 'lucide-react';
import { LocationsService } from '../services/locations';
import { SchedulesService, ScheduleEntry } from '../services/schedules';
import { Location } from '../types/firestore';

interface BiweeklyPeriod {
  start: Date;
  end: Date;
  label: string;
  year: number;
  month: number;
  period: 'first' | 'second';
}

interface EmployeePayrollData {
  employeeName: string;
  ccssType: 'TC' | 'MT';
  days: { [day: number]: string };
  regularHours: number;
  overtimeHours: number;
  totalWorkDays: number;
  hoursPerDay: number;
  totalHours: number;
  regularSalary: number;
  overtimeSalary: number;
  extraAmount: number;
  totalIncome: number;
  ccssDeduction: number;
  comprasDeduction: number;
  adelantoDeduction: number;
  otrosDeduction: number;
  totalDeductions: number;
  netSalary: number;
}

interface EditableDeductions {
  [employeeKey: string]: {
    compras: number;
    adelanto: number;
    otros: number;
    otrosIncome: number; // Para el monto "Otros" de ingresos
    extraAmount: number; // Para el monto extra editable
  };
}

interface LocationPayrollData {
  location: Location;
  employees: EmployeePayrollData[];
}

interface PayrollExporterProps {
  currentPeriod: BiweeklyPeriod | null;
  selectedLocation?: string;
  onLocationChange?: (location: string) => void;
}

export default function PayrollExporter({ 
  currentPeriod, 
  selectedLocation = 'all', 
  onLocationChange 
}: PayrollExporterProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [payrollData, setPayrollData] = useState<LocationPayrollData[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);const [editableDeductions, setEditableDeductions] = useState<EditableDeductions>({});

  // Constantes de salario
  const REGULAR_HOURLY_RATE = 1529.62;
  const OVERTIME_HOURLY_RATE = 2294.43;
  const CCSS_TC = 11017.39;
  const CCSS_MT = 3672.46;
  // Función para mostrar notificación
  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Función para crear clave única del empleado
  const getEmployeeKey = (locationValue: string, employeeName: string): string => {
    return `${locationValue}-${employeeName}`;
  };  // Función para actualizar deducciones editables con debounce optimizado
  const updateDeduction = useCallback((locationValue: string, employeeName: string, type: 'compras' | 'adelanto' | 'otros' | 'otrosIncome' | 'extraAmount', value: number) => {
    const employeeKey = getEmployeeKey(locationValue, employeeName);
    const defaults = { compras: 0, adelanto: 0, otros: 0, otrosIncome: 0, extraAmount: 0 };

    setEditableDeductions(prev => ({
      ...prev,
      [employeeKey]: {
        ...defaults,
        ...prev[employeeKey], // Spread existing values
        [type]: value // Override with new value
      }
    }));
  }, []);  // Función para obtener deducciones editables de un empleado
  const getEmployeeDeductions = useCallback((locationValue: string, employeeName: string) => {
    const employeeKey = getEmployeeKey(locationValue, employeeName);
    const defaults = { compras: 0, adelanto: 0, otros: 0, otrosIncome: 0, extraAmount: 0 };
    const existing = editableDeductions[employeeKey];

    if (!existing) {
      return defaults;
    }

    // Ensure all properties exist with defaults
    return {
      compras: existing.compras ?? defaults.compras,
      adelanto: existing.adelanto ?? defaults.adelanto,
      otros: existing.otros ?? defaults.otros,
      otrosIncome: existing.otrosIncome ?? defaults.otrosIncome,
      extraAmount: existing.extraAmount ?? defaults.extraAmount
    };
  }, [editableDeductions]);
  // Calcular datos de planilla para un empleado
  const calculatePayrollData = useCallback((
    employeeName: string,
    days: { [day: number]: string },
    ccssType: 'TC' | 'MT',
    locationValue: string,
    extraAmount: number = 0
  ): EmployeePayrollData => {
    const workShifts = Object.values(days).filter(shift => shift === 'D' || shift === 'N');
    const totalWorkDays = workShifts.length;

    // Asumir 8 horas por día trabajado
    const hoursPerDay = 8;
    const totalHours = totalWorkDays * hoursPerDay;

    // Calcular horas regulares y extraordinarias
    const regularHours = totalHours; // Todas las horas básicas
    const overtimeHours = 0; // Por ahora 0, se puede ajustar según reglas de negocio

    // Calcular salarios según el formato solicitado
    const regularSalary = REGULAR_HOURLY_RATE; // 1529.62
    const overtimeSalary = OVERTIME_HOURLY_RATE; // 2294.43
    // Calcular totales por tipo (T/S = S/H * T/H)
    const regularTotal = regularSalary * totalHours;
    const overtimeTotal = overtimeSalary * overtimeHours;    // Obtener deducciones editables para usar el valor de "Otros" ingresos
    const deductions = getEmployeeDeductions(locationValue, employeeName);
    
    // Usar el monto extra editable en lugar del valor fijo del empleado
    const editableExtraAmount = deductions.extraAmount > 0 ? deductions.extraAmount : extraAmount;
    
    // Total de ingresos: suma de todos los T/S + monto extra editable
    const totalIncome = regularTotal + overtimeTotal + editableExtraAmount;

    // Deducciones
    const ccssDeduction = ccssType === 'TC' ? CCSS_TC : CCSS_MT;
    const comprasDeduction = deductions.compras;
    const adelantoDeduction = deductions.adelanto;
    const otrosDeduction = deductions.otros;

    const totalDeductions = ccssDeduction + comprasDeduction + adelantoDeduction + otrosDeduction;
    const netSalary = totalIncome - totalDeductions;    return {
      employeeName,
      ccssType,
      days,
      regularHours,
      overtimeHours,
      totalWorkDays,
      hoursPerDay,
      totalHours,
      regularSalary,
      overtimeSalary,
      extraAmount: editableExtraAmount,
      totalIncome,
      ccssDeduction,
      comprasDeduction,
      adelantoDeduction,
      otrosDeduction,
      totalDeductions,
      netSalary
    };
  }, [getEmployeeDeductions]);
  // Cargar ubicaciones
  useEffect(() => {
    const loadLocations = async () => {
      try {
        const locationsData = await LocationsService.getAllLocations();
        setLocations(locationsData);
      } catch (error) {
        console.error('Error loading locations:', error);
      }
    };
    loadLocations();
  }, []);

  // Cargar datos de planilla cuando cambie el período o ubicación
  useEffect(() => {
    const loadPayrollData = async () => {
      if (!currentPeriod) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const allSchedules = await SchedulesService.getAllSchedules();

        // Filtrar por período actual
        const periodSchedules = allSchedules.filter(schedule => {
          const matchesPeriod = schedule.year === currentPeriod.year &&
            schedule.month === currentPeriod.month;

          if (!matchesPeriod) return false;

          if (currentPeriod.period === 'first') {
            return schedule.day >= 1 && schedule.day <= 15;
          } else {
            return schedule.day >= 16;
          }
        });

        // Agrupar por ubicación
        const locationGroups = new Map<string, ScheduleEntry[]>();

        periodSchedules.forEach(schedule => {
          if (!locationGroups.has(schedule.locationValue)) {
            locationGroups.set(schedule.locationValue, []);
          }
          locationGroups.get(schedule.locationValue)!.push(schedule);
        });

        const payrollDataArray: LocationPayrollData[] = [];

        const locationsToProcess = selectedLocation === 'all' ?
          locations :
          locations.filter(loc => loc.value === selectedLocation);

        locationsToProcess.forEach(location => {
          const locationSchedules = locationGroups.get(location.value) || [];

          // Agrupar por empleado
          const employeeGroups = new Map<string, ScheduleEntry[]>();
          locationSchedules.forEach(schedule => {
            if (!employeeGroups.has(schedule.employeeName)) {
              employeeGroups.set(schedule.employeeName, []);
            }
            employeeGroups.get(schedule.employeeName)!.push(schedule);
          });

          const employees: EmployeePayrollData[] = []; employeeGroups.forEach((schedules, employeeName) => {
            const days: { [day: number]: string } = {};

            schedules.forEach(schedule => {
              if (schedule.shift && schedule.shift.trim() !== '') {
                days[schedule.day] = schedule.shift;
              }
            });            if (Object.keys(days).length > 0) {
              // Buscar el empleado para obtener tipo de CCSS y monto extra
              const employee = location.employees?.find(emp => emp.name === employeeName);
              const ccssType = employee?.ccssType || 'TC'; // Por defecto TC
              const baseExtraAmount = employee?.extraAmount || 0; // Monto extra base, por defecto 0

              const payrollData = calculatePayrollData(employeeName, days, ccssType, location.value, baseExtraAmount);

              // Solo agregar empleados que tienen días trabajados (totalWorkDays > 0)
              if (payrollData.totalWorkDays > 0) {
                employees.push(payrollData);
              }
            }
          });

          if (employees.length > 0) {
            payrollDataArray.push({
              location,
              employees
            });
          }
        }); setPayrollData(payrollDataArray);
      } catch (error) {
        console.error('Error loading payroll data:', error);
        showNotification('Error al cargar los datos de planilla', 'error');
      } finally {
        setLoading(false);
      }
    };    if (currentPeriod && locations.length > 0) {
      loadPayrollData();
    }
  }, [currentPeriod, selectedLocation, locations]); // Removido calculatePayrollData de las dependencias

  // Memorizar cálculos de planilla para evitar recálculos innecesarios
  const memoizedPayrollCalculations = useMemo(() => {
    return payrollData.map(locationData => ({
      ...locationData,
      employees: locationData.employees.map(employee => {
        const deductions = getEmployeeDeductions(locationData.location.value, employee.employeeName);
        const regularTotal = employee.regularSalary * employee.totalHours;
        const overtimeTotal = employee.overtimeSalary * 0;
        const finalExtraAmount = deductions.extraAmount > 0 ? deductions.extraAmount : employee.extraAmount;
        const totalIncome = regularTotal + overtimeTotal + finalExtraAmount;
        const ccssAmount = employee.ccssType === 'TC' ? CCSS_TC : CCSS_MT;
        const totalDeductions = ccssAmount + deductions.compras + deductions.adelanto + deductions.otros;
        const finalNetSalary = totalIncome - totalDeductions;

        return {
          ...employee,
          deductions,
          regularTotal,
          overtimeTotal,
          finalExtraAmount,
          totalIncome,
          ccssAmount,
          totalDeductions,
          finalNetSalary
        };
      })
    }));
  }, [payrollData, editableDeductions, getEmployeeDeductions]);

  const exportPayroll = () => {
    if (!currentPeriod || memoizedPayrollCalculations.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    const periodDates = `${currentPeriod.start.getDate()}-${currentPeriod.end.getDate()}`;

    memoizedPayrollCalculations.forEach(locationData => {
      csvContent += `\nUBICACION: ${locationData.location.label}\n`;
      locationData.employees.forEach(employee => {        // Usar los valores precalculados del memoized data
        const {
          deductions,
          regularTotal,
          finalExtraAmount,
          totalIncome,
          ccssAmount,
          totalDeductions,
          finalNetSalary
        } = employee;

        // Encabezados con employee name y period en las columnas correctas (como en la tabla)
        csvContent += `"${employee.employeeName}","MES:","MesActual","Quincena:","${periodDates}",\n`;
        csvContent += ",DiasLaborados,H/D,H/T,S/H,T/S\n";

        // Fila de HorasOrdinarias
        csvContent += `"HorasOrdinarias","${employee.totalWorkDays}","${employee.hoursPerDay}","${employee.totalHours}","${employee.regularSalary.toFixed(2)}","${regularTotal.toFixed(2)}"\n`;

        // Fila de HorasExtras
        csvContent += `"HorasExtras","","","","${employee.overtimeSalary.toFixed(2)}",""\n`;

        // Fila de Monto Extra
        csvContent += `"Monto Extra","","","","","${finalExtraAmount.toFixed(2)}"\n`;

        // Separador y filas de totales
        csvContent += `"","","","","IngresosTotales","${totalIncome.toFixed(2)}"\n`;
        csvContent += `"","","","","",\n`;
        csvContent += `"","","","","CCSS","${ccssAmount.toFixed(2)} (${employee.ccssType})"\n`;
        csvContent += `"","","","","COMPRAS","${deductions.compras.toFixed(2)}"\n`;
        csvContent += `"","","","","ADELANTO","${deductions.adelanto.toFixed(2)}"\n`;
        csvContent += `"","","","","OTROS","${deductions.otros.toFixed(2)}"\n`;
        csvContent += `"","","","","DEDUCCIONESTOTALES","${totalDeductions.toFixed(2)}"\n`;
        csvContent += `"","","","","SALARIO NETO","${finalNetSalary.toFixed(2)}"\n`;
        csvContent += "\n";
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `planilla-${currentPeriod.year}-${currentPeriod.month}-${currentPeriod.period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link); showNotification('📊 Planilla de pago exportada exitosamente', 'success');
  };

  if (loading) {
    return (
      <div className="max-w-full mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div className="text-lg text-[var(--foreground)]">Cargando planilla de pago...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-semibold animate-fade-in-down ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`}>
          <DollarSign className="w-5 h-5" />
          {notification.message}
        </div>
      )}

      {/* Header con controles */}
      <div className="mb-6 flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <Calculator className="w-8 h-8 text-green-600" />
          <div>
            <h3 className="text-xl font-semibold">Planilla de Pago</h3>
            <p className="text-sm text-[var(--tab-text)]">
              Cálculo de salarios por quincena
            </p>
          </div>
        </div>        <div className="flex items-center gap-4">
          {/* Selector de ubicación */}
          <select
            value={selectedLocation}
            onChange={(e) => onLocationChange?.(e.target.value)}
            className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: 'var(--foreground)',
            }}
          >
            <option value="all">Todas las ubicaciones</option>
            {locations.map(location => (
              <option key={location.value} value={location.value}>
                {location.label}
              </option>
            ))}
          </select>

          {/* Mostrar período actual - solo lectura */}
          <div className="px-3 py-2 rounded-md border text-sm text-gray-600 dark:text-gray-400"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: 'var(--foreground)',
            }}
          >
            {currentPeriod ? currentPeriod.label : 'Sin período seleccionado'}
          </div>

          {/* Botón de exportar */}
          <button
            onClick={exportPayroll}
            disabled={memoizedPayrollCalculations.length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md flex items-center gap-2 transition-colors"
            title="Exportar planilla de pago"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar Planilla</span>
          </button>
        </div>
      </div>

      {/* Contenido de planilla */}
      <div className="space-y-6">
        {memoizedPayrollCalculations.map((locationData, locationIndex) => (
          <div key={locationIndex} className="border border-[var(--input-border)] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                {locationData.location.label}
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--tab-text)]">
                  {locationData.employees.length} empleado{locationData.employees.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {locationData.employees.length === 0 ? (
              <div className="text-center py-8 text-[var(--tab-text)]">
                <Calculator className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No hay datos de planilla para este período</p>
              </div>              ) : (<div className="space-y-6">                {locationData.employees.map((employee, empIndex) => {
                // Usar los valores precalculados
                const {
                  deductions,
                  regularTotal,
                  overtimeTotal,
                  finalExtraAmount,
                  totalIncome,
                  ccssAmount,
                  totalDeductions,
                  finalNetSalary
                } = employee;

                return (
                  <div key={empIndex} className="overflow-x-auto">
                    <table className="w-full border-collapse border border-[var(--input-border)]">
                      <thead>
                        <tr>
                          <th className="border border-[var(--input-border)] p-2 font-semibold text-center bg-[var(--input-bg)]">
                            {employee.employeeName}
                          </th>
                          <th className="border border-[var(--input-border)] p-2 font-semibold text-center bg-[var(--input-bg)]">
                            MES:
                          </th>
                          <th className="border border-[var(--input-border)] p-2 font-semibold text-center bg-[var(--input-bg)]">
                            MesActual
                          </th>
                          <th className="border border-[var(--input-border)] p-2 font-semibold text-center bg-[var(--input-bg)]">
                            Quincena:
                          </th>
                          <th className="border border-[var(--input-border)] p-2 font-semibold text-center bg-[var(--input-bg)]">
                            {currentPeriod ? `${currentPeriod.start.getDate()}-${currentPeriod.end.getDate()}` : 'NumeroQuincenaActual'}
                          </th>
                          <th className="border border-[var(--input-border)] p-2 font-semibold text-center bg-[var(--input-bg)]">

                          </th>
                        </tr>
                        <tr>
                          <th className="border border-[var(--input-border)] p-2 text-xs bg-gray-50 dark:bg-gray-800"></th>
                          <th className="border border-[var(--input-border)] p-2 text-xs bg-gray-50 dark:bg-gray-800">
                            DiasLaborados
                          </th>
                          <th className="border border-[var(--input-border)] p-2 text-xs bg-gray-50 dark:bg-gray-800">
                            H/D
                          </th>
                          <th className="border border-[var(--input-border)] p-2 text-xs bg-gray-50 dark:bg-gray-800">
                            H/T
                          </th>
                          <th className="border border-[var(--input-border)] p-2 text-xs bg-gray-50 dark:bg-gray-800">
                            S/H
                          </th>
                          <th className="border border-[var(--input-border)] p-2 text-xs bg-gray-50 dark:bg-gray-800">
                            T/S
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Fila de HorasOrdinarias */}
                        <tr className="bg-blue-50 dark:bg-blue-900/20">
                          <td className="border border-[var(--input-border)] p-2 font-medium">
                            HorasOrdinarias
                          </td>
                          <td className="border border-[var(--input-border)] p-2 text-center">
                            {employee.totalWorkDays}
                          </td>
                          <td className="border border-[var(--input-border)] p-2 text-center">
                            {employee.hoursPerDay}
                          </td>
                          <td className="border border-[var(--input-border)] p-2 text-center">
                            {employee.totalHours}
                          </td>
                          <td className="border border-[var(--input-border)] p-2 text-center">
                            {employee.regularSalary.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="border border-[var(--input-border)] p-2 text-center font-semibold">
                            {regularTotal.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        {/* Fila de HorasExtras */}
                        <tr className="bg-orange-50 dark:bg-orange-900/20">
                          <td className="border border-[var(--input-border)] p-2 font-medium">
                            HorasExtras
                          </td>
                          <td className="border border-[var(--input-border)] p-2 text-center">
                          </td>
                          <td className="border border-[var(--input-border)] p-2 text-center">
                          </td>
                          <td className="border border-[var(--input-border)] p-2 text-center">
                          </td>
                          <td className="border border-[var(--input-border)] p-2 text-center">
                            {employee.overtimeSalary.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="border border-[var(--input-border)] p-2 text-center font-semibold">
                          </td>
                        </tr>
                        {/* Fila de Monto Extra */}
                        <tr className="bg-green-50 dark:bg-green-900/20">
                          <td className="border border-[var(--input-border)] p-2 font-medium">
                            Monto Extra
                          </td>
                          <td className="border border-[var(--input-border)] p-2 text-center"></td>
                          <td className="border border-[var(--input-border)] p-2 text-center"></td>
                          <td className="border border-[var(--input-border)] p-2 text-center"></td>
                          <td className="border border-[var(--input-border)] p-2 text-center"></td>
                          <td className="border border-[var(--input-border)] p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={deductions.extraAmount > 0 ? deductions.extraAmount : (employee.extraAmount > 0 ? employee.extraAmount : '')}
                              onChange={(e) => updateDeduction(locationData.location.value, employee.employeeName, 'extraAmount', parseFloat(e.target.value) || 0)}
                              className="w-full text-center border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 font-semibold"
                              style={{
                                background: 'var(--input-bg)',
                                color: 'var(--foreground)',
                              }}
                              placeholder="0.00"
                            />
                          </td>
                        </tr>
                        {/* Separador vacío */}
                        <tr>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2 font-bold text-center">
                            IngresosTotales
                          </td>
                          <td className="border border-[var(--input-border)] p-2 text-center font-bold">
                            {totalIncome.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        {/* Separador vacío */}
                        <tr>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                        </tr>
                        {/* CCSS */}
                        <tr>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2 font-medium">CCSS</td>
                          <td className="border border-[var(--input-border)] p-2 text-center">
                            <span className="font-semibold">
                              ₡{ccssAmount.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              ({employee.ccssType === 'TC' ? 'TC' : 'MT'})
                            </span>
                          </td>
                        </tr>
                        {/* COMPRAS - Editable */}
                        <tr>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2 font-medium">COMPRAS</td>
                          <td className="border border-[var(--input-border)] p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={deductions.compras > 0 ? deductions.compras : ''}
                              onChange={(e) => updateDeduction(locationData.location.value, employee.employeeName, 'compras', parseFloat(e.target.value) || 0)}
                              className="w-full text-center border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1"
                              style={{
                                background: 'var(--input-bg)',
                                color: 'var(--foreground)',
                              }}
                              placeholder="0.00"
                            />
                          </td>
                        </tr>
                        {/* ADELANTO - Editable */}
                        <tr>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2 font-medium">ADELANTO</td>
                          <td className="border border-[var(--input-border)] p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={deductions.adelanto > 0 ? deductions.adelanto : ''}
                              onChange={(e) => updateDeduction(locationData.location.value, employee.employeeName, 'adelanto', parseFloat(e.target.value) || 0)}
                              className="w-full text-center border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1"
                              style={{
                                background: 'var(--input-bg)',
                                color: 'var(--foreground)',
                              }}
                              placeholder="0.00"
                            />
                          </td>
                        </tr>
                        {/* OTROS deducciones - Editable */}
                        <tr>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2 font-medium">OTROS</td>
                          <td className="border border-[var(--input-border)] p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={deductions.otros > 0 ? deductions.otros : ''}
                              onChange={(e) => updateDeduction(locationData.location.value, employee.employeeName, 'otros', parseFloat(e.target.value) || 0)}
                              className="w-full text-center border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1"
                              style={{
                                background: 'var(--input-bg)',
                                color: 'var(--foreground)',
                              }}
                              placeholder="0.00"
                            />
                          </td>
                        </tr>
                        {/* DEDUCCIONESTOTALES */}
                        <tr className="bg-red-100 dark:bg-red-900/30">
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2 font-bold">DEDUCCIONESTOTALES</td>
                          <td className="border border-[var(--input-border)] p-2 text-center font-bold">
                            ₡{totalDeductions.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                        {/* SALARIO NETO */}
                        <tr className="bg-yellow-200 dark:bg-yellow-800">
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2 font-bold">SALARIO NETO</td>
                          <td className="border border-[var(--input-border)] p-2 text-center font-bold text-lg">
                            ₡{finalNetSalary.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        ))}
      </div>

      {memoizedPayrollCalculations.length === 0 && (
        <div className="text-center py-12">
          <Calculator className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
            No hay datos de planilla
          </h3>
          <p className="text-[var(--tab-text)]">
            No se encontraron horarios para este período y ubicación.
          </p>
        </div>
      )}
    </div>
  );
}
