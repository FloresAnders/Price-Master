// Firebase configuration
export { db } from '../config/firebase';

// Services
export { FirestoreService } from '../services/firestore';
export { LocationsService } from '../services/locations';
export { SorteosService } from '../services/sorteos';

// Types
export type { Location, Sorteo } from '../types/firestore';

// Migration utilities
export { MigrationService } from '../utils/migration';
