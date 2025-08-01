import { FirestoreService } from './firestore';

export interface ScheduleEntry {
  id?: string;
  locationValue: string;
  employeeName: string;
  year: number;
  month: number;
  day: number;
  shift: string; // 'N', 'D', 'L', 'V', 'I', or empty string
  horasPorDia?: number; // Específico para DELIFOOD
  createdAt?: Date;
  updatedAt?: Date;
}

export class SchedulesService {
  private static readonly COLLECTION_NAME = 'schedules';
  /**
   * Get all schedule entries
   */
  static async getAllSchedules(): Promise<ScheduleEntry[]> {
    return await FirestoreService.getAll(this.COLLECTION_NAME);
  }

  /**
   * Get schedule entry by ID
   */
  static async getScheduleById(id: string): Promise<ScheduleEntry | null> {
    return await FirestoreService.getById(this.COLLECTION_NAME, id);
  }

  /**
   * Add a new schedule entry
   */
  static async addSchedule(schedule: Omit<ScheduleEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const scheduleWithTimestamps = {
      ...schedule,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return await FirestoreService.add(this.COLLECTION_NAME, scheduleWithTimestamps);
  }

  /**
   * Update a schedule entry
   */
  static async updateSchedule(id: string, schedule: Partial<ScheduleEntry>): Promise<void> {
    const updateData = {
      ...schedule,
      updatedAt: new Date()
    };
    return await FirestoreService.update(this.COLLECTION_NAME, id, updateData);
  }

  /**
   * Delete a schedule entry
   */
  static async deleteSchedule(id: string): Promise<void> {
    return await FirestoreService.delete(this.COLLECTION_NAME, id);
  }

  /**
   * Get schedules for a specific location, employee, and month
   */
  static async getSchedulesByLocationEmployeeMonth(
    locationValue: string,
    employeeName: string,
    year: number,
    month: number
  ): Promise<ScheduleEntry[]> {
    return await FirestoreService.query(this.COLLECTION_NAME, [
      { field: 'locationValue', operator: '==', value: locationValue },
      { field: 'employeeName', operator: '==', value: employeeName },
      { field: 'year', operator: '==', value: year },
      { field: 'month', operator: '==', value: month }
    ]);
  }

  /**
   * Get or create a schedule entry for a specific day
   */
  static async getOrCreateScheduleEntry(
    locationValue: string,
    employeeName: string,
    year: number,
    month: number,
    day: number
  ): Promise<ScheduleEntry> {
    // First try to find existing entry
    const existing = await FirestoreService.query(this.COLLECTION_NAME, [
      { field: 'locationValue', operator: '==', value: locationValue },
      { field: 'employeeName', operator: '==', value: employeeName },
      { field: 'year', operator: '==', value: year },
      { field: 'month', operator: '==', value: month },
      { field: 'day', operator: '==', value: day }
    ]);

    if (existing.length > 0) {
      return existing[0];
    }

    // Create new entry if it doesn't exist
    const newEntry = {
      locationValue,
      employeeName,
      year,
      month,
      day,
      shift: ''
    };

    const id = await this.addSchedule(newEntry);
    return { ...newEntry, id };
  }
  /**
   * Find existing schedule entry for a specific day
   */
  static async findScheduleEntry(
    locationValue: string,
    employeeName: string,
    year: number,
    month: number,
    day: number
  ): Promise<ScheduleEntry | null> {
    const existing = await FirestoreService.query(this.COLLECTION_NAME, [
      { field: 'locationValue', operator: '==', value: locationValue },
      { field: 'employeeName', operator: '==', value: employeeName },
      { field: 'year', operator: '==', value: year },
      { field: 'month', operator: '==', value: month },
      { field: 'day', operator: '==', value: day }
    ]);

    return existing.length > 0 ? existing[0] : null;
  }

  /**
   * Update or create schedule entry shift
   * If shift is empty, delete the document instead of updating it
   */
  static async updateScheduleShift(
    locationValue: string,
    employeeName: string,
    year: number,
    month: number,
    day: number,
    shift: string
  ): Promise<void> {
    try {
      // Find existing entry first
      const existingEntry = await this.findScheduleEntry(locationValue, employeeName, year, month, day);

      if (shift === '' || shift.trim() === '') {
        // If setting to empty and document exists, DELETE it
        if (existingEntry && existingEntry.id) {
          await this.deleteSchedule(existingEntry.id);
          console.log(`Documento eliminado exitosamente: ${existingEntry.id}`);
        }
        // If no existing document, do nothing (already "empty")
      } else {
        // Get employee hoursPerShift from location data only for work shifts (D or N)
        let horasPorDia: number | undefined;
        
        if (shift === 'D' || shift === 'N') {
          try {
            const { LocationsService } = await import('./locations');
            const locations = await LocationsService.findLocationsByValue(locationValue);
            const location = locations[0];
            const employee = location?.employees?.find(emp => emp.name === employeeName);
            horasPorDia = employee?.hoursPerShift || 8; // Default to 8 hours if not specified
            console.log(`🔄 Adding horasPorDia for ${employeeName} (${shift}): ${horasPorDia} hours`);
          } catch (error) {
            console.warn('Error getting employee hoursPerShift, using default 8:', error);
            horasPorDia = 8; // Fallback to 8 hours
          }
        } else {
          // For shifts other than D or N (like L), don't add horasPorDia
          console.log(`ℹ️ Shift "${shift}" for ${employeeName}: no horasPorDia added`);
        }

        // If setting a value
        if (existingEntry && existingEntry.id) {
          // Update existing document with shift and horasPorDia (only if defined)
          const updateData: Partial<ScheduleEntry> = { shift };
          if (horasPorDia !== undefined) {
            updateData.horasPorDia = horasPorDia;
          }
          await this.updateSchedule(existingEntry.id, updateData);
        } else {
          // Create new document with shift and horasPorDia (only if defined)
          const newSchedule: Omit<ScheduleEntry, 'id' | 'createdAt' | 'updatedAt'> = {
            locationValue,
            employeeName,
            year,
            month,
            day,
            shift
          };
          if (horasPorDia !== undefined) {
            newSchedule.horasPorDia = horasPorDia;
          }
          await this.addSchedule(newSchedule);
        }
      }
    } catch (error) {
      console.error('Error al actualizar/eliminar documento:', error);
      throw error;
    }
  }

  /**
   * Update or create schedule entry hours worked (specific for DELIFOOD)
   * If hours is 0, delete the document. Otherwise store the hours.
   */
  static async updateScheduleHours(
    locationValue: string,
    employeeName: string,
    year: number,
    month: number,
    day: number,
    horasPorDia: number
  ): Promise<void> {
    try {
      // Find existing entry first
      const existingEntry = await this.findScheduleEntry(locationValue, employeeName, year, month, day);

      if (horasPorDia <= 0) {
        // If hours is 0 or negative, delete the document if it exists
        if (existingEntry && existingEntry.id) {
          await this.deleteSchedule(existingEntry.id);
          console.log(`Documento eliminado (0 horas): ${existingEntry.id}`);
        }
        // If no existing document, do nothing (already "empty")
      } else {
        // If hours > 0, create or update the document
        if (existingEntry && existingEntry.id) {
          // Update existing document with shift 'L' and specific horasPorDia
          await this.updateSchedule(existingEntry.id, { 
            shift: 'L',
            horasPorDia: horasPorDia
          });
        } else {
          // Create new document with shift 'L' and specific horasPorDia
          await this.addSchedule({
            locationValue,
            employeeName,
            year,
            month,
            day,
            shift: 'L',
            horasPorDia: horasPorDia
          });
        }
      }
    } catch (error) {
      console.error('Error al actualizar horas trabajadas:', error);
      throw error;
    }
  }
}
