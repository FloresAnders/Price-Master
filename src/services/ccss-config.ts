import { FirestoreService } from './firestore';
import { CcssConfig } from '../types/firestore';

export class CcssConfigService {
  private static readonly COLLECTION_NAME = 'ccss-config';

  /**
   * Get CCSS configuration by owner
   */
  static async getCcssConfig(ownerId: string, ownerCompanie?: string): Promise<CcssConfig | null> {
    try {
      const configs = await FirestoreService.getAll(this.COLLECTION_NAME);

      // Find config by ownerId and optionally by ownerCompanie
      const config = configs.find((config: CcssConfig) => {
        if (ownerCompanie) {
          return config.ownerId === ownerId && config.ownerCompanie === ownerCompanie;
        }
        return config.ownerId === ownerId;
      });

      return config || null;
    } catch (error) {
      console.error('Error getting CCSS config:', error);
      return null;
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
      // Check if config exists for this owner and company
      const existingConfig = await this.getCcssConfig(config.ownerId, config.ownerCompanie);

      if (existingConfig && existingConfig.id) {
        await FirestoreService.update(this.COLLECTION_NAME, existingConfig.id, configWithTimestamp);
      } else {
        // Create new config document
        await FirestoreService.add(this.COLLECTION_NAME, configWithTimestamp);
      }
    } catch (error) {
      console.error('Error updating CCSS config:', error);
      throw error;
    }
  }

  /**
   * Get all CCSS configurations for an owner
   */
  static async getAllCcssConfigsByOwner(ownerId: string): Promise<CcssConfig[]> {
    try {
      const configs = await FirestoreService.getAll(this.COLLECTION_NAME);
      return configs.filter((config: CcssConfig) => config.ownerId === ownerId);
    } catch (error) {
      console.error('Error getting CCSS configs by owner:', error);
      return [];
    }
  }

  /**
   * Delete CCSS configuration
   */
  static async deleteCcssConfig(configId: string): Promise<void> {
    try {
      await FirestoreService.delete(this.COLLECTION_NAME, configId);
    } catch (error) {
      console.error('Error deleting CCSS config:', error);
      throw error;
    }
  }

  /**
   * Create new CCSS configuration
   */
  static async createCcssConfig(
    ownerId: string,
    ownerCompanie: string,
    config: { mt: number; tc: number; valorhora: number; horabruta: number }
  ): Promise<void> {
    const configData = {
      ownerId,
      ownerCompanie,
      ...config,
      updatedAt: new Date()
    };

    try {
      await FirestoreService.add(this.COLLECTION_NAME, configData);
    } catch (error) {
      console.error('Error creating CCSS config:', error);
      throw error;
    }
  }
}
