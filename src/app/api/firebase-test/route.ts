import { NextResponse } from 'next/server';
import { MigrationService } from '../../../utils/migration';
import { LocationsService } from '../../../services/locations';
import { SorteosService } from '../../../services/sorteos';
import { UsersService } from '../../../services/users';

export async function GET() {
  try {
    // Test Firebase connection by getting current data
    const [locations, sorteos, users] = await Promise.all([
      LocationsService.getAllLocations(),
      SorteosService.getAllSorteos(),
      UsersService.getAllUsers()
    ]);

    return NextResponse.json({
      success: true,
      data: {
        locations: locations.length,
        sorteos: sorteos.length,
        users: users.length,
        locationsData: locations.slice(0, 3), // Show first 3 for testing
        sorteosData: sorteos.slice(0, 3), // Show first 3 for testing
        usersData: users.slice(0, 3) // Show first 3 for testing
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

export async function POST() {
  try {
    // Run migration
    await MigrationService.runAllMigrations();

    // Get updated data
    const [locations, sorteos, users] = await Promise.all([
      LocationsService.getAllLocations(),
      SorteosService.getAllSorteos(),
      UsersService.getAllUsers()
    ]);

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      data: {
        locations: locations.length,
        sorteos: sorteos.length,
        users: users.length
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
