// Firebase configuration
export { db } from '../config/firebase';
// Services
export { FirestoreService } from '../services/firestore';
export { LocationsService } from '../services/locations';
export { SorteosService } from '../services/sorteos';
export { ScanningService } from '../services/scanning';

// Types
export type { Location, Sorteo, ScanResult } from '../types/firestore';

// Migration utilities
export { MigrationService } from '../utils/migration';
