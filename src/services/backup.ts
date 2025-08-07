import { CcssConfigService } from './ccss-config';
import { FirestoreService } from './firestore';

export interface BackupData {
  timestamp: string;
  version: string;
  ccssConfig: any;
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
  static validateBackup(backupData: any): boolean {
    try {
      return (
        backupData &&
        typeof backupData.timestamp === 'string' &&
        typeof backupData.version === 'string' &&
        backupData.ccssConfig &&
        backupData.metadata &&
        typeof backupData.metadata.exportedBy === 'string'
      );
    } catch (error) {
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
        await CcssConfigService.updateCcssConfig(backupData.ccssConfig.default);
      }

      // If backup contains full collection data, restore additional documents
      if (backupData.ccssConfig.collection && Array.isArray(backupData.ccssConfig.collection)) {
        for (const doc of backupData.ccssConfig.collection) {
          if (doc.id && doc.id !== 'default') {
            await FirestoreService.addWithId('ccss-config', doc.id, doc);
          }
        }
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
      throw new Error('Failed to restore backup: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Send backup via email
   */
  static async sendBackupByEmail(backupData: BackupData, email: string): Promise<void> {
    try {
      const jsonString = JSON.stringify(backupData, null, 2);
      const now = new Date();
      const filename = `backup_ccss_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.json`;

      // Convert JSON to base64 for email attachment
      const base64Data = btoa(unescape(encodeURIComponent(jsonString)));

      const emailData = {
        to: email,
        subject: `🗄️ Backup de Configuración CCSS - ${now.toLocaleDateString()}`,
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
        }]
      };

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

    } catch (error) {
      console.error('Error sending backup email:', error);
      throw new Error('Failed to send backup email: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}
