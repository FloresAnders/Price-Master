import { FirestoreService } from './firestore';
import { Location } from '../types/firestore';

export class LocationsService {
  private static readonly COLLECTION_NAME = 'locations';

  /**
   * Get all locations
   */
  static async getAllLocations(): Promise<Location[]> {
    return await FirestoreService.getAll(this.COLLECTION_NAME);
  }

  /**
   * Get location by ID
   */
  static async getLocationById(id: string): Promise<Location | null> {
    return await FirestoreService.getById(this.COLLECTION_NAME, id);
  }

  /**
   * Add a new location
   */
  static async addLocation(location: Omit<Location, 'id'>): Promise<string> {
    return await FirestoreService.add(this.COLLECTION_NAME, location);
  }

  /**
   * Update a location
   */
  static async updateLocation(id: string, location: Partial<Location>): Promise<void> {
    return await FirestoreService.update(this.COLLECTION_NAME, id, location);
  }

  /**
   * Delete a location
   */
  static async deleteLocation(id: string): Promise<void> {
    return await FirestoreService.delete(this.COLLECTION_NAME, id);
  }

  /**
   * Find locations by value
   */
  static async findLocationsByValue(value: string): Promise<Location[]> {
    return await FirestoreService.query(this.COLLECTION_NAME, [
      { field: 'value', operator: '==', value }
    ]);
  }

  /**
   * Find locations that contain a specific name
   */
  static async findLocationsByName(name: string): Promise<Location[]> {
    return await FirestoreService.query(this.COLLECTION_NAME, [
      { field: 'names', operator: 'array-contains', value: name }
    ]);
  }

  /**
   * Get locations ordered by label
   */
  static async getLocationsOrderedByLabel(): Promise<Location[]> {
    return await FirestoreService.query(this.COLLECTION_NAME, [], 'label', 'asc');
  }
}
