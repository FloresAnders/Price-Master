import { CcssConfigService } from './ccss-config';
import { FirestoreService } from './firestore';

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

export class ClientBackupService {
  private static readonly BACKUP_VERSION = '1.0.0';

  /**
   * Generate backup of CCSS configuration (client-side)
   */
  static async generateCcssBackup(exportedBy: string): Promise<BackupData> {
    try {
      // Get current CCSS configuration
      const ccssConfig = await CcssConfigService.getCcssConfig();
      
      const now = new Date();
      const backup: BackupData = {
        timestamp: now.toISOString(),
        version: this.BACKUP_VERSION,
        ccssConfig: {
          default: ccssConfig,
        },
        metadata: {
          exportedBy,
          exportedAt: now.toLocaleString(),
          systemVersion: '1.0.0',
        }
      };

      return backup;
    } catch (error) {
      console.error('Error generating backup:', error);
      throw new Error('Failed to generate backup: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
   * Restore CCSS configuration from backup (client-side)
   */
  static async restoreCcssBackup(backupData: BackupData): Promise<void> {
    try {
      // Validate backup
      if (!this.validateBackup(backupData)) {
        throw new Error('Invalid backup data');
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
   * Download backup as JSON file
   */
  static downloadBackup(backupData: BackupData, filename?: string): void {
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `backup-ccss-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
