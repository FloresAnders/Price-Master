// Utility script to seed initial fondo movement types to database
// This can be run once to migrate from hardcoded constants to database

import { FondoMovementTypesService } from '../services/fondo-movement-types';

/**
 * Seeds the initial fondo movement types from the hardcoded constants into the database.
 * This should be run once during migration, or if the database needs to be reset.
 * 
 * To use this:
 * 1. Go to the DataEditor as a superadmin
 * 2. Open the browser console
 * 3. Run: await window.seedFondoMovementTypes()
 */
export async function seedFondoMovementTypes(): Promise<void> {
  try {
    console.log('Starting seed of fondo movement types...');
    await FondoMovementTypesService.seedInitialData();
    console.log('✅ Fondo movement types seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding fondo movement types:', error);
    throw error;
  }
}

// Make it available globally for easy access from browser console
if (typeof window !== 'undefined') {
  (window as any).seedFondoMovementTypes = seedFondoMovementTypes;
}
