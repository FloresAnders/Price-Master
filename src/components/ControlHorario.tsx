// src/components/ControlHorario.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Calendar, ChevronLeft, ChevronRight, Save, LogOut, User as UserIcon } from 'lucide-react';
import { LocationsService } from '../services/locations';
import { SchedulesService } from '../services/schedules';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';
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
  const [fullMonthView, setFullMonthView] = useState(false); // Vista mensual completa opcional

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

  // Verificar si necesita autenticación
  if (!isAuthenticated) {
    return (
      <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
        <div className="text-center py-8">
          <Clock className="w-16 h-16 mx-auto mb-4 text-blue-600" />
          <h3 className="text-2xl font-semibold mb-4">Control de Horarios</h3>
          <p className="text-[var(--tab-text)] mb-6">
            Necesitas iniciar sesión para acceder a esta funcionalidad
          </p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
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
      // Verificar si ya hay alguien más con este turno en este día
      const existingEmployee = Object.keys(scheduleData).find(employee => 
        employee !== employeeName && scheduleData[employee]?.[day] === newValue
      );

      if (existingEmployee) {
        showNotification(`No se puede asignar el turno "${newValue}". ${existingEmployee} ya tiene este turno el día ${day}.`, 'error');
        return;
      }
    }

    // Si la celda ya tiene un valor específico (N, D, L), solicitar confirmación
    if (currentValue && ['N', 'D', 'L'].includes(currentValue) && currentValue !== newValue) {
      let confirmMessage = '';
      if (newValue === '' || newValue.trim() === '') {
        confirmMessage = `¿Está seguro de eliminar el turno "${currentValue}" de ${employeeName} del día ${day}? Esto eliminará el registro de la base de datos.`;
      } else {
        confirmMessage = `¿Está seguro de cambiar el turno de ${employeeName} del día ${day} de "${currentValue}" a "${newValue}"?`;
      }

      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) return;
    }

    try {
      setSaving(true);

      // Actualizar en Firebase (eliminará el documento si newValue está vacío)
      await SchedulesService.updateScheduleShift(
        location,
        employeeName,
        year,
        month,
        parseInt(day),
        newValue
      );

      // Actualizar estado local
      setScheduleData(prev => ({
        ...prev,
        [employeeName]: {
          ...prev[employeeName],
          [day]: newValue
        }
      }));

      // Mostrar mensaje específico según la acción
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
  };// Opciones de turnos disponibles
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
      // Crear un canvas temporal para generar la imagen
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('No se pudo crear el contexto del canvas');
      }      // Configurar el canvas - más grande
      canvas.width = 1200;
      canvas.height = 900;
      
      // Fondo blanco
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Configurar estilos de texto
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 32px Arial';

      // Usar todo el ancho disponible
      const marginX = 50;
      const availableWidth = canvas.width - (marginX * 2);
      const employeeNameWidth = 250;
      const totalDaysWidth = availableWidth - employeeNameWidth;
      const cellWidth = totalDaysWidth / daysToShow.length;
      
      let yPosition = 60;
      const lineHeight = 40;
      const cellHeight = 45;// Título principal - centrado y más grande
      ctx.font = 'bold 40px Arial';
      ctx.fillStyle = '#1f2937';
      ctx.textAlign = 'center';
      ctx.fillText('📅 Control de Horarios - Price Master', canvas.width / 2, yPosition);
      ctx.textAlign = 'left';
      yPosition += 60;

      // Información del reporte - centrada y más grande
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
      yPosition += 60;      // Encabezados de días - más grandes y usando todo el ancho
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#1f2937';
      
      // Título "Empleado"
      ctx.fillText('Empleado', marginX, yPosition);
      
      // Días del mes - distribuidos en todo el ancho
      const startX = marginX + employeeNameWidth;
      daysToShow.forEach((day, index) => {
        const x = startX + (index * cellWidth);
        ctx.textAlign = 'center';
        ctx.fillText(day.toString(), x + cellWidth / 2, yPosition);
      });
      ctx.textAlign = 'left';
      yPosition += 40;

      // Línea divisoria - usando todo el ancho
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(marginX, yPosition);
      ctx.lineTo(canvas.width - marginX, yPosition);
      ctx.stroke();
      yPosition += 10;      // Datos de horarios - más grandes y usando todo el ancho
      ctx.font = '16px Arial';
      names.forEach((employeeName) => {
        // Nombre del empleado
        ctx.fillStyle = '#374151';
        ctx.fillText(employeeName, marginX, yPosition + 30);

        // Horarios por día - distribuidos en todo el ancho
        daysToShow.forEach((day, dayIndex) => {
          const shift = scheduleData[employeeName]?.[day.toString()] || '';
          const x = startX + (dayIndex * cellWidth);
          const y = yPosition;

          // Fondo de la celda según el turno
          if (shift === 'N') {
            ctx.fillStyle = '#87CEEB'; // Azul claro
          } else if (shift === 'D') {
            ctx.fillStyle = '#FFFF00'; // Amarillo
          } else if (shift === 'L') {
            ctx.fillStyle = '#FF00FF'; // Magenta
          } else {
            ctx.fillStyle = '#f9fafb'; // Gris claro
          }

          // Dibujar celda
          ctx.fillRect(x, y, cellWidth, cellHeight);

          // Borde de la celda
          ctx.strokeStyle = '#d1d5db';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, cellWidth, cellHeight);

          // Texto del turno - más grande
          if (shift) {
            ctx.fillStyle = shift === 'L' ? '#ffffff' : '#000000';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(shift, x + cellWidth / 2, y + cellHeight / 2 + 7);
            ctx.textAlign = 'left';
          }
        });

        yPosition += cellHeight + 10;
      });// Leyenda - centrada y más grande
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

      // Calcular posición centrada para la leyenda - más espaciada
      const legendWidth = legendItems.length * 200;
      const legendStartX = (canvas.width - legendWidth) / 2;

      legendItems.forEach((item, index) => {
        const x = legendStartX + (index * 200);
        
        // Cuadro de color - más grande
        ctx.fillStyle = item.color;
        ctx.fillRect(x, yPosition - 20, 30, 30);
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, yPosition - 20, 30, 30);

        // Texto - más grande
        ctx.fillStyle = '#374151';
        ctx.font = '16px Arial';
        ctx.fillText(item.label, x + 40, yPosition);
      });

      // Información de pie - centrada y más grande
      yPosition = canvas.height - 80;
      ctx.font = '14px Arial';
      ctx.fillStyle = '#9ca3af';
      ctx.textAlign = 'center';
      ctx.fillText('Generated by Price Master - Control de Horarios', canvas.width / 2, yPosition);
      ctx.fillText(`Total de empleados: ${names.length}`, canvas.width / 2, yPosition + 20);
      ctx.fillText('⚠️ Documento confidencial - Solo para uso autorizado', canvas.width / 2, yPosition + 40);
      ctx.textAlign = 'left';

      // Convertir canvas a imagen y descargar
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
      <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
        <div className="text-center py-8">
          <div className="text-lg">Cargando datos...</div>
        </div>
      </div>
    );
  }

  // Si no hay ubicación seleccionada, mostrar selector
  if (!location) {
    return (
      <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
        <div className="text-center mb-8">
          <Clock className="w-16 h-16 mx-auto mb-4 text-blue-600" />
          <h3 className="text-2xl font-semibold mb-4">Control de Horarios</h3>
          <p className="text-[var(--tab-text)] mb-6">
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
      </div>
    );
  }

  // Utilidad para calcular resumen de turnos
  function getEmployeeSummary(name: string) {
    const days = daysToShow;
    const shifts = days.map((day: number) => scheduleData[name]?.[day.toString()] || '');
    const workedDays = shifts.filter((s: string) => s === 'N' || s === 'D').length;
    const hours = workedDays * 8;
    const colones = hours * 1529.62;
    const ccss = 3672.42;
    const neto = colones - ccss;
    return {
      workedDays,
      hours,
      colones,
      ccss,
      neto
    };
  }

  return (
    <div className="max-w-full mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-semibold animate-fade-in-down ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`}>
          {notification.type === 'success' ? (
            <Save className="w-5 h-5" />
          ) : (
            <Clock className="w-5 h-5" />
          )}
          {notification.message}
        </div>
      )}

      {/* Loading indicator */}
      {saving && (
        <div className="fixed top-20 right-6 z-40 px-4 py-2 rounded-lg bg-blue-500 text-white flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          Guardando...
        </div>
      )}      {/* Header con controles */}
      <div className="mb-6 flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <Clock className="w-16 h-16 mx-auto mb-4 text-blue-600" />
          <div>
            <h3 className="text-2xl font-semibold mb-4">Control de Horarios</h3>
            <p className="text-[var(--tab-text)] mb-6">
              Usuario: {user?.name} - Ubicación: {location}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Selector de ubicación - solo para administradores */}
          {canChangeLocation() ? (
            <select
              className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <div className="px-3 py-2 text-sm text-[var(--tab-text)]">
            </div>
          )}

          {/* Botón de logout */}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>

      {/* Controles de navegación de mes y quincena */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
          <button
            onClick={() => changeMonth('prev')}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h4 className="text-lg font-semibold capitalize">{monthName}</h4>
          <button
            onClick={() => changeMonth('next')}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        {/* Controles de quincena, vista y filtro empleados en fila o columna según pantalla */}
        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto justify-center">
          {/* Botones de quincena solo si no está la vista mensual completa */}
          {!fullMonthView && (
            <>
              <button
                onClick={() => setViewMode('first')}
                className={`px-4 py-2 rounded-md transition-colors ${viewMode === 'first'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
              >
                1-15
              </button>
              <button
                onClick={() => setViewMode('second')}
                className={`px-4 py-2 rounded-md transition-colors ${viewMode === 'second'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
              >
                16-{daysInMonth}
              </button>
            </>
          )}
          {/* Botón de vista quincenal/mensual con icono Calendar */}
          <button
            onClick={() => setFullMonthView(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${fullMonthView ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-400 dark:border-gray-600'}`}
            title={fullMonthView ? 'Vista quincenal' : 'Vista mensual'}
          >
            <Calendar className="w-5 h-5" />
            {fullMonthView ? 'Quincenal' : 'Mensual'}
          </button>
          {/* Dropdown de empleados con icono de persona y select nativo estilizado */}
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-[var(--foreground)]" />
            <select
              className="px-3 py-2 rounded-md bg-[var(--input-bg)] text-[var(--foreground)] border border-[var(--input-border)] focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Leyenda de colores */}
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
      </div>

      {/* Grid de horarios */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-[var(--input-border)]">
          <thead>
            <tr>
              <th
                className="border border-[var(--input-border)] p-2 font-semibold text-center bg-[var(--input-bg)] text-[var(--foreground)] min-w-[120px] sticky left-0 z-20"
                style={{ background: 'var(--input-bg)', color: 'var(--foreground)', minWidth: '120px', left: 0 }}
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
                return (
                  <th
                    key={day}
                    className={`border border-[var(--input-border)] p-2 font-semibold text-center transition-colors ${isToday ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-[var(--card-bg)]' : ''}`}
                    style={{ background: 'var(--input-bg)', color: 'var,--foreground)', minWidth: '50px', borderColor: isToday ? '#4ade80' : undefined }}
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
                  className="border border-[var(--input-border)] p-2 font-medium bg-[var(--input-bg)] text-[var(--foreground)] min-w-[120px] sticky left-0 z-10 group cursor-pointer"
                  style={{ background: 'var(--input-bg)', color: 'var(--foreground)', minWidth: '120px', left: 0 }}
                >
                  {name}
                  {/* Tooltip al pasar el mouse */}
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-gray-900 text-white text-xs rounded shadow-lg px-4 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 min-w-[180px] text-left whitespace-pre-line">
                    {(() => {
                      const summary = getEmployeeSummary(name);
                      return (
                        <>
                          <div><b>Días trabajados:</b> {summary.workedDays}</div>
                          <div><b>Horas trabajadas:</b> {summary.hours}</div>
                          <div><b>Total bruto:</b> ₡{summary.colones.toLocaleString('es-CR')}</div>
                          <div><b>CCSS:</b> -₡{summary.ccss.toLocaleString('es-CR', {minimumFractionDigits:2})}</div>
                          <div><b>Salario neto:</b> ₡{summary.neto.toLocaleString('es-CR', {minimumFractionDigits:2})}</div>
                        </>
                      );
                    })()}
                  </div>
                </td>
                {daysToShow.map(day => {
                  const value = scheduleData[name]?.[day.toString()] || '';
                  return (<td key={day} className="border border-[var(--input-border)] p-0">
                    <select
                      value={value}
                      onChange={(e) => handleCellChange(name, day, e.target.value)}
                      className="w-full h-full p-2 border-none outline-none text-center font-semibold cursor-pointer"
                      style={getCellStyle(value)}
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
        <div className="text-center py-8 text-[var(--tab-text)]">
          No hay empleados registrados para esta ubicación.
        </div>
      )}
    </div>
  );
}
