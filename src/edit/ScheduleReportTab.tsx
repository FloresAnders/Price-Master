// src/edit/ScheduleReportTab.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar, MapPin, FileText, Download } from 'lucide-react';
import { EmpresasService } from '../services/empresas';
import { useAuth } from '../hooks/useAuth';
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

interface EmployeeSchedule {
  employeeName: string;
  days: { [day: number]: string };
}

interface LocationSchedule {
  location: Location;
  employees: EmployeeSchedule[];
  totalWorkDays: number;
}

export default function ScheduleReportTab() {
  const { user: currentUser } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [currentPeriod, setCurrentPeriod] = useState<BiweeklyPeriod | null>(null);
  const [availablePeriods, setAvailablePeriods] = useState<BiweeklyPeriod[]>([]);
  const [scheduleData, setScheduleData] = useState<LocationSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  // Función para obtener el período de quincena actual
  const getCurrentBiweeklyPeriod = (): BiweeklyPeriod => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    const period: 'first' | 'second' = day <= 15 ? 'first' : 'second';
    const start = new Date(year, month, period === 'first' ? 1 : 16);
    const end = period === 'first' ?
      new Date(year, month, 15) :
      new Date(year, month + 1, 0); // último día del mes

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    return {
      start,
      end,
      label: `${monthNames[month]} ${year} (${period === 'first' ? '1-15' : `16-${end.getDate()}`})`,
      year,
      month: month + 1, // Firebase months are 1-indexed
      period
    };
  };

  // Función para obtener períodos anteriores con días laborados
  const getAvailablePeriods = async (): Promise<BiweeklyPeriod[]> => {
    try {
      const allSchedules = await SchedulesService.getAllSchedules();
      const periods = new Set<string>();

      allSchedules.forEach(schedule => {
        if (schedule.shift && schedule.shift.trim() !== '') {
          const period = schedule.day <= 15 ? 'first' : 'second';
          const key = `${schedule.year}-${schedule.month}-${period}`;
          periods.add(key);
        }
      });

      const periodsArray: BiweeklyPeriod[] = [];

      periods.forEach(key => {
        const [year, month, period] = key.split('-');
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        const isFirst = period === 'first';

        const start = new Date(yearNum, monthNum - 1, isFirst ? 1 : 16);
        const end = isFirst ?
          new Date(yearNum, monthNum - 1, 15) :
          new Date(yearNum, monthNum, 0);

        const monthNames = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        periodsArray.push({
          start,
          end,
          label: `${monthNames[monthNum - 1]} ${yearNum} (${isFirst ? '1-15' : `16-${end.getDate()}`})`,
          year: yearNum,
          month: monthNum,
          period: isFirst ? 'first' : 'second'
        });
      });

      // Ordenar por fecha descendente (más reciente primero)
      return periodsArray.sort((a, b) => b.start.getTime() - a.start.getTime());
    } catch (error) {
      console.error('Error getting available periods:', error);
      return [];
    }
  };

  // Cargar empresas (mapeadas a la forma esperada por la vista de planilla)
  useEffect(() => {
    const loadLocations = async () => {
      try {
        const empresas = await EmpresasService.getAllEmpresas();

        let owned: typeof empresas = [];

        if (!currentUser) {
          owned = [];
        } else if (currentUser.role === 'superadmin') {
          owned = empresas || [];
        } else {
          owned = (empresas || []).filter(e => e && e.ownerId && (
            String(e.ownerId) === String(currentUser.id) ||
            (currentUser.ownerId && String(e.ownerId) === String(currentUser.ownerId))
          ));
        }

        const mapped = owned.map(e => ({
          id: e.id,
          label: e.name || e.ubicacion || e.id || 'Empresa',
          value: e.ubicacion || e.name || e.id || '',
          names: [],
          employees: (e.empleados || []).map(emp => ({
            name: emp.Empleado || '',
            ccssType: emp.ccssType || 'TC',
            hoursPerShift: emp.hoursPerShift || 8,
            extraAmount: emp.extraAmount || 0
          }))
        }));
        setLocations(mapped);
      } catch (error) {
        console.error('Error loading empresas:', error);
      }
    };
    loadLocations();
  }, [currentUser]);

  // Inicializar períodos disponibles
  useEffect(() => {
    const initializePeriods = async () => {
      setLoading(true);
      const current = getCurrentBiweeklyPeriod();
      setCurrentPeriod(current);

      const available = await getAvailablePeriods();

      // Agregar período actual al inicio si no está en la lista
      const currentExists = available.some(p =>
        p.year === current.year &&
        p.month === current.month &&
        p.period === current.period
      );

      if (!currentExists) {
        setAvailablePeriods([current, ...available]);
      } else {
        setAvailablePeriods(available);
      } setLoading(false);
    };
    initializePeriods();
  }, []);

  const loadScheduleData = useCallback(async () => {
    if (!currentPeriod) return;

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
        if (!locationGroups.has(schedule.companieValue)) {
          locationGroups.set(schedule.companieValue, []);
        }
        locationGroups.get(schedule.companieValue)!.push(schedule);
      });

      const scheduleDataArray: LocationSchedule[] = [];

      // Filtrar ubicaciones según selección
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

        const employees: EmployeeSchedule[] = [];
        let totalWorkDays = 0;

        employeeGroups.forEach((schedules, employeeName) => {
          const days: { [day: number]: string } = {};
          let employeeWorkDays = 0;

          schedules.forEach(schedule => {
            if (schedule.shift && schedule.shift.trim() !== '') {
              days[schedule.day] = schedule.shift;
              employeeWorkDays++;
            }
          });

          if (employeeWorkDays > 0) {
            employees.push({ employeeName, days });
            totalWorkDays += employeeWorkDays;
          }
        });

        if (employees.length > 0) {
          scheduleDataArray.push({
            location,
            employees,
            totalWorkDays
          });
        }
      });

      setScheduleData(scheduleDataArray);
    } catch (error) {
      console.error('Error loading schedule data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPeriod, selectedLocation, locations]);

  // Cargar datos de horarios cuando cambie el período o la ubicación
  useEffect(() => {
    if (currentPeriod) {
      loadScheduleData();
    }
  }, [currentPeriod, selectedLocation, loadScheduleData]);

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const currentIndex = availablePeriods.findIndex(p =>
      p.year === currentPeriod?.year &&
      p.month === currentPeriod?.month &&
      p.period === currentPeriod?.period
    );

    if (direction === 'prev' && currentIndex < availablePeriods.length - 1) {
      setCurrentPeriod(availablePeriods[currentIndex + 1]);
    } else if (direction === 'next' && currentIndex > 0) {
      setCurrentPeriod(availablePeriods[currentIndex - 1]);
    }
  };

  const getDaysInPeriod = (): number[] => {
    if (!currentPeriod) return [];

    const days: number[] = [];
    const start = currentPeriod.period === 'first' ? 1 : 16;
    const end = currentPeriod.period === 'first' ? 15 : currentPeriod.end.getDate();

    for (let i = start; i <= end; i++) {
      days.push(i);
    }

    return days;
  };

  const exportData = () => {
    if (!currentPeriod || scheduleData.length === 0) return;

    const exportData = {
      period: currentPeriod.label,
      locations: scheduleData.map(locationData => ({
        location: locationData.location.label,
        employees: locationData.employees.map(emp => ({
          name: emp.employeeName,
          schedule: emp.days,
          totalDays: Object.keys(emp.days).length
        })),
        totalWorkDays: locationData.totalWorkDays
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planilla-${currentPeriod.year}-${currentPeriod.month}-${currentPeriod.period}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-[var(--tab-text)]">Cargando planillas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header y controles */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Planilla de Horarios</h3>
          <p className="text-sm text-[var(--tab-text)] mt-1">
            Control de horarios por ubicación y quincena
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportData}
            disabled={scheduleData.length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Selector de empresa */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="w-4 h-4" />
          Empresa:
        </label>
        <select
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          className="px-3 py-2 border border-[var(--input-border)] rounded-md bg-[var(--input-bg)] text-[var(--text-color)]"
        >
          <option value="all">Todas las empresas</option>
          {locations.filter(location => location.value !== 'DELIFOOD').map(location => (<option key={location.value} value={location.value}>
            {location.label}
          </option>
          ))}
        </select>
      </div>

      {/* Navegación de períodos */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[var(--tab-text)]" />
          <span className="text-sm text-[var(--tab-text)]">Período:</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigatePeriod('prev')}
            disabled={!currentPeriod || availablePeriods.findIndex(p =>
              p.year === currentPeriod.year &&
              p.month === currentPeriod.month &&
              p.period === currentPeriod.period
            ) >= availablePeriods.length - 1}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="text-lg font-medium min-w-[200px] text-center">
            {currentPeriod?.label || 'Cargando...'}
          </span>

          <button
            onClick={() => navigatePeriod('next')}
            disabled={!currentPeriod || availablePeriods.findIndex(p =>
              p.year === currentPeriod.year &&
              p.month === currentPeriod.month &&
              p.period === currentPeriod.period
            ) <= 0}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Contenido de horarios */}
      {scheduleData.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[var(--text-color)] mb-2">
            No hay datos de horarios
          </h3>
          <p className="text-[var(--tab-text)]">
            No se encontraron horarios para este período y ubicación.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {scheduleData.map((locationData, locationIndex) => (
            <div key={locationIndex} className="border border-[var(--input-border)] rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  {locationData.location.label}
                </h4>
                <span className="text-sm text-[var(--tab-text)]">
                  Total días laborados: {locationData.totalWorkDays}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--input-border)]">
                      <th className="text-left p-2 font-medium">Empleado</th>
                      {getDaysInPeriod().map(day => (
                        <th key={day} className="text-center p-2 font-medium min-w-[40px]">
                          {day}
                        </th>
                      ))}
                      <th className="text-center p-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locationData.employees.map((employee, empIndex) => (
                      <tr key={empIndex} className="border-b border-[var(--input-border)] hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="p-2 font-medium">{employee.employeeName}</td>
                        {getDaysInPeriod().map(day => (
                          <td key={day} className="text-center p-2">
                            <span className={`w-6 h-6 rounded text-xs font-medium flex items-center justify-center ${employee.days[day] === 'D' ? 'bg-yellow-200 text-yellow-800' :
                              employee.days[day] === 'N' ? 'bg-blue-200 text-blue-800' :
                                employee.days[day] === 'L' ? 'bg-gray-200 text-gray-800' :
                                  'bg-transparent'
                              }`}>
                              {employee.days[day] || ''}
                            </span>
                          </td>
                        ))}
                        <td className="text-center p-2 font-medium">
                          {Object.keys(employee.days).length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Leyenda */}
              <div className="flex gap-4 mt-4 text-xs">
                <div className="flex items-center gap-1">
                  <span className="inline-block w-4 h-4 rounded bg-yellow-200"></span>
                  <span>D = Día</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-4 h-4 rounded bg-blue-200"></span>
                  <span>N = Noche</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-4 h-4 rounded bg-gray-200"></span>
                  <span>L = Libre</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
