/**
 * Ejemplo de uso de la función de eliminación de documentos
 * 
 * Implementación basada en el requerimiento:
 * - Cuando una celda se actualiza a "", el documento se elimina de la DB
 * - Se obtiene el ID del documento existente para saber qué eliminar
 */

import { SchedulesService } from '../services/schedules';

// Ejemplo de la función implementada:
async function eliminarDocumentoPorHorario() {
  try {
    // Ejemplo: Eliminar turno de Juan Pérez del día 15 de junio 2025
    await SchedulesService.updateScheduleShift(
      'LOCATION_1',     // locationValue
      'Juan Pérez',     // employeeName  
      2025,             // year
      5,                // month (Junio = 5, base 0)
      15,               // day
      ''                // shift vacío = ELIMINAR DOCUMENTO
    );

  } catch (error) {
    console.error('Error al eliminar documento:', error);
  }
}

/**
 * Flujo interno de la función updateScheduleShift cuando shift = "":
 * 
 * 1. Busca documento existente con findScheduleEntry()
 * 2. Si existe documento y shift === "":
 *    - Llama a deleteSchedule(document.id)
 *    - Logging: "Documento eliminado exitosamente: {id}"
 * 3. Si no existe documento y shift === "":
 *    - No hace nada (ya está "vacío")
 * 4. Si shift tiene valor:
 *    - Crea nuevo documento o actualiza existente
 */

// Función de consulta para verificar documentos existentes:
async function verificarDocumentosExistentes() {
  try {
    const schedules = await SchedulesService.getAllSchedules();
    //('Documentos en la colección schedules:', schedules.length);

    schedules.forEach(schedule => {
      //(`ID: ${schedule.id}, Empleado: ${schedule.employeeName}, Día: ${schedule.day}, Turno: ${schedule.shift}`);
    });
  } catch (error) {
    console.error('Error al consultar documentos:', error);
  }
}

// Función específica para eliminar por ID directo (similar al ejemplo solicitado):
async function eliminarDocumentoPorID(documentId: string) {
  try {
    await SchedulesService.deleteSchedule(documentId);
    //('Documento eliminado exitosamente');
  } catch (error) {
    console.error('Error al eliminar documento:', error);
  }
}

export {
  eliminarDocumentoPorHorario,
  verificarDocumentosExistentes,
  eliminarDocumentoPorID
};
