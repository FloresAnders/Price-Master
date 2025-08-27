// src/services/payroll-records.ts
import { FirestoreService } from './firestore';

export interface PayrollRecord {
  employeeName: string;
  locationValue: string;
  records: {
    [year: number]: {
      [month: number]: {
        NumeroQuincena1?: {
          DiasLaborados: number;
          hoursPerDay: number;
          totalHours: number;
          period: 'first';
        };
        NumeroQuincena2?: {
          DiasLaborados: number;
          hoursPerDay: number;
          totalHours: number;
          period: 'second';
        };
      };
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export class PayrollRecordsService {
  private static readonly COLLECTION_NAME = 'payroll-records';

  /**
   * Generate a unique document ID for an employee
   */
  private static getEmployeeDocId(locationValue: string, employeeName: string): string {
    return `${locationValue}-${employeeName.replace(/\s+/g, '_')}`;
  }

  /**
   * Save or update payroll record for an employee
   */
  static async saveRecord(
    locationValue: string,
    employeeName: string,
    year: number,
    month: number,
    period: 'first' | 'second',
    diasLaborados: number,
    hoursPerDay: number,
    totalHours: number
  ): Promise<void> {
    try {
      const docId = this.getEmployeeDocId(locationValue, employeeName);

      // Try to get existing record
      const existingRecord = await FirestoreService.getById(this.COLLECTION_NAME, docId);

      const periodData = {
        DiasLaborados: diasLaborados,
        hoursPerDay,
        totalHours,
        period
      };

      if (existingRecord) {
        // Update existing record
        const updatedRecords = { ...existingRecord.records };

        if (!updatedRecords[year]) {
          updatedRecords[year] = {};
        }

        if (!updatedRecords[year][month]) {
          updatedRecords[year][month] = {};
        }

        const quincenaKey = period === 'first' ? 'NumeroQuincena1' : 'NumeroQuincena2';
        updatedRecords[year][month][quincenaKey] = periodData;

        await FirestoreService.update(this.COLLECTION_NAME, docId, {
          records: updatedRecords,
          updatedAt: new Date()
        });
      } else {
        // Create new record
        const newRecord: PayrollRecord = {
          employeeName,
          locationValue,
          records: {
            [year]: {
              [month]: {
                [period === 'first' ? 'NumeroQuincena1' : 'NumeroQuincena2']: periodData
              }
            }
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await FirestoreService.addWithId(this.COLLECTION_NAME, docId, newRecord);
      }
    } catch (error) {
      console.error('Error saving payroll record:', error);
      throw error;
    }
  }

  /**
   * Get payroll record for an employee
   */
  static async getRecord(locationValue: string, employeeName: string): Promise<PayrollRecord | null> {
    try {
      const docId = this.getEmployeeDocId(locationValue, employeeName);
      return await FirestoreService.getById(this.COLLECTION_NAME, docId);
    } catch (error) {
      console.error('Error getting payroll record:', error);
      throw error;
    }
  }

  /**
   * Get all payroll records for a location
   */
  static async getRecordsByLocation(locationValue: string): Promise<PayrollRecord[]> {
    try {
      return await FirestoreService.query(this.COLLECTION_NAME, [
        { field: 'locationValue', operator: '==', value: locationValue }
      ]);
    } catch (error) {
      console.error('Error getting payroll records by location:', error);
      throw error;
    }
  }

  /**
   * Get all payroll records
   */
  static async getAllRecords(): Promise<PayrollRecord[]> {
    try {
      return await FirestoreService.getAll(this.COLLECTION_NAME);
    } catch (error) {
      console.error('Error getting all payroll records:', error);
      throw error;
    }
  }

  /**
   * Delete payroll record for an employee
   */
  static async deleteRecord(locationValue: string, employeeName: string): Promise<void> {
    try {
      const docId = this.getEmployeeDocId(locationValue, employeeName);
      await FirestoreService.delete(this.COLLECTION_NAME, docId);
    } catch (error) {
      console.error('Error deleting payroll record:', error);
      throw error;
    }
  }

  /**
   * Delete a specific period (quincena) from payroll record
   */
  static async deletePeriodFromRecord(
    locationValue: string,
    employeeName: string,
    year: number,
    month: number,
    period: 'first' | 'second'
  ): Promise<void> {
    try {
      const docId = this.getEmployeeDocId(locationValue, employeeName);
      const existingRecord = await FirestoreService.getById(this.COLLECTION_NAME, docId);

      if (!existingRecord) {
        throw new Error('Record not found');
      }

      const updatedRecords = { ...existingRecord.records };
      const quincenaKey = period === 'first' ? 'NumeroQuincena1' : 'NumeroQuincena2';

      // Remove the specific period
      if (updatedRecords[year] && updatedRecords[year][month]) {
        delete updatedRecords[year][month][quincenaKey];

        // If the month has no more periods, remove the month
        if (Object.keys(updatedRecords[year][month]).length === 0) {
          delete updatedRecords[year][month];

          // If the year has no more months, remove the year
          if (Object.keys(updatedRecords[year]).length === 0) {
            delete updatedRecords[year];
          }
        }
      }

      // If there are no more records, delete the entire document
      if (Object.keys(updatedRecords).length === 0) {
        await FirestoreService.delete(this.COLLECTION_NAME, docId);
      } else {
        // Update the record with the remaining data
        await FirestoreService.update(this.COLLECTION_NAME, docId, {
          records: updatedRecords,
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error deleting period from payroll record:', error);
      throw error;
    }
  }

  /**
   * Check if a record exists for a specific period
   */
  static async hasRecordForPeriod(
    locationValue: string,
    employeeName: string,
    year: number,
    month: number,
    period: 'first' | 'second'
  ): Promise<boolean> {
    try {
      const record = await this.getRecord(locationValue, employeeName);
      if (!record) return false;

      const quincenaKey = period === 'first' ? 'NumeroQuincena1' : 'NumeroQuincena2';
      return record.records[year]?.[month]?.[quincenaKey] !== undefined;
    } catch (error) {
      console.error('Error checking if record exists for period:', error);
      return false;
    }
  }
}
