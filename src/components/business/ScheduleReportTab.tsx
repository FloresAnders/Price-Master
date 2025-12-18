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
  const optionStyle = {
    backgroundColor: 'var(--card-bg)',
    color: 'var(--foreground)'
  };
  const tabConfigurations: Array<{
    id: 'schedule' | 'payroll' | 'records';
    label: string;
    shortLabel: string;
    helper: string;
    icon: typeof FileText;
    activeClasses: string;
  }> = [
    {
      id: 'schedule',
      label: 'Horarios',
      shortLabel: 'Hor.',
      helper: 'Turnos y asistencia',
      icon: FileText,
      activeClasses: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg border-transparent'
    },
    {
      id: 'payroll',
      label: 'Planilla',
      shortLabel: 'Plan.',
      helper: 'Pagos por quincena',
      icon: Calculator,
      activeClasses: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg border-transparent'
    },
    {
      id: 'records',
      label: 'Registros',
      shortLabel: 'Reg.',
      helper: 'Historial guardado',
      icon: Eye,
      activeClasses: 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white shadow-lg border-transparent'
    }
  ];

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
      // Optimize: Fetch only schedules for the current period (year/month)
      // instead of fetching all history.
      let periodSchedules = await SchedulesService.getSchedulesByYearMonth(
        currentPeriod.year,
        currentPeriod.month
      );

      // Filter by biweekly period (1-15 or 16-end)
      periodSchedules = periodSchedules.filter(schedule => {
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
      <div className="max-w-full mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4 sm:p-6">
        <div className="text-center py-8 sm:py-12">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto mb-3 sm:mb-4"></div>
          <div className="text-base sm:text-lg text-[var(--foreground)]">Cargando planillas...</div>
          <div className="text-sm text-[var(--tab-text)] mt-2">Obteniendo datos de horarios y empleados</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto bg-[var(--card-bg)] rounded-lg shadow p-3 sm:p-6">
      {/* notifications are rendered globally by ToastProvider */}

      {/* Header con controles */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col gap-4">
          {/* Título y descripción */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-lg sm:text-xl font-semibold">Planilla de Horarios</h3>
                <p className="text-sm text-[var(--tab-text)]">
                  Control de horarios y planilla de pago por quincena
                </p>
              </div>
            </div>
          </div>

          {/* Tabs de navegación - estilo pills */}
          <div className="flex flex-wrap gap-2 bg-gray-100 dark:bg-gray-800/60 border border-[var(--input-border)] rounded-2xl p-2 w-full sm:w-auto sm:self-end">
            {tabConfigurations.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex-1 sm:flex-none min-w-[110px] px-3 py-2 sm:px-4 rounded-xl border text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 ${isActive
                    ? tab.activeClasses
                    : 'bg-white/40 dark:bg-gray-900/40 text-[var(--tab-text)] border-transparent hover:border-[var(--input-border)] hover:bg-white dark:hover:bg-gray-900'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-[var(--tab-text)]'}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm font-semibold">
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className="sm:hidden">{tab.shortLabel}</span>
                      </span>
                      <span className={`text-[10px] uppercase tracking-wide ${isActive ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'} hidden sm:inline`}>
                        {tab.helper}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contenido condicional basado en el tab activo */}
      {activeTab === 'schedule' ? (
        <>
          {/* Controles específicos del tab de horarios */}
          <div className="mb-4 sm:mb-6">
            <div className="bg-gray-50/80 dark:bg-gray-900/30 border border-[var(--input-border)] rounded-2xl p-4 sm:p-5 space-y-4 transition-colors">
              {/* Fila 1: Empresa + modo edición */}
              <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-stretch">
                <div className="flex items-center gap-3 flex-1 w-full bg-white/80 dark:bg-gray-900/60 border border-[var(--input-border)] rounded-xl px-3 py-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                    <MapPin className="w-5 h-5" />
                  </span>
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tab-text)]">Empresa</p>
                    <select
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      className="w-full bg-transparent text-sm font-medium text-[var(--foreground)] focus:outline-none appearance-none"
                      style={{ backgroundColor: 'transparent' }}
                    >
                      <option value="all" style={optionStyle}>Todas las empresas</option>
                      {locations.filter(location => location.value !== 'DELIFOOD').map(location => (
                        <option key={location.value} value={location.value} style={optionStyle}>
                          {location.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-semibold shadow-sm transition-all w-full lg:w-auto ${isEditing
                    ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                    }`}
                  title={isEditing ? 'Salir del modo edición' : 'Activar modo edición'}
                >
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span className="hidden sm:inline">{isEditing ? 'Modo edición activo' : 'Editar horarios'}</span>
                    <span className="sm:hidden">{isEditing ? 'Edición' : 'Editar'}</span>
                  </span>
                  <span className={`h-2.5 w-2.5 rounded-full ${isEditing ? 'bg-green-300 shadow-[0_0_0_4px_rgba(134,239,172,0.35)]' : 'bg-white/70'}`}></span>
                </button>
              </div>

              {/* Fila 2: Período */}
              <div className="flex flex-col xl:flex-row gap-3 xl:gap-4 items-stretch">
                <div className="flex items-center gap-3 flex-1 w-full bg-white/80 dark:bg-gray-900/60 border border-[var(--input-border)] rounded-xl px-3 py-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                    <Calendar className="w-5 h-5" />
                  </span>
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tab-text)]">Seleccionar quincena</p>
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
                      className="w-full bg-transparent text-sm font-medium text-[var(--foreground)] focus:outline-none appearance-none"
                      style={{ backgroundColor: 'transparent' }}
                    >
                      {availablePeriods.length === 0 ? (
                        <option value="" style={optionStyle}>Cargando quincenas...</option>
                      ) : (
                        availablePeriods.map((period) => (
                          <option
                            key={`${period.year}-${period.month}-${period.period}`}
                            value={`${period.year}-${period.month}-${period.period}`}
                            style={optionStyle}
                          >
                            {period.label}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 bg-white dark:bg-gray-900/70 border border-[var(--input-border)] rounded-xl px-3 py-3 w-full xl:w-auto">
                  <button
                    onClick={() => navigatePeriod('prev')}
                    disabled={!currentPeriod || availablePeriods.findIndex(p =>
                      p.year === currentPeriod.year &&
                      p.month === currentPeriod.month &&
                      p.period === currentPeriod.period
                    ) >= availablePeriods.length - 1}
                    className="h-10 w-10 rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-500/50 dark:text-blue-200 dark:hover:bg-blue-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Quincena anterior"
                  >
                    <ChevronLeft className="w-5 h-5 mx-auto" />
                  </button>
                  <div className="text-center">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--tab-text)]">Período activo</p>
                    <p className="text-sm sm:text-base font-semibold text-[var(--foreground)]">
                      {currentPeriod?.label || 'Cargando...'}
                    </p>
                  </div>
                  <button
                    onClick={() => navigatePeriod('next')}
                    disabled={!currentPeriod || availablePeriods.findIndex(p =>
                      p.year === currentPeriod.year &&
                      p.month === currentPeriod.month &&
                      p.period === currentPeriod.period
                    ) <= 0}
                    className="h-10 w-10 rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-500/50 dark:text-blue-200 dark:hover:bg-blue-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Quincena siguiente"
                  >
                    <ChevronRight className="w-5 h-5 mx-auto" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Leyenda de colores */}
          <div className="mb-4 sm:mb-6">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 sm:p-4">
              <h5 className="text-sm font-medium text-[var(--foreground)] mb-3 text-center sm:text-left">
                Leyenda de Turnos:
              </h5>
              <div className="flex flex-wrap gap-3 sm:gap-4 justify-center sm:justify-start">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: '#FFFF00' }}></div>
                  <span className="text-sm font-medium">D - Diurno</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: '#87CEEB' }}></div>
                  <span className="text-sm font-medium">N - Nocturno</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: '#FF00FF' }}></div>
                  <span className="text-sm font-medium">L - Libre</span>
                </div>
              </div>
            </div>
          </div>

          {/* Contenido de horarios */}
          <div className="space-y-4 sm:space-y-6">
            {scheduleData.map((locationData, locationIndex) => (
              <div key={locationIndex} className="border border-[var(--input-border)] rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 sm:px-6 sm:py-4 border-b border-[var(--input-border)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                    <h4 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                      <span className="truncate">{locationData.location.label}</span>
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-[var(--tab-text)]">
                      {locationData.employees.length > 0 && (
                        <span>
                          {locationData.employees.length} empleado{locationData.employees.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {locationData.employees.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 text-[var(--tab-text)]">
                    <FileText className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm sm:text-base">No hay horarios registrados para este período</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-full">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th
                              className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 font-semibold text-left bg-gray-50 dark:bg-gray-800/50 sticky left-0 z-10"
                              style={{ color: 'var(--foreground)', minWidth: '120px' }}
                            >
                              Empleado
                            </th>
                            {getDaysInPeriod().map(day => (
                              <th
                                key={day}
                                className="border-b border-r border-[var(--input-border)] p-1 sm:p-2 font-semibold text-center bg-gray-50 dark:bg-gray-800/50 min-w-[35px]"
                                style={{ color: 'var(--foreground)' }}
                              >
                                <span className="text-xs sm:text-sm">{day}</span>
                              </th>
                            ))}
                            <th
                              className="border-b border-[var(--input-border)] p-2 sm:p-3 font-semibold text-center bg-gray-50 dark:bg-gray-800/50 min-w-[50px]"
                              style={{ color: 'var(--foreground)' }}
                            >
                              <span className="text-xs sm:text-sm">Total</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {locationData.employees.map((employee, empIndex) => (
                            <tr key={empIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                              <td
                                className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 font-medium sticky left-0 z-10 bg-inherit"
                                style={{ color: 'var(--foreground)' }}
                              >
                                <span className="text-sm sm:text-base truncate block max-w-[120px]" title={employee.employeeName}>
                                  {employee.employeeName}
                                </span>
                              </td>
                              {getDaysInPeriod().map(day => {
                                const cellKey = getCellKey(locationData.location.value, employee.employeeName, day);
                                const currentValue = editableSchedules[cellKey] !== undefined
                                  ? editableSchedules[cellKey]
                                  : employee.days[day] || '';

                                return (
                                  <td key={day} className="border-b border-r border-[var(--input-border)] p-0 min-w-[35px]">
                                    {isEditing ? (
                                      <select
                                        value={currentValue}
                                        onChange={(e) => handleCellChange(locationData.location.value, employee.employeeName, day, e.target.value)}
                                        onBlur={() => handleCellBlur(locationData.location.value, employee.employeeName, day)}
                                        className="w-full h-full p-1 text-center font-semibold text-xs sm:text-sm border-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        style={{
                                          ...getCellStyle(currentValue),
                                          minHeight: '32px'
                                        }}
                                      >
                                        <option value="">-</option>
                                        <option value="D">D</option>
                                        <option value="N">N</option>
                                        <option value="L">L</option>
                                      </select>
                                    ) : (
                                      <div
                                        className="w-full h-full p-1 text-center font-semibold text-xs sm:text-sm flex items-center justify-center"
                                        style={getCellStyle(currentValue)}
                                      >
                                        {currentValue || '-'}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                              <td
                                className="border-b border-[var(--input-border)] p-2 sm:p-3 text-center font-medium bg-gray-50 dark:bg-gray-800/50"
                                style={{ color: 'var(--foreground)' }}
                              >
                                <span className="text-sm sm:text-base">
                                  {Object.values(employee.days).filter(shift => shift === 'D' || shift === 'N').length}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
