import { NextRequest, NextResponse } from 'next/server';
import { BackupService } from '../../../services/backup';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userName, userId } = body;

    // Validate that we have user info
    if (!userName && !userId) {
      return NextResponse.json(
        { error: 'Se requiere información del usuario' },
        { status: 400 }
      );
    }

    // Generate backup
    const backupData = await BackupService.generateCcssBackup(userName || userId || 'SuperAdmin');
    
    // Get backup email from environment variable
    const backupEmail = process.env.BACKUP_EMAIL || process.env.GMAIL_USER;
    
    if (!backupEmail) {
      return NextResponse.json(
        { error: 'Email de backup no configurado en variables de entorno' },
        { status: 500 }
      );
    }

    // Send backup by email
    await BackupService.sendBackupByEmail(backupData, backupEmail);

    return NextResponse.json({
      success: true,
      message: 'Backup generado y enviado exitosamente',
      sentTo: backupEmail
    });

  } catch (error) {
    console.error('Error in auto backup:', error);
    return NextResponse.json(
      { error: 'Error al generar backup automático: ' + (error instanceof Error ? error.message : 'Error desconocido') },
      { status: 500 }
    );
  }
}
