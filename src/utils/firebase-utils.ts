import { SorteosService } from '../services/sorteos';
import { UsersService } from '../services/users';
import { CcssConfigService } from '../services/ccss-config';
import { Sorteo, User, CcssConfig } from '../types/firestore';

/**
 * Firebase helper utilities
 */
export class FirebaseUtils {
    /**
   * Initialize collections with default data if they're empty
   */  static async initializeCollections(): Promise<void> {
    try {
      const sorteos = await SorteosService.getAllSorteos();

      if (sorteos.length === 0) {
        console.log('Collections are empty, running migration...');
        const { MigrationService } = await import('./migration');
        await MigrationService.runAllMigrations();
      }
    } catch (error) {
      console.error('Error initializing collections:', error);
    }
  }  /**
   * Get statistics about the collections
   */
  static async getCollectionStats(): Promise<{
    sorteos: number;
    users: number;
    ccssConfigExists: boolean;
  }> {
    try {
      const [sorteos, users, ccssConfig] = await Promise.all([
        SorteosService.getAllSorteos(),
        UsersService.getAllUsers(),
        CcssConfigService.getCcssConfig()
      ]);

      return {
        sorteos: sorteos.length,
        users: users.length,
        ccssConfigExists: ccssConfig.tc !== undefined && ccssConfig.mt !== undefined
      };
    } catch (error) {
      console.error('Error getting collection stats:', error);
      return { sorteos: 0, users: 0, ccssConfigExists: false };
    }
  }
  /**
   * Search across all collections
   */
  static async globalSearch(term: string): Promise<{
    sorteos: Sorteo[];
    users: User[];
  }> {
    try {
      const [sorteos, users] = await Promise.all([
        SorteosService.getAllSorteos(),
        UsersService.getAllUsers()
      ]);

      const searchTerm = term.toLowerCase();

      const matchingSorteos = sorteos.filter(sorteo =>
        sorteo.name.toLowerCase().includes(searchTerm)
      );
      const matchingUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm) ||
        (user.ownercompanie && user.ownercompanie.toLowerCase().includes(searchTerm)) ||
        (user.role && user.role.toLowerCase().includes(searchTerm))
      );

      return {
        sorteos: matchingSorteos,
        users: matchingUsers
      };
    } catch (error) {
      console.error('Error in global search:', error);
      return { sorteos: [], users: [] };
    }
  }  /**
   * Backup all data to JSON format
   */
  static async backupToJSON(): Promise<{
    sorteos: Sorteo[];
    users: User[];
    ccssConfig: CcssConfig;
    timestamp: string;
  }> {
    try {
      const [sorteos, users, ccssConfig] = await Promise.all([
        SorteosService.getAllSorteos(),
        UsersService.getAllUsers(),
        CcssConfigService.getCcssConfig()
      ]);

      return {
        sorteos,
        users,
        ccssConfig,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error backing up data:', error);
      throw error;
    }
  }
}
