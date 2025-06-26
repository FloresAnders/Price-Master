// src/components/ControlHorario.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Clock, ChevronLeft, ChevronRight, Save, LogOut, User as UserIcon, Lock, Unlock } from 'lucide-react';
import { LocationsService } from '../services/locations';
import { SchedulesService } from '../services/schedules';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';
import ConfirmModal from './ConfirmModal';
import type { Location } from '../types/firestore';
import type { User as FirestoreUser } from '../types/firestore';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';

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
  // Estado para countdown de validez del QR
  const [qrCountdown, setQrCountdown] = useState<number | null>(null);

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

  // Función para exportar la quincena actual como PNG
  const exportQuincenaToPNG = async () => {
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
      tableHTML += `</tr></thead><tbody>`;
      names.forEach(name => {
        tableHTML += `<tr><td style='border:1px solid #d1d5db;padding:6px 10px;font-weight:bold;background:#f3f4f6;'>${name}</td>`;
        daysToShow.forEach(day => {
          const value = scheduleData[name]?.[day.toString()] || '';
          let bg = '#fff';
          if (value === 'N') bg = '#87CEEB';
          if (value === 'D') bg = '#FFFF00';
          if (value === 'L') bg = '#FF00FF';
          tableHTML += `<td style='border:1px solid #d1d5db;padding:6px 10px;background:${bg};text-align:center;'>${value}</td>`;
        });
        tableHTML += `</tr>`;
      });
      tableHTML += `</tbody></table>`;
      tableHTML += `<div style='margin-top:1.2rem;text-align:right;font-size:0.95rem;opacity:0.7;'>Exportado: ${new Date().toLocaleString('es-CR')}</div>`;
      exportDiv.innerHTML = tableHTML;
      document.body.appendChild(exportDiv);
      await new Promise(resolve => setTimeout(resolve, 100));
      const canvas = await html2canvas(exportDiv, {
        useCORS: true,
        allowTaint: true,
        width: exportDiv.scrollWidth,
        height: exportDiv.scrollHeight,
        logging: false
      });
      document.body.removeChild(exportDiv);
      // Subir a Firebase Storage
      const imgData = canvas.toDataURL('image/png');
      const blob = await (await fetch(imgData)).blob();
      const timestamp = Date.now();
      const fileName = `horario_quincena_${timestamp}.png`;
      const storagePath = `exports/${fileName}`;
      const imageRef = ref(storage, storagePath);
      await uploadBytes(imageRef, blob);
      const downloadUrl = await getDownloadURL(imageRef);
      // Generar QR para descarga desde otro dispositivo
      const qrDataUrl = await QRCode.toDataURL(downloadUrl, { width: 300 });
      setQRCodeDataURL(qrDataUrl);
      setShowQRModal(true);
      setQrCountdown(60);
      const countdownInterval = setInterval(() => {
        setQrCountdown(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      // Borrar la imagen de Firebase después de 1 minuto
      setTimeout(async () => {
        try {
          await deleteObject(imageRef);
        } catch {
          // Ignorar error de borrado
        }
      }, 60000); // 1 minuto
    } catch {
      alert('Error al exportar la quincena.');
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
                title="Exportar quincena como imagen"
                disabled={isExporting}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 10l5 5 5-5M12 4v12" /></svg>
                Exportar Quincena
              </button>
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
        </div>        {/* Grid de horarios */}
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
                    today.getDate() === day; return (<th
                      key={day}
                      className={`border border-[var(--input-border)] p-2 font-semibold text-center transition-colors text-xs ${isToday ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-[var(--card-bg)]' : ''}`}
                      style={{
                        background: 'var(--input-bg)',
                        color: 'var(--foreground)',
                        minWidth: fullMonthView ? '40px' : '20px',
                        borderColor: isToday ? '#4ade80' : undefined,
                        height: '40px'
                      }}
                    >
                      {day}
                    </th>
                    );                })}
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
                        className="sm:hidden text-blue-500 hover:text-blue-700 p-1"
                        title="Ver resumen"
                      >
                        ℹ️
                      </button>
                    </div>
                    {/* Tooltip al pasar el mouse - solo en pantallas grandes */}
                    <div className="hidden sm:block absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-gray-900 text-white text-xs rounded shadow-lg px-4 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 min-w-[180px] text-left whitespace-pre-line">
                      {(() => {
                        const summary = getEmployeeSummary(name);
                        return (
                          <>
                            <div><b>Días trabajados:</b> {summary.workedDays}</div>
                            <div><b>Horas trabajadas:</b> {summary.hours}</div>
                            <div><b>Total bruto:</b> ₡{summary.colones.toLocaleString('es-CR')}</div>
                            <div><b>CCSS:</b> -₡{summary.ccss.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</div>
                            <div><b>Salario neto:</b> ₡{summary.neto.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</div>
                          </>
                        );
                      })()}
                    </div>
                  </td>
                    {daysToShow.map(day => {
                      const value = scheduleData[name]?.[day.toString()] || '';
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
                      } return (<td key={day} className="border border-[var(--input-border)] p-0" style={{ minWidth: fullMonthView ? '32px' : '40px' }}>
                        <select
                          value={value}
                          onChange={(e) => handleCellChange(name, day, e.target.value)}
                          className={`w-full h-full p-1 border-none outline-none text-center font-semibold cursor-pointer text-xs ${disabled ? 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-500' : ''}`}
                          style={{ ...getCellStyle(value), minWidth: fullMonthView ? '32px' : '40px', height: '40px' }}
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
        </div>        {names.length === 0 && (
          <div className="text-center py-8 text-[var(--tab-text)]">
            No hay empleados registrados para esta ubicación.
          </div>
        )}

        {/* Modal de resumen del empleado para móviles */}
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
              {(() => {
                const summary = getEmployeeSummary(showEmployeeSummary);
                return (
                  <div className="space-y-2 text-sm">
                    <div><b>Días trabajados:</b> {summary.workedDays}</div>
                    <div><b>Horas trabajadas:</b> {summary.hours}</div>
                    <div><b>Total bruto:</b> ₡{summary.colones.toLocaleString('es-CR')}</div>
                    <div><b>CCSS:</b> -₡{summary.ccss.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</div>
                    <div><b>Salario neto:</b> ₡{summary.neto.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</div>
                  </div>
                );
              })()}
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

      {/* Modal QR para descarga (sin supervínculo Descargar QR) */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full flex flex-col items-center">
            <Image
              src={qrCodeDataURL}
              alt="QR para descargar quincena"
              className="mb-4"
              width={300}
              height={300}
              unoptimized
            />
            <div className="text-xs text-red-600 mb-2 text-center">Este enlace y QR solo estarán disponibles por 1 minuto.</div>
            <button
              onClick={() => {
                setShowQRModal(false);
                setQrCountdown(null);
              }}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >Cerrar</button>
          </div>
        </div>
      )}

      {/* Toast de countdown para QR */}
      {qrCountdown !== null && qrCountdown > 0 && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded shadow-lg animate-pulse font-semibold text-sm">
          El enlace y QR expiran en {qrCountdown} segundo{qrCountdown === 1 ? '' : 's'}
        </div>
      )}
    </>
  );
}
