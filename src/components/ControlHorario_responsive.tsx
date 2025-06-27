// src/components/ControlHorario.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Clock, ChevronLeft, ChevronRight, Save, LogOut, User as UserIcon, Lock, Unlock } from 'lucide-react';
import { LocationsService } from '../services/locations';
import { SchedulesService } from '../services/schedules';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';
import ConfirmModal from './ConfirmModal';
import type { Location } from '../types/firestore';
import type { User as FirestoreUser } from '../types/firestore';

interface ScheduleData {
  [employeeName: string]: {
    [day: string]: string;
  };
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
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    message: string;
    onConfirm: (() => Promise<void>) | null;
    actionType?: 'assign' | 'delete' | 'change';
  }>({ open: false, message: '', onConfirm: null, actionType: 'assign' });
  const [modalLoading, setModalLoading] = useState(false);
  const [editPastDaysEnabled, setEditPastDaysEnabled] = useState(false);
  const [unlockPastDaysModal, setUnlockPastDaysModal] = useState(false);

  // Function to calculate employee summary
  const calculateEmployeeSummary = (employeeName: string, daysToShow: number[]) => {
    const employeeData = scheduleData[employeeName] || {};
    const workedDays = daysToShow.filter(day => {
      const schedule = employeeData[day.toString()];
      return schedule && schedule !== 'D';
    }).length;
    
    return {
      workedDays,
      hours: workedDays * 8, // Assuming 8 hours per day
      colones: workedDays * 8 * 2500, // Assuming 2500 per hour
      ccss: workedDays * 8 * 2500 * 0.1, // Assuming 10% CCSS
      neto: workedDays * 8 * 2500 * 0.9 // Net after CCSS
    };
  };

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

  // Cargar horarios de Firebase cuando cambie la ubicación
  useEffect(() => {
    const loadScheduleData = async () => {
      if (!location || !locations.find(l => l.value === location)?.names?.length) return;

      const names = locations.find(l => l.value === location)?.names || [];
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      try {
        const scheduleEntries = await Promise.all(
          names.map(employeeName =>
            SchedulesService.getSchedulesByLocationEmployeeMonth(location, employeeName, year, month)
          )
        );

        const newScheduleData: ScheduleData = {};

        names.forEach((employeeName, index) => {
          newScheduleData[employeeName] = {};
          scheduleEntries[index].forEach(entry => {
            newScheduleData[employeeName][entry.day.toString()] = entry.shift;
          });
        });

        setScheduleData(newScheduleData);
      } catch (error) {
        console.error('Error loading schedule data:', error);
        showNotification('Error al cargar los horarios', 'error');
      }
    };

    loadScheduleData();
  }, [location, locations, currentDate]);

  // Manejar login exitoso
  const handleLoginSuccess = (userData: FirestoreUser) => {
    login(userData);
    setShowLoginModal(false);
    if (userData.location) {
      setLocation(userData.location);
    }
  };

  // AUTO-QUINCENA
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

  // Verificar si necesita autenticación
  if (!isAuthenticated) {
    return (
      <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4 sm:p-6">
        <div className="text-center py-8">
          <Clock className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-blue-600" />
          <h3 className="text-xl sm:text-2xl font-semibold mb-4">Control de Horarios</h3>
          <p className="text-[var(--tab-text)] mb-6 text-sm sm:text-base">
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
  const daysToShow = getDaysToShow();

  // Función para actualizar un horario específico
  const updateScheduleCell = async (employeeName: string, day: string, newValue: string) => {
    const currentValue = scheduleData[employeeName]?.[day] || '';

    // Validar que solo pueda haber una persona por día con el mismo turno (N, D, L)
    if (newValue && ['N', 'D', 'L'].includes(newValue)) {
      const existingEmployee = Object.keys(scheduleData).find(employee =>
        employee !== employeeName && scheduleData[employee]?.[day] === newValue
      );
      if (existingEmployee) {
        showNotification(`No se puede asignar el turno "${newValue}". ${existingEmployee} ya tiene este turno el día ${day}.`, 'error');
        return;
      }
    }

    // Confirmar asignación de turno nuevo
    if (!currentValue && ['N', 'D', 'L'].includes(newValue)) {
      setConfirmModal({
        open: true,
        message: `¿Está seguro de asignar el turno "${newValue}" a ${employeeName} el día ${day}?`,
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
    if (currentValue && ['N', 'D', 'L'].includes(currentValue) && currentValue !== newValue) {
      let confirmMessage = '';
      let actionType: 'delete' | 'change' = 'change';
      if (newValue === '' || newValue.trim() === '') {
        confirmMessage = `¿Está seguro de eliminar el turno "${currentValue}" de ${employeeName} del día ${day}? Esto eliminará el registro de la base de datos.`;
        actionType = 'delete';
      } else {
        confirmMessage = `¿Está seguro de cambiar el turno de ${employeeName} del día ${day} de "${currentValue}" a "${newValue}"?`;
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
        await SchedulesService.updateScheduleShift(
          location,
          employeeName,
          year,
          month,
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

  // Opciones de turnos disponibles
  const shiftOptions = [
    { value: '', label: '', color: 'var(--input-bg)', textColor: 'var(--foreground)' },
    { value: 'N', label: 'N', color: '#87CEEB', textColor: '#000' },
    { value: 'D', label: 'D', color: '#FFFF00', textColor: '#000' },
    { value: 'L', label: 'L', color: '#FF00FF', textColor: '#FFF' },
  ];

  // Función para obtener el color de fondo según la letra
  const getCellStyle = (value: string) => {
    const option = shiftOptions.find(opt => opt.value === value);
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
    updateScheduleCell(employeeName, day.toString(), value);
  };

  // Función para cambiar mes
  const changeMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  // Función para exportar horarios como imagen (Solo SuperAdmin)
  const exportScheduleAsImage = async () => {
    if (!isSuperAdmin()) {
      showNotification('Solo SuperAdmin puede exportar como imagen', 'error');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('No se pudo crear el contexto del canvas');
      }

      canvas.width = 1200;
      canvas.height = 900;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 32px Arial';

      const marginX = 50;
      const availableWidth = canvas.width - (marginX * 2);
      const employeeNameWidth = 250;
      const totalDaysWidth = availableWidth - employeeNameWidth;
      const cellWidth = totalDaysWidth / daysToShow.length;

      let yPosition = 60;
      const lineHeight = 40;
      const cellHeight = 45;

      ctx.font = 'bold 40px Arial';
      ctx.fillStyle = '#1f2937';
      ctx.textAlign = 'center';
      ctx.fillText('📅 Control de Horarios - Price Master', canvas.width / 2, yPosition);
      ctx.textAlign = 'left';
      yPosition += 60;

      ctx.font = '22px Arial';
      ctx.fillStyle = '#4b5563';
      ctx.textAlign = 'center';
      ctx.fillText(`📍 Ubicación: ${locations.find(l => l.value === location)?.label || location}`, canvas.width / 2, yPosition);
      yPosition += lineHeight;
      ctx.fillText(`📅 Mes: ${monthName}`, canvas.width / 2, yPosition);
      yPosition += lineHeight;
      ctx.fillText(`👤 Exportado por: ${user?.name} (SuperAdmin)`, canvas.width / 2, yPosition);
      yPosition += lineHeight;
      ctx.fillText(`🕒 Fecha de exportación: ${new Date().toLocaleDateString('es-ES')}`, canvas.width / 2, yPosition);
      ctx.textAlign = 'left';
      yPosition += 60;

      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#1f2937';

      ctx.fillText('Empleado', marginX, yPosition);

      const startX = marginX + employeeNameWidth;
      daysToShow.forEach((day, index) => {
        const x = startX + (index * cellWidth);
        ctx.textAlign = 'center';
        ctx.fillText(day.toString(), x + cellWidth / 2, yPosition);
      });
      ctx.textAlign = 'left';
      yPosition += 40;

      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(marginX, yPosition);
      ctx.lineTo(canvas.width - marginX, yPosition);
      ctx.stroke();
      yPosition += 10;

      ctx.font = '16px Arial';
      names.forEach((employeeName) => {
        ctx.fillStyle = '#374151';
        ctx.fillText(employeeName, marginX, yPosition + 30);

        daysToShow.forEach((day, dayIndex) => {
          const shift = scheduleData[employeeName]?.[day.toString()] || '';
          const x = startX + (dayIndex * cellWidth);
          const y = yPosition;

          if (shift === 'N') {
            ctx.fillStyle = '#87CEEB';
          } else if (shift === 'D') {
            ctx.fillStyle = '#FFFF00';
          } else if (shift === 'L') {
            ctx.fillStyle = '#FF00FF';
          } else {
            ctx.fillStyle = '#f9fafb';
          }

          ctx.fillRect(x, y, cellWidth, cellHeight);

          ctx.strokeStyle = '#d1d5db';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, cellWidth, cellHeight);

          if (shift) {
            ctx.fillStyle = shift === 'L' ? '#ffffff' : '#000000';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(shift, x + cellWidth / 2, y + cellHeight / 2 + 7);
            ctx.textAlign = 'left';
          }
        });

        yPosition += cellHeight + 10;
      });

      yPosition += 50;
      ctx.font = 'bold 22px Arial';
      ctx.fillStyle = '#1f2937';
      ctx.textAlign = 'center';
      ctx.fillText('📋 Leyenda de Turnos:', canvas.width / 2, yPosition);
      ctx.textAlign = 'left';
      yPosition += 40;

      const legendItems = [
        { label: 'N = Nocturno', color: '#87CEEB', textColor: '#000' },
        { label: 'D = Diurno', color: '#FFFF00', textColor: '#000' },
        { label: 'L = Libre', color: '#FF00FF', textColor: '#fff' },
        { label: 'Vacío = Sin asignar', color: '#f9fafb', textColor: '#000' }
      ];

      const legendWidth = legendItems.length * 200;
      const legendStartX = (canvas.width - legendWidth) / 2;

      legendItems.forEach((item, index) => {
        const x = legendStartX + (index * 200);

        ctx.fillStyle = item.color;
        ctx.fillRect(x, yPosition - 20, 30, 30);
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, yPosition - 20, 30, 30);

        ctx.fillStyle = '#374151';
        ctx.font = '16px Arial';
        ctx.fillText(item.label, x + 40, yPosition);
      });

      yPosition = canvas.height - 80;
      ctx.font = '14px Arial';
      ctx.fillStyle = '#9ca3af';
      ctx.textAlign = 'center';
      ctx.fillText('Generated by Price Master - Control de Horarios', canvas.width / 2, yPosition);
      ctx.fillText(`Total de empleados: ${names.length}`, canvas.width / 2, yPosition + 20);
      ctx.fillText('⚠️ Documento confidencial - Solo para uso autorizado', canvas.width / 2, yPosition + 40);
      ctx.textAlign = 'left';

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `horarios-${location}-${year}-${month + 1}-${new Date().toISOString().split('T')[0]}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          showNotification('📸 Horarios exportados como imagen exitosamente', 'success');
        } else {
          throw new Error('Error al generar la imagen');
        }
      }, 'image/png');

    } catch (error) {
      showNotification('Error al exportar horarios como imagen', 'error');
      console.error('Export schedule as image error:', error);
    }
  };

  // Si está cargando, mostrar loading
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative flex items-center justify-center mb-4">
            <svg className="animate-spin-slow w-8 h-8 sm:w-12 sm:h-12 text-[var(--foreground)]" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="4" opacity="0.2" />
              <line x1="24" y1="24" x2="24" y2="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <line x1="24" y1="24" x2="36" y2="24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <div className="text-base sm:text-lg flex items-center">
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
      <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4 sm:p-6">
        <div className="text-center mb-8">
          <Clock className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-blue-600" />
          <h3 className="text-xl sm:text-2xl font-semibold mb-4">Control de Horarios</h3>
          <p className="text-[var(--tab-text)] mb-6 text-sm sm:text-base">
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
      </div>    );
  }

  return (
    <>
      <div className="max-w-full mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4 sm:p-6">
        {/* Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 sm:top-6 sm:right-6 z-50 px-4 sm:px-6 py-2 sm:py-3 rounded-xl shadow-2xl flex items-center gap-2 font-semibold animate-fade-in-down ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            } text-white text-sm sm:text-base`}>
            {notification.type === 'success' ? (
              <Save className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
            {notification.message}
          </div>
        )}

        {/* Loading indicator */}
        {saving && (
          <div className="fixed top-16 right-4 sm:top-20 sm:right-6 z-40 px-3 sm:px-4 py-2 rounded-lg bg-blue-500 text-white flex items-center gap-2 text-sm sm:text-base">
            <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
            Guardando...
          </div>
        )}

        {/* Header con controles responsivo */}
        <div className="mb-6 space-y-4">
          {/* Título y usuario */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <Clock className="w-12 h-12 sm:w-16 sm:h-16 text-blue-600" />
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold mb-2">Control de Horarios</h3>
                <p className="text-sm sm:text-base text-[var(--tab-text)]">
                  <span className="block sm:inline">Usuario: {user?.name}</span>
                  <span className="hidden sm:inline"> - </span>
                  <span className="block sm:inline">Ubicación: {location}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              {/* Selector de ubicación - solo para administradores */}
              {canChangeLocation() && (
                <select
                  className="w-full sm:w-auto px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm sm:text-base"
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
              )}              {/* Botón de logout */}
              <button
                onClick={() => logout()}
                className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors w-full sm:w-auto justify-center text-sm sm:text-base"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
                <span>Salir</span>
              </button>
            </div>
          </div>

          {/* Controles de navegación y período responsivos */}
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Navegación de mes */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeMonth('prev')}
                  className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h4 className="text-base sm:text-lg font-semibold capitalize flex items-center gap-2 whitespace-nowrap">
                  {monthName}
                  {/* Candado para días pasados */}
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
                      {editPastDaysEnabled ? <Unlock className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" /> : <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />}
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

              {/* Botones de período responsivos */}
              <div className="flex gap-2 flex-wrap justify-center">
                <button
                  className={`px-3 py-1 text-xs sm:text-sm rounded transition-colors whitespace-nowrap ${selectedPeriod === '1-15'
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
                  className={`px-3 py-1 text-xs sm:text-sm rounded transition-colors whitespace-nowrap ${selectedPeriod === '16-30'
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
                  className={`px-3 py-1 text-xs sm:text-sm rounded transition-colors whitespace-nowrap ${selectedPeriod === 'monthly'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  onClick={() => {
                    setSelectedPeriod('monthly');
                    setFullMonthView(true);
                  }}
                >
                  Mensual
                </button>
              </div>
            </div>

            {/* Controles de filtro y exportación responsivos */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
              {/* Filtro de empleados */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <UserIcon className="w-4 h-4 text-[var(--foreground)]" />
                <select
                  className="w-full sm:w-auto px-3 py-1 text-xs sm:text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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


            </div>
          </div>
        </div>

        {/* Leyenda de colores responsiva */}
        <div className="mb-6 flex flex-wrap gap-2 sm:gap-4 justify-center sm:justify-start">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded" style={{ backgroundColor: '#87CEEB' }}></div>
            <span className="text-xs sm:text-sm">N - Nocturno</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded" style={{ backgroundColor: '#FFFF00' }}></div>
            <span className="text-xs sm:text-sm">D - Diurno</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded" style={{ backgroundColor: '#FF00FF' }}></div>
            <span className="text-xs sm:text-sm">L - Libre</span>
          </div>
        </div>

        {/* Grid de horarios responsivo */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[var(--input-border)] min-w-[600px]">
            <thead>
              <tr>
                <th
                  className="border border-[var(--input-border)] p-1 sm:p-2 font-semibold text-center bg-[var(--input-bg)] text-[var(--foreground)] min-w-[80px] sm:min-w-[120px] sticky left-0 z-20 text-xs sm:text-sm"
                  style={{ background: 'var(--input-bg)', color: 'var(--foreground)', left: 0 }}
                >
                  Nombre
                </th>
                {daysToShow.map(day => {
                  const today = new Date();
                  const isToday =
                    today.getFullYear() === currentDate.getFullYear() &&
                    today.getMonth() === currentDate.getMonth() &&
                    today.getDate() === day;
                  return (
                    <th
                      key={day}
                      className={`border border-[var(--input-border)] p-1 sm:p-2 font-semibold text-center transition-colors text-xs sm:text-sm min-w-[30px] sm:min-w-[50px] ${isToday ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-[var(--card-bg)]' : ''}`}
                      style={{ 
                        background: 'var(--input-bg)', 
                        color: 'var(--foreground)', 
                        borderColor: isToday ? '#4ade80' : undefined 
                      }}
                    >
                      {day}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(selectedEmployee === 'Todos' ? names : [selectedEmployee]).map(name => (
                <tr key={name}>
                  <td
                    className="border border-[var(--input-border)] p-1 sm:p-2 font-medium bg-[var(--input-bg)] text-[var(--foreground)] min-w-[80px] sm:min-w-[120px] sticky left-0 z-10 group cursor-pointer text-xs sm:text-sm"
                    style={{ background: 'var(--input-bg)', color: 'var(--foreground)', left: 0 }}
                  >
                    {name}
                    {/* Tooltip responsive */}                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-gray-900 text-white text-xs rounded shadow-lg px-2 sm:px-4 py-1 sm:py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 min-w-[120px] sm:min-w-[180px] text-left whitespace-pre-line">
                      {(() => {
                        const summary = calculateEmployeeSummary(name, daysToShow);
                        return (
                          <>
                            <div><b>Días:</b> {summary.workedDays}</div>
                            <div><b>Horas:</b> {summary.hours}</div>
                            <div className="hidden sm:block"><b>Total bruto:</b> ₡{summary.colones.toLocaleString('es-CR')}</div>
                            <div className="hidden sm:block"><b>CCSS:</b> -₡{summary.ccss.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</div>
                            <div className="hidden sm:block"><b>Salario neto:</b> ₡{summary.neto.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</div>
                          </>
                        );
                      })()}
                    </div>
                  </td>
                  {daysToShow.map(day => {
                    const value = scheduleData[name]?.[day.toString()] || '';
                    let disabled = false;
                    const cellDate = new Date(year, month, day);
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    if (cellDate < now && !editPastDaysEnabled) {
                      disabled = true;
                    }
                    return (
                      <td key={day} className="border border-[var(--input-border)] p-0">
                        <select
                          value={value}
                          onChange={(e) => handleCellChange(name, day, e.target.value)}
                          className={`w-full h-full p-1 sm:p-2 border-none outline-none text-center font-semibold cursor-pointer text-xs sm:text-sm ${disabled ? 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-500' : ''}`}
                          style={getCellStyle(value)}
                          disabled={disabled}
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

        {names.length === 0 && (
          <div className="text-center py-8 text-[var(--tab-text)] text-sm sm:text-base">
            No hay empleados registrados para esta ubicación.
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
    </>
  );
}
