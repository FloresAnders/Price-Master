// src/components/ControlHorario.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Calendar, ChevronLeft, ChevronRight, Save, LogOut } from 'lucide-react';
import { LocationsService } from '../services/locations';
import { SchedulesService } from '../services/schedules';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';
import type { Location, User } from '../types/firestore';

interface ScheduleData {
  [employeeName: string]: {
    [day: string]: string;
  };
}

export default function ControlHorario() {
  const { user, isAuthenticated, login, logout, canChangeLocation } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleData, setScheduleData] = useState<ScheduleData>({});
  const [viewMode, setViewMode] = useState<'first' | 'second'>('first');
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
  const handleLoginSuccess = (userData: User) => {
    login(userData);
    setShowLoginModal(false);
    if (userData.location) {
      setLocation(userData.location);
    }
  };

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

  // Determinar qué días mostrar según el modo de vista
  const getDaysToShow = () => {
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
          <Calendar className="w-8 h-8 text-blue-600" />
          <div>
            <h3 className="text-xl font-semibold">Control de Horarios</h3>
            <p className="text-sm text-[var(--tab-text)]">
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
        <div className="flex items-center gap-2">
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

        <div className="flex gap-2">
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
                className="border border-[var(--input-border)] p-2 font-semibold text-center"
                style={{ background: 'var(--input-bg)', color: 'var(--foreground)', minWidth: '120px' }}
              >
                Nombre
              </th>
              {daysToShow.map(day => (
                <th
                  key={day}
                  className="border border-[var(--input-border)] p-2 font-semibold text-center"
                  style={{ background: 'var(--input-bg)', color: 'var(--foreground)', minWidth: '50px' }}
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {names.map(name => (
              <tr key={name}>
                <td
                  className="border border-[var(--input-border)] p-2 font-medium"
                  style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                >
                  {name}
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
