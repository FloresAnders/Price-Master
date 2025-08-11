import { NextResponse } from 'next/server';
import { UsersService } from '../../../../services/users';

export async function POST() {
  try {
    // Execute both migration functions
    const migrateResult = await UsersService.migrateUsersPermissions();
    const ensureResult = await UsersService.ensureAllPermissions();

    return NextResponse.json({
      success: true,
      message: 'Permissions migration completed successfully',
      results: {
        migration: {
          updated: migrateResult.updated,
          skipped: migrateResult.skipped,
          description: 'Added default permissions to users without any permissions'
        },
        ensure: {
          updated: ensureResult.updated,
          skipped: ensureResult.skipped,
          description: 'Updated existing users to include all available permissions'
        }
      }
    });
  } catch (error) {
    console.error('Permission migration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error during permissions migration',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Permissions migration endpoint',
    usage: 'Send a POST request to execute permissions migration',
    endpoints: {
      POST: 'Execute both migration and ensure all permissions'
    }
  });
}
