import { MigrationService } from './src/utils/migration.js';

async function runMigration() {
  try {
    console.log('🚀 Iniciando migración de datos...');
    await MigrationService.runAllMigrations();
    console.log('✅ Migración completada exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  }
}

runMigration();
