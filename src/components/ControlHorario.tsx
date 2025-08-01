// src/components/ControlHorario.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Clock, ChevronLeft, ChevronRight, Save, LogOut, User as UserIcon, Lock, Unlock, Info } from 'lucide-react';
import { LocationsService } from '../services/locations';
import { SchedulesService } from '../services/schedules';
import type { ScheduleEntry } from '../services/schedules';
import { CcssConfigService } from '../services/ccss-config';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';
import DelifoodHoursModal from './DelifoodHoursModal';
import ConfirmModal from './ConfirmModal';
import type { Location } from '../types/firestore';
import type { User as FirestoreUser } from '../types/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';

interface ScheduleData {
  [employeeName: string]: {
    [day: string]: string;
  };
}

// Componente para el tooltip que muestra resumen con datos reales de la BD
function EmployeeTooltipSummary({ 
  employeeName, 
  locationValue, 
  year, 
  month, 
  daysToShow,
  isDelifoodLocation = false,
  delifoodHoursData = {}
}: {
  employeeName: string;
  locationValue: string;
  year: number;
  month: number;
  daysToShow: number[];
  isDelifoodLocation?: boolean;
  delifoodHoursData?: { [employeeName: string]: { [day: string]: { hours: number } } };
}) {
  const [summary, setSummary] = React.useState<{
    workedDays: number;
    hours: number;
    colones: number;
    ccss: number;
    neto: number;
    extraAmount: number;
  } | null>(null);

  React.useEffect(() => {
    const fetchSummary = async () => {
      try {
        // Obtener información de la ubicación que contiene los empleados
        const locations = await LocationsService.findLocationsByValue(locationValue);
        const currentLocation = locations[0]; // Tomar la primera coincidencia
        const employee = currentLocation?.employees?.find(emp => emp.name === employeeName);
        
        // Obtener horarios del empleado para este mes - usar JavaScript month (0-11)
        const schedules = await SchedulesService.getSchedulesByLocationEmployeeMonth(
          locationValue,
          employeeName,
          year,
          month // Usar JavaScript month (0-11) para consistencia
        );

        // Obtener configuración CCSS actualizada
        const ccssConfig = await CcssConfigService.getCcssConfig();

        let workedDaysInPeriod = 0;
        let totalHours = 0;

        if (isDelifoodLocation) {
          // Para DELIFOOD, usar las horas directamente de horasPorDia
          totalHours = daysToShow.reduce((total, day) => {
            const hours = delifoodHoursData[employeeName]?.[day.toString()]?.hours || 0;
            return total + hours;
          }, 0);
          
          // Para DELIFOOD, los "días trabajados" son los días que tienen horas > 0
          workedDaysInPeriod = daysToShow.filter(day => {
            const hours = delifoodHoursData[employeeName]?.[day.toString()]?.hours || 0;
            return hours > 0;
          }).length;
        } else {
          // Para ubicaciones normales, usar datos REALES de la BD
          const scheduleMap = new Map<number, { shift: string; horasPorDia?: number }>();
          
          // Crear mapa de horarios por día
          schedules.forEach((schedule) => {
            scheduleMap.set(schedule.day, {
              shift: schedule.shift,
              horasPorDia: schedule.horasPorDia
            });
          });

          // Calcular días trabajados y horas totales basado en el período mostrado (daysToShow)
          daysToShow.forEach(day => {
            const daySchedule = scheduleMap.get(day);
            
            if (daySchedule && (daySchedule.shift === 'N' || daySchedule.shift === 'D')) {
              workedDaysInPeriod++;
              
              // Usar horasPorDia de la BD si está disponible, sino usar hoursPerShift del empleado
              if (daySchedule.horasPorDia && daySchedule.horasPorDia > 0) {
                totalHours += daySchedule.horasPorDia;
              } else {
                // Fallback: usar hoursPerShift configurado en el empleado
                const hoursPerDay = employee?.hoursPerShift || 8;
                totalHours += hoursPerDay;
              }
            }
          });
        }

        // **CÁLCULOS DE SALARIO BASADOS EN DATOS REALES**
        const ccssType = employee?.ccssType || 'MT';
        const extraAmount = employee?.extraAmount || 0;
        
        // Si no hay horas trabajadas, todo es 0
        let grossSalary = 0;
        let ccssDeduction = 0;
        let netSalary = 0;
        let hourlyRate = 0;
        
        if (totalHours > 0) {
          // Usar horabruta de la configuración CCSS obtenida desde la base de datos
          hourlyRate = ccssConfig.horabruta;
          
          // Calcular salario bruto: horas trabajadas × valor por hora
          grossSalary = totalHours * hourlyRate;
          
          // Deducción CCSS según el tipo de empleado
          const ccssAmount = ccssType === 'TC' ? ccssConfig.tc : ccssConfig.mt;
          ccssDeduction = ccssAmount;
          
          // Salario neto = bruto - deducción CCSS + monto extra
          netSalary = grossSalary - ccssDeduction + extraAmount;
        } else {
          // Si no hay horas trabajadas, pero hay extraAmount, solo mostrar el extra
          netSalary = extraAmount;
        }

        console.log(`📊 Tooltip Summary for ${employeeName}:`, {
          workedDaysInPeriod,
          totalHours,
          hourlyRate: hourlyRate.toFixed(2),
          grossSalary: grossSalary.toFixed(2),
          ccssDeduction,
          extraAmount,
          netSalary: netSalary.toFixed(2),
          period: `${daysToShow[0]}-${daysToShow[daysToShow.length - 1]}`,
          isDelifoodLocation
        });

        setSummary({
          workedDays: workedDaysInPeriod,
          hours: totalHours,
          colones: grossSalary,
          ccss: ccssDeduction,
          neto: netSalary,
          extraAmount: extraAmount
        });
      } catch (error) {
        console.error('Error fetching employee summary:', error);
        // Fallback a datos por defecto en caso de error
        setSummary({
          workedDays: 0,
          hours: 0,
          colones: 0,
          ccss: 0,
          neto: 0,
          extraAmount: 0
        });
      }
    };

    fetchSummary();
  }, [employeeName, locationValue, year, month, daysToShow, isDelifoodLocation, delifoodHoursData]);

  if (!summary) {
    return <div>Cargando...</div>;
  }

  return (
    <>
      <div><b>{isDelifoodLocation ? 'Días con horas:' : 'Días trabajados:'}</b> {summary.workedDays}</div>
      <div><b>Horas trabajadas:</b> {summary.hours}</div>
      <div><b>Total bruto:</b> ₡{summary.colones.toLocaleString('es-CR')}</div>
      <div><b>CCSS:</b> -₡{summary.ccss.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</div>
      {summary.extraAmount > 0 && (
        <div><b>Monto extra:</b> +₡{summary.extraAmount.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</div>
      )}
      <div><b>Salario neto:</b> ₡{summary.neto.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</div>
    </>
  );
}

export default function ControlHorario() {
  const { user, isAuthenticated, login, logout, canChangeLocation, isSuperAdmin } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleData, setScheduleData] = useState<ScheduleData>({});
  const [viewMode, setViewMode] = useState<'first' | 'second'>('first');
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('Todos');
  const [selectedPeriod, setSelectedPeriod] = useState<'1-15' | '16-30' | 'monthly'>('1-15');
  const [fullMonthView, setFullMonthView] = useState(false);
  const [showEmployeeSummary, setShowEmployeeSummary] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    message: string;
    onConfirm: (() => Promise<void>) | null;
    actionType?: 'assign' | 'delete' | 'change';
  }>({ open: false, message: '', onConfirm: null, actionType: 'assign' });
  const [modalLoading, setModalLoading] = useState(false);
  const [editPastDaysEnabled, setEditPastDaysEnabled] = useState(false);
  const [unlockPastDaysModal, setUnlockPastDaysModal] = useState(false);
  // Estado para exportación y QR
  const [isExporting, setIsExporting] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeDataURL, setQRCodeDataURL] = useState('');
  const [storageRef, setStorageRef] = useState('');
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  // Estado para countdown de validez del QR
  const [qrCountdown, setQrCountdown] = useState<number | null>(null);
  // Estado para horas de DELIFOOD
  const [delifoodHoursData, setDelifoodHoursData] = useState<{ [employeeName: string]: { [day: string]: { hours: number } } }>({});
  const [delifoodModal, setDelifoodModal] = useState<{ isOpen: boolean; employeeName: string; day: number; currentHours: number }>({
    isOpen: false,
    employeeName: '',
    day: 0,
    currentHours: 0
  });

  // Cargar datos desde Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        const locationsData = await LocationsService.getAllLocations();
        setLocations(locationsData);
      } catch (error) {
        console.error('Error loading locations from Firebase:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Efecto para manejar la ubicación del usuario autenticado
  useEffect(() => {
    if (isAuthenticated && user?.location && !location) {
      setLocation(user.location);
    }
  }, [isAuthenticated, user, location]);

  // Función para mostrar notificaciones
  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Verificar si la ubicación actual es DELIFOOD
  const isDelifoodLocation = location.toLowerCase().includes('delifood');

  // Cargar horarios de Firebase cuando cambie la ubicación
  useEffect(() => {
    const loadScheduleData = async () => {
      if (!location || !locations.find(l => l.value === location)?.names?.length) return;

      const names = locations.find(l => l.value === location)?.names || [];
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      try {
        // Determinar el mes correcto para la consulta
        // Si los datos históricos están guardados con JavaScript month (0-11), usar month
        // Si están guardados con calendario month (1-12), usar month + 1
        const dbMonth = month; // Temporal: usar month directamente para ver datos históricos
        console.log('🧪 TESTING: Querying with JavaScript month (0-11):', dbMonth);
        console.log('Current month displayed:', new Date(year, month).toLocaleDateString('es-CR', { month: 'long' }));
        
        const scheduleEntries: ScheduleEntry[][] = await Promise.all(
          names.map(employeeName =>
            SchedulesService.getSchedulesByLocationEmployeeMonth(location, employeeName, year, dbMonth)
          )
        );

        console.log('=== LOADING SCHEDULE DATA ===');
        console.log('Location:', location, 'isDelifoodLocation:', isDelifoodLocation);
        console.log('Year:', year);
        console.log('Current JavaScript Date:', currentDate);
        console.log('Month (JS 0-based):', month, '- Month name:', new Date(year, month).toLocaleDateString('es-CR', { month: 'long' }));
        console.log('Month queried in DB:', dbMonth);
        console.log('Raw Schedule entries from DB:', scheduleEntries);
        
        // Verificar qué meses están realmente en los datos
        scheduleEntries.forEach((employeeEntries, employeeIndex) => {
          const employeeName = names[employeeIndex];
          console.log(`📋 Employee ${employeeName} entries:`, employeeEntries.map(entry => ({
            day: entry.day,
            month: entry.month,
            year: entry.year,
            shift: entry.shift,
            horasPorDia: entry.horasPorDia
          })));
        });

        // Si es DELIFOOD, cargar datos de horas
        if (isDelifoodLocation) {
          const newDelifoodData: { [employeeName: string]: { [day: string]: { hours: number } } } = {};
          
          names.forEach((employeeName, index) => {
            newDelifoodData[employeeName] = {};
            
            // Solo agregar días que realmente tienen datos en Firestore
            scheduleEntries[index].forEach((entry: ScheduleEntry) => {
              if (entry.horasPorDia !== undefined && entry.horasPorDia !== null && entry.horasPorDia > 0) {
                const hours = entry.horasPorDia;
                newDelifoodData[employeeName][entry.day.toString()] = { hours };
                console.log(`✅ DELIFOOD data loaded: ${employeeName} - day ${entry.day} - hours: ${hours} (raw: ${entry.horasPorDia}) - month: ${entry.month}`);
              }
            });
            
            console.log(`Datos finales para ${employeeName}:`, newDelifoodData[employeeName]);
          });

          console.log('=== SETTING DELIFOOD DATA ===');
          console.log('Final newDelifoodData:', newDelifoodData);
          setDelifoodHoursData(newDelifoodData);
          console.log('===============================');
        } else {
          // Para ubicaciones normales, cargar datos de turnos
          const newScheduleData: ScheduleData = {};

          console.log('=== LOADING NORMAL SCHEDULE DATA ===');
          names.forEach((employeeName, index) => {
            newScheduleData[employeeName] = {};
            console.log(`Processing ${employeeName}, scheduleEntries[${index}]:`, scheduleEntries[index]);
            
            scheduleEntries[index].forEach((entry: ScheduleEntry) => {
              // Verificar que exista el campo shift y no esté vacío
              if (entry.shift && entry.shift.trim() !== '') {
                newScheduleData[employeeName][entry.day.toString()] = entry.shift;
                console.log(`✅ NORMAL data loaded: ${employeeName} - day ${entry.day} - shift: ${entry.shift} - month: ${entry.month}`);
              } else {
                console.log(`⚠️ Entry without valid shift: ${employeeName} - day ${entry.day} - shift: "${entry.shift}" - horasPorDia: ${entry.horasPorDia}`);
              }
            });
            
            console.log(`Datos finales para ${employeeName}:`, newScheduleData[employeeName]);
          });

          console.log('=== SETTING NORMAL SCHEDULE DATA ===');
          console.log('Final newScheduleData:', newScheduleData);
          setScheduleData(newScheduleData);
          console.log('====================================');
        }
      } catch (error) {
        console.error('Error loading schedule data:', error);
        showNotification('Error al cargar los horarios', 'error');
      }
    };

    loadScheduleData();
  }, [location, locations, currentDate, isDelifoodLocation, isAuthenticated, loading]);

  // Manejar login exitoso
  const handleLoginSuccess = (userData: FirestoreUser) => {
    login(userData);
    setShowLoginModal(false);
    if (userData.location) {
      setLocation(userData.location);
    }
  };

  // --- AUTO-QUINCENA: Detectar y mostrar la quincena actual SOLO al cargar el mes actual por PRIMERA VEZ en la sesión ---
  const autoQuincenaRef = React.useRef<boolean>(false);
  useEffect(() => {
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === currentDate.getFullYear() && today.getMonth() === currentDate.getMonth();
    if (isAuthenticated && !loading && isCurrentMonth && !autoQuincenaRef.current) {
      if (today.getDate() > 15) {
        setViewMode('second');
      } else {
        setViewMode('first');
      }
      autoQuincenaRef.current = true;
    }
    // Si cambias de mes, permite volver a auto-quincena si regresas al mes actual
    if (!isCurrentMonth) {
      autoQuincenaRef.current = false;
    }
  }, [isAuthenticated, loading, currentDate, viewMode]);

  // Sincronizar selectedPeriod con viewMode y fullMonthView
  useEffect(() => {
    if (fullMonthView) {
      setSelectedPeriod('monthly');
    } else if (viewMode === 'first') {
      setSelectedPeriod('1-15');
    } else if (viewMode === 'second') {
      setSelectedPeriod('16-30');
    }
  }, [viewMode, fullMonthView]);

  // Debug logging para verificar el estado de scheduleData
  useEffect(() => {
    if (!isDelifoodLocation && Object.keys(scheduleData).length > 0) {
      console.log('🔍 Current scheduleData state:', scheduleData);
    }
  }, [scheduleData, isDelifoodLocation]);

  // Verificar si necesita autenticación
  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4 sm:p-6">
        <div className="text-center py-8">
          <Clock className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-blue-600" />
          <h3 className="text-xl sm:text-2xl font-semibold mb-4">Control de Horarios</h3>
          <p className="text-sm sm:text-base text-[var(--tab-text)] mb-6">
            Necesitas iniciar sesión para acceder a esta funcionalidad
          </p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
          >
            Iniciar Sesión
          </button>
        </div>

        <LoginModal
          isOpen={showLoginModal}
          onLoginSuccess={handleLoginSuccess}
          onClose={() => setShowLoginModal(false)}
          title="Control de Horarios"
        />
      </div>
    );
  }

  const names = locations.find(l => l.value === location)?.names || [];

  // Obtener información del mes actual
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Determinar qué días mostrar según el modo de vista o vista mensual completa
  const getDaysToShow = () => {
    if (fullMonthView) {
      return Array.from({ length: daysInMonth }, (_, i) => i + 1);
    }
    if (viewMode === 'first') {
      return Array.from({ length: 15 }, (_, i) => i + 1);
    } else {
      return Array.from({ length: daysInMonth - 15 }, (_, i) => i + 16);
    }
  };
  const daysToShow = getDaysToShow();  // Función para actualizar un horario específico
  const updateScheduleCell = async (employeeName: string, day: string, newValue: string) => {
    const currentValue = scheduleData[employeeName]?.[day] || '';

    // Validar que solo usuarios ADMIN puedan asignar turnos V (Vacaciones) e I (Incapacidad)
    if (newValue && ['V', 'I'].includes(newValue) && !isUserAdmin()) {
      const stateName = newValue === 'V' ? 'Vacaciones' : 'Incapacidad';
      showNotification(`Solo usuarios ADMIN pueden asignar "${stateName}".`, 'error');
      return;
    }

    // Validar que solo pueda haber una persona por día con el mismo turno (N, D) - permitir máximo 2 L
    if (newValue && ['N', 'D'].includes(newValue)) {
      // Verificar si ya hay alguien más con este turno en este día (solo para N y D)
      const existingEmployee = Object.keys(scheduleData).find(employee =>
        employee !== employeeName && scheduleData[employee]?.[day] === newValue
      );
      if (existingEmployee) {
        showNotification(`No se puede asignar el turno "${newValue}". ${existingEmployee} ya tiene este turno el día ${day}.`, 'error');
        return;
      }
    }

    // Validar que solo pueda haber máximo 2 personas con turno "L" por día
    if (newValue === 'L') {
      const employeesWithL = Object.keys(scheduleData).filter(employee =>
        employee !== employeeName && scheduleData[employee]?.[day] === 'L'
      );
      if (employeesWithL.length >= 2) {
        showNotification(`No se puede asignar más turnos "L".\n Ya hay 2 empleados libres el día ${day}: ${employeesWithL.join(', ')}.`, 'error');
        return;
      }
    }

    // Confirmar asignación de turno nuevo
    if (!currentValue && ['N', 'D', 'L', 'V', 'I'].includes(newValue)) {
      let confirmMessage = `¿Está seguro de asignar el turno "${newValue}" a ${employeeName} el día ${day}?`;
      
      // Mensajes específicos para los nuevos estados
      if (newValue === 'V') {
        confirmMessage = `¿Está seguro de marcar a ${employeeName} como "Vacaciones" el día ${day}?`;
      } else if (newValue === 'I') {
        confirmMessage = `¿Está seguro de marcar a ${employeeName} como "Incapacidad" el día ${day}?`;
      }

      setConfirmModal({
        open: true,
        message: confirmMessage,
        onConfirm: async () => {
          setModalLoading(true);
          await doUpdate();
          setModalLoading(false);
          setConfirmModal({ open: false, message: '', onConfirm: null, actionType: 'assign' });
        },
        actionType: 'assign',
      });
      return;
    }

    // Confirmar cambio o eliminación de turno
    if (currentValue && ['N', 'D', 'L', 'V', 'I'].includes(currentValue) && currentValue !== newValue) {
      let confirmMessage = '';
      let actionType: 'delete' | 'change' = 'change';
      if (newValue === '' || newValue.trim() === '') {
        // Mensaje específico según el tipo de estado que se está eliminando
        let stateDescription = currentValue;
        if (currentValue === 'V') stateDescription = 'Vacaciones';
        else if (currentValue === 'I') stateDescription = 'Incapacidad';
        else if (currentValue === 'L') stateDescription = 'Libre';
        else if (currentValue === 'N') stateDescription = 'Nocturno';
        else if (currentValue === 'D') stateDescription = 'Diurno';
        
        confirmMessage = `¿Está seguro de eliminar "${stateDescription}" de ${employeeName} del día ${day}? Esto eliminará el registro de la base de datos.`;
        actionType = 'delete';
      } else {
        // Mensajes específicos para cambios
        let fromDescription = currentValue;
        let toDescription = newValue;
        
        if (currentValue === 'V') fromDescription = 'Vacaciones';
        else if (currentValue === 'I') fromDescription = 'Incapacidad';
        else if (currentValue === 'L') fromDescription = 'Libre';
        
        if (newValue === 'V') toDescription = 'Vacaciones';
        else if (newValue === 'I') toDescription = 'Incapacidad';
        else if (newValue === 'L') toDescription = 'Libre';
        
        confirmMessage = `¿Está seguro de cambiar a ${employeeName} del día ${day} de "${fromDescription}" a "${toDescription}"?`;
        actionType = 'change';
      }
      setConfirmModal({
        open: true,
        message: confirmMessage,
        onConfirm: async () => {
          setModalLoading(true);
          await doUpdate();
          setModalLoading(false);
          setConfirmModal({ open: false, message: '', onConfirm: null, actionType });
        },
        actionType,
      });
      return;
    }

    await doUpdate();

    async function doUpdate() {
      try {
        setSaving(true);
        
        console.log('🔄 SAVING SCHEDULE DATA:');
        console.log('Current Date:', currentDate);
        console.log('JS Month (0-based):', month, '- Month name:', new Date(year, month).toLocaleDateString('es-CR', { month: 'long' }));
        console.log('🧪 TESTING: Sending to DB with JavaScript month:', month);
        console.log('Full save data:', { location, employeeName, year, month: month, day: parseInt(day), newValue });
        
        await SchedulesService.updateScheduleShift(
          location,
          employeeName,
          year,
          month, // Usar JavaScript month (0-11) para consistencia
          parseInt(day),
          newValue
        );
        setScheduleData(prev => ({
          ...prev,
          [employeeName]: {
            ...prev[employeeName],
            [day]: newValue
          }
        }));
        if (newValue === '' || newValue.trim() === '') {
          showNotification('Turno eliminado correctamente (documento borrado)', 'success');
        } else {
          showNotification('Horario actualizado correctamente', 'success');
        }
      } catch (error) {
        console.error('Error updating schedule:', error);
        showNotification('Error al actualizar el horario', 'error');
      } finally {
        setSaving(false);
      }
    }
  };

  // Función para verificar si el usuario es admin
  const isUserAdmin = () => {
    return user?.role === 'admin' || user?.role === 'superadmin';
  };

  // Opciones de turnos disponibles
  const getShiftOptions = () => {
    const baseOptions = [
      { value: '', label: '', color: 'var(--input-bg)', textColor: 'var(--foreground)' },
      { value: 'N', label: 'N', color: '#87CEEB', textColor: '#000' },
      { value: 'D', label: 'D', color: '#FFFF00', textColor: '#000' },
      { value: 'L', label: 'L', color: '#FF00FF', textColor: '#FFF' },
    ];

    // Agregar opciones adicionales solo para usuarios ADMIN
    if (isUserAdmin()) {
      baseOptions.push(
        { value: 'V', label: 'V', color: '#28a745', textColor: '#FFF' }, // Verde para Vacaciones
        { value: 'I', label: 'I', color: '#fd7e14', textColor: '#FFF' }  // Naranja para Incapacidad
      );
    }

    return baseOptions;
  };

  const shiftOptions = getShiftOptions();

  // Opciones completas para visualización (todos los usuarios pueden ver los colores)
  const getAllShiftColors = () => [
    { value: '', label: '', color: 'var(--input-bg)', textColor: 'var(--foreground)' },
    { value: 'N', label: 'N', color: '#87CEEB', textColor: '#000' },
    { value: 'D', label: 'D', color: '#FFFF00', textColor: '#000' },
    { value: 'L', label: 'L', color: '#FF00FF', textColor: '#FFF' },
    { value: 'V', label: 'V', color: '#28a745', textColor: '#FFF' }, // Verde para Vacaciones
    { value: 'I', label: 'I', color: '#fd7e14', textColor: '#FFF' }  // Naranja para Incapacidad
  ];

  // Función para obtener el color de fondo según la letra (todos los usuarios ven todos los colores)
  const getCellStyle = (value: string) => {
    const allColors = getAllShiftColors();
    const option = allColors.find(opt => opt.value === value);
    return option ? {
      backgroundColor: option.color,
      color: option.textColor
    } : {
      backgroundColor: 'var(--input-bg)',
      color: 'var(--foreground)'
    };
  };
  // Función para manejar cambios en las celdas
  const handleCellChange = (employeeName: string, day: number, value: string) => {
    const currentValue = scheduleData[employeeName]?.[day.toString()] || '';
    
    // Prevenir cambios en celdas V/I por usuarios regulares
    if (!isUserAdmin() && ['V', 'I'].includes(currentValue)) {
      const stateName = currentValue === 'V' ? 'Vacaciones' : 'Incapacidad';
      showNotification(`Solo usuarios ADMIN pueden modificar estados de "${stateName}".`, 'error');
      return;
    }
    
    updateScheduleCell(employeeName, day.toString(), value);
  };

  // Funciones para DELIFOOD
  const handleDelifoodCellClick = (employeeName: string, day: number) => {
    const currentHours = delifoodHoursData[employeeName]?.[day.toString()]?.hours || 0;
    setDelifoodModal({
      isOpen: true,
      employeeName,
      day,
      currentHours
    });
  };

  const handleDelifoodHoursSave = async (hours: number) => {
    const { employeeName, day } = delifoodModal;
    
    console.log('🧪 TESTING: Guardando horas con JavaScript month:', { location, employeeName, year, month: month, day, hours });
    
    if (!location || !employeeName) return;

    try {
      setSaving(true);
      
      // Actualizar en Firebase - usar JavaScript month (0-11) para consistencia
      await SchedulesService.updateScheduleHours(
        location,
        employeeName,
        year,
        month, // Usar JavaScript month (0-11) para consistencia
        day,
        hours
      );

      console.log('Horas guardadas en Firebase, actualizando estado local');

      // Actualizar estado local
      setDelifoodHoursData(prev => {
        const newData = { ...prev };
        
        if (hours <= 0) {
          // Si las horas son 0, eliminar la entrada del estado local
          if (newData[employeeName]) {
            delete newData[employeeName][day.toString()];
          }
        } else {
          // Si las horas son > 0, agregar/actualizar la entrada
          if (!newData[employeeName]) {
            newData[employeeName] = {};
          }
          newData[employeeName][day.toString()] = { hours };
        }
        
        console.log('Nuevo estado local:', newData);
        return newData;
      });

      if (hours <= 0) {
        setNotification({ message: 'Registro eliminado (0 horas)', type: 'success' });
      } else {
        setNotification({ message: 'Horas guardadas correctamente', type: 'success' });
      }
    } catch (error) {
      console.error('Error al guardar horas:', error);
      setNotification({ message: 'Error al guardar las horas', type: 'error' });
    } finally {
      setSaving(false);
      setDelifoodModal({ isOpen: false, employeeName: '', day: 0, currentHours: 0 });
    }
  };

  // Función para cambiar mes
  const changeMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      console.log('📅 CHANGING MONTH:');
      console.log('Previous date:', prev);
      console.log('Previous month (JS):', prev.getMonth(), '- Month name:', prev.toLocaleDateString('es-CR', { month: 'long' }));
      
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      
      console.log('New date:', newDate);
      console.log('New month (JS):', newDate.getMonth(), '- Month name:', newDate.toLocaleDateString('es-CR', { month: 'long' }));
      console.log('Will query DB with month (JavaScript 0-11):', newDate.getMonth());
      
      return newDate;
    });
  };

  // Función para exportar horarios como imagen (Solo SuperAdmin) - Descarga directa
  const exportScheduleAsImage = async () => {
    if (!isSuperAdmin()) {
      showNotification('Solo SuperAdmin puede exportar como imagen', 'error');
      return;
    }

    try {
      setIsExporting(true);

      // Crear un canvas para generar la imagen
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('No se pudo crear el contexto del canvas');
      }

      // Configurar dimensiones dinámicas basadas en el contenido
      const employeeCount = names.length;
      const dayCount = daysToShow.length;
      const baseWidth = 1400;
      const baseHeight = 800 + (employeeCount * 50);
      
      canvas.width = Math.max(baseWidth, 300 + (dayCount * 60));
      canvas.height = Math.max(baseHeight, 600 + (employeeCount * 50));

      // Fondo blanco
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Configuraciones de diseño
      const marginX = 60;
      const marginY = 80;
      const employeeNameWidth = 200;
      const workedDaysColumnWidth = 120; // Nueva columna para días trabajados
      const availableWidth = canvas.width - marginX * 2 - employeeNameWidth - workedDaysColumnWidth;
      const cellWidth = Math.max(50, availableWidth / dayCount);
      const cellHeight = 50;

      let yPosition = marginY;

      // --- ENCABEZADO ---
      // Título principal
      ctx.font = 'bold 36px Arial';
      ctx.fillStyle = '#1f2937';
      ctx.textAlign = 'center';
      ctx.fillText('📅 Control de Horarios - Price Master', canvas.width / 2, yPosition);
      yPosition += 50;

      // Información del reporte
      ctx.font = '20px Arial';
      ctx.fillStyle = '#4b5563';
      const selectedPeriodText = fullMonthView ? 'Mes Completo' : 
                                  viewMode === 'first' ? 'Primera Quincena (1-15)' : 'Segunda Quincena (16-fin)';
      
      ctx.fillText(`📍 Ubicación: ${locations.find(l => l.value === location)?.label || location}`, canvas.width / 2, yPosition);
      yPosition += 35;
      ctx.fillText(`📅 Período: ${monthName} - ${selectedPeriodText}`, canvas.width / 2, yPosition);
      yPosition += 35;
      ctx.fillText(`👤 Exportado por: ${user?.name} (SuperAdmin)`, canvas.width / 2, yPosition);
      yPosition += 35;
      ctx.fillText(`🕒 ${new Date().toLocaleDateString('es-CR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`, canvas.width / 2, yPosition);
      
      yPosition += 60;
      ctx.textAlign = 'left';

      // --- TABLA DE HORARIOS ---
      const tableStartY = yPosition;
      
      // Encabezados
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#1f2937';
      
      // Encabezado "Empleado"
      ctx.fillRect(marginX, tableStartY, employeeNameWidth, cellHeight);
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 2;
      ctx.strokeRect(marginX, tableStartY, employeeNameWidth, cellHeight);
      ctx.fillStyle = '#1f2937';
      ctx.textAlign = 'center';
      ctx.fillText('Empleado', marginX + employeeNameWidth / 2, tableStartY + cellHeight / 2 + 6);

      // Encabezados de días
      const daysStartX = marginX + employeeNameWidth;
      daysToShow.forEach((day, index) => {
        const x = daysStartX + (index * cellWidth);
        
        // Fondo del encabezado
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x, tableStartY, cellWidth, cellHeight);
        ctx.strokeRect(x, tableStartY, cellWidth, cellHeight);
        
        // Texto del día
        ctx.fillStyle = '#1f2937';
        ctx.fillText(day.toString(), x + cellWidth / 2, tableStartY + cellHeight / 2 + 6);
      });

      // Encabezado "Días Trabajados" o "Total Horas" al final
      const workedDaysHeaderX = daysStartX + (dayCount * cellWidth);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(workedDaysHeaderX, tableStartY, workedDaysColumnWidth, cellHeight);
      ctx.strokeRect(workedDaysHeaderX, tableStartY, workedDaysColumnWidth, cellHeight);
      ctx.fillStyle = '#1f2937';
      const headerText = isDelifoodLocation ? 'Total Horas' : 'Días Trab.';
      ctx.fillText(headerText, workedDaysHeaderX + workedDaysColumnWidth / 2, tableStartY + cellHeight / 2 + 6);
      daysToShow.forEach((day, index) => {
        const x = daysStartX + (index * cellWidth);
        
        // Fondo del encabezado
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x, tableStartY, cellWidth, cellHeight);
        ctx.strokeRect(x, tableStartY, cellWidth, cellHeight);
        
        // Texto del día
        ctx.fillStyle = '#1f2937';
        ctx.fillText(day.toString(), x + cellWidth / 2, tableStartY + cellHeight / 2 + 6);
      });

      // Filas de empleados
      yPosition = tableStartY + cellHeight;
      names.forEach((employeeName, empIndex) => {
        // Calcular días trabajados o total de horas según el tipo de ubicación
        let summaryValue = 0;
        if (isDelifoodLocation) {
          // Para DELIFOOD, sumar todas las horas del período
          summaryValue = daysToShow.reduce((total, day) => {
            const hours = delifoodHoursData[employeeName]?.[day.toString()]?.hours || 0;
            return total + hours;
          }, 0);
        } else {
          // Para ubicaciones normales, contar días trabajados
          summaryValue = daysToShow.filter(day => {
            const shift = scheduleData[employeeName]?.[day.toString()] || '';
            return shift === 'N' || shift === 'D'; // Solo contar Nocturno y Diurno
          }).length;
        }

        // Celda del nombre del empleado
        ctx.fillStyle = empIndex % 2 === 0 ? '#f8fafc' : '#ffffff';
        ctx.fillRect(marginX, yPosition, employeeNameWidth, cellHeight);
        ctx.strokeStyle = '#d1d5db';
        ctx.strokeRect(marginX, yPosition, employeeNameWidth, cellHeight);
        
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(employeeName, marginX + 10, yPosition + cellHeight / 2 + 6);

        // Celdas de horarios
        daysToShow.forEach((day, dayIndex) => {
          const x = daysStartX + (dayIndex * cellWidth);

          if (isDelifoodLocation) {
            // Para DELIFOOD, mostrar horas
            const hours = delifoodHoursData[employeeName]?.[day.toString()]?.hours || 0;
            
            // Color de fondo según si hay horas registradas
            let bgColor = empIndex % 2 === 0 ? '#f8fafc' : '#ffffff';
            let textColor = '#000000';
            
            if (hours > 0) {
              bgColor = '#d1fae5'; // Verde claro para horas registradas
              textColor = '#065f46'; // Verde oscuro para el texto
            }

            // Dibujar celda
            ctx.fillStyle = bgColor;
            ctx.fillRect(x, yPosition, cellWidth, cellHeight);
            ctx.strokeStyle = '#d1d5db';
            ctx.strokeRect(x, yPosition, cellWidth, cellHeight);

            // Texto de las horas
            if (hours > 0) {
              ctx.fillStyle = textColor;
              ctx.font = 'bold 16px Arial';
              ctx.textAlign = 'center';
              ctx.fillText(hours.toString(), x + cellWidth / 2, yPosition + cellHeight / 2 + 6);
            }
          } else {
            // Para ubicaciones normales, mostrar turnos
            const shift = scheduleData[employeeName]?.[day.toString()] || '';

            // Color de fondo según el turno
            let bgColor = empIndex % 2 === 0 ? '#f8fafc' : '#ffffff';
            let textColor = '#000000';
            
            if (shift === 'N') {
              bgColor = '#87CEEB'; // Azul claro
              textColor = '#000000';
            } else if (shift === 'D') {
              bgColor = '#FFFF00'; // Amarillo
              textColor = '#000000';
            } else if (shift === 'L') {
              bgColor = '#FF00FF'; // Magenta
              textColor = '#ffffff';
            } else if (shift === 'V') {
              bgColor = '#28a745'; // Verde para Vacaciones
              textColor = '#ffffff';
            } else if (shift === 'I') {
              bgColor = '#fd7e14'; // Naranja para Incapacidad
              textColor = '#ffffff';
            }

            // Dibujar celda
            ctx.fillStyle = bgColor;
            ctx.fillRect(x, yPosition, cellWidth, cellHeight);
            ctx.strokeStyle = '#d1d5db';
            ctx.strokeRect(x, yPosition, cellWidth, cellHeight);

            // Texto del turno
            if (shift) {
              ctx.fillStyle = textColor;
              ctx.font = 'bold 18px Arial';
              ctx.textAlign = 'center';
              ctx.fillText(shift, x + cellWidth / 2, yPosition + cellHeight / 2 + 6);
            }
          }
        });

        // Celda de resumen al final (días trabajados o total horas)
        const summaryCellX = daysStartX + (dayCount * cellWidth);
        ctx.fillStyle = empIndex % 2 === 0 ? '#e0f2fe' : '#f0f8ff'; // Color ligeramente diferente
        ctx.fillRect(summaryCellX, yPosition, workedDaysColumnWidth, cellHeight);
        ctx.strokeRect(summaryCellX, yPosition, workedDaysColumnWidth, cellHeight);
        
        ctx.fillStyle = '#1565c0'; // Color azul para resaltar
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        const displayValue = isDelifoodLocation ? `${summaryValue}h` : summaryValue.toString();
        ctx.fillText(displayValue, summaryCellX + workedDaysColumnWidth / 2, yPosition + cellHeight / 2 + 6);

        yPosition += cellHeight;
      });

      // --- LEYENDA ---
      yPosition += 40;
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = '#1f2937';
      ctx.textAlign = 'center';
      const legendTitle = isDelifoodLocation ? '📋 Leyenda de Horas' : '📋 Leyenda de Turnos';
      ctx.fillText(legendTitle, canvas.width / 2, yPosition);
      yPosition += 40;

      const legendItems = isDelifoodLocation ? [
        { label: 'Verde = Con horas registradas', color: '#d1fae5', textColor: '#000' },
        { label: 'Vacío = Sin horas registradas', color: '#f9fafb', textColor: '#000' },
        { label: 'Número = Horas trabajadas', color: '#ffffff', textColor: '#000' }
      ] : [
        { label: 'N = Nocturno', color: '#87CEEB', textColor: '#000' },
        { label: 'D = Diurno', color: '#FFFF00', textColor: '#000' },
        { label: 'L = Libre', color: '#FF00FF', textColor: '#fff' },
        { label: 'Vacío = Sin asignar', color: '#f9fafb', textColor: '#000' }
      ];

      const legendItemWidth = isDelifoodLocation ? 250 : 200;
      const legendTotalWidth = legendItems.length * legendItemWidth;
      const legendStartX = (canvas.width - legendTotalWidth) / 2;

      legendItems.forEach((item, index) => {
        const x = legendStartX + (index * legendItemWidth);
        
        // Cuadrado de color
        ctx.fillStyle = item.color;
        ctx.fillRect(x, yPosition - 15, 25, 25);
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, yPosition - 15, 25, 25);

        // Texto de la leyenda
        ctx.fillStyle = '#374151';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(item.label, x + 35, yPosition);
      });

      // --- PIE DE PÁGINA ---
      yPosition = canvas.height - 60;
      ctx.font = '12px Arial';
      ctx.fillStyle = '#9ca3af';
      ctx.textAlign = 'center';
      ctx.fillText('Generated by Price Master - Control de Horarios', canvas.width / 2, yPosition);
      const summaryText = isDelifoodLocation ? 'Horas mostradas' : 'Días mostrados';
      ctx.fillText(`Total de empleados: ${names.length} | ${summaryText}: ${dayCount}`, canvas.width / 2, yPosition + 20);
      ctx.fillText('⚠️ Documento confidencial - Solo para uso autorizado', canvas.width / 2, yPosition + 40);

      // Convertir a imagen y descargar directamente
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const filePrefix = isDelifoodLocation ? 'horas-delifood' : 'horarios';
          a.download = `${filePrefix}-${location}-${monthName.replace(/\s+/g, '_')}-${selectedPeriodText.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          const successMessage = isDelifoodLocation ? '📸 Horas DELIFOOD exportadas como imagen exitosamente' : '📸 Horarios exportados como imagen exitosamente';
          showNotification(successMessage, 'success');
        } else {
          throw new Error('Error al generar la imagen');
        }
      }, 'image/png');

    } catch (error) {
      showNotification('Error al exportar horarios como imagen', 'error');
      console.error('Export schedule as image error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Función para exportar la quincena actual como PNG
  const exportQuincenaToPNG = async () => {
    // Validaciones iniciales
    if (!location) {
      showNotification('Error: No hay ubicación seleccionada', 'error');
      return;
    }

    if (!names || names.length === 0) {
      showNotification('Error: No hay empleados para exportar', 'error');
      return;
    }

    if (!daysToShow || daysToShow.length === 0) {
      showNotification('Error: No hay días para mostrar', 'error');
      return;
    }

    setIsExporting(true);
    try {
      // Crear un contenedor temporal para la tabla exportable (HTML plano, sin Tailwind)
      const exportDiv = document.createElement('div');
      exportDiv.style.position = 'absolute';
      exportDiv.style.left = '-9999px';
      exportDiv.style.top = '0';
      exportDiv.style.zIndex = '-1000';
      exportDiv.style.background = '#fff';
      exportDiv.style.color = '#171717';
      exportDiv.style.padding = '32px';
      exportDiv.style.borderRadius = '18px';
      exportDiv.style.fontFamily = 'Arial, sans-serif';
      exportDiv.style.minWidth = '340px';
      
      // Generar HTML plano de la quincena
      let tableHTML = `<h2 style='font-size:1.2rem;font-weight:bold;text-align:center;margin-bottom:1rem;'>Horario Quincenal - Ubicación: ${location}</h2>`;
      tableHTML += `<table style='width:100%;border-collapse:collapse;font-size:1rem;'>`;
      tableHTML += `<thead><tr><th style='border:1px solid #d1d5db;padding:6px 10px;background:#f3f4f6;'>Nombre</th>`;
      
      daysToShow.forEach(day => {
        tableHTML += `<th style='border:1px solid #d1d5db;padding:6px 10px;background:#f3f4f6;'>${day}</th>`;
      });
      
      const summaryHeader = isDelifoodLocation ? 'Total Horas' : 'Días Trab.';
      tableHTML += `<th style='border:1px solid #d1d5db;padding:6px 10px;background:#e0f2fe;color:#1565c0;font-weight:bold;'>${summaryHeader}</th>`;
      tableHTML += `</tr></thead><tbody>`;
      
      names.forEach(name => {
        // Calcular resumen según el tipo de ubicación
        let summaryValue = 0;
        if (isDelifoodLocation) {
          // Para DELIFOOD, sumar todas las horas
          summaryValue = daysToShow.reduce((total, day) => {
            const hours = delifoodHoursData?.[name]?.[day.toString()]?.hours || 0;
            return total + hours;
          }, 0);
        } else {
          // Para ubicaciones normales, contar días trabajados
          summaryValue = daysToShow.filter(day => {
            const shift = scheduleData?.[name]?.[day.toString()] || '';
            return shift === 'N' || shift === 'D'; // Solo contar Nocturno y Diurno
          }).length;
        }
        
        tableHTML += `<tr><td style='border:1px solid #d1d5db;padding:6px 10px;font-weight:bold;background:#f3f4f6;'>${name}</td>`;
        daysToShow.forEach(day => {
          if (isDelifoodLocation) {
            // Para DELIFOOD, mostrar horas
            const hours = delifoodHoursData?.[name]?.[day.toString()]?.hours || 0;
            const bg = hours > 0 ? '#d1fae5' : '#fff'; // Verde claro si hay horas
            const displayValue = hours > 0 ? hours.toString() : '';
            tableHTML += `<td style='border:1px solid #d1d5db;padding:6px 10px;background:${bg};text-align:center;color:#065f46;font-weight:${hours > 0 ? 'bold' : 'normal'};'>${displayValue}</td>`;
          } else {
            // Para ubicaciones normales, mostrar turnos
            const value = scheduleData?.[name]?.[day.toString()] || '';
            let bg = '#fff';
            if (value === 'N') bg = '#87CEEB';
            if (value === 'D') bg = '#FFFF00';
            if (value === 'L') bg = '#FF00FF';
            if (value === 'V') bg = '#28a745'; // Verde para Vacaciones
            if (value === 'I') bg = '#fd7e14'; // Naranja para Incapacidad
            tableHTML += `<td style='border:1px solid #d1d5db;padding:6px 10px;background:${bg};text-align:center;'>${value}</td>`;
          }
        });
        const displaySummary = isDelifoodLocation ? `${summaryValue}h` : summaryValue.toString();
        tableHTML += `<td style='border:1px solid #d1d5db;padding:6px 10px;background:#e0f2fe;text-align:center;font-weight:bold;color:#1565c0;'>${displaySummary}</td>`;
        tableHTML += `</tr>`;
      });
      
      tableHTML += `</tbody></table>`;
      tableHTML += `<div style='margin-top:1.2rem;text-align:right;font-size:0.95rem;opacity:0.7;'>Exportado: ${new Date().toLocaleString('es-CR')}</div>`;
      
      exportDiv.innerHTML = tableHTML;
      document.body.appendChild(exportDiv);
      
      // Esperar un poco para que se renderice
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Importar html2canvas dinámicamente para evitar problemas de SSR
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(exportDiv, {
        useCORS: true,
        allowTaint: true,
        width: exportDiv.scrollWidth,
        height: exportDiv.scrollHeight,
        logging: false
      });
      
      document.body.removeChild(exportDiv);
      
      // Convertir canvas a blob y descargar directamente
      const imgData = canvas.toDataURL('image/png');
      const blob = await (await fetch(imgData)).blob();
      
      // Crear enlace de descarga
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filePrefix = isDelifoodLocation ? 'horas_delifood_quincena' : 'horario_quincena';
      const filenameSuffix = selectedPeriod === 'monthly' ? 'mensual' : 
                            selectedPeriod === '1-15' ? 'primera_quincena' : 'segunda_quincena';
      a.download = `${filePrefix}_${location}_${monthName}_${year}_${filenameSuffix}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      const successMessage = isDelifoodLocation ? 
        '📥 Horas DELIFOOD exportadas exitosamente!' : 
        '📥 Quincena exportada exitosamente!';
      showNotification(successMessage, 'success');
      
    } catch (error) {
      console.error('Error al exportar la quincena:', error);
      let errorMessage = 'Error desconocido';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      showNotification(`Error al exportar la quincena: ${errorMessage}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Si está cargando, mostrar loading
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative flex items-center justify-center mb-4">
            <svg className="animate-spin-slow w-8 h-8 sm:w-12 sm:h-12 text-[var(--foreground)]" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="4" opacity="0.2" />
              <line x1="24" y1="24" x2="24" y2="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <line x1="24" y1="24" x2="36" y2="24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <div className="text-sm sm:text-lg flex items-center">
            Cargando
            <span className="inline-block w-6 text-left">
              <span className="loading-dot">.</span>
              <span className="loading-dot">.</span>
              <span className="loading-dot">.</span>
            </span>
          </div>
        </div>
      </div>
    );
  }
  // Si no hay ubicación seleccionada, mostrar selector
  if (!location) {
    return (
      <div className="max-w-4xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4 sm:p-6">
        <div className="text-center mb-8">
          <Clock className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-blue-600" />
          <h3 className="text-xl sm:text-2xl font-semibold mb-4">Control de Horarios</h3>
          <p className="text-sm sm:text-base text-[var(--tab-text)] mb-6">
            Selecciona una ubicación para continuar
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
              Ubicación:
            </label>
            <select
              className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                color: 'var(--foreground)',
              }}
              value={location}
              onChange={e => setLocation(e.target.value)}
            >
              <option value="">Seleccionar ubicación</option>
              {locations.map((loc: Location) => (
                <option key={loc.value} value={loc.value}>{loc.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>);
  }

  return (
    <>
      <div className="max-w-full mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4 sm:p-6">        {/* Notification */}
        {notification && (
          <div className={`fixed top-4 sm:top-6 right-4 sm:right-6 z-50 px-4 sm:px-6 py-2 sm:py-3 rounded-xl shadow-2xl flex items-center gap-2 font-semibold animate-fade-in-down max-w-xs sm:max-w-sm text-sm sm:text-base ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            } text-white`}>
            {notification.type === 'success' ? (
              <Save className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            ) : (
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            )}
            <span className="truncate">{notification.message}</span>
          </div>
        )}

        {/* Loading indicator */}
        {saving && (
          <div className="fixed top-16 sm:top-20 right-4 sm:right-6 z-40 px-3 sm:px-4 py-2 rounded-lg bg-blue-500 text-white flex items-center gap-2 text-sm sm:text-base">
            <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
            Guardando...
          </div>
        )}

        {/* Header con controles */}
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <Clock className="w-12 h-12 sm:w-16 sm:h-16 text-blue-600" />
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-4">Control de Horarios</h3>
                <p className="text-sm sm:text-base text-[var(--tab-text)] mb-4 sm:mb-6">
                  <span className="block sm:inline">Usuario: {user?.name}</span>
                  <span className="hidden sm:inline"> - </span>
                  <span className="block sm:inline">Ubicación: {location}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Selector de ubicación - solo para administradores */}
              {canChangeLocation() ? (
                <select
                  className="w-full sm:w-auto px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    color: 'var(--foreground)',
                  }}
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                >
                  <option value="">Seleccionar ubicación</option>
                  {locations.map((loc: Location) => (
                    <option key={loc.value} value={loc.value}>{loc.label}</option>
                  ))}
                </select>
              ) : (
                <div className="hidden sm:block px-3 py-2 text-sm text-[var(--tab-text)]">
                </div>
              )}              {/* Botón de logout */}
              <button
                onClick={() => logout()}
                className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors w-full sm:w-auto justify-center"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
                <span>Salir</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Selector de período */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeMonth('prev')}
                  className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h4 className="text-lg font-semibold capitalize flex items-center gap-2">
                  {monthName}
                  {/* Mostrar candado si hay al menos un día pasado en la vista, sin importar el estado */}
                  {daysToShow.some(day => {
                    const cellDate = new Date(year, month, day);
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    return cellDate < now;
                  }) && (
                      <button
                        onClick={() => setUnlockPastDaysModal(true)}
                        className="ml-2 p-1 rounded-full border border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        title={editPastDaysEnabled ? 'Bloquear edición de días pasados' : 'Desbloquear días pasados'}
                        type="button"
                      >
                        {editPastDaysEnabled ? <Unlock className="w-5 h-5 text-green-600" /> : <Lock className="w-5 h-5 text-gray-500" />}
                      </button>
                    )}
                </h4>
                <button
                  onClick={() => changeMonth('next')}
                  className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  className={`px-3 py-1 text-xs rounded transition-colors ${selectedPeriod === '1-15'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  onClick={() => {
                    setSelectedPeriod('1-15');
                    setViewMode('first');
                    setFullMonthView(false);
                  }}
                >
                  1-15
                </button>
                <button
                  className={`px-3 py-1 text-xs rounded transition-colors ${selectedPeriod === '16-30'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  onClick={() => {
                    setSelectedPeriod('16-30');
                    setViewMode('second');
                    setFullMonthView(false);
                  }}
                >
                  16-{daysInMonth}
                </button>
                <button
                  className={`px-3 py-1 text-xs rounded transition-colors ${selectedPeriod === 'monthly'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  onClick={() => {
                    if (selectedPeriod === 'monthly') {
                      setSelectedPeriod('1-15');
                      setViewMode('first');
                      setFullMonthView(false);
                    } else {
                      setSelectedPeriod('monthly');
                      setFullMonthView(true);
                    }
                  }}
                >
                  {selectedPeriod === 'monthly' ? 'Quincenal' : 'Mensual'}
                </button>
              </div>
            </div>

            {/* Controles de filtro y exportación */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Filtro de empleados */}
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-[var(--foreground)]" />
                <select
                  className="px-3 py-1 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    color: 'var(--foreground)',
                  }}
                  value={selectedEmployee}
                  onChange={e => setSelectedEmployee(e.target.value)}
                >
                  <option value="Todos">Todos</option>
                  {names.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* Botón de exportar - Solo para SuperAdmin */}
              {isSuperAdmin() && (
                <button
                  onClick={exportScheduleAsImage}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                  title="Exportar como imagen"
                >
                  📷 Exportar Imagen
                </button>
              )}
              {/* Botón de exportar quincena con icono acorde (Download) */}
              <button
                onClick={exportQuincenaToPNG}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                title={isDelifoodLocation ? "Exportar horas DELIFOOD como imagen" : "Exportar quincena como imagen"}
                disabled={isExporting}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 10l5 5 5-5M12 4v12" /></svg>
                {isDelifoodLocation ? 'Exportar Horas' : 'Exportar Quincena'}
              </button>
            </div>
          </div>
        </div>

        {/* Leyenda de colores */}
        {isDelifoodLocation ? (
          <div className="mb-6 flex flex-wrap gap-4 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#d1fae5' }}></div>
              <span className="text-sm">Con horas registradas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'var(--input-bg)' }}></div>
              <span className="text-sm">Sin horas registradas</span>
            </div>
          </div>
        ) : (
          <div className="mb-6 flex flex-wrap gap-4 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#87CEEB' }}></div>
              <span className="text-sm">N - Nocturno</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FFFF00' }}></div>
              <span className="text-sm">D - Diurno</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FF00FF' }}></div>
              <span className="text-sm">L - Libre</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#28a745' }}></div>
              <span className="text-sm">V - Vacaciones</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#fd7e14' }}></div>
              <span className="text-sm">I - Incapacidad</span>
            </div>
          </div>
        )}        {/* Grid de horarios */}
        <div className="overflow-x-auto -mx-4 sm:mx-0" style={{overflowY: 'hidden'}}>
          <div className="min-w-full inline-block">            <table className="w-full border-collapse border border-[var(--input-border)]">
            <thead>
              <tr>
                <th
                  className="border border-[var(--input-border)] p-2 font-semibold text-center bg-[var(--input-bg)] text-[var(--foreground)] min-w-[80px] sm:min-w-[100px] sticky left-0 z-20 text-xs"
                  style={{ background: 'var(--input-bg)', color: 'var(--foreground)', minWidth: '80px', left: 0, height: '40px' }}
                >
                  Nombre
                </th>
                {daysToShow.map(day => {
                  // Detectar si es hoy
                  const today = new Date();
                  const isToday =
                    today.getFullYear() === currentDate.getFullYear() &&
                    today.getMonth() === currentDate.getMonth() &&
                    today.getDate() === day;
                  // Tooltip: día de la semana, día, mes y año
                  const dayDate = new Date(year, month, day);
                  const dayName = dayDate.toLocaleDateString('es-CR', { weekday: 'long' });
                  const monthNameFull = dayDate.toLocaleDateString('es-CR', { month: 'long' });
                  const tooltip = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${day} de ${monthNameFull} de ${year}`;
                  return (
                    <th
                      key={day}
                      className={`border border-[var(--input-border)] p-2 font-semibold text-center transition-colors text-xs relative${isToday ? ' bg-green-500 text-white' : ''}`}
                      style={{
                        background: isToday ? '#22c55e' : 'var(--input-bg)',
                        color: isToday ? '#fff' : 'var(--foreground)',
                        minWidth: fullMonthView ? '40px' : '20px',
                        height: '40px',
                        zIndex: isToday ? 1 : undefined,
                        cursor: 'pointer',
                        borderColor: isToday ? '#4ade80' : undefined
                      }}
                    >
                      <span className="relative group">
                        {day}
                        <span className="absolute left-1/2 -translate-x-1/2 mt-2 px-2 py-1 rounded bg-gray-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg" style={{bottom: '-2.2rem'}}>
                          {tooltip}
                        </span>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>{(selectedEmployee === 'Todos' ? names : [selectedEmployee]).map(name => (
              <tr key={name}>
                <td
                  className="border border-[var(--input-border)] p-2 font-medium bg-[var(--input-bg)] text-[var(--foreground)] min-w-[80px] sm:min-w-[100px] sticky left-0 z-10 group cursor-pointer text-xs"
                  style={{ background: 'var(--input-bg)', color: 'var(--foreground)', minWidth: '80px', left: 0, height: '40px' }}
                >
                  <div className="flex items-center gap-1">
                    <span className="block truncate flex-1">{name}</span>
                    {/* Botón de información para móviles */}
                    <button
                      onClick={() => setShowEmployeeSummary(showEmployeeSummary === name ? null : name)}
                      className="sm:hidden flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 text-blue-600 dark:text-blue-400 transition-colors"
                      title="Ver resumen"
                    >
                      <Info className="w-3 h-3" />
                    </button>
                  </div>
                  {/* Tooltip al pasar el mouse - solo en pantallas grandes */}                  <div className="hidden sm:block absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-gray-900 text-white text-xs rounded shadow-lg px-4 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 min-w-[180px] text-left whitespace-pre-line">
                    <EmployeeTooltipSummary 
                      employeeName={name}
                      locationValue={location}
                      year={year}
                      month={month}
                      daysToShow={daysToShow}
                      isDelifoodLocation={isDelifoodLocation}
                      delifoodHoursData={delifoodHoursData}
                    />
                  </div>
                </td>
                {daysToShow.map(day => {
                  const value = scheduleData[name]?.[day.toString()] || '';
                  
                  // Debug logging para ver qué valores se están obteniendo
                  if (!isDelifoodLocation && value) {
                    console.log(`📋 Cell value for ${name} day ${day}:`, value, 'from scheduleData:', scheduleData[name]);
                  }
                  
                  // Deshabilitar si el día ya pasó en cualquier mes y año, y no está habilitado el modo edición
                  let disabled = false;
                  const cellDate = new Date(year, month, day);
                  const now = new Date();
                  now.setHours(0, 0, 0, 0); // ignorar hora
                  if (
                    cellDate < now &&
                    !editPastDaysEnabled
                  ) {
                    disabled = true;
                  }

                  // Deshabilitar si la celda tiene V o I y el usuario no es ADMIN
                  if (!isUserAdmin() && ['V', 'I'].includes(value)) {
                    disabled = true;
                  }

                  // Si es DELIFOOD, mostrar celda de horas
                  if (isDelifoodLocation) {
                    const hours = delifoodHoursData[name]?.[day.toString()]?.hours || 0;
                    
                    return (
                      <td key={day} className="border border-[var(--input-border)] p-0" style={{ minWidth: fullMonthView ? '32px' : '40px' }}>
                        <button
                          onClick={() => !disabled && handleDelifoodCellClick(name, day)}
                          className={`w-full h-full p-1 text-center font-semibold cursor-pointer text-xs border-none outline-none ${disabled ? 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-500' : ''}`}
                          style={{ 
                            minWidth: fullMonthView ? '32px' : '40px', 
                            height: '40px',
                            backgroundColor: hours > 0 ? '#d1fae5' : 'var(--input-bg)',
                            color: hours > 0 ? '#065f46' : 'var(--foreground)'
                          }}
                          disabled={disabled}
                          title={hours > 0 ? `${hours}h trabajadas - Clic para editar` : 'Clic para agregar horas'}
                        >
                          {hours > 0 ? `${hours}h` : '▼'}
                        </button>
                      </td>
                    );
                  }

                  // Si no es DELIFOOD, mostrar select normal o div readonly para V/I
                  // Crear título descriptivo para el tooltip
                  let cellTitle = '';
                  if (disabled && ['V', 'I'].includes(value) && !isUserAdmin()) {
                    const stateName = value === 'V' ? 'Vacaciones' : 'Incapacidad';
                    cellTitle = `${stateName} - Solo ADMIN puede modificar`;
                  }

                  // Si la celda tiene V o I y el usuario no es admin, mostrar como div readonly
                  if (['V', 'I'].includes(value) && !isUserAdmin()) {
                    return (
                      <td key={day} className="border border-[var(--input-border)] p-0" style={{ minWidth: fullMonthView ? '32px' : '40px' }}>
                        <div
                          className="w-full h-full p-1 text-center font-semibold text-xs flex items-center justify-center"
                          style={{ 
                            ...getCellStyle(value), 
                            minWidth: fullMonthView ? '32px' : '40px', 
                            height: '40px',
                            cursor: 'not-allowed'
                          }}
                          title={cellTitle}
                        >
                          {value}
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td key={day} className="border border-[var(--input-border)] p-0" style={{ minWidth: fullMonthView ? '32px' : '40px' }}>
                      <select
                        value={value}
                        onChange={(e) => handleCellChange(name, day, e.target.value)}
                        className={`w-full h-full p-1 border-none outline-none text-center font-semibold cursor-pointer text-xs ${disabled ? 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-500' : ''}`}
                        style={{ ...getCellStyle(value), minWidth: fullMonthView ? '32px' : '40px', height: '40px' }}
                        disabled={disabled}
                        title={cellTitle}
                    >
                      {shiftOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  );
                })}
              </tr>
            ))}
            </tbody>
          </table>
          </div>
        </div>        {names.length === 0 && (
          <div className="text-center py-8 text-[var(--tab-text)]">
            No hay empleados registrados para esta ubicación.
          </div>
        )}        {/* Modal de resumen del empleado para móviles */}
        {showEmployeeSummary && (
          <div className="sm:hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Resumen - {showEmployeeSummary}</h3>
                <button
                  onClick={() => setShowEmployeeSummary(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <EmployeeTooltipSummary 
                  employeeName={showEmployeeSummary}
                  locationValue={location}
                  year={year}
                  month={month}
                  daysToShow={daysToShow}
                  isDelifoodLocation={isDelifoodLocation}
                  delifoodHoursData={delifoodHoursData}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmModal.open}
        message={confirmModal.message}
        loading={modalLoading}
        actionType={confirmModal.actionType}
        onConfirm={async () => {
          if (confirmModal.onConfirm) await confirmModal.onConfirm();
        }}
        onCancel={() => setConfirmModal({ open: false, message: '', onConfirm: null, actionType: 'assign' })}
      />

      {/* Modal para desbloquear días pasados */}
      <ConfirmModal
        open={unlockPastDaysModal}
        message={editPastDaysEnabled ? '¿Quieres volver a bloquear la edición de días pasados?' : '¿Quieres desbloquear la edición de días pasados?'}
        loading={false}
        actionType={editPastDaysEnabled ? 'delete' : 'assign'}
        onConfirm={() => {
          setEditPastDaysEnabled(e => !e);
          setUnlockPastDaysModal(false);
        }}
        onCancel={() => setUnlockPastDaysModal(false)}
      />

      {/* Modal QR para descarga con funcionalidad de descarga de imagen */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full flex flex-col items-center">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">
              📱 Descargar en tu móvil
            </h3>
            <Image
              src={qrCodeDataURL}
              alt="QR para descargar imagen"
              className="mb-4 rounded-lg border-2 border-gray-200 dark:border-gray-600"
              width={300}
              height={300}
              unoptimized
            />
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-4 text-center">
              Escanea este QR con tu móvil para descargar la imagen
            </div>
            
            <div className="flex gap-3 w-full">
              <button
                onClick={async () => {
                  // Limpiar archivo de Firebase Storage si existe
                  if (storageRef) {
                    try {
                      const fileRef = ref(storage, storageRef);
                      await deleteObject(fileRef);
                    } catch (error) {
                      console.error('Error eliminando archivo de storage:', error);
                    }
                  }
                  setShowQRModal(false);
                  setQrCountdown(null);
                  setStorageRef('');
                  setQRCodeDataURL('');
                  setImageBlob(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cerrar
              </button>
              
              {/* Botón para descargar imagen del horario */}
              <button 
                onClick={() => {
                  try {
                    // Descargar directamente usando el blob almacenado
                    if (imageBlob) {
                      const url = URL.createObjectURL(imageBlob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `horario-quincena-${location}-${new Date().toISOString().split('T')[0]}.png`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      
                      showNotification('📥 Horario descargado exitosamente', 'success');
                    } else {
                      throw new Error('No hay imagen disponible para descargar');
                    }
                  } catch (error) {
                    console.error('Error downloading schedule image:', error);
                    showNotification('❌ Error al descargar el horario', 'error');
                  }
                }}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                title="Descargar imagen del horario"
              >
                📥 Descargar Horario
              </button>
            </div>
            
            {qrCountdown !== null && qrCountdown > 0 && (
              <div className="text-xs text-red-600 mt-2 text-center">
                Este enlace expira en {qrCountdown} segundo{qrCountdown === 1 ? '' : 's'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast de countdown para QR */}
      {qrCountdown !== null && qrCountdown > 0 && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded shadow-lg animate-pulse font-semibold text-sm">
          El enlace y QR expiran en {qrCountdown} segundo{qrCountdown === 1 ? '' : 's'}
        </div>
      )}

      {/* Modal de horas para DELIFOOD */}
      {isDelifoodLocation && (
        <DelifoodHoursModal
          isOpen={delifoodModal.isOpen}
          onClose={() => setDelifoodModal({ isOpen: false, employeeName: '', day: 0, currentHours: 0 })}
          onSave={handleDelifoodHoursSave}
          employeeName={delifoodModal.employeeName}
          day={delifoodModal.day}
          month={month}
          year={year}
          locationValue={location}
          currentHours={delifoodModal.currentHours}
        />
      )}
    </>
  );
}
