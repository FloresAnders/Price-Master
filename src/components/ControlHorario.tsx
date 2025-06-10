// src/components/ControlHorario.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { LocationsService } from '../services/locations';
import type { Location } from '../types/firestore';

interface ScheduleData {
  [employeeName: string]: {
    [day: string]: string;
  };
}

export default function ControlHorario() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleData, setScheduleData] = useState<ScheduleData>({});
  const [viewMode, setViewMode] = useState<'first' | 'second'>('first'); // primera o segunda quincena
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

  // Cargar datos del localStorage cuando cambie la ubicación
  useEffect(() => {
    if (location) {
      const saved = localStorage.getItem(`scheduleData_${location}_${year}_${month}`);
      if (saved) {
        try {
          setScheduleData(JSON.parse(saved));
        } catch {
          setScheduleData({});
        }
      } else {
        setScheduleData({});
      }
    }
  }, [location, year, month]);

  // Guardar datos en localStorage cuando cambien
  useEffect(() => {
    if (location && Object.keys(scheduleData).length > 0) {
      localStorage.setItem(`scheduleData_${location}_${year}_${month}`, JSON.stringify(scheduleData));
    }
  }, [scheduleData, location, year, month]);  // Opciones de turnos disponibles
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
    setScheduleData(prev => ({
      ...prev,
      [employeeName]: {
        ...prev[employeeName],
        [day.toString()]: value
      }
    }));
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
    });  };

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
      {/* Header con controles */}
      <div className="mb-6 flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <Calendar className="w-8 h-8 text-blue-600" />
          <div>
            <h3 className="text-xl font-semibold">Control de Horarios</h3>
            <p className="text-sm text-[var(--tab-text)]">Ubicación: {location}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Selector de ubicación */}
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
            className={`px-4 py-2 rounded-md transition-colors ${
              viewMode === 'first'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            1-15
          </button>
          <button
            onClick={() => setViewMode('second')}
            className={`px-4 py-2 rounded-md transition-colors ${
              viewMode === 'second'
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
                  return (                    <td key={day} className="border border-[var(--input-border)] p-0">
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
