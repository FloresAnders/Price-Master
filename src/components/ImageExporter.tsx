'use client';

import React from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface ImageExportProps {
  locationName: string;
  employeeName?: string;
  periodLabel: string;
  onExportComplete?: (message: string) => void;
}

export default function ImageExporter({
  locationName,
  employeeName,
  periodLabel,
  onExportComplete
}: ImageExportProps) {

  const generateImage = async () => {
    try {
      // Crear un canvas para generar la imagen
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('No se pudo crear el contexto del canvas');
      }

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
      ctx.fillText(`Ubicación: ${locationName}`, canvas.width / 2, canvas.height / 2 + 20);

      if (employeeName) {
        ctx.fillText(`Empleado: ${employeeName}`, canvas.width / 2, canvas.height / 2 + 60);
        ctx.fillText(`Período: ${periodLabel}`, canvas.width / 2, canvas.height / 2 + 100);
      } else {
        ctx.fillText(`Período: ${periodLabel}`, canvas.width / 2, canvas.height / 2 + 60);
      }

      // Convertir canvas a blob
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('No se pudo generar la imagen');
        }

        // Crear nombre del archivo
        const cleanLocationName = locationName.replace(/[^a-zA-Z0-9]/g, '');
        const cleanEmployeeName = employeeName ? employeeName.replace(/[^a-zA-Z0-9]/g, '') : 'TodosLosEmpleados';
        const cleanPeriodLabel = periodLabel.replace(/[^a-zA-Z0-9]/g, '');

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

        // Notificar que se completó la exportación
        if (onExportComplete) {
          onExportComplete(`📸 Imagen exportada: ${fileName}`);
        }
      }, 'image/jpeg', 0.9);

    } catch (error) {
      console.error('Error generating image:', error);
      if (onExportComplete) {
        onExportComplete('❌ Error al generar la imagen');
      }
    }
  };

  return (
    <button
      onClick={generateImage}
      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md flex items-center gap-2 transition-colors"
      title="Exportar como imagen"
    >
      <ImageIcon className="w-4 h-4" />
      <span className="hidden sm:inline">Imagen</span>
    </button>
  );
}

// Hook para exportar múltiples empleados de una ubicación
export const useLocationImageExport = (
  locationName: string,
  employees: Array<{ employeeName: string }>,
  periodLabel: string,
  onExportComplete?: (message: string) => void
) => {
  const exportAllEmployees = async () => {
    try {
      if (employees.length === 0) {
        // Si no hay empleados, exportar solo la ubicación
        const exporter = new (ImageExporter as any)({
          locationName,
          periodLabel,
          onExportComplete
        });
        await exporter.generateImage();
        return;
      }

      // Exportar imagen para cada empleado
      for (const employee of employees) {
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
        ctx.fillText(`Ubicación: ${locationName}`, canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillText(`Empleado: ${employee.employeeName}`, canvas.width / 2, canvas.height / 2 + 60);
        ctx.fillText(`Período: ${periodLabel}`, canvas.width / 2, canvas.height / 2 + 100);

        // Convertir canvas a blob y descargar
        await new Promise<void>((resolve) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve();
              return;
            }

            // Crear nombre del archivo
            const cleanLocationName = locationName.replace(/[^a-zA-Z0-9]/g, '');
            const cleanEmployeeName = employee.employeeName.replace(/[^a-zA-Z0-9]/g, '');
            const cleanPeriodLabel = periodLabel.replace(/[^a-zA-Z0-9]/g, '');

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

      if (onExportComplete) {
        onExportComplete(`📸 ${employees.length} imágenes exportadas para ${locationName}`);
      }

    } catch (error) {
      console.error('Error exporting location images:', error);
      if (onExportComplete) {
        onExportComplete('❌ Error al exportar imágenes');
      }
    }
  };

  return { exportAllEmployees };
};
