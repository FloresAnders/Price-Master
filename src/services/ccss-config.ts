import { FirestoreService } from './firestore';
import { CcssConfig } from '../types/firestore';

export class CcssConfigService {
  private static readonly COLLECTION_NAME = 'ccss-config';
  private static readonly CONFIG_DOC_ID = 'default';

  /**
   * Get CCSS configuration
   */
  static async getCcssConfig(): Promise<CcssConfig> {
    try {
      const config = await FirestoreService.getById(this.COLLECTION_NAME, this.CONFIG_DOC_ID);
      if (config) {
        return config as CcssConfig;
      }
      // Return default values if no config exists
      return {
        mt: 3672.46,
        tc: 11017.39,
        valorhora: 1441,
        horabruta: 1529.62,
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Error getting CCSS config:', error);
      // Return default values on error
      return {
        mt: 3672.46,
        tc: 11017.39,
        valorhora: 1441,
        horabruta: 1529.62,
        updatedAt: new Date()
      };
    }
  }

  /**
   * Update CCSS configuration
   */
  static async updateCcssConfig(config: Omit<CcssConfig, 'id' | 'updatedAt'>): Promise<void> {
    const configWithTimestamp = {
      ...config,
      updatedAt: new Date()
    };

    try {
      // Check if config exists
      const exists = await FirestoreService.exists(this.COLLECTION_NAME, this.CONFIG_DOC_ID);
      
      if (exists) {
        await FirestoreService.update(this.COLLECTION_NAME, this.CONFIG_DOC_ID, configWithTimestamp);
      } else {
        // Create new config document with specific ID
        await FirestoreService.addWithId(this.COLLECTION_NAME, this.CONFIG_DOC_ID, configWithTimestamp);
      }
    } catch (error) {
      console.error('Error updating CCSS config:', error);
      throw error;
    }
  }

  /**
   * Initialize CCSS configuration with default values if it doesn't exist
   */
  static async initializeCcssConfig(): Promise<void> {
    try {
      const exists = await FirestoreService.exists(this.COLLECTION_NAME, this.CONFIG_DOC_ID);
      
      if (!exists) {
        await this.updateCcssConfig({
          mt: 3672.46,
          tc: 11017.39,
          valorhora: 1441,
          horabruta: 1529.62
        });
      }
    } catch (error) {
      console.error('Error initializing CCSS config:', error);
      throw error;
    }
  }
}
