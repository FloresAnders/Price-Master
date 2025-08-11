import { NextRequest, NextResponse } from 'next/server';
import { BackupService } from '@/services/backup';

export async function POST(request: NextRequest) {
  try {
    const { exportedBy, action, email, backupType } = await request.json();

    if (!exportedBy) {
      return NextResponse.json(
        { success: false, error: 'exportedBy is required' },
        { status: 400 }
      );
    }

    if (backupType === 'individual') {
      // Generate individual backup files
      const individualBackups = await BackupService.generateIndividualBackups(exportedBy);

      if (action === 'download') {
        // Return individual backup data for download
        return NextResponse.json({
          success: true,
          backups: individualBackups,
          backupType: 'individual',
          message: 'Archivos individuales de backup generados exitosamente'
        });
      } else if (action === 'email' && email) {
        // Send individual backups via email
        await BackupService.sendIndividualBackupsByEmail(individualBackups, email);
        return NextResponse.json({
          success: true,
          message: `Archivos individuales de backup enviados exitosamente a ${email}`
        });
      } else {
        return NextResponse.json(
          { success: false, error: 'Invalid action or missing email for email action' },
          { status: 400 }
        );
      }
    } else {
      // Generate complete backup (default behavior)
      const backupData = await BackupService.generateCompleteBackup(exportedBy);

      if (action === 'download') {
        // Return backup data for download
        return NextResponse.json({
          success: true,
          backup: backupData,
          backupType: 'complete',
          message: 'Backup completo generado exitosamente'
        });
      } else if (action === 'email' && email) {
        // Send backup via email
        await BackupService.sendCompleteBackupByEmail(backupData, email);
        return NextResponse.json({
          success: true,
          message: `Backup completo enviado exitosamente a ${email}`
        });
      } else {
        return NextResponse.json(
          { success: false, error: 'Invalid action or missing email for email action' },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error('Error in complete backup API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido al generar backup'
      },
      { status: 500 }
    );
  }
}
