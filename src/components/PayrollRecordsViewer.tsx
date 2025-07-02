// src/components/PayrollRecordsViewer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Users, Eye, Trash2 } from 'lucide-react';
import { PayrollRecordsService, PayrollRecord } from '../services/payroll-records';
import { LocationsService } from '../services/locations';
import { Location } from '../types/firestore';
import ConfirmModal from './ConfirmModal';

interface PayrollRecordsViewerProps {
  selectedLocation?: string;
}

interface PeriodToDelete {
  locationValue: string;
  employeeName: string;
  year: number;
  month: number;
  period: 'first' | 'second';
  periodLabel: string;
}

export default function PayrollRecordsViewer({ selectedLocation = 'all' }: PayrollRecordsViewerProps) {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    periodToDelete: PeriodToDelete | null;
    loading: boolean;
  }>({
    open: false,
    periodToDelete: null,
    loading: false
  });

  // Función para mostrar notificación
  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
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

  // Cargar registros
  useEffect(() => {
    const loadRecords = async () => {
      setLoading(true);
      try {
        let recordsData: PayrollRecord[];
        
        if (selectedLocation === 'all') {
          recordsData = await PayrollRecordsService.getAllRecords();
        } else {
          recordsData = await PayrollRecordsService.getRecordsByLocation(selectedLocation);
        }
        
        setRecords(recordsData);
      } catch (error) {
        console.error('Error loading payroll records:', error);
        showNotification('Error al cargar los registros de planilla', 'error');
      } finally {
        setLoading(false);
      }
    };

    if (locations.length > 0) {
      loadRecords();
    }
  }, [selectedLocation, locations]);

  // Preparar eliminación de período específico
  const preparePeriodDeletion = (
    locationValue: string,
    employeeName: string,
    year: number,
    month: number,
    period: 'first' | 'second'
  ) => {
    const monthName = getMonthName(month);
    const periodLabel = period === 'first' ? 'Primera Quincena' : 'Segunda Quincena';
    
    setConfirmModal({
      open: true,
      periodToDelete: {
        locationValue,
        employeeName,
        year,
        month,
        period,
        periodLabel: `${periodLabel} de ${monthName} ${year}`
      },
      loading: false
    });
  };

  // Confirmar eliminación de período
  const confirmPeriodDeletion = async () => {
    if (!confirmModal.periodToDelete) return;

    setConfirmModal(prev => ({ ...prev, loading: true }));

    try {
      const { locationValue, employeeName, year, month, period } = confirmModal.periodToDelete;
      
      await PayrollRecordsService.deletePeriodFromRecord(
        locationValue,
        employeeName,
        year,
        month,
        period
      );

      showNotification(
        `${confirmModal.periodToDelete.periodLabel} de ${employeeName} eliminada exitosamente`,
        'success'
      );

      // Recargar registros
      let recordsData: PayrollRecord[];
      if (selectedLocation === 'all') {
        recordsData = await PayrollRecordsService.getAllRecords();
      } else {
        recordsData = await PayrollRecordsService.getRecordsByLocation(selectedLocation);
      }
      setRecords(recordsData);

      // Cerrar modal
      setConfirmModal({ open: false, periodToDelete: null, loading: false });
    } catch (error) {
      console.error('Error deleting period:', error);
      showNotification(
        `Error eliminando ${confirmModal.periodToDelete.periodLabel} de ${confirmModal.periodToDelete.employeeName}`,
        'error'
      );
      setConfirmModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Cancelar eliminación
  const cancelPeriodDeletion = () => {
    setConfirmModal({ open: false, periodToDelete: null, loading: false });
  };

  // Obtener nombre de ubicación
  const getLocationName = (locationValue: string) => {
    const location = locations.find(loc => loc.value === locationValue);
    return location ? location.label : locationValue;
  };

  // Calcular días totales de un empleado específico
  const getEmployeeTotalDays = (employeeRecord: PayrollRecord) => {
    let totalDays = 0;
    Object.values(employeeRecord.records).forEach(yearData => {
      Object.values(yearData).forEach(monthData => {
        if (monthData.NumeroQuincena1) {
          totalDays += monthData.NumeroQuincena1.DiasLaborados;
        }
        if (monthData.NumeroQuincena2) {
          totalDays += monthData.NumeroQuincena2.DiasLaborados;
        }
      });
    });
    return totalDays;
  };

  // Formatear mes
  const getMonthName = (month: number) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    // Los meses en la base de datos están en formato 0-11 (JavaScript getMonth())
    return months[month] || `Mes ${month + 1}`;
  };

  if (loading) {
    return (
      <div className="max-w-full mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div className="text-lg text-[var(--foreground)]">Cargando registros de planilla...</div>
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
          <Eye className="w-5 h-5" />
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Calendar className="w-8 h-8 text-blue-600" />
        <div>
          <h3 className="text-xl font-semibold">Registros de Planilla</h3>
          <p className="text-sm text-[var(--tab-text)]">
            {records.length} registro{records.length !== 1 ? 's' : ''} guardado{records.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Contenido */}
      {records.length === 0 ? (
        <div className="text-center py-8 text-[var(--tab-text)]">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No hay registros de planilla guardados</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record, index) => (
            <div key={index} className="border border-[var(--input-border)] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-lg">{record.employeeName}</h4>
                  <p className="text-sm text-[var(--tab-text)]">
                    {getLocationName(record.locationValue)}
                  </p>
                </div>
                
                {/* Indicador de días totales del empleado */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-center">
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {getEmployeeTotalDays(record)}
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Días Totales
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(record.records).map(([year, yearData]) =>
                  Object.entries(yearData).map(([month, monthData]) => (
                    <div key={`${year}-${month}`} className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                      <h5 className="font-medium mb-2">
                        {getMonthName(parseInt(month))} {year}
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {monthData.NumeroQuincena1 && (
                          <div className="bg-white dark:bg-gray-700 rounded p-2 relative">
                            <button
                              onClick={() => preparePeriodDeletion(
                                record.locationValue,
                                record.employeeName,
                                parseInt(year),
                                parseInt(month),
                                'first'
                              )}
                              className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
                              title="Eliminar Primera Quincena"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <h6 className="font-medium text-sm text-blue-600 dark:text-blue-400 pr-8">
                              Primera Quincena
                            </h6>
                            <p className="text-sm">
                              Días laborados: {monthData.NumeroQuincena1.DiasLaborados}
                            </p>
                            <p className="text-sm">
                              Horas por día: {monthData.NumeroQuincena1.hoursPerDay}
                            </p>
                            <p className="text-sm">
                              Total horas: {monthData.NumeroQuincena1.totalHours}
                            </p>
                          </div>
                        )}
                        {monthData.NumeroQuincena2 && (
                          <div className="bg-white dark:bg-gray-700 rounded p-2 relative">
                            <button
                              onClick={() => preparePeriodDeletion(
                                record.locationValue,
                                record.employeeName,
                                parseInt(year),
                                parseInt(month),
                                'second'
                              )}
                              className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
                              title="Eliminar Segunda Quincena"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <h6 className="font-medium text-sm text-green-600 dark:text-green-400 pr-8">
                              Segunda Quincena
                            </h6>
                            <p className="text-sm">
                              Días laborados: {monthData.NumeroQuincena2.DiasLaborados}
                            </p>
                            <p className="text-sm">
                              Horas por día: {monthData.NumeroQuincena2.hoursPerDay}
                            </p>
                            <p className="text-sm">
                              Total horas: {monthData.NumeroQuincena2.totalHours}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 text-xs text-[var(--tab-text)]">
                Creado: {new Date(record.createdAt).toLocaleDateString('es-ES')} |
                Actualizado: {new Date(record.updatedAt).toLocaleDateString('es-ES')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de confirmación */}
      <ConfirmModal
        open={confirmModal.open}
        title="Eliminar Quincena"
        message={confirmModal.periodToDelete ? 
          `¿Estás seguro de que quieres eliminar la ${confirmModal.periodToDelete.periodLabel} de ${confirmModal.periodToDelete.employeeName}?` : 
          ''
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        loading={confirmModal.loading}
        onConfirm={confirmPeriodDeletion}
        onCancel={cancelPeriodDeletion}
        actionType="delete"
      />
    </div>
  );
}
