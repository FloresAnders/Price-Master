import { NextRequest, NextResponse } from 'next/server';
import { BackupService } from '../../../services/backup';

// In-memory cache to prevent duplicate backups
const recentBackups = new Map<string, number>();
const BACKUP_COOLDOWN = 30000; // 30 seconds

// Clean up old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentBackups.entries()) {
    if (now - timestamp > BACKUP_COOLDOWN) {
      recentBackups.delete(key);
    }
  }
}, 60000);

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

    // Check for duplicate requests
    const backupKey = `${userId || 'unknown'}_${userName || 'unknown'}`;
    const now = Date.now();
    const lastBackupTime = recentBackups.get(backupKey);

    if (lastBackupTime && (now - lastBackupTime) < BACKUP_COOLDOWN) {
      console.log(`Duplicate backup request detected for ${backupKey}, skipping...`);
      return NextResponse.json({
        success: true,
        message: 'Backup ya enviado recientemente',
        cached: true
      });
    }

    // Mark this backup request as processed
    recentBackups.set(backupKey, now);

    console.log(`Processing backup request for user: ${userName || userId}`);

    // Generate backup
    const backupData = await BackupService.generateCcssBackup(userName || userId || 'SuperAdmin');
    
    // Get backup email from environment variable
    const backupEmail = process.env.BACKUP_EMAIL || process.env.GMAIL_USER;
    
    if (!backupEmail) {
      recentBackups.delete(backupKey); // Remove from cache if failed
      return NextResponse.json(
        { error: 'Email de backup no configurado en variables de entorno' },
        { status: 500 }
      );
    }

    // Send backup by email
    await BackupService.sendBackupByEmail(backupData, backupEmail);

    console.log(`Backup sent successfully for user: ${userName || userId}`);

    return NextResponse.json({
      success: true,
      message: 'Backup generado y enviado exitosamente',
      sentTo: backupEmail
    });

  } catch (error) {
    console.error('Error in auto backup:', error);
    
    // Remove from cache on error to allow retry
    const { userName, userId } = await request.json().catch(() => ({}));
    const backupKey = `${userId || 'unknown'}_${userName || 'unknown'}`;
    recentBackups.delete(backupKey);
    
    return NextResponse.json(
      { error: 'Error al generar backup automático: ' + (error instanceof Error ? error.message : 'Error desconocido') },
      { status: 500 }
    );
  }
}
