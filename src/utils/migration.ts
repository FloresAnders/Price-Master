import { LocationsService } from '../services/locations';
import { SorteosService } from '../services/sorteos';
import { UsersService } from '../services/users';
import { CcssConfigService } from '../services/ccss-config';
import { Location } from '../types/firestore';
import locationsData from '../data/locations.json';
import sorteosData from '../data/sorteos.json';

export class MigrationService {

  /**
   * Migrate locations from JSON to Firestore
   */
  static async migrateLocations(): Promise<void> {
    console.log('Starting locations migration...');

    try {
      // Check if locations already exist
      const existingLocations = await LocationsService.getAllLocations();
      if (existingLocations.length > 0) {
        console.log(`Found ${existingLocations.length} existing locations. Skipping migration.`);
        return;
      }

      // Migrate each location
      for (const locationData of locationsData as Location[]) {
        const locationId = await LocationsService.addLocation({
          label: locationData.label,
          value: locationData.value,
          names: locationData.names
        });
        console.log(`Migrated location: ${locationData.label} (ID: ${locationId})`);
      }

      console.log(`Successfully migrated ${locationsData.length} locations to Firestore.`);
    } catch (error) {
      console.error('Error migrating locations:', error);
      throw error;
    }
  }

  /**
   * Migrate sorteos from JSON to Firestore
   */
  static async migrateSorteos(): Promise<void> {
    console.log('Starting sorteos migration...');

    try {
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
  static async runAllMigrations(): Promise<void> {    console.log('Starting data migration from JSON to Firestore...');

    try {
      await this.migrateLocations();
      await this.migrateSorteos();
      await CcssConfigService.initializeCcssConfig();
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
      // Clear locations
      const locations = await LocationsService.getAllLocations();
      for (const location of locations) {
        if (location.id) {
          await LocationsService.deleteLocation(location.id);
        }
      }
      console.log(`Deleted ${locations.length} locations.`);

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
          mt: 3672.46,
          tc: 11017.39
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
