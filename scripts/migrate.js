#!/usr/bin/env node

/**
 * Migration script for Time Master
 * This script migrates data from JSON files to Firestore
 */

const { MigrationService } = require('./src/utils/migration');

async function main() {
  try {
    console.log('🚀 Starting Time Master data migration...');
    console.log('📁 Migrating from JSON files to Firestore...\n');
    
    await MigrationService.runAllMigrations();
    
    console.log('\n✅ Migration completed successfully!');
    console.log('🎉 Your data is now available in Firestore');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('💡 Please check your Firebase configuration and try again');
    process.exit(1);
  }
}

main();
