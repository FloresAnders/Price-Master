import { NextResponse } from 'next/server';
import { MigrationService } from '../../../utils/migration';
import { LocationsService } from '../../../services/locations';
import { SorteosService } from '../../../services/sorteos';
import { UsersService } from '../../../services/users';
import { CcssConfigService } from '../../../services/ccss-config';

export async function GET() {  try {
    // Test Firebase connection by getting current data
    const [locations, sorteos, users, ccssConfig] = await Promise.all([
      LocationsService.getAllLocations(),
      SorteosService.getAllSorteos(),
      UsersService.getAllUsers(),
      CcssConfigService.getCcssConfig()
    ]);    return NextResponse.json({
      success: true,
      data: {
        locations: locations.length,
        sorteos: sorteos.length,
        users: users.length,
        ccssConfig: ccssConfig,
        locationsData: locations, // Show all locations
        sorteosData: sorteos, // Show all sorteos
        usersData: users, // Show all users
        ccssConfigData: ccssConfig // Show CCSS configuration
      }
    });
  } catch (error) {
    console.error('Firebase test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST() {  try {
    // Run migration
    await MigrationService.runAllMigrations();
    
    // Initialize CCSS configuration with default values
    await CcssConfigService.initializeCcssConfig();

    // Get updated data
    const [locations, sorteos, users, ccssConfig] = await Promise.all([
      LocationsService.getAllLocations(),
      SorteosService.getAllSorteos(),
      UsersService.getAllUsers(),
      CcssConfigService.getCcssConfig()
    ]);    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      data: {
        locations: locations.length,
        sorteos: sorteos.length,
        users: users.length,
        ccssConfig: ccssConfig,
        locationsData: locations, // Show all locations after migration
        sorteosData: sorteos, // Show all sorteos after migration
        usersData: users, // Show all users after migration
        ccssConfigData: ccssConfig // Show CCSS configuration after migration
      }
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Clear all data
    await MigrationService.clearAllData();

    return NextResponse.json({
      success: true,
      message: 'All data cleared successfully'
    });
  } catch (error) {
    console.error('Clear data error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Clear data failed'
    }, { status: 500 });
  }
}
