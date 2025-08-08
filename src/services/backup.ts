import { CcssConfigService } from './ccss-config';
import { FirestoreService } from './firestore';

// Server-side only - don't import this in client components
export interface BackupData {
  timestamp: string;
  version: string;
  ccssConfig: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collection?: any[];
  };
  metadata: {
    exportedBy: string;
    exportedAt: string;
    systemVersion: string;
  };
}

export class BackupService {
  private static readonly BACKUP_VERSION = '1.0.0';

  /**
   * Generate backup of CCSS configuration
   */
  static async generateCcssBackup(exportedBy: string): Promise<BackupData> {
    try {
      // Get CCSS configuration
      const ccssConfig = await CcssConfigService.getCcssConfig();
      
      // Get entire collection for complete backup
      const ccssCollection = await FirestoreService.getAll('ccss-config');
      
      const backupData: BackupData = {
        timestamp: new Date().toISOString(),
        version: this.BACKUP_VERSION,
        ccssConfig: {
          default: ccssConfig,
          collection: ccssCollection
        },
        metadata: {
          exportedBy,
          exportedAt: new Date().toISOString(),
          systemVersion: 'Price Master v2.0'
        }
      };

      return backupData;
    } catch (error) {
      console.error('Error generating CCSS backup:', error);
      throw new Error('Failed to generate backup');
    }
  }

  /**
   * Download backup as JSON file
   */
  static downloadBackup(backupData: BackupData, filename?: string): void {
    try {
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const defaultFilename = `backup_ccss_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename || defaultFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading backup:', error);
      throw new Error('Failed to download backup');
    }
  }

  /**
   * Validate backup file structure
   */
  static validateBackup(backupData: unknown): boolean {
    try {
      const data = backupData as BackupData;
      return (
        data &&
        typeof data.timestamp === 'string' &&
        typeof data.version === 'string' &&
        data.ccssConfig &&
        data.metadata &&
        typeof data.metadata.exportedBy === 'string'
      );
    } catch {
      return false;
    }
  }

  /**
   * Restore CCSS configuration from backup
   */
  static async restoreCcssBackup(backupData: BackupData): Promise<void> {
    try {
      if (!this.validateBackup(backupData)) {
        throw new Error('Invalid backup file format');
      }

      // Restore default configuration
      if (backupData.ccssConfig.default) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await CcssConfigService.updateCcssConfig(backupData.ccssConfig.default as any);
      }

      // If backup contains full collection data, restore additional documents
      if (backupData.ccssConfig.collection && Array.isArray(backupData.ccssConfig.collection)) {
        for (const doc of backupData.ccssConfig.collection) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const docData = doc as any;
          if (docData.id && docData.id !== 'default') {
            await FirestoreService.addWithId('ccss-config', docData.id, docData);
          }
        }
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
      throw new Error('Failed to restore backup: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Send backup via email (server-side only)
   */
  static async sendBackupByEmail(backupData: BackupData, email: string): Promise<void> {
    // This method should be called from API routes only
    // Import nodemailer dynamically to avoid client-side issues
    const nodemailer = (await import('nodemailer')).default;
    
    try {
      const now = new Date();
      const base64Data = Buffer.from(JSON.stringify(backupData, null, 2)).toString('base64');
      const filename = `ccss-backup-${now.toISOString().split('T')[0]}.json`;

      // Create transporter
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
        pool: true,
        maxConnections: 1,
        rateDelta: 20000,
        rateLimit: 5,
      });

      // Send email
      await transporter.sendMail({
        from: {
          name: 'Price Master System',
          address: process.env.GMAIL_USER || '',
        },
        to: email,
        subject: `🗄️ Backup CCSS - ${now.toLocaleDateString()}`,
        text: `Se adjunta el backup de la configuración CCSS generado el ${now.toLocaleString()}.

📋 Detalles del backup:
• Fecha y hora: ${backupData.metadata.exportedAt}
• Exportado por: ${backupData.metadata.exportedBy}
• Versión del sistema: ${backupData.metadata.systemVersion}
• Versión del backup: ${backupData.version}

Este archivo contiene toda la configuración CCSS y puede ser usado para restaurar la configuración en caso de pérdida de datos.

⚠️ IMPORTANTE: Mantén este archivo en un lugar seguro y no lo compartas con personal no autorizado.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
              <h2 style="color: #333; margin-bottom: 20px;">🗄️ Backup de Configuración CCSS</h2>
              
              <div style="background-color: white; padding: 20px; border-radius: 6px; border-left: 4px solid #28a745;">
                <p><strong>Se adjunta el backup de la configuración CCSS generado el ${now.toLocaleString()}.</strong></p>
                
                <h3 style="color: #495057; margin-top: 20px;">📋 Detalles del backup:</h3>
                <ul style="color: #6c757d;">
                  <li><strong>Fecha y hora:</strong> ${backupData.metadata.exportedAt}</li>
                  <li><strong>Exportado por:</strong> ${backupData.metadata.exportedBy}</li>
                  <li><strong>Versión del sistema:</strong> ${backupData.metadata.systemVersion}</li>
                  <li><strong>Versión del backup:</strong> ${backupData.version}</li>
                </ul>
                
                <p style="margin-top: 20px; color: #495057;">
                  Este archivo contiene toda la configuración CCSS y puede ser usado para restaurar la configuración en caso de pérdida de datos.
                </p>
              </div>
              
              <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
                <p style="margin: 0; color: #856404;">
                  <strong>⚠️ IMPORTANTE:</strong> Mantén este archivo en un lugar seguro y no lo compartas con personal no autorizado.
                </p>
              </div>
            </div>
          </div>
        `,
        attachments: [{
          filename: filename,
          content: base64Data,
          encoding: 'base64'
        }],
        headers: {
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
          'Importance': 'Normal',
          'X-Mailer': 'Price Master System',
          'Reply-To': process.env.GMAIL_USER || '',
        },
        messageId: `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@pricemaster.local>`,
        date: new Date(),
      });

    } catch (error) {
      console.error('Error sending backup email:', error);
      throw new Error('Failed to send backup email: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}
