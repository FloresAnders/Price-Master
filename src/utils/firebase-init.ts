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
    locations: number;
    sorteos: number;
    totalNames: number;
  };
}> {
  try {
    console.log('Initializing Firebase collections...');
    
    // Check if collections need initialization
    const stats = await FirebaseUtils.getCollectionStats();
    
    if (stats.locations === 0 || stats.sorteos === 0) {
      console.log('Collections are empty, running migration...');
      await MigrationService.runAllMigrations();
      
      // Get updated stats
      const updatedStats = await FirebaseUtils.getCollectionStats();
      
      return {
        success: true,
        message: `Firebase initialized successfully. Migrated ${updatedStats.locations} locations and ${updatedStats.sorteos} sorteos.`,
        stats: updatedStats
      };
    } else {
      return {
        success: true,
        message: `Firebase already initialized. Found ${stats.locations} locations and ${stats.sorteos} sorteos.`,
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
      message: 'Firebase connection is healthy',
      details: {
        collections: {
          locations: stats.locations,
          sorteos: stats.sorteos,
          totalNames: stats.totalNames
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
export async function exportFirebaseData(): Promise<string> {
  try {
    const backup = await FirebaseUtils.backupToJSON();
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
