// src/components/PayrollExporter.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Calculator, DollarSign, Image, Save, Calendar } from 'lucide-react';
import { LocationsService } from '../services/locations';
import { SchedulesService, ScheduleEntry } from '../services/schedules';
import { PayrollRecordsService } from '../services/payroll-records';
import { Location, Employee } from '../types/firestore';

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
    extraAmount: number; // Para el monto extra editable
  };
}

interface EnhancedEmployeePayrollData extends EmployeePayrollData {
  deductions: {
    compras: number;
    adelanto: number;
    otros: number;
    extraAmount: number;
  };
  regularTotal: number;
  overtimeTotal: number;
  finalExtraAmount: number;
  totalIncome: number;
  ccssAmount: number;
  totalDeductions: number;
  finalNetSalary: number;
}

interface LocationPayrollData {
  location: Location;
  employees: EmployeePayrollData[];
}

interface PayrollExporterProps {
  currentPeriod: BiweeklyPeriod | null;
  selectedLocation?: string;
  onLocationChange?: (location: string) => void;
  availablePeriods?: BiweeklyPeriod[];
  onPeriodChange?: (period: BiweeklyPeriod) => void;
}

export default function PayrollExporter({ 
  currentPeriod, 
  selectedLocation = 'all', 
  onLocationChange,
  availablePeriods = [],
  onPeriodChange
}: PayrollExporterProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [payrollData, setPayrollData] = useState<LocationPayrollData[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);  const [editableDeductions, setEditableDeductions] = useState<EditableDeductions>({});
  const [tempInputValues, setTempInputValues] = useState<{ [key: string]: string }>({});
  const [debounceTimers, setDebounceTimers] = useState<{ [key: string]: NodeJS.Timeout }>({});

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
  const updateDeduction = useCallback((locationValue: string, employeeName: string, type: 'compras' | 'adelanto' | 'otros' | 'extraAmount', inputValue: string) => {
    const employeeKey = getEmployeeKey(locationValue, employeeName);
    const inputKey = `${employeeKey}-${type}`;
    const defaults = { compras: 0, adelanto: 0, otros: 0, extraAmount: 0 };

    // Actualizar el valor temporal inmediatamente para responsividad de UI
    setTempInputValues(prev => ({
      ...prev,
      [inputKey]: inputValue
    }));

    // Limpiar timer anterior si existe
    if (debounceTimers[inputKey]) {
      clearTimeout(debounceTimers[inputKey]);
    }

    // Crear nuevo timer para debounce
    const newTimer = setTimeout(() => {
      const numericValue = parseFloat(inputValue) || 0;
      
      setEditableDeductions(prev => ({
        ...prev,
        [employeeKey]: {
          ...defaults,
          ...prev[employeeKey], // Spread existing values
          [type]: numericValue // Override with new value
        }
      }));

      // Limpiar el timer del estado
      setDebounceTimers(prev => {
        const newTimers = { ...prev };
        delete newTimers[inputKey];
        return newTimers;
      });
    }, 1000); // 500ms de debounce

    // Guardar el timer
    setDebounceTimers(prev => ({
      ...prev,
      [inputKey]: newTimer
    }));
  }, [debounceTimers]);  // Función para obtener deducciones editables de un empleado
  const getEmployeeDeductions = useCallback((locationValue: string, employeeName: string) => {
    const employeeKey = getEmployeeKey(locationValue, employeeName);
    const defaults = { compras: 0, adelanto: 0, otros: 0, extraAmount: 0 };
    const existing = editableDeductions[employeeKey];

    if (!existing) {
      return defaults;
    }

    // Ensure all properties exist with defaults
    return {
      compras: existing.compras ?? defaults.compras,
      adelanto: existing.adelanto ?? defaults.adelanto,
      otros: existing.otros ?? defaults.otros,
      extraAmount: existing.extraAmount ?? defaults.extraAmount
    };
  }, [editableDeductions]);

  // Función para obtener el valor temporal de un input (para mostrar mientras se escribe)
  const getTempInputValue = useCallback((locationValue: string, employeeName: string, type: 'compras' | 'adelanto' | 'otros' | 'extraAmount'): string => {
    const employeeKey = getEmployeeKey(locationValue, employeeName);
    const inputKey = `${employeeKey}-${type}`;
    
    // Si hay un valor temporal, usarlo
    if (tempInputValues[inputKey] !== undefined) {
      return tempInputValues[inputKey];
    }
    
    // Sino, usar el valor guardado directamente del estado
    const defaults = { compras: 0, adelanto: 0, otros: 0, extraAmount: 0 };
    const existing = editableDeductions[employeeKey];
    
    if (!existing) {
      return '';
    }
    
    const value = existing[type] ?? defaults[type];
    return value > 0 ? value.toString() : '';
  }, [tempInputValues, editableDeductions]);
  const calculatePayrollData = useCallback((
    employeeName: string,
    days: { [day: number]: string },
    ccssType: 'TC' | 'MT',
    locationValue: string,
    extraAmount: number = 0,
    employee?: Employee
  ): EmployeePayrollData => {
    const workShifts = Object.values(days).filter(shift => shift === 'D' || shift === 'N');
    const totalWorkDays = workShifts.length;

    // Usar hoursPerShift del empleado o 8 horas por defecto
    const hoursPerDay = employee?.hoursPerShift || 8;
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

  // Limpiar timers al desmontar el componente
  useEffect(() => {
    return () => {
      Object.values(debounceTimers).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, [debounceTimers]);

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
          locations.filter(location => location.value !== 'DELIFOOD') :
          locations.filter(loc => loc.value === selectedLocation && loc.value !== 'DELIFOOD');

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

              const payrollData = calculatePayrollData(employeeName, days, ccssType, location.value, baseExtraAmount, employee);

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
  }, [currentPeriod, selectedLocation, locations, calculatePayrollData]);

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
  }, [payrollData, getEmployeeDeductions]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Función para generar imagen de planilla para un empleado
  const generateEmployeeImage = async (
    employee: EnhancedEmployeePayrollData,
    locationName: string,
    periodDates: string
  ): Promise<void> => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configurar canvas (más grande para mejor resolución)
    canvas.width = 900;
    canvas.height = 540;

    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Configuración inicial
    ctx.textAlign = 'left';
    ctx.font = '14px Arial';
    let y = 40;
    const margin = 20;
    const cellHeight = 35;
    const colWidths = [130, 120, 120, 120, 180, 170, 170]; // Anchos de columnas ajustados

    // Función para dibujar celda con borde
    const drawCell = (x: number, y: number, width: number, height: number, text: string, bgColor: string = '#ffffff', textColor: string = '#000000', bold: boolean = false, fontSize: number = 14) => {
      // Fondo de celda
      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, width, height);
      
      // Borde
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);
      
      // Texto
      ctx.fillStyle = textColor;
      ctx.font = bold ? `bold ${fontSize}px Arial` : `${fontSize}px Arial`;
      ctx.textAlign = 'center';
      
      // Centrar texto en la celda
      const textX = x + width / 2;
      const textY = y + height / 2 + fontSize / 3;
      ctx.fillText(text, textX, textY);
    };

    // Encabezado principal (igual que en la tabla HTML)
    let currentX = margin;
    
    // Primera fila de encabezados
    drawCell(currentX, y, colWidths[0], cellHeight, employee.employeeName, '#f3f4f6', '#000000', true, 16);
    currentX += colWidths[0];
    drawCell(currentX, y, colWidths[1], cellHeight, 'MES:', '#f3f4f6', '#000000', true);
    currentX += colWidths[1];
    drawCell(currentX, y, colWidths[2], cellHeight, new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }), '#f3f4f6', '#000000', true);
    currentX += colWidths[2];
    drawCell(currentX, y, colWidths[3], cellHeight, 'Quincena:', '#f3f4f6', '#000000', true);
    currentX += colWidths[3];
    drawCell(currentX, y, colWidths[4], cellHeight, periodDates, '#f3f4f6', '#000000', true);
    currentX += colWidths[4];
    drawCell(currentX, y, colWidths[5] + colWidths[6], cellHeight, '', '#f3f4f6', '#000000', true);

    y += cellHeight;
    currentX = margin;

    // Segunda fila de encabezados
    drawCell(currentX, y, colWidths[0], cellHeight, '', '#f9fafb', '#000000', false, 12);
    currentX += colWidths[0];
    drawCell(currentX, y, colWidths[1], cellHeight, 'DiasLaborados', '#f9fafb', '#000000', false, 12);
    currentX += colWidths[1];
    drawCell(currentX, y, colWidths[2], cellHeight, 'H/D', '#f9fafb', '#000000', false, 12);
    currentX += colWidths[2];
    drawCell(currentX, y, colWidths[3], cellHeight, 'H/T', '#f9fafb', '#000000', false, 12);
    currentX += colWidths[3];
    drawCell(currentX, y, colWidths[4], cellHeight, 'S/H', '#f9fafb', '#000000', false, 12);
    currentX += colWidths[4];
    drawCell(currentX, y, colWidths[5], cellHeight, 'T/S', '#f9fafb', '#000000', false, 12);

    y += cellHeight;

    // Obtener datos calculados - usar el mismo locationValue que se usa en los inputs
    const deductions = getEmployeeDeductions(locationName, employee.employeeName);
    const regularTotal = employee.regularSalary * employee.totalHours;
    const finalExtraAmount = deductions.extraAmount > 0 ? deductions.extraAmount : employee.extraAmount;
    const totalIncome = regularTotal + finalExtraAmount;
    const ccssAmount = employee.ccssType === 'TC' ? CCSS_TC : CCSS_MT;
    const totalDeductions = ccssAmount + deductions.compras + deductions.adelanto + deductions.otros;
    const finalNetSalary = totalIncome - totalDeductions;

    // Fila de Horas Ordinarias (fondo azul claro)
    currentX = margin;
    drawCell(currentX, y, colWidths[0], cellHeight, 'HorasOrdinarias', '#dbeafe', '#000000', true);
    currentX += colWidths[0];
    drawCell(currentX, y, colWidths[1], cellHeight, employee.totalWorkDays.toString(), '#dbeafe');
    currentX += colWidths[1];
    drawCell(currentX, y, colWidths[2], cellHeight, employee.hoursPerDay.toString(), '#dbeafe');
    currentX += colWidths[2];
    drawCell(currentX, y, colWidths[3], cellHeight, employee.totalHours.toString(), '#dbeafe');
    currentX += colWidths[3];
    drawCell(currentX, y, colWidths[4], cellHeight, employee.regularSalary.toLocaleString('es-CR', { minimumFractionDigits: 2 }), '#dbeafe');
    currentX += colWidths[4];
    drawCell(currentX, y, colWidths[5], cellHeight, regularTotal.toLocaleString('es-CR', { minimumFractionDigits: 2 }), '#dbeafe', '#000000', true);

    y += cellHeight;

    // Fila de Horas Extras (fondo naranja claro)
    currentX = margin;
    drawCell(currentX, y, colWidths[0], cellHeight, 'HorasExtras', '#fed7aa', '#000000', true);
    currentX += colWidths[0];
    drawCell(currentX, y, colWidths[1], cellHeight, '', '#fed7aa');
    currentX += colWidths[1];
    drawCell(currentX, y, colWidths[2], cellHeight, '', '#fed7aa');
    currentX += colWidths[2];
    drawCell(currentX, y, colWidths[3], cellHeight, '', '#fed7aa');
    currentX += colWidths[3];
    drawCell(currentX, y, colWidths[4], cellHeight, employee.overtimeSalary.toLocaleString('es-CR', { minimumFractionDigits: 2 }), '#fed7aa');
    currentX += colWidths[4];
    drawCell(currentX, y, colWidths[5], cellHeight, '', '#fed7aa', '#000000', true);

    y += cellHeight;

    // Fila de Monto Extra (fondo verde claro)
    currentX = margin;
    drawCell(currentX, y, colWidths[0], cellHeight, 'Monto Extra', '#dcfce7', '#000000', true);
    currentX += colWidths[0];
    drawCell(currentX, y, colWidths[1], cellHeight, '', '#dcfce7');
    currentX += colWidths[1];
    drawCell(currentX, y, colWidths[2], cellHeight, '', '#dcfce7');
    currentX += colWidths[2];
    drawCell(currentX, y, colWidths[3], cellHeight, '', '#dcfce7');
    currentX += colWidths[3];
    drawCell(currentX, y, colWidths[4], cellHeight, '', '#dcfce7');
    currentX += colWidths[4];
    drawCell(currentX, y, colWidths[5], cellHeight, finalExtraAmount.toLocaleString('es-CR', { minimumFractionDigits: 2 }), '#dcfce7', '#000000', true);

    y += cellHeight;

    // Fila separadora
    currentX = margin;
    for (let i = 0; i < 4; i++) {
      drawCell(currentX, y, colWidths[i], cellHeight, '', '#ffffff');
      currentX += colWidths[i];
    }
    drawCell(currentX, y, colWidths[4], cellHeight, 'IngresosTotales', '#ffffff', '#000000', true);
    currentX += colWidths[4];
    drawCell(currentX, y, colWidths[5], cellHeight, totalIncome.toLocaleString('es-CR', { minimumFractionDigits: 2 }), '#ffffff', '#000000', true);

    y += cellHeight;

    // Fila separadora vacía
    currentX = margin;
    for (let i = 0; i < colWidths.length - 1; i++) {
      drawCell(currentX, y, colWidths[i], cellHeight, '', '#ffffff');
      currentX += colWidths[i];
    }

    y += cellHeight;

    // CCSS
    currentX = margin;
    for (let i = 0; i < 4; i++) {
      drawCell(currentX, y, colWidths[i], cellHeight, '', '#ffffff');
      currentX += colWidths[i];
    }
    drawCell(currentX, y, colWidths[4], cellHeight, 'CCSS', '#ffffff', '#000000', true);
    currentX += colWidths[4];
    drawCell(currentX, y, colWidths[5], cellHeight, `₡${ccssAmount.toLocaleString('es-CR', { minimumFractionDigits: 2 })} (${employee.ccssType})`, '#ffffff');

    y += cellHeight;

    // COMPRAS
    currentX = margin;
    for (let i = 0; i < 4; i++) {
      drawCell(currentX, y, colWidths[i], cellHeight, '', '#ffffff');
      currentX += colWidths[i];
    }
    drawCell(currentX, y, colWidths[4], cellHeight, 'COMPRAS', '#ffffff', '#000000', true);
    currentX += colWidths[4];
    drawCell(currentX, y, colWidths[5], cellHeight, deductions.compras.toLocaleString('es-CR', { minimumFractionDigits: 2 }), '#ffffff');

    y += cellHeight;

    // ADELANTO
    currentX = margin;
    for (let i = 0; i < 4; i++) {
      drawCell(currentX, y, colWidths[i], cellHeight, '', '#ffffff');
      currentX += colWidths[i];
    }
    drawCell(currentX, y, colWidths[4], cellHeight, 'ADELANTO', '#ffffff', '#000000', true);
    currentX += colWidths[4];
    drawCell(currentX, y, colWidths[5], cellHeight, deductions.adelanto.toLocaleString('es-CR', { minimumFractionDigits: 2 }), '#ffffff');

    y += cellHeight;

    // OTROS
    currentX = margin;
    for (let i = 0; i < 4; i++) {
      drawCell(currentX, y, colWidths[i], cellHeight, '', '#ffffff');
      currentX += colWidths[i];
    }
    drawCell(currentX, y, colWidths[4], cellHeight, 'OTROS', '#ffffff', '#000000', true);
    currentX += colWidths[4];
    drawCell(currentX, y, colWidths[5], cellHeight, deductions.otros.toLocaleString('es-CR', { minimumFractionDigits: 2 }), '#ffffff');

    y += cellHeight;

    // DEDUCCIONESTOTALES (fondo rojo claro)
    currentX = margin;
    for (let i = 0; i < 4; i++) {
      drawCell(currentX, y, colWidths[i], cellHeight, '', '#fecaca');
      currentX += colWidths[i];
    }
    drawCell(currentX, y, colWidths[4], cellHeight, 'DEDUCCIONESTOTALES', '#fecaca', '#000000', true);
    currentX += colWidths[4];
    drawCell(currentX, y, colWidths[5], cellHeight, `₡${totalDeductions.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`, '#fecaca', '#000000', true);

    y += cellHeight;

    // SALARIO NETO (fondo amarillo)
    currentX = margin;
    for (let i = 0; i < 4; i++) {
      drawCell(currentX, y, colWidths[i], cellHeight, '', '#fef3c7');
      currentX += colWidths[i];
    }
    drawCell(currentX, y, colWidths[4], cellHeight, 'SALARIO NETO', '#fef3c7', '#000000', true, 16);
    currentX += colWidths[4];
    drawCell(currentX, y, colWidths[5], cellHeight, `₡${finalNetSalary.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`, '#fef3c7', '#000000', true, 16);

    // Descargar la imagen
    try {
      const dataURL = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = `planilla-${employee.employeeName.replace(/\s+/g, '_')}-${periodDates}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating image:', error);
      throw error;
    }
  };

  // Función para exportar un empleado individual
  const exportIndividualEmployee = async (employee: EnhancedEmployeePayrollData, locationName: string) => {
    if (!currentPeriod) {
      showNotification('No hay período seleccionado', 'error');
      return;
    }
    
    const periodDates = `${currentPeriod.start.getDate()}-${currentPeriod.end.getDate()}`;
    
    showNotification(`📊 Generando imagen de ${employee.employeeName}...`, 'success');
    
    try {
      await generateEmployeeImage(employee, locationName, periodDates);
      showNotification(`✅ Imagen de ${employee.employeeName} descargada exitosamente`, 'success');
    } catch (error) {
      console.error('Error generating individual employee image:', error);
      showNotification(`❌ Error generando imagen de ${employee.employeeName}`, 'error');
    }
  };

  // Función para guardar registro de planilla
  const savePayrollRecord = async (employee: EnhancedEmployeePayrollData, locationValue: string) => {
    if (!currentPeriod) {
      showNotification('No hay período seleccionado', 'error');
      return;
    }

    try {
      showNotification(`💾 Guardando registro de ${employee.employeeName}...`, 'success');
      
      await PayrollRecordsService.saveRecord(
        locationValue,
        employee.employeeName,
        currentPeriod.year,
        currentPeriod.month,
        currentPeriod.period,
        employee.totalWorkDays,
        employee.hoursPerDay,
        employee.totalHours
      );

      showNotification(`✅ Registro de ${employee.employeeName} guardado exitosamente`, 'success');
    } catch (error) {
      console.error('Error saving payroll record:', error);
      showNotification(`❌ Error guardando registro de ${employee.employeeName}`, 'error');
    }
  };

  const exportPayroll = async () => {
    if (!currentPeriod || memoizedPayrollCalculations.length === 0) {
      showNotification('No hay datos para exportar', 'error');
      return;
    }

    const periodDates = `${currentPeriod.start.getDate()}-${currentPeriod.end.getDate()}`;
    let totalEmployees = 0;

    // Contar total de empleados para mostrar progreso
    memoizedPayrollCalculations.forEach(locationData => {
      totalEmployees += locationData.employees.length;
    });

    let processedEmployees = 0;
    let successCount = 0;
    let errorCount = 0;

    showNotification(`📊 Iniciando exportación de ${totalEmployees} planillas...`, 'success');

    for (const locationData of memoizedPayrollCalculations) {
      for (const employee of locationData.employees) {
        try {
          await new Promise(resolve => setTimeout(resolve, 200)); // Pausa entre imágenes
          await generateEmployeeImage(employee, locationData.location.value, periodDates);
          successCount++;
          processedEmployees++;
          
          // Actualizar notificación de progreso
          showNotification(`📊 Procesando... ${processedEmployees}/${totalEmployees} (${successCount} exitosas)`, 'success');
        } catch (error) {
          console.error(`Error exporting ${employee.employeeName}:`, error);
          errorCount++;
          processedEmployees++;
        }
      }
    }

    if (errorCount === 0) {
      showNotification(`✅ ${successCount} imágenes descargadas exitosamente`, 'success');
    } else {
      showNotification(`⚠️ ${successCount} exitosas, ${errorCount} errores`, 'error');
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
            {locations.filter(location => location.value !== 'DELIFOOD').map(location => (
              <option key={location.value} value={location.value}>
                {location.label}
              </option>
            ))}
          </select>

          {/* Selector de período - ahora interactivo */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--tab-text)]" />
            <select
              value={currentPeriod ? `${currentPeriod.year}-${currentPeriod.month}-${currentPeriod.period}` : ''}
              onChange={(e) => {
                if (e.target.value && onPeriodChange) {
                  const [year, month, period] = e.target.value.split('-');
                  const selectedPeriod = availablePeriods.find(p =>
                    p.year === parseInt(year) &&
                    p.month === parseInt(month) &&
                    p.period === period
                  );
                  if (selectedPeriod) {
                    onPeriodChange(selectedPeriod);
                  }
                }
              }}
              className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                color: 'var(--foreground)',
              }}
              disabled={!onPeriodChange || availablePeriods.length === 0}
              title={onPeriodChange ? "Seleccionar quincena para la planilla" : "Período controlado desde la pestaña Horarios"}
            >
              {availablePeriods.length === 0 ? (
                <option value="">Cargando quincenas...</option>
              ) : (
                availablePeriods.map((period) => (
                  <option
                    key={`${period.year}-${period.month}-${period.period}`}
                    value={`${period.year}-${period.month}-${period.period}`}
                  >
                    {period.label}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Botón de exportar */}
          <button
            onClick={exportPayroll}
            disabled={memoizedPayrollCalculations.length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md flex items-center gap-2 transition-colors"
            title="Exportar planillas como imágenes"
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar Imágenes</span>
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
                  regularTotal,
                  overtimeTotal,
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
                            {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
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
                            {employee.overtimeHours}
                          </td>
                          <td className="border border-[var(--input-border)] p-2 text-center">
                            {(employee.regularSalary * 1.5).toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="border border-[var(--input-border)] p-2 text-center font-semibold">
                            {overtimeTotal.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
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
                              value={getTempInputValue(locationData.location.value, employee.employeeName, 'extraAmount')}
                              onChange={(e) => updateDeduction(locationData.location.value, employee.employeeName, 'extraAmount', e.target.value)}
                              className="w-full text-center border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 font-semibold"
                              style={{
                                background: 'var(--input-bg)',
                                color: 'var(--foreground)',
                              }}
                              placeholder="0.00"
                            />
                          </td>
                        </tr>

                        {/* Fila de INGRESOS TOTALES */}
                        <tr className="bg-green-100 dark:bg-green-900/30 border-t-2 border-green-600">
                          <td className="border border-[var(--input-border)] p-2 font-bold text-green-800 dark:text-green-200">
                            INGRESOS TOTALES
                          </td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2 text-center font-bold text-green-800 dark:text-green-200 text-lg">
                            {totalIncome.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>

                        {/* Fila de CCSS */}
                        <tr className="bg-red-50 dark:bg-red-900/20">
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2 font-medium">CCSS</td>
                          <td className="border border-[var(--input-border)] p-2 text-center font-semibold">
                            {ccssAmount.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
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
                              value={getTempInputValue(locationData.location.value, employee.employeeName, 'compras')}
                              onChange={(e) => updateDeduction(locationData.location.value, employee.employeeName, 'compras', e.target.value)}
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
                              value={getTempInputValue(locationData.location.value, employee.employeeName, 'adelanto')}
                              onChange={(e) => updateDeduction(locationData.location.value, employee.employeeName, 'adelanto', e.target.value)}
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
                              value={getTempInputValue(locationData.location.value, employee.employeeName, 'otros')}
                              onChange={(e) => updateDeduction(locationData.location.value, employee.employeeName, 'otros', e.target.value)}
                              className="w-full text-center border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1"
                              style={{
                                background: 'var(--input-bg)',
                                color: 'var(--foreground)',
                              }}
                              placeholder="0.00"
                            />
                          </td>
                        </tr>

                        {/* Fila de DEDUCCIONESTOTALES */}
                        <tr className="bg-red-100 dark:bg-red-900/30 border-t-2 border-red-600">
                          <td className="border border-[var(--input-border)] p-2 font-bold text-red-800 dark:text-red-200">
                            DEDUCCIONESTOTALES
                          </td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2"></td>
                          <td className="border border-[var(--input-border)] p-2 text-center font-bold text-red-800 dark:text-red-200 text-lg">
                            {totalDeductions.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>

                        {/* Fila de SALARIO NETO */}
                        <tr className="bg-yellow-100 dark:bg-yellow-900/30 border-t-4 border-yellow-600">
                          <td className="border border-[var(--input-border)] p-3 font-bold text-yellow-800 dark:text-yellow-200 text-lg">
                            SALARIO NETO
                          </td>
                          <td className="border border-[var(--input-border)] p-3"></td>
                          <td className="border border-[var(--input-border)] p-3"></td>
                          <td className="border border-[var(--input-border)] p-3"></td>
                          <td className="border border-[var(--input-border)] p-3"></td>
                          <td className="border border-[var(--input-border)] p-3 text-center font-bold text-yellow-800 dark:text-yellow-200 text-xl">
                            {finalNetSalary.toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Botones de acción */}
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        onClick={() => savePayrollRecord(employee, locationData.location.value)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md flex items-center gap-2 transition-colors"
                        title={`Guardar registro de ${employee.employeeName}`}
                      >
                        <Save className="w-4 h-4" />
                        Guardar Registro
                      </button>
                      <button
                        onClick={() => exportIndividualEmployee(employee, locationData.location.value)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md flex items-center gap-2 transition-colors"
                        title={`Exportar planilla de ${employee.employeeName}`}
                      >
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <Image className="w-4 h-4" />
                        Exportar Planilla
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        ))}
      </div>
      {/* Canvas oculto para exportación */}
      <canvas 
        ref={canvasRef} 
        width={900} 
        height={540} 
        style={{ display: 'none' }}
      />
    </div>
  );
};
