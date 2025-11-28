// src/components/ScheduleReportTab.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, MapPin, FileText, Clock, Calculator, Eye } from 'lucide-react';
import { EmpresasService } from '../../services/empresas';
import { UsersService } from '../../services/users';
import useToast from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { useActorOwnership } from '../../hooks/useActorOwnership';
import { SchedulesService, ScheduleEntry } from '../../services/schedules';
import PayrollExporter from './PayrollExporter';
import PayrollRecordsViewer from './PayrollRecordsViewer';

interface MappedEmpresa {
  id?: string;
  label: string;
  value: string;
  names: string[];
  employees: {
    name: string;
    ccssType: 'TC' | 'MT';
    hoursPerShift: number;
    extraAmount: number;
  }[];
}

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
  location: MappedEmpresa;
  employees: EmployeeSchedule[];
  totalWorkDays: number;
}

export default function ScheduleReportTab() {
  const { user: currentUser } = useAuth();
  const { ownerIds: actorOwnerIds, primaryOwnerId } = useActorOwnership(currentUser);
  const actorOwnerIdSet = useMemo(() => new Set(actorOwnerIds.map(id => String(id))), [actorOwnerIds]);
  const [locations, setLocations] = useState<MappedEmpresa[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [currentPeriod, setCurrentPeriod] = useState<BiweeklyPeriod | null>(null);
  const [availablePeriods, setAvailablePeriods] = useState<BiweeklyPeriod[]>([]);
  const [scheduleData, setScheduleData] = useState<LocationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'schedule' | 'payroll' | 'records'>('schedule');

  // Estado para manejar horarios editables
  const [editableSchedules, setEditableSchedules] = useState<{ [key: string]: string }>({});
  const [isEditing, setIsEditing] = useState(false);

  // notifications handled by ToastProvider via showToast()
  // Función para obtener el período de quincena actual
  const getCurrentBiweeklyPeriod = useCallback((): BiweeklyPeriod => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    const period: 'first' | 'second' = day <= 15 ? 'first' : 'second';
    const start = new Date(year, month, period === 'first' ? 1 : 16);
    const end = period === 'first' ?
      new Date(year, month, 15) :
      new Date(year, month + 1, 0);

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    return {
      start,
      end,
      label: `${monthNames[month]} ${year} (${period === 'first' ? '1-15' : `16-${end.getDate()}`})`,
      year,
      month: month,
      period
    };
  }, []);

  // Función para obtener períodos anteriores con días laborados
  const getAvailablePeriods = useCallback(async (): Promise<BiweeklyPeriod[]> => {
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

        const start = new Date(yearNum, monthNum, isFirst ? 1 : 16);
        const end = isFirst ?
          new Date(yearNum, monthNum, 15) :
          new Date(yearNum, monthNum + 1, 0);

        const monthNames = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        periodsArray.push({
          start,
          end,
          label: `${monthNames[monthNum]} ${yearNum} (${isFirst ? '1-15' : `16-${end.getDate()}`})`,
          year: yearNum,
          month: monthNum,
          period: isFirst ? 'first' : 'second'
        });
      });

      return periodsArray.sort((a, b) => b.start.getTime() - a.start.getTime());
    } catch (error) {
      console.error('Error getting available periods:', error);
      return [];
    }
  }, []);

  // Cargar empresas (mapeadas a la forma esperada por la vista de planilla)
  useEffect(() => {
    const loadLocations = async () => {
      try {
        const empresas = await EmpresasService.getAllEmpresas();
        let owned: typeof empresas = [];

        // Si no hay usuario autenticado aún, mostrar vacío
        if (!currentUser) {
          owned = [];
        } else if (currentUser.role === 'superadmin') {
          // superadmin ve todas las empresas
          owned = empresas || [];
        } else {
          if (actorOwnerIdSet.size > 0) {
            owned = (empresas || []).filter(
              e => e && e.ownerId && actorOwnerIdSet.has(String(e.ownerId))
            );
          } else {
            owned = (empresas || []).filter(
              e =>
                e && e.ownerId && (
                  (currentUser.id && String(e.ownerId) === String(currentUser.id)) ||
                  (currentUser.ownerId && String(e.ownerId) === String(currentUser.ownerId))
                )
            );
          }
        }

        try {
          // If the current actor is an admin, exclude empresas owned by a superadmin user
          if (currentUser?.role === 'admin') {
            const ownerIds = Array.from(new Set((owned || []).map((e: any) => e.ownerId).filter(Boolean)));
            const owners = await Promise.all(ownerIds.map(id => UsersService.getUserById(id)));
            const ownerRoleById = new Map<string, string | undefined>();
            ownerIds.forEach((id, idx) => ownerRoleById.set(id, owners[idx]?.role));

            console.debug('[ScheduleReportTab] currentUser:', currentUser?.id, currentUser?.ownerId, 'resolved actorOwnerId:', primaryOwnerId, 'owned count before:', (owned || []).length);
            console.debug('[ScheduleReportTab] owner roles:', Array.from(ownerRoleById.entries()));

            owned = (owned || []).filter((e: any) => ownerRoleById.get(e.ownerId) !== 'superadmin');

            console.debug('[ScheduleReportTab] owned after filtering:', (owned || []).map((x: any) => ({ id: x.id, ownerId: x.ownerId, name: x.name })));
          }
        } catch (err) {
          console.warn('Error resolving empresa owners for schedule filtering:', err);
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
  }, [actorOwnerIdSet, actorOwnerIds, currentUser, primaryOwnerId]);
  // Inicializar períodos disponibles
  useEffect(() => {
    const initializePeriods = async () => {
      setLoading(true);
      const current = getCurrentBiweeklyPeriod();
      setCurrentPeriod(current);

      const available = await getAvailablePeriods();

      const currentExists = available.some(p =>
        p.year === current.year &&
        p.month === current.month &&
        p.period === current.period
      );

      if (!currentExists) {
        setAvailablePeriods([current, ...available]);
      } else {
        setAvailablePeriods(available);
      }

      setLoading(false);
    };
    initializePeriods();
  }, [getCurrentBiweeklyPeriod, getAvailablePeriods]);
  // Función para cargar datos de horarios
  const loadScheduleData = useCallback(async () => {
    if (!currentPeriod) return;

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
        if (!locationGroups.has(schedule.companieValue)) {
          locationGroups.set(schedule.companieValue, []);
        }
        locationGroups.get(schedule.companieValue)!.push(schedule);
      });

      const scheduleDataArray: LocationSchedule[] = [];

      const locationsToProcess = selectedLocation === 'all' ?
        locations.filter(location => location.value !== 'DELIFOOD') :
        locations.filter(loc => loc.value === selectedLocation && loc.value !== 'DELIFOOD');

      locationsToProcess.forEach(location => {
        const locationSchedules = locationGroups.get(location.value) || [];
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
              if (schedule.shift === 'D' || schedule.shift === 'N') {
                employeeWorkDays++;
              }
            }
          });

          if (Object.keys(days).length > 0) {
            employees.push({ employeeName, days });
            totalWorkDays += employeeWorkDays;
          }
        });

        scheduleDataArray.push({
          location,
          employees,
          totalWorkDays
        });
      });

      setScheduleData(scheduleDataArray);
    } catch (error) {
      console.error('Error loading schedule data:', error);
      showToast('Error al cargar los datos de planilla', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPeriod, selectedLocation, locations, showToast]);

  // Cargar datos cuando el período y ubicaciones estén listos
  useEffect(() => {
    if (currentPeriod && locations.length > 0) {
      loadScheduleData();
    }
  }, [currentPeriod, locations, selectedLocation, loadScheduleData]);

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

  const getCellStyle = (value: string) => {
    switch (value) {
      case 'D':
        return { backgroundColor: '#FFFF00', color: '#000000' };
      case 'N':
        return { backgroundColor: '#87CEEB', color: '#000000' };
      case 'L':
        return { backgroundColor: '#FF00FF', color: '#FFFFFF' };
      default:
        return {
          backgroundColor: 'var(--input-bg)',
          color: 'var(--foreground)'
        };
    }
  };

  // Función para generar clave única para cada celda editable
  const getCellKey = (companieValue: string, employeeName: string, day: number): string => {
    return `${companieValue}-${employeeName}-${day}`;
  };
  // Función para actualizar horario
  const updateSchedule = async (companieValue: string, employeeName: string, day: number, shift: string) => {
    try {
      await SchedulesService.updateScheduleShift(
        companieValue,
        employeeName,
        currentPeriod!.year,
        currentPeriod!.month,
        day,
        shift
      );

      // Recargar datos
      await loadScheduleData();
      showToast('Horario actualizado exitosamente', 'success');
    } catch (error) {
      console.error('Error updating schedule:', error);
      showToast('Error al actualizar el horario', 'error');
    }
  };

  // Función para manejar cambio en celda
  const handleCellChange = (companieValue: string, employeeName: string, day: number, value: string) => {
    const cellKey = getCellKey(companieValue, employeeName, day);
    setEditableSchedules(prev => ({
      ...prev,
      [cellKey]: value
    }));
  };

  // Función para confirmar cambio y guardar en base de datos
  const handleCellBlur = (companieValue: string, employeeName: string, day: number) => {
    const cellKey = getCellKey(companieValue, employeeName, day);
    const newValue = editableSchedules[cellKey];

    if (newValue !== undefined) {
      updateSchedule(companieValue, employeeName, day, newValue);
      // Limpiar el estado temporal
      setEditableSchedules(prev => {
        const newState = { ...prev };
        delete newState[cellKey];
        return newState;
      });
    }
  };

  if (loading) {
    return (
      <div className="max-w-full mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div className="text-lg text-[var(--foreground)]">Cargando planillas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
      {/* notifications are rendered globally by ToastProvider */}

      {/* Header con controles */}
      <div className="mb-6 flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <FileText className="w-8 h-8 text-blue-600" />
          <div>
            <h3 className="text-xl font-semibold">Planilla de Horarios</h3>
            <p className="text-sm text-[var(--tab-text)]">
              Control de horarios y planilla de pago por quincena
            </p>
          </div>
        </div>

        {/* Tabs de navegación */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${activeTab === 'schedule'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
          >
            <FileText className="w-4 h-4" />
            Horarios
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${activeTab === 'payroll'
              ? 'bg-green-600 text-white'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
          >
            <Calculator className="w-4 h-4" />
            Planilla de Pago
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${activeTab === 'records'
              ? 'bg-purple-600 text-white'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
          >
            <Eye className="w-4 h-4" />
            Registros Guardados
          </button>
        </div>
      </div>

      {/* Contenido condicional basado en el tab activo */}
      {activeTab === 'schedule' ? (
        <>
          {/* Controles específicos del tab de horarios */}
          <div className="mb-6 flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Selector de empresa (usar empresas en lugar de ubicaciones) */}
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[var(--tab-text)]" />
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    color: 'var(--foreground)',
                  }}
                >
                  <option value="all">Todas las empresas</option>
                  {locations.filter(location => location.value !== 'DELIFOOD').map(location => (
                    <option key={location.value} value={location.value}>
                      {location.label}
                    </option>
                  ))}
                </select>
              </div>              {/* Botones de exportación y modo edición */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${isEditing
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  title={isEditing ? "Salir del modo edición" : "Activar modo edición"}
                >
                  <Clock className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {isEditing ? 'Salir Edición' : 'Editar Horarios'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Controles de navegación de período */}
          <div className="mb-6 flex flex-col gap-4">
            {/* Selector de quincena específica */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--tab-text)]" />
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    Seleccionar Quincena:
                  </label>
                </div>
                <select
                  value={currentPeriod ? `${currentPeriod.year}-${currentPeriod.month}-${currentPeriod.period}` : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [year, month, period] = e.target.value.split('-');
                      const selectedPeriod = availablePeriods.find(p =>
                        p.year === parseInt(year) &&
                        p.month === parseInt(month) &&
                        p.period === period
                      );
                      if (selectedPeriod) {
                        setCurrentPeriod(selectedPeriod);
                      }
                    }
                  }}
                  className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[250px]"
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    color: 'var(--foreground)',
                  }}
                >                  {availablePeriods.length === 0 ? (
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
            </div>

            {/* Navegación con botones */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => navigatePeriod('prev')}
                disabled={!currentPeriod || availablePeriods.findIndex(p =>
                  p.year === currentPeriod.year &&
                  p.month === currentPeriod.month &&
                  p.period === currentPeriod.period
                ) >= availablePeriods.length - 1}
                className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Quincena anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h4 className="text-lg font-semibold capitalize min-w-[200px] text-center">
                {currentPeriod?.label || 'Cargando...'}
              </h4>
              <button
                onClick={() => navigatePeriod('next')}
                disabled={!currentPeriod || availablePeriods.findIndex(p =>
                  p.year === currentPeriod.year &&
                  p.month === currentPeriod.month &&
                  p.period === currentPeriod.period
                ) <= 0}
                className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Quincena siguiente"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Leyenda de colores */}
          <div className="mb-6 flex flex-wrap gap-4 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FFFF00' }}></div>
              <span className="text-sm">D - Diurno</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#87CEEB' }}></div>
              <span className="text-sm">N - Nocturno</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FF00FF' }}></div>
              <span className="text-sm">L - Libre</span>
            </div>
          </div>

          {/* Contenido de horarios */}
          <div className="space-y-6">
            {scheduleData.map((locationData, locationIndex) => (
              <div key={locationIndex} className="border border-[var(--input-border)] rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    {locationData.location.label}
                  </h4>
                  <div className="flex items-center gap-2">
                    {locationData.employees.length > 0 && (
                      <span className="text-sm text-[var(--tab-text)]">
                        {locationData.employees.length} empleado{locationData.employees.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {locationData.employees.length === 0 ? (
                  <div className="text-center py-8 text-[var(--tab-text)]">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No hay horarios registrados para este período</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">                    <table className="w-full border-collapse border border-[var(--input-border)]">
                    <thead><tr>
                      <th
                        className="border border-[var(--input-border)] p-2 font-semibold text-center"
                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)', minWidth: '100px' }}
                      >
                        Empleado
                      </th>
                      {getDaysInPeriod().map(day => (
                        <th
                          key={day}
                          className="border border-[var(--input-border)] p-2 font-semibold text-center"
                          style={{ background: 'var(--input-bg)', color: 'var(--foreground)', minWidth: '35px' }}
                        >
                          {day}
                        </th>
                      ))}
                      <th
                        className="border border-[var(--input-border)] p-2 font-semibold text-center"
                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)', minWidth: '50px' }}
                      >
                        Total                          </th>
                    </tr></thead>
                    <tbody>{locationData.employees.map((employee, empIndex) => (
                      <tr key={empIndex}><td
                        className="border border-[var(--input-border)] p-2 font-medium"
                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                      >
                        {employee.employeeName}
                      </td>
                        {getDaysInPeriod().map(day => {
                          const cellKey = getCellKey(locationData.location.value, employee.employeeName, day);
                          const currentValue = editableSchedules[cellKey] !== undefined
                            ? editableSchedules[cellKey]
                            : employee.days[day] || '';

                          return (
                            <td key={day} className="border border-[var(--input-border)] p-0">
                              {isEditing ? (
                                <select
                                  value={currentValue}
                                  onChange={(e) => handleCellChange(locationData.location.value, employee.employeeName, day, e.target.value)}
                                  onBlur={() => handleCellBlur(locationData.location.value, employee.employeeName, day)}
                                  className="w-full h-full p-1 text-center font-semibold text-sm border-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  style={{
                                    ...getCellStyle(currentValue),
                                    minHeight: '28px'
                                  }}
                                >
                                  <option value="">-</option>
                                  <option value="D">D</option>
                                  <option value="N">N</option>
                                  <option value="L">L</option>
                                </select>
                              ) : (
                                <div
                                  className="w-full h-full p-1 text-center font-semibold text-sm"
                                  style={getCellStyle(currentValue)}
                                >
                                  {currentValue || ''}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td
                          className="border border-[var(--input-border)] p-2 text-center font-medium"
                          style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                        >
                          {Object.values(employee.days).filter(shift => shift === 'D' || shift === 'N').length}
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>) : activeTab === 'payroll' ? (
          /* Tab de Planilla de Pago */
          <PayrollExporter
            currentPeriod={currentPeriod}
            selectedLocation={selectedLocation}
            onLocationChange={setSelectedLocation}
            availablePeriods={availablePeriods}
            onPeriodChange={setCurrentPeriod}
          />
        ) : (
        /* Tab de Registros Guardados */
        <PayrollRecordsViewer
          selectedLocation={selectedLocation}
        />
      )}
    </div>
  );
}
