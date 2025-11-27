import { SorteosService } from '../services/sorteos';
import { UsersService } from '../services/users';
import { CcssConfigService } from '../services/ccss-config';
import fs from 'fs';
import path from 'path';

export class MigrationService {

  /**
   * Migrate sorteos from JSON to Firestore
   */
  static async migrateSorteos(): Promise<void> {
    console.log('Starting sorteos migration...');

    try {
      // Load sorteos JSON at runtime if available to avoid build-time module resolution errors
      const sorteosJsonPath = path.resolve(process.cwd(), 'src', 'data', 'sorteos.json');
      let sorteosData: string[] = [];
      if (fs.existsSync(sorteosJsonPath)) {
        try {
          const raw = fs.readFileSync(sorteosJsonPath, 'utf8');
          sorteosData = JSON.parse(raw) as string[];
        } catch (err) {
          console.warn('Could not read or parse sorteos.json:', err);
          sorteosData = [];
        }
      } else {
        console.log('sorteos.json not found, skipping sorteos migration.');
        return;
      }

      // Check if sorteos already exist
      const existingSorteos = await SorteosService.getAllSorteos();
      if (existingSorteos.length > 0) {
        console.log(`Found ${existingSorteos.length} existing sorteos. Skipping migration.`);
        return;
      }

      // Migrate each sorteo
      for (const sorteoName of sorteosData as string[]) {
        const sorteoId = await SorteosService.addSorteo({
          name: sorteoName
        });
        console.log(`Migrated sorteo: ${sorteoName} (ID: ${sorteoId})`);
      }

      console.log(`Successfully migrated ${sorteosData.length} sorteos to Firestore.`);
    } catch (error) {
      console.error('Error migrating sorteos:', error);
      throw error;
    }
  }

  /**
   * Run all migrations
   */
  static async runAllMigrations(): Promise<void> {
    console.log('Starting data migration from JSON to Firestore...');

    try {
      await this.migrateSorteos();
      console.log('All migrations completed successfully!');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }
  /**
   * Clear all Firestore data (use with caution!)
   */
  static async clearAllData(): Promise<void> {
    console.log('WARNING: Clearing all Firestore data...');

    try {
      // Clear sorteos
      const sorteos = await SorteosService.getAllSorteos();
      for (const sorteo of sorteos) {
        if (sorteo.id) {
          await SorteosService.deleteSorteo(sorteo.id);
        }
      }
      console.log(`Deleted ${sorteos.length} sorteos.`);      // Clear users
      const users = await UsersService.getAllUsers();
      for (const user of users) {
        if (user.id) {
          await UsersService.deleteUser(user.id);
        }
      }
      console.log(`Deleted ${users.length} users.`);

      // Clear CCSS configuration
      try {
        // We don't delete the CCSS config, just reset it to default values
        await CcssConfigService.updateCcssConfig({
          ownerId: 'default',
          companie: [{
            ownerCompanie: 'default',
            mt: 3672.46,
            tc: 11017.39,
            valorhora: 1441,
            horabruta: 1529.62
          }]
        });
        console.log('CCSS configuration reset to default values.');
      } catch (error) { // eslint-disable-line @typescript-eslint/no-unused-vars
        console.log('CCSS configuration not found or already at defaults.');
      }

      console.log('All Firestore data cleared successfully!');
    } catch (error) {
      console.error('Error clearing Firestore data:', error);
      throw error;
    }
  }
}
