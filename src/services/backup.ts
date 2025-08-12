import { CcssConfigService } from './ccss-config';
import { FirestoreService } from './firestore';
import { LocationsService } from './locations';
import { UsersService } from './users';
import { SchedulesService } from './schedules';
import { PayrollRecordsService } from './payroll-records';

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

// Interface for complete database backup
export interface CompleteBackupData {
  timestamp: string;
  version: string;
  data: {
    locations: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: any[];
      count: number;
    };
    users: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: any[];
      count: number;
    };
    schedules: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: any[];
      count: number;
    };
    payrollRecords: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: any[];
      count: number;
    };
  };
  metadata: {
    exportedBy: string;
    exportedAt: string;
    systemVersion: string;
    totalRecords: number;
    backupType: string;
    collections: string[];
  };
}

// Interfaces for individual service backups
export interface IndividualBackupData {
  timestamp: string;
  version: string;
  serviceName: string;
  data: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collection: any[];
    count: number;
  };
  metadata: {
    exportedBy: string;
    exportedAt: string;
    systemVersion: string;
    backupType: string;
  };
}

export interface IndividualBackupFiles {
  locations: IndividualBackupData;
  users: IndividualBackupData;
  schedules: IndividualBackupData;
  payrollRecords: IndividualBackupData;
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
   * Generate complete database backup (Essential Services)
   */
  static async generateCompleteBackup(exportedBy: string): Promise<CompleteBackupData> {
    try {
      console.log('🔄 Starting complete database backup...');
      
      // Get all essential collections
      const [locations, users, schedules, payrollRecords] = await Promise.all([
        LocationsService.getAllLocations(),
        UsersService.getAllUsers(),
        SchedulesService.getAllSchedules(),
        PayrollRecordsService.getAllRecords()
      ]);

      const totalRecords = locations.length + users.length + schedules.length + payrollRecords.length;
      
      const backupData: CompleteBackupData = {
        timestamp: new Date().toISOString(),
        version: this.BACKUP_VERSION,
        data: {
          locations: {
            collection: locations,
            count: locations.length
          },
          users: {
            collection: users,
            count: users.length
          },
          schedules: {
            collection: schedules,
            count: schedules.length
          },
          payrollRecords: {
            collection: payrollRecords,
            count: payrollRecords.length
          }
        },
        metadata: {
          exportedBy,
          exportedAt: new Date().toISOString(),
          systemVersion: 'Price Master v2.0',
          backupType: 'complete-database',
          totalRecords,
          collections: ['locations', 'users', 'schedules', 'payrollRecords']
        }
      };

      console.log(`✅ Complete backup generated with ${totalRecords} total records`);
      return backupData;
    } catch (error) {
      console.error('Error generating complete backup:', error);
      throw new Error('Failed to generate complete backup');
    }
  }

  /**
   * Generate individual backup files for each service
   */
  static async generateIndividualBackups(exportedBy: string): Promise<IndividualBackupFiles> {
    try {
      console.log('🔄 Starting individual backups generation...');
      
      // Get all essential collections
      const [locations, users, schedules, payrollRecords] = await Promise.all([
        LocationsService.getAllLocations(),
        UsersService.getAllUsers(),
        SchedulesService.getAllSchedules(),
        PayrollRecordsService.getAllRecords()
      ]);

      const timestamp = new Date().toISOString();
      const systemVersion = 'Price Master v2.0';
      
      const individualBackups: IndividualBackupFiles = {
        locations: {
          timestamp,
          version: this.BACKUP_VERSION,
          serviceName: 'locations',
          data: {
            collection: locations,
            count: locations.length
          },
          metadata: {
            exportedBy,
            exportedAt: timestamp,
            systemVersion,
            backupType: 'individual-service'
          }
        },
        users: {
          timestamp,
          version: this.BACKUP_VERSION,
          serviceName: 'users',
          data: {
            collection: users,
            count: users.length
          },
          metadata: {
            exportedBy,
            exportedAt: timestamp,
            systemVersion,
            backupType: 'individual-service'
          }
        },
        schedules: {
          timestamp,
          version: this.BACKUP_VERSION,
          serviceName: 'schedules',
          data: {
            collection: schedules,
            count: schedules.length
          },
          metadata: {
            exportedBy,
            exportedAt: timestamp,
            systemVersion,
            backupType: 'individual-service'
          }
        },
        payrollRecords: {
          timestamp,
          version: this.BACKUP_VERSION,
          serviceName: 'payrollRecords',
          data: {
            collection: payrollRecords,
            count: payrollRecords.length
          },
          metadata: {
            exportedBy,
            exportedAt: timestamp,
            systemVersion,
            backupType: 'individual-service'
          }
        }
      };

      const totalRecords = locations.length + users.length + schedules.length + payrollRecords.length;
      console.log(`✅ Individual backups generated: ${totalRecords} total records across 4 services`);
      return individualBackups;
    } catch (error) {
      console.error('Error generating individual backups:', error);
      throw new Error('Failed to generate individual backups');
    }
  }

  /**
   * Download backup as JSON file
   */
  static downloadBackup(backupData: BackupData | CompleteBackupData, filename?: string): void {
    try {
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      let defaultFilename: string;
      
      // Determine backup type and create appropriate filename
      if ('data' in backupData && backupData.metadata.backupType === 'complete-database') {
        defaultFilename = `backup_complete_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.json`;
      } else {
        defaultFilename = `backup_ccss_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.json`;
      }

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
   * Download individual backup files as separate JSON files
   */
  static downloadIndividualBackups(individualBackups: IndividualBackupFiles): void {
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
      
      // Download each service as a separate file
      const services = ['locations', 'users', 'schedules', 'payrollRecords'] as const;
      
      services.forEach((serviceName) => {
        const serviceData = individualBackups[serviceName];
        const jsonString = JSON.stringify(serviceData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const filename = `${serviceName}_backup_${dateStr}.json`;
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      });
      
      console.log('✅ Individual backup files downloaded successfully');
    } catch (error) {
      console.error('Error downloading individual backups:', error);
      throw new Error('Failed to download individual backup files');
    }
  }

  /**
   * Validate backup file structure
   */
  static validateBackup(backupData: unknown): { isValid: boolean; type: 'ccss' | 'complete' | 'individual' | 'unknown' } {
    try {
      if (!backupData || typeof backupData !== 'object') {
        return { isValid: false, type: 'unknown' };
      }

      const data = backupData as Record<string, unknown>;
      
      // Check for individual service backup structure
      if (data &&
          typeof data.timestamp === 'string' &&
          typeof data.version === 'string' &&
          typeof data.serviceName === 'string' &&
          data.data &&
          typeof data.data === 'object' &&
          data.data !== null) {
        
        const dataObj = data.data as Record<string, unknown>;
        const metadataObj = data.metadata as Record<string, unknown>;
        
        if (Array.isArray(dataObj.collection) &&
            typeof dataObj.count === 'number' &&
            data.metadata &&
            typeof data.metadata === 'object' &&
            data.metadata !== null &&
            typeof metadataObj.exportedBy === 'string' &&
            metadataObj.backupType === 'individual-service') {
          return { isValid: true, type: 'individual' };
        }
      }
      
      // Check for complete backup structure
      if (data &&
          typeof data.timestamp === 'string' &&
          typeof data.version === 'string' &&
          data.data &&
          typeof data.data === 'object' &&
          data.data !== null) {
        
        const dataObj = data.data as Record<string, unknown>;
        const metadataObj = data.metadata as Record<string, unknown>;
        
        if (dataObj.locations &&
            dataObj.users &&
            dataObj.schedules &&
            dataObj.payrollRecords &&
            data.metadata &&
            typeof data.metadata === 'object' &&
            data.metadata !== null &&
            typeof metadataObj.exportedBy === 'string' &&
            metadataObj.backupType === 'complete-database') {
          return { isValid: true, type: 'complete' };
        }
      }
      
      // Check for CCSS backup structure (legacy)
      if (data &&
          typeof data.timestamp === 'string' &&
          typeof data.version === 'string' &&
          data.ccssConfig &&
          data.metadata &&
          typeof data.metadata === 'object' &&
          data.metadata !== null) {
        
        const metadataObj = data.metadata as Record<string, unknown>;
        
        if (typeof metadataObj.exportedBy === 'string') {
          return { isValid: true, type: 'ccss' };
        }
      }
      
      return { isValid: false, type: 'unknown' };
    } catch {
      return { isValid: false, type: 'unknown' };
    }
  }

  /**
   * Restore CCSS configuration from backup
   */
  static async restoreCcssBackup(backupData: BackupData): Promise<void> {
    try {
      const validation = this.validateBackup(backupData);
      if (!validation.isValid || validation.type !== 'ccss') {
        throw new Error('Invalid CCSS backup file format');
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
   * Restore complete database from backup
   */
  static async restoreCompleteBackup(backupData: CompleteBackupData): Promise<void> {
    try {
      const validation = this.validateBackup(backupData);
      if (!validation.isValid || validation.type !== 'complete') {
        throw new Error('Invalid complete backup file format');
      }

      console.log('🔄 Starting complete database restoration...');
      let totalRestored = 0;

      // Restore locations
      console.log('📍 Restoring locations...');
      for (const location of backupData.data.locations.collection) {
        try {
          if (location.id) {
            await FirestoreService.addWithId('locations', location.id, location);
            totalRestored++;
          }
        } catch (error) {
          console.warn(`Warning: Failed to restore location ${location.id}:`, error);
        }
      }

      // Restore users
      console.log('👥 Restoring users...');
      for (const user of backupData.data.users.collection) {
        try {
          if (user.id) {
            await FirestoreService.addWithId('users', user.id, user);
            totalRestored++;
          }
        } catch (error) {
          console.warn(`Warning: Failed to restore user ${user.id}:`, error);
        }
      }

      // Restore schedules
      console.log('📅 Restoring schedules...');
      for (const schedule of backupData.data.schedules.collection) {
        try {
          if (schedule.id) {
            await FirestoreService.addWithId('schedules', schedule.id, schedule);
            totalRestored++;
          }
        } catch (error) {
          console.warn(`Warning: Failed to restore schedule ${schedule.id}:`, error);
        }
      }

      // Restore payroll records
      console.log('💰 Restoring payroll records...');
      for (const record of backupData.data.payrollRecords.collection) {
        try {
          if (record.id) {
            await FirestoreService.addWithId('payroll-records', record.id, record);
            totalRestored++;
          }
        } catch (error) {
          console.warn(`Warning: Failed to restore payroll record ${record.id}:`, error);
        }
      }

      console.log(`✅ Complete restoration finished. ${totalRestored} records restored.`);
    } catch (error) {
      console.error('Error restoring complete backup:', error);
      throw new Error('Failed to restore complete backup: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Restore individual service backup
   */
  static async restoreIndividualBackup(backupData: IndividualBackupData): Promise<void> {
    try {
      console.log(`🔄 Starting restoration of ${backupData.serviceName} service...`);
      
      const serviceName = backupData.serviceName;
      const records = backupData.data.collection;
      let totalRestored = 0;

      switch (serviceName) {
        case 'locations':
          console.log(`📍 Restoring ${records.length} location records...`);
          for (const record of records) {
            try {
              if (record.id) {
                await FirestoreService.addWithId('locations', record.id, record);
                totalRestored++;
              }
            } catch (error) {
              console.warn(`Warning: Failed to restore location ${record.id}:`, error);
            }
          }
          break;

        case 'users':
          console.log(`👥 Restoring ${records.length} user records...`);
          for (const record of records) {
            try {
              if (record.id) {
                await FirestoreService.addWithId('users', record.id, record);
                totalRestored++;
              }
            } catch (error) {
              console.warn(`Warning: Failed to restore user ${record.id}:`, error);
            }
          }
          break;

        case 'schedules':
          console.log(`📅 Restoring ${records.length} schedule records...`);
          for (const record of records) {
            try {
              if (record.id) {
                await FirestoreService.addWithId('schedules', record.id, record);
                totalRestored++;
              }
            } catch (error) {
              console.warn(`Warning: Failed to restore schedule ${record.id}:`, error);
            }
          }
          break;

        case 'payrollRecords':
          console.log(`💰 Restoring ${records.length} payroll records...`);
          for (const record of records) {
            try {
              if (record.id) {
                await FirestoreService.addWithId('payroll-records', record.id, record);
                totalRestored++;
              }
            } catch (error) {
              console.warn(`Warning: Failed to restore payroll record ${record.id}:`, error);
            }
          }
          break;

        default:
          throw new Error(`Unknown service name: ${serviceName}`);
      }

      console.log(`✅ ${serviceName} restoration finished. ${totalRestored} records restored.`);
    } catch (error) {
      console.error(`Error restoring ${backupData.serviceName} backup:`, error);
      throw new Error(`Failed to restore ${backupData.serviceName} backup: ` + (error instanceof Error ? error.message : 'Unknown error'));
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

  /**
   * Send complete backup via email (server-side only)
   */
  static async sendCompleteBackupByEmail(backupData: CompleteBackupData, email: string): Promise<void> {
    // This method should be called from API routes only
    // Import nodemailer dynamically to avoid client-side issues
    const nodemailer = (await import('nodemailer')).default;
    
    try {
      const now = new Date();
      const base64Data = Buffer.from(JSON.stringify(backupData, null, 2)).toString('base64');
      const filename = `backup-completo-${now.toISOString().split('T')[0]}.json`;

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
        subject: `🗄️ Backup Completo Base de Datos - ${now.toLocaleDateString()}`,
        text: `Se adjunta el backup completo de la base de datos generado el ${now.toLocaleString()}.

📋 Detalles del backup:
• Fecha y hora: ${backupData.metadata.exportedAt}
• Exportado por: ${backupData.metadata.exportedBy}
• Versión del sistema: ${backupData.metadata.systemVersion}
• Versión del backup: ${backupData.version}

📊 Resumen del contenido:
• Ubicaciones: ${backupData.data.locations.count} registros
• Usuarios: ${backupData.data.users.count} registros  
• Horarios: ${backupData.data.schedules.count} registros
• Registros de Planilla: ${backupData.data.payrollRecords.count} registros
• Total de registros: ${backupData.metadata.totalRecords}

Este archivo contiene un backup completo de la base de datos y puede ser usado para restaurar toda la información en caso de pérdida de datos.

⚠️ IMPORTANTE: Mantén este archivo en un lugar seguro y no lo compartas con personal no autorizado.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
              <h2 style="color: #333; margin-bottom: 20px;">🗄️ Backup Completo de Base de Datos</h2>
              
              <div style="background-color: white; padding: 20px; border-radius: 6px; border-left: 4px solid #28a745;">
                <p><strong>Se adjunta el backup completo de la base de datos generado el ${now.toLocaleString()}.</strong></p>
                
                <h3 style="color: #495057; margin-top: 20px;">📋 Detalles del backup:</h3>
                <ul style="color: #6c757d;">
                  <li><strong>Fecha y hora:</strong> ${backupData.metadata.exportedAt}</li>
                  <li><strong>Exportado por:</strong> ${backupData.metadata.exportedBy}</li>
                  <li><strong>Versión del sistema:</strong> ${backupData.metadata.systemVersion}</li>
                  <li><strong>Versión del backup:</strong> ${backupData.version}</li>
                </ul>
                
                <div style="margin-top: 15px; padding: 15px; background-color: #e3f2fd; border-radius: 6px;">
                  <h4 style="color: #1976d2; margin-bottom: 10px;">📊 Resumen del contenido:</h4>
                  <ul style="color: #424242; margin: 0;">
                    <li>Ubicaciones: ${backupData.data.locations.count} registros</li>
                    <li>Usuarios: ${backupData.data.users.count} registros</li>
                    <li>Horarios: ${backupData.data.schedules.count} registros</li>
                    <li>Registros de Planilla: ${backupData.data.payrollRecords.count} registros</li>
                    <li><strong>Total de registros: ${backupData.metadata.totalRecords}</strong></li>
                  </ul>
                </div>
                
                <p style="margin-top: 20px; color: #495057;">
                  Este archivo contiene un backup completo de la base de datos y puede ser usado para restaurar toda la información en caso de pérdida de datos.
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
      console.error('Error sending complete backup email:', error);
      throw new Error('Failed to send complete backup email: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Send individual backup files via email (server-side only)
   */
  static async sendIndividualBackupsByEmail(individualBackups: IndividualBackupFiles, email: string): Promise<void> {
    try {
      const nodemailer = await import('nodemailer');
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        }
      });

      const now = new Date();
      const dateStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
      
      // Prepare attachments for each service
      const attachments = [];
      const services = ['locations', 'users', 'schedules', 'payrollRecords'] as const;
      let totalRecords = 0;
      
      for (const serviceName of services) {
        const serviceData = individualBackups[serviceName];
        const jsonString = JSON.stringify(serviceData, null, 2);
        const base64Data = Buffer.from(jsonString).toString('base64');
        const filename = `${serviceName}_backup_${dateStr}.json`;
        
        attachments.push({
          filename,
          content: base64Data,
          encoding: 'base64' as const
        });
        
        totalRecords += serviceData.data.count;
      }

      await transporter.sendMail({
        from: `"Price Master System" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `🗃️ Backup Individual de Base de Datos - ${now.toLocaleDateString()}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
              <h2 style="color: #333; margin-bottom: 20px;">🗃️ Backup Individual de Base de Datos</h2>
              
              <div style="background-color: white; padding: 20px; border-radius: 6px; border-left: 4px solid #28a745;">
                <p><strong>Se adjuntan los archivos individuales de backup generados el ${now.toLocaleString()}.</strong></p>
                
                <h3 style="color: #495057; margin-top: 20px;">📋 Archivos incluidos:</h3>
                <ul style="color: #6c757d;">
                  <li><strong>locations_backup_${dateStr}.json</strong> - ${individualBackups.locations.data.count} ubicaciones</li>
                  <li><strong>users_backup_${dateStr}.json</strong> - ${individualBackups.users.data.count} usuarios</li>
                  <li><strong>schedules_backup_${dateStr}.json</strong> - ${individualBackups.schedules.data.count} horarios</li>
                  <li><strong>payrollRecords_backup_${dateStr}.json</strong> - ${individualBackups.payrollRecords.data.count} registros de nómina</li>
                </ul>
                
                <h3 style="color: #495057; margin-top: 20px;">📊 Resumen del backup:</h3>
                <ul style="color: #6c757d;">
                  <li><strong>Total de registros:</strong> ${totalRecords}</li>
                  <li><strong>Exportado por:</strong> ${individualBackups.locations.metadata.exportedBy}</li>
                  <li><strong>Versión del sistema:</strong> ${individualBackups.locations.metadata.systemVersion}</li>
                  <li><strong>Fecha y hora:</strong> ${individualBackups.locations.metadata.exportedAt}</li>
                </ul>
                
                <p style="margin-top: 20px; color: #495057;">
                  Cada archivo contiene un servicio específico del sistema y puede ser restaurado independientemente para casos de recuperación selectiva de datos.
                </p>
              </div>
              
              <div style="margin-top: 20px; padding: 15px; background-color: #d1ecf1; border-radius: 6px; border-left: 4px solid #17a2b8;">
                <p style="margin: 0; color: #0c5460;">
                  <strong>💡 VENTAJAS:</strong> Los archivos individuales permiten restaurar servicios específicos sin afectar otros datos del sistema.
                </p>
              </div>
              
              <div style="margin-top: 15px; padding: 15px; background-color: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
                <p style="margin: 0; color: #856404;">
                  <strong>⚠️ IMPORTANTE:</strong> Mantén estos archivos en un lugar seguro y no los compartas con personal no autorizado.
                </p>
              </div>
            </div>
          </div>
        `,
        attachments,
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
      console.error('Error sending individual backup emails:', error);
      throw new Error('Failed to send individual backup emails: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}
