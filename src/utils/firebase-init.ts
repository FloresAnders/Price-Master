import { FirebaseUtils } from './firebase-utils';
import { MigrationService } from './migration';

/**
 * Initialize Firebase collections on app startup
 * This function should be called once when the app starts
 * It will automatically migrate data if collections are empty
 */
export async function initializeFirebase(): Promise<{
  success: boolean;
  message: string;
  stats?: {
    sorteos: number;
    users: number;
    ccssConfigExists: boolean;
  };
}> {
  try {
    console.log('Initializing Firebase collections...');

    // Check if collections need initialization
    const stats = await FirebaseUtils.getCollectionStats();
    if (stats.sorteos === 0 || !stats.ccssConfigExists) {
      console.log('Collections are empty or CCSS config missing, running migration...');
      await MigrationService.runAllMigrations();

      // Get updated stats
      const updatedStats = await FirebaseUtils.getCollectionStats();

      return {
        success: true,
        message: `Firebase initialized successfully. Migrated ${updatedStats.sorteos} sorteos, ${updatedStats.users} users, and initialized CCSS config.`,
        stats: updatedStats
      };
    } else {
      return {
        success: true,
        message: `Firebase already initialized. Found ${stats.sorteos} sorteos, ${stats.users} users, and CCSS config exists.`,
        stats
      };
    }
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    return {
      success: false,
      message: `Failed to initialize Firebase: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Health check for Firebase connection
 */
export async function firebaseHealthCheck(): Promise<{
  status: 'healthy' | 'error';
  message: string;
  details?: any;
}> {
  try {
    const stats = await FirebaseUtils.getCollectionStats();

    return {
      status: 'healthy',
      message: 'Firebase connection is healthy', details: {
        collections: {
          sorteos: stats.sorteos,
          users: stats.users,
          ccssConfigExists: stats.ccssConfigExists
        },
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Firebase connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: {
        error: error instanceof Error ? error.message : error,
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Export data for backup purposes
 */
export async function exportFirebaseData(ownerId: string): Promise<string> {
  try {
    const backup = await FirebaseUtils.backupToJSON(ownerId);
    return JSON.stringify(backup, null, 2);
  } catch (error) {
    throw new Error(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate Firebase environment variables
 */
export function validateFirebaseConfig(): {
  valid: boolean;
  missing: string[];
} {
  const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);

  return {
    valid: missing.length === 0,
    missing
  };
}
