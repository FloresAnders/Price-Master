import { NextRequest, NextResponse } from 'next/server';
import { BackupService } from '@/services/backup';

export async function POST(request: NextRequest) {
  try {
    const { backupData } = await request.json();

    if (!backupData) {
      return NextResponse.json(
        { success: false, error: 'backupData is required' },
        { status: 400 }
      );
    }

    // Validate backup data
    const validation = BackupService.validateBackup(backupData);
    
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: 'Archivo de backup inválido' },
        { status: 400 }
      );
    }

    // Restore based on backup type
    if (validation.type === 'complete') {
      await BackupService.restoreCompleteBackup(backupData);
      return NextResponse.json({
        success: true,
        message: 'Backup completo restaurado exitosamente'
      });
    } else if (validation.type === 'individual') {
      await BackupService.restoreIndividualBackup(backupData);
      return NextResponse.json({
        success: true,
        message: `Backup de ${backupData.serviceName} restaurado exitosamente`
      });
    } else if (validation.type === 'ccss') {
      await BackupService.restoreCcssBackup(backupData);
      return NextResponse.json({
        success: true,
        message: 'Backup CCSS restaurado exitosamente'
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Tipo de backup no reconocido' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error in restore backup API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido al restaurar backup'
      },
      { status: 500 }
    );
  }
}
