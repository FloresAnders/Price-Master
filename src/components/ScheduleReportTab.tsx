// src/components/ScheduleReportTab.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, MapPin, FileText, Download, Clock, Image as ImageIcon } from 'lucide-react';
import { LocationsService } from '../services/locations';
import { SchedulesService, ScheduleEntry } from '../services/schedules';
import { Location } from '../types/firestore';
import ImageExporter, { useLocationImageExport } from './ImageExporter';

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
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [currentPeriod, setCurrentPeriod] = useState<BiweeklyPeriod | null>(null);
  const [availablePeriods, setAvailablePeriods] = useState<BiweeklyPeriod[]>([]);
  const [scheduleData, setScheduleData] = useState<LocationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Función para mostrar notificación
  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

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

    const result = {
      start,
      end,
      label: `${monthNames[month]} ${year} (${period === 'first' ? '1-15' : `16-${end.getDate()}`})`,
      year,
      month: month, // Usar el mes con base 0 como JavaScript/ControlHorario
      period
    };
    
    return result;
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
        const monthNum = parseInt(month); // El mes viene en base 0 desde Firebase
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
          month: monthNum, // Mantener base 0
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
      }
      
      setLoading(false);
    };
    initializePeriods();
  }, []);  // Cargar datos de horarios cuando cambie el período, la ubicación o las ubicaciones
  useEffect(() => {
    const loadScheduleData = async () => {
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
          if (!locationGroups.has(schedule.locationValue)) {
            locationGroups.set(schedule.locationValue, []);
          }
          locationGroups.get(schedule.locationValue)!.push(schedule);
        });

        const scheduleDataArray: LocationSchedule[] = [];

        // Siempre procesar todas las ubicaciones al iniciar
        const locationsToProcess = selectedLocation === 'all' ? 
          locations : 
          locations.filter(loc => loc.value === selectedLocation);

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
                // Solo contar D y N como días laborados, no L
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

          // Agregar ubicación incluso si no tiene empleados (para mostrar todas las ubicaciones)
          scheduleDataArray.push({
            location,
            employees,
            totalWorkDays
          });
        });

        setScheduleData(scheduleDataArray);
      } catch (error) {
        console.error('Error loading schedule data:', error);
        showNotification('Error al cargar los datos de planilla', 'error');
      } finally {
        setLoading(false);
      }
    };

    if (currentPeriod && locations.length > 0) {
      loadScheduleData();
    }
  }, [currentPeriod, selectedLocation, locations]);
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
          totalDays: Object.values(emp.days).filter(shift => shift === 'D' || shift === 'N').length
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
    URL.revokeObjectURL(url);    showNotification('📄 Planilla exportada exitosamente', 'success');
  };

  // Función para exportar todas las imágenes
  const exportAllImages = async () => {
    if (!currentPeriod || scheduleData.length === 0) return;

    try {
      for (const locationData of scheduleData) {
        if (locationData.employees.length === 0) {
          // Si no hay empleados, exportar solo la ubicación
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) continue;

          // Configurar tamaño del canvas
          canvas.width = 800;
          canvas.height = 600;

          // Fondo blanco
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Configurar texto
          ctx.fillStyle = '#333333';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Título principal
          ctx.font = 'bold 48px Arial';
          ctx.fillText('Próximamente', canvas.width / 2, canvas.height / 2 - 50);

          // Información adicional
          ctx.font = '24px Arial';
          ctx.fillStyle = '#666666';
          ctx.fillText(`Ubicación: ${locationData.location.label}`, canvas.width / 2, canvas.height / 2 + 20);
          ctx.fillText(`Período: ${currentPeriod.label}`, canvas.width / 2, canvas.height / 2 + 60);

          // Convertir canvas a blob y descargar
          await new Promise<void>((resolve) => {
            canvas.toBlob((blob) => {
              if (!blob) {
                resolve();
                return;
              }

              // Crear nombre del archivo
              const cleanLocationName = locationData.location.label.replace(/[^a-zA-Z0-9]/g, '');
              const cleanPeriodLabel = currentPeriod.label.replace(/[^a-zA-Z0-9]/g, '');
              
              const fileName = `${cleanLocationName}-SinEmpleados-${cleanPeriodLabel}.jpg`;

              // Crear URL y descargar
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);

              resolve();
            }, 'image/jpeg', 0.9);
          });
        } else {
          // Exportar imagen para cada empleado
          for (const employee of locationData.employees) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) continue;

            // Configurar tamaño del canvas
            canvas.width = 800;
            canvas.height = 600;

            // Fondo blanco
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Configurar texto
            ctx.fillStyle = '#333333';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Título principal
            ctx.font = 'bold 48px Arial';
            ctx.fillText('Próximamente', canvas.width / 2, canvas.height / 2 - 50);

            // Información adicional
            ctx.font = '24px Arial';
            ctx.fillStyle = '#666666';
            ctx.fillText(`Ubicación: ${locationData.location.label}`, canvas.width / 2, canvas.height / 2 + 20);
            ctx.fillText(`Empleado: ${employee.employeeName}`, canvas.width / 2, canvas.height / 2 + 60);
            ctx.fillText(`Período: ${currentPeriod.label}`, canvas.width / 2, canvas.height / 2 + 100);

            // Convertir canvas a blob y descargar
            await new Promise<void>((resolve) => {
              canvas.toBlob((blob) => {
                if (!blob) {
                  resolve();
                  return;
                }

                // Crear nombre del archivo
                const cleanLocationName = locationData.location.label.replace(/[^a-zA-Z0-9]/g, '');
                const cleanEmployeeName = employee.employeeName.replace(/[^a-zA-Z0-9]/g, '');
                const cleanPeriodLabel = currentPeriod.label.replace(/[^a-zA-Z0-9]/g, '');
                
                const fileName = `${cleanLocationName}-${cleanEmployeeName}-${cleanPeriodLabel}.jpg`;

                // Crear URL y descargar
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                resolve();
              }, 'image/jpeg', 0.9);
            });

            // Pequeña pausa entre descargas para no saturar el navegador
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      const totalImages = scheduleData.reduce((total, location) => {
        return total + (location.employees.length || 1);
      }, 0);      showNotification(`📸 ${totalImages} imágenes exportadas exitosamente`, 'success');

    } catch (error) {
      console.error('Error exporting images:', error);
      showNotification('❌ Error al exportar imágenes', 'error');
    }
  };

  // Función para exportar imágenes de una ubicación específica
  const exportLocationImages = async (locationData: LocationSchedule) => {
    if (!currentPeriod) return;

    try {
      if (locationData.employees.length === 0) {
        // Si no hay empleados, exportar solo la ubicación
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return;

        // Configurar tamaño del canvas
        canvas.width = 800;
        canvas.height = 600;

        // Fondo blanco
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Configurar texto
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Título principal
        ctx.font = 'bold 48px Arial';
        ctx.fillText('Próximamente', canvas.width / 2, canvas.height / 2 - 50);

        // Información adicional
        ctx.font = '24px Arial';
        ctx.fillStyle = '#666666';
        ctx.fillText(`Ubicación: ${locationData.location.label}`, canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillText(`Período: ${currentPeriod.label}`, canvas.width / 2, canvas.height / 2 + 60);

        // Convertir canvas a blob y descargar
        await new Promise<void>((resolve) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve();
              return;
            }

            // Crear nombre del archivo
            const cleanLocationName = locationData.location.label.replace(/[^a-zA-Z0-9]/g, '');
            const cleanPeriodLabel = currentPeriod.label.replace(/[^a-zA-Z0-9]/g, '');
            
            const fileName = `${cleanLocationName}-SinEmpleados-${cleanPeriodLabel}.jpg`;

            // Crear URL y descargar
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            resolve();
          }, 'image/jpeg', 0.9);
        });

        showNotification(`📸 Imagen exportada para ${locationData.location.label}`, 'success');
      } else {
        // Exportar imagen para cada empleado
        for (const employee of locationData.employees) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) continue;

          // Configurar tamaño del canvas
          canvas.width = 800;
          canvas.height = 600;

          // Fondo blanco
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Configurar texto
          ctx.fillStyle = '#333333';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Título principal
          ctx.font = 'bold 48px Arial';
          ctx.fillText('Próximamente', canvas.width / 2, canvas.height / 2 - 50);

          // Información adicional
          ctx.font = '24px Arial';
          ctx.fillStyle = '#666666';
          ctx.fillText(`Ubicación: ${locationData.location.label}`, canvas.width / 2, canvas.height / 2 + 20);
          ctx.fillText(`Empleado: ${employee.employeeName}`, canvas.width / 2, canvas.height / 2 + 60);
          ctx.fillText(`Período: ${currentPeriod.label}`, canvas.width / 2, canvas.height / 2 + 100);

          // Convertir canvas a blob y descargar
          await new Promise<void>((resolve) => {
            canvas.toBlob((blob) => {
              if (!blob) {
                resolve();
                return;
              }

              // Crear nombre del archivo
              const cleanLocationName = locationData.location.label.replace(/[^a-zA-Z0-9]/g, '');
              const cleanEmployeeName = employee.employeeName.replace(/[^a-zA-Z0-9]/g, '');
              const cleanPeriodLabel = currentPeriod.label.replace(/[^a-zA-Z0-9]/g, '');
              
              const fileName = `${cleanLocationName}-${cleanEmployeeName}-${cleanPeriodLabel}.jpg`;

              // Crear URL y descargar
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);

              resolve();
            }, 'image/jpeg', 0.9);
          });

          // Pequeña pausa entre descargas para no saturar el navegador
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        showNotification(`📸 ${locationData.employees.length} imágenes exportadas para ${locationData.location.label}`, 'success');
      }
    } catch (error) {
      console.error('Error exporting location images:', error);
      showNotification('❌ Error al exportar imágenes', 'error');
    }
  };

  // Función para obtener el estilo de celda basado en el turno
  const getCellStyle = (value: string) => {
    switch (value) {
      case 'D':
        return { backgroundColor: '#FFFF00', color: '#000000' }; // Amarillo
      case 'N':
        return { backgroundColor: '#87CEEB', color: '#000000' }; // Azul claro
      case 'L':
        return { backgroundColor: '#FF00FF', color: '#FFFFFF' }; // Magenta
      default:
        return { 
          backgroundColor: 'var(--input-bg)', 
          color: 'var(--foreground)' 
        };
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
      {/* Notification */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-semibold animate-fade-in-down ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          <Clock className="w-5 h-5" />
          {notification.message}
        </div>
      )}

      {/* Header con controles */}
      <div className="mb-6 flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <FileText className="w-8 h-8 text-blue-600" />
          <div>
            <h3 className="text-xl font-semibold">Planilla de Horarios</h3>
            <p className="text-sm text-[var(--tab-text)]">
              Control de horarios por ubicación y quincena
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Selector de ubicación */}
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
              <option value="all">Todas las ubicaciones</option>
              {locations.map(location => (
                <option key={location.value} value={location.value}>
                  {location.label}
                </option>
              ))}
            </select>
          </div>          {/* Botones de exportación */}
          <div className="flex items-center gap-2">
            <button
              onClick={exportData}
              disabled={scheduleData.length === 0}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md flex items-center gap-2 transition-colors"
              title="Exportar datos JSON"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">JSON</span>
            </button>
            
            {/* Botón de exportar imagen global */}
            <button
              onClick={exportAllImages}
              disabled={scheduleData.length === 0}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-md flex items-center gap-2 transition-colors"
              title="Exportar todas las imágenes"
            >
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Imágenes</span>
            </button>
          </div>
        </div>
      </div>      {/* Controles de navegación de período */}
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
        </div>

        {/* Navegación con botones (mantener como alternativa) */}
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
          <div key={locationIndex} className="border border-[var(--input-border)] rounded-lg p-6">            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                {locationData.location.label}
              </h4>              <div className="flex items-center gap-2">
                {locationData.employees.length > 0 && (
                  <span className="text-sm text-[var(--tab-text)]">
                    {locationData.employees.length} empleado{locationData.employees.length !== 1 ? 's' : ''}
                  </span>
                )}
                <button
                  onClick={() => exportLocationImages(locationData)}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md flex items-center gap-2 transition-colors"
                  title={`Exportar imágenes de ${locationData.location.label}`}
                >
                  <ImageIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Imagen</span>
                </button>
              </div>
            </div>

            {locationData.employees.length === 0 ? (
              <div className="text-center py-8 text-[var(--tab-text)]">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No hay horarios registrados para este período</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-[var(--input-border)]">
                  <thead>
                    <tr>
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
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {locationData.employees.map((employee, empIndex) => (
                      <tr key={empIndex}>
                        <td
                          className="border border-[var(--input-border)] p-2 font-medium"
                          style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                        >
                          {employee.employeeName}
                        </td>
                        {getDaysInPeriod().map(day => (
                          <td key={day} className="border border-[var(--input-border)] p-0">
                            <div 
                              className="w-full h-full p-1 text-center font-semibold text-sm"
                              style={getCellStyle(employee.days[day] || '')}
                            >
                              {employee.days[day] || ''}
                            </div>
                          </td>
                        ))}
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
    </div>
  );
}
