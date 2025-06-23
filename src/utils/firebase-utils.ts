import { LocationsService } from '../services/locations';
import { SorteosService } from '../services/sorteos';
import { UsersService } from '../services/users';
import { Location, Sorteo, User } from '../types/firestore';

/**
 * Firebase helper utilities
 */
export class FirebaseUtils {
    /**
   * Initialize collections with default data if they're empty
   */  static async initializeCollections(): Promise<void> {
    try {
      const [locations, sorteos] = await Promise.all([
        LocationsService.getAllLocations(),
        SorteosService.getAllSorteos()
      ]);

      if (locations.length === 0 || sorteos.length === 0) {
        console.log('Collections are empty, running migration...');
        const { MigrationService } = await import('./migration');
        await MigrationService.runAllMigrations();
      }
    } catch (error) {
      console.error('Error initializing collections:', error);
    }
  }
  /**
   * Get statistics about the collections
   */
  static async getCollectionStats(): Promise<{
    locations: number;
    sorteos: number;
    users: number;
    totalNames: number;
  }> {
    try {
      const [locations, sorteos, users] = await Promise.all([
        LocationsService.getAllLocations(),
        SorteosService.getAllSorteos(),
        UsersService.getAllUsers()
      ]);

      const totalNames = locations.reduce((acc, location) =>
        acc + (location.names?.length || 0), 0
      );

      return {
        locations: locations.length,
        sorteos: sorteos.length,
        users: users.length,
        totalNames
      };
    } catch (error) {
      console.error('Error getting collection stats:', error);
      return { locations: 0, sorteos: 0, users: 0, totalNames: 0 };
    }
  }
  /**
   * Search across all collections
   */
  static async globalSearch(term: string): Promise<{
    locations: Location[];
    sorteos: Sorteo[];
    users: User[];
  }> {
    try {
      const [locations, sorteos, users] = await Promise.all([
        LocationsService.getAllLocations(),
        SorteosService.getAllSorteos(),
        UsersService.getAllUsers()
      ]);

      const searchTerm = term.toLowerCase();

      const matchingLocations = locations.filter(location =>
        location.label.toLowerCase().includes(searchTerm) ||
        location.value.toLowerCase().includes(searchTerm) ||
        location.names?.some(name => name.toLowerCase().includes(searchTerm))
      );

      const matchingSorteos = sorteos.filter(sorteo =>
        sorteo.name.toLowerCase().includes(searchTerm)
      ); const matchingUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm) ||
        (user.location && user.location.toLowerCase().includes(searchTerm)) ||
        (user.role && user.role.toLowerCase().includes(searchTerm))
      );

      return {
        locations: matchingLocations,
        sorteos: matchingSorteos,
        users: matchingUsers
      };
    } catch (error) {
      console.error('Error in global search:', error);
      return { locations: [], sorteos: [], users: [] };
    }
  }
  /**
   * Backup all data to JSON format
   */
  static async backupToJSON(): Promise<{
    locations: Location[];
    sorteos: Sorteo[];
    users: User[];
    timestamp: string;
  }> {
    try {
      const [locations, sorteos, users] = await Promise.all([
        LocationsService.getAllLocations(),
        SorteosService.getAllSorteos(),
        UsersService.getAllUsers()
      ]);

      return {
        locations,
        sorteos,
        users,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error backing up data:', error);
      throw error;
    }
  }
}
