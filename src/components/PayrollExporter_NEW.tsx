// src/components/PayrollExporter.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, Calculator, DollarSign, ImageIcon } from 'lucide-react';
import html2canvas from 'html2canvas';
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
    otrosIncome: number;
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
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [editableDeductions, setEditableDeductions] = useState<EditableDeductions>({});

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
  };

  // Función para actualizar deducciones editables
  const updateDeduction = (locationValue: string, employeeName: string, type: 'compras' | 'adelanto' | 'otros' | 'otrosIncome', value: number) => {
    const employeeKey = getEmployeeKey(locationValue, employeeName);
    const defaults = { compras: 0, adelanto: 0, otros: 0, otrosIncome: 0 };

    setEditableDeductions(prev => ({
      ...prev,
      [employeeKey]: {
        ...defaults,
        ...prev[employeeKey],
        [type]: value
      }
    }));
  };

  // Función para obtener deducciones editables de un empleado
  const getEmployeeDeductions = useCallback((locationValue: string, employeeName: string) => {
    const employeeKey = getEmployeeKey(locationValue, employeeName);
    const defaults = { compras: 0, adelanto: 0, otros: 0, otrosIncome: 0 };
    const existing = editableDeductions[employeeKey];

    if (!existing) {
      return defaults;
    }

    return {
      compras: existing.compras ?? defaults.compras,
      adelanto: existing.adelanto ?? defaults.adelanto,
      otros: existing.otros ?? defaults.otros,
      otrosIncome: existing.otrosIncome ?? defaults.otrosIncome
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

    const hoursPerDay = 8;
    const totalHours = totalWorkDays * hoursPerDay;

    const regularHours = totalHours;
    const overtimeHours = 0;

    const regularSalary = REGULAR_HOURLY_RATE;
    const overtimeSalary = OVERTIME_HOURLY_RATE;
    const regularTotal = regularSalary * totalHours;
    const overtimeTotal = overtimeSalary * overtimeHours;

    const deductions = getEmployeeDeductions(locationValue, employeeName);
    const otrosTotal = deductions.otrosIncome;

    const totalIncome = regularTotal + overtimeTotal + otrosTotal + extraAmount;

    const ccssDeduction = ccssType === 'TC' ? CCSS_TC : CCSS_MT;
    const comprasDeduction = deductions.compras;
    const adelantoDeduction = deductions.adelanto;
    const otrosDeduction = deductions.otros;

    const totalDeductions = ccssDeduction + comprasDeduction + adelantoDeduction + otrosDeduction;
    const netSalary = totalIncome - totalDeductions;

    return {
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
      extraAmount,
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

          const employeeGroups = new Map<string, ScheduleEntry[]>();
          locationSchedules.forEach(schedule => {
            if (!employeeGroups.has(schedule.employeeName)) {
              employeeGroups.set(schedule.employeeName, []);
            }
            employeeGroups.get(schedule.employeeName)!.push(schedule);
          });

          const employees: EmployeePayrollData[] = [];

          employeeGroups.forEach((schedules, employeeName) => {
            const days: { [day: number]: string } = {};

            schedules.forEach(schedule => {
              if (schedule.shift && schedule.shift.trim() !== '') {
                days[schedule.day] = schedule.shift;
              }
            });

            if (Object.keys(days).length > 0) {
              const employee = location.employees?.find(emp => emp.name === employeeName);
              const ccssType = employee?.ccssType || 'TC';
              const extraAmount = employee?.extraAmount || 0;

              const payrollData = calculatePayrollData(employeeName, days, ccssType, location.value, extraAmount);

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
        });

        setPayrollData(payrollDataArray);
      } catch (error) {
        console.error('Error loading payroll data:', error);
        showNotification('Error al cargar los datos de planilla', 'error');
      } finally {
        setLoading(false);
      }
    };

    if (currentPeriod && locations.length > 0) {
      loadPayrollData();
    }
  }, [currentPeriod, selectedLocation, locations, calculatePayrollData]);

  const exportPayroll = () => {
    if (!currentPeriod || payrollData.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    const periodDates = `${currentPeriod.start.getDate()}-${currentPeriod.end.getDate()}`;

    payrollData.forEach(locationData => {
      csvContent += `\nUBICACION: ${locationData.location.label}\n`;
      locationData.employees.forEach(employee => {
        const deductions = getEmployeeDeductions(locationData.location.value, employee.employeeName);
        const regularTotal = employee.regularSalary * employee.totalHours;
        const overtimeTotal = 0;
        const otrosTotal = deductions.otrosIncome;
        const totalIncome = regularTotal + overtimeTotal + otrosTotal + employee.extraAmount;

        const ccssAmount = employee.ccssType === 'TC' ? CCSS_TC : CCSS_MT;
        const totalDeductions = ccssAmount + deductions.compras + deductions.adelanto + deductions.otros;
        const finalNetSalary = totalIncome - totalDeductions;

        csvContent += `"${employee.employeeName}","MES:","MesActual","Quincena:","${periodDates}",\n`;
        csvContent += ",DiasLaborados,H/D,H/T,S/H,T/S\n";
        csvContent += `"HorasOrdinarias","${employee.totalWorkDays}","${employee.hoursPerDay}","${employee.totalHours}","${employee.regularSalary.toFixed(2)}","${regularTotal.toFixed(2)}"\n`;
        csvContent += `"HorasExtras","","","","${employee.overtimeSalary.toFixed(2)}",""\n`;
        csvContent += `"Otros","","","","","${otrosTotal.toFixed(2)}"\n`;
        csvContent += `"Monto Extra","","","","","${employee.extraAmount.toFixed(2)}"\n`;
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
    document.body.removeChild(link);

    showNotification('📊 Planilla de pago exportada exitosamente', 'success');
  };

  // Función para exportar planillas individuales como imágenes PNG
  const exportIndividualImages = async () => {
    if (!currentPeriod || payrollData.length === 0) return;

    try {
      showNotification('⏳ Generando imágenes de planillas individuales...', 'success');
      
      for (const locationData of payrollData) {
        for (let empIndex = 0; empIndex < locationData.employees.length; empIndex++) {
          const employee = locationData.employees[empIndex];
          
          const employeeTable = document.querySelector(`[data-employee-table="${locationData.location.value}-${empIndex}"]`) as HTMLElement;
          
          if (employeeTable) {
            try {
              const canvas = await html2canvas(employeeTable, {
                allowTaint: true,
                useCORS: true,
                logging: false
              });

              canvas.toBlob((blob) => {
                if (blob) {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  
                  const cleanLocationName = locationData.location.label.replace(/[^a-zA-Z0-9]/g, '');
                  const cleanEmployeeName = employee.employeeName.replace(/[^a-zA-Z0-9]/g, '');
                  const periodLabel = currentPeriod.label.replace(/[^a-zA-Z0-9]/g, '');
                  
                  a.href = url;
                  a.download = `Planilla-${cleanLocationName}-${cleanEmployeeName}-${periodLabel}.png`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }
              }, 'image/png');

              await new Promise(resolve => setTimeout(resolve, 500));
              
            } catch (error) {
              console.error(`Error generating image for ${employee.employeeName}:`, error);
            }
          }
        }
      }
      
      const totalEmployees = payrollData.reduce((total, location) => total + location.employees.length, 0);
      showNotification(`📸 ${totalEmployees} planillas exportadas como imágenes PNG`, 'success');
      
    } catch (error) {
      console.error('Error exporting individual images:', error);
      showNotification('❌ Error al exportar imágenes individuales', 'error');
    }
  };

  // Función para exportar una planilla individual específica
  const exportSingleEmployeeImage = async (locationData: LocationPayrollData, employee: EmployeePayrollData, empIndex: number) => {
    if (!currentPeriod) return;

    try {
      showNotification('⏳ Generando imagen de planilla individual...', 'success');
      
      const employeeTable = document.querySelector(`[data-employee-table="${locationData.location.value}-${empIndex}"]`) as HTMLElement;
      
      if (employeeTable) {
        try {
          const canvas = await html2canvas(employeeTable, {
            allowTaint: true,
            useCORS: true,
            logging: false,
            width: employeeTable.scrollWidth,
            height: employeeTable.scrollHeight
          });

          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              
              const cleanLocationName = locationData.location.label.replace(/[^a-zA-Z0-9]/g, '');
              const cleanEmployeeName = employee.employeeName.replace(/[^a-zA-Z0-9]/g, '');
              const periodLabel = currentPeriod.label.replace(/[^a-zA-Z0-9]/g, '');
              
              a.href = url;
              a.download = `Planilla-${cleanLocationName}-${cleanEmployeeName}-${periodLabel}.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              
              showNotification(`📸 Planilla de ${employee.employeeName} exportada`, 'success');
            }
          }, 'image/png', 1.0);
          
        } catch (error) {
          console.error(`Error generating image for ${employee.employeeName}:`, error);
          showNotification('❌ Error al exportar la planilla', 'error');
        }
      }
    } catch (error) {
      console.error('Error exporting single employee image:', error);
      showNotification('❌ Error al exportar la planilla', 'error');
    }
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
        </div>

        <div className="flex items-center gap-4">
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

          {/* Botones de exportar */}
          <div className="flex items-center gap-2">
            <button
              onClick={exportPayroll}
              disabled={payrollData.length === 0}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md flex items-center gap-2 transition-colors"
              title="Exportar planilla de pago en CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            
            <button
              onClick={exportIndividualImages}
              disabled={payrollData.length === 0}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-md flex items-center gap-2 transition-colors"
              title="Exportar planillas individuales como imágenes PNG"
            >
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">PNG Individual</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenido de planilla */}
      <div className="space-y-6">
        {payrollData.map((locationData, locationIndex) => (
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
              </div>
            ) : (
              <div className="space-y-6">
                {locationData.employees.map((employee, empIndex) => {
                  const deductions = getEmployeeDeductions(locationData.location.value, employee.employeeName);
                  const regularTotal = employee.regularSalary * employee.totalHours;
                  const overtimeTotal = employee.overtimeSalary * 0;
                  const otrosTotal = deductions.otrosIncome;
                  const totalIncome = regularTotal + overtimeTotal + otrosTotal + employee.extraAmount;

                  const ccssAmount = employee.ccssType === 'TC' ? CCSS_TC : CCSS_MT;
                  const totalDeductions = ccssAmount + deductions.compras + deductions.adelanto + deductions.otros;
                  const finalNetSalary = totalIncome - totalDeductions;

                  return (
                    <div key={empIndex} className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-900 shadow-lg" data-employee-table={`${locationData.location.value}-${empIndex}`}>
                      {/* Header con nombre del empleado y botón de exportar */}
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                        <h5 className="font-semibold text-lg">{employee.employeeName}</h5>
                        <button
                          onClick={() => exportSingleEmployeeImage(locationData, employee, empIndex)}
                          className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-md flex items-center gap-2 transition-colors text-sm font-medium"
                          title={`Exportar planilla de ${employee.employeeName}`}
                        >
                          <ImageIcon className="w-4 h-4" />
                          Exportar PNG
                        </button>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700">
                              <th className="border border-gray-300 dark:border-gray-600 p-3 font-semibold text-center text-gray-700 dark:text-gray-200">
                                MES: {currentPeriod ? new Date(currentPeriod.start).toLocaleDateString('es-CR', { month: 'long', year: 'numeric' }) : 'Mes Actual'}
                              </th>
                              <th className="border border-gray-300 dark:border-gray-600 p-3 font-semibold text-center text-gray-700 dark:text-gray-200">
                                Quincena: {currentPeriod ? `${currentPeriod.start.getDate()}-${currentPeriod.end.getDate()}` : 'Actual'}
                              </th>
                              <th className="border border-gray-300 dark:border-gray-600 p-3 font-semibold text-center text-gray-700 dark:text-gray-200">
                                Días Laborados
                              </th>
                              <th className="border border-gray-300 dark:border-gray-600 p-3 font-semibold text-center text-gray-700 dark:text-gray-200">
                                H/D
                              </th>
                              <th className="border border-gray-300 dark:border-gray-600 p-3 font-semibold text-center text-gray-700 dark:text-gray-200">
                                H/T
                              </th>
                              <th className="border border-gray-300 dark:border-gray-600 p-3 font-semibold text-center text-gray-700 dark:text-gray-200">
                                S/H
                              </th>
                              <th className="border border-gray-300 dark:border-gray-600 p-3 font-semibold text-center text-gray-700 dark:text-gray-200">
                                T/S
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Fila de HorasOrdinarias */}
                            <tr className="bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                              <td className="border border-gray-300 dark:border-gray-600 p-3 font-medium text-gray-800 dark:text-gray-200" colSpan={2}>
                                Horas Ordinarias
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center font-semibold text-blue-700 dark:text-blue-300">
                                {employee.totalWorkDays}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center text-gray-700 dark:text-gray-300">
                                {employee.hoursPerDay}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center text-gray-700 dark:text-gray-300">
                                {employee.totalHours}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center text-green-700 dark:text-green-300 font-medium">
                                ₡{employee.regularSalary.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center font-bold text-green-800 dark:text-green-200 bg-green-50 dark:bg-green-900/30">
                                ₡{regularTotal.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>

                            {/* Fila de HorasExtras */}
                            <tr className="bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors">
                              <td className="border border-gray-300 dark:border-gray-600 p-3 font-medium text-gray-800 dark:text-gray-200" colSpan={2}>
                                Horas Extras
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center text-gray-500 dark:text-gray-400">
                                -
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center text-gray-500 dark:text-gray-400">
                                -
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center text-gray-500 dark:text-gray-400">
                                -
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center text-orange-700 dark:text-orange-300 font-medium">
                                ₡{employee.overtimeSalary.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center font-medium text-gray-500 dark:text-gray-400">
                                ₡0,00
                              </td>
                            </tr>

                            {/* Fila de Otros */}
                            <tr className="bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                              <td className="border border-gray-300 dark:border-gray-600 p-3 font-medium text-gray-800 dark:text-gray-200" colSpan={2}>
                                Otros Ingresos
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center text-gray-500 dark:text-gray-400">-</td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center text-gray-500 dark:text-gray-400">-</td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center text-gray-500 dark:text-gray-400">-</td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center text-gray-500 dark:text-gray-400">-</td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={deductions.otrosIncome ?? 0}
                                  onChange={(e) => updateDeduction(locationData.location.value, employee.employeeName, 'otrosIncome', parseFloat(e.target.value) || 0)}
                                  className="w-20 text-center border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="0"
                                />
                              </td>
                            </tr>

                            {/* Fila de Monto Extra */}
                            <tr className="bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors">
                              <td className="border border-gray-300 dark:border-gray-600 p-3 font-medium text-gray-800 dark:text-gray-200" colSpan={2}>
                                Monto Extra
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center text-gray-500 dark:text-gray-400">-</td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center text-gray-500 dark:text-gray-400">-</td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center text-gray-500 dark:text-gray-400">-</td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center text-gray-500 dark:text-gray-400">-</td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center font-semibold text-green-800 dark:text-green-200">
                                ₡{employee.extraAmount.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>

                            {/* Separador - Ingresos Totales */}
                            <tr className="bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50">
                              <td className="border border-gray-300 dark:border-gray-600 p-3 font-bold text-center text-blue-800 dark:text-blue-200" colSpan={6}>
                                INGRESOS TOTALES
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center font-bold text-lg text-blue-900 dark:text-blue-100 bg-blue-100 dark:bg-blue-800/30">
                                ₡{totalIncome.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>

                            {/* Separador vacío */}
                            <tr>
                              <td className="border border-gray-300 dark:border-gray-600 p-2" colSpan={7}></td>
                            </tr>

                            {/* CCSS */}
                            <tr className="bg-red-50 dark:bg-red-900/30">
                              <td className="border border-gray-300 dark:border-gray-600 p-3 font-medium text-red-800 dark:text-red-200" colSpan={6}>CCSS</td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center">
                                <span className="font-semibold text-red-700 dark:text-red-300">
                                  ₡{ccssAmount.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                                </span>
                                <span className="text-xs text-red-600 dark:text-red-400 ml-2">
                                  ({employee.ccssType === 'TC' ? 'TC' : 'MT'})
                                </span>
                              </td>
                            </tr>

                            {/* COMPRAS - Editable */}
                            <tr className="bg-red-50 dark:bg-red-900/30">
                              <td className="border border-gray-300 dark:border-gray-600 p-3 font-medium text-red-800 dark:text-red-200" colSpan={6}>COMPRAS</td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={deductions.compras ?? 0}
                                  onChange={(e) => updateDeduction(locationData.location.value, employee.employeeName, 'compras', parseFloat(e.target.value) || 0)}
                                  className="w-24 text-center border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-500"
                                  placeholder="0.00"
                                />
                              </td>
                            </tr>

                            {/* ADELANTO - Editable */}
                            <tr className="bg-red-50 dark:bg-red-900/30">
                              <td className="border border-gray-300 dark:border-gray-600 p-3 font-medium text-red-800 dark:text-red-200" colSpan={6}>ADELANTO</td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={deductions.adelanto ?? 0}
                                  onChange={(e) => updateDeduction(locationData.location.value, employee.employeeName, 'adelanto', parseFloat(e.target.value) || 0)}
                                  className="w-24 text-center border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-500"
                                  placeholder="0.00"
                                />
                              </td>
                            </tr>

                            {/* OTROS deducciones - Editable */}
                            <tr className="bg-red-50 dark:bg-red-900/30">
                              <td className="border border-gray-300 dark:border-gray-600 p-3 font-medium text-red-800 dark:text-red-200" colSpan={6}>OTROS</td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={deductions.otros ?? 0}
                                  onChange={(e) => updateDeduction(locationData.location.value, employee.employeeName, 'otros', parseFloat(e.target.value) || 0)}
                                  className="w-24 text-center border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-500"
                                  placeholder="0.00"
                                />
                              </td>
                            </tr>

                            {/* DEDUCCIONESTOTALES */}
                            <tr className="bg-gradient-to-r from-red-200 to-red-300 dark:from-red-900/70 dark:to-red-800/70">
                              <td className="border border-gray-300 dark:border-gray-600 p-3 font-bold text-red-900 dark:text-red-100" colSpan={6}>DEDUCCIONES TOTALES</td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center font-bold text-lg text-red-900 dark:text-red-100 bg-red-100 dark:bg-red-800/30">
                                ₡{totalDeductions.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          
                            {/* SALARIO NETO */}
                            <tr className="bg-gradient-to-r from-yellow-200 to-yellow-300 dark:from-yellow-800/70 dark:to-yellow-700/70">
                              <td className="border border-gray-300 dark:border-gray-600 p-3 font-bold text-yellow-900 dark:text-yellow-100" colSpan={6}>SALARIO NETO</td>
                              <td className="border border-gray-300 dark:border-gray-600 p-3 text-center font-bold text-xl text-yellow-900 dark:text-yellow-100 bg-yellow-100 dark:bg-yellow-800/30">
                                ₡{finalNetSalary.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {payrollData.length === 0 && (
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
