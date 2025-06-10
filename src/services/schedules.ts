import { FirestoreService } from './firestore';

export interface ScheduleEntry {
  id?: string;
  locationValue: string;
  employeeName: string;
  year: number;
  month: number;
  day: number;
  shift: string; // 'N', 'D', 'L', or empty string
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
   * Update or create schedule entry shift
   */
  static async updateScheduleShift(
    locationValue: string,
    employeeName: string,
    year: number,
    month: number,
    day: number,
    shift: string
  ): Promise<void> {
    const entry = await this.getOrCreateScheduleEntry(locationValue, employeeName, year, month, day);
    
    if (entry.id) {
      await this.updateSchedule(entry.id, { shift });
    }
  }
}
