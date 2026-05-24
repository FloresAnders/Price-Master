import { FirestoreService } from "./firestore";
import { CcssConfig, companies } from "../types/firestore";

export class CcssConfigService {
  private static readonly COLLECTION_NAME = "ccss-config";
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private static readonly cacheByOwnerId = new Map<
    string,
    { fetchedAt: number; configs: CcssConfig[] }
  >();

  private static normalizeCompany(company: companies): companies {
    const mt = Number(company.mt) || 0;
    const tc = Number(company.tc) || 0;
    const valorhora = Number(company.valorhora) || 0;

    return {
      ...company,
      mt,
      tc,
      valorhora,
      pagoTotalMT:
        typeof company.pagoTotalMT === "number" ? company.pagoTotalMT : mt,
      pagoTotalTC:
        typeof company.pagoTotalTC === "number" ? company.pagoTotalTC : tc,
      pagoTotalPH:
        typeof company.pagoTotalPH === "number"
          ? company.pagoTotalPH
          : valorhora,
    };
  }

  /**
   * Get CCSS configuration by owner
   */
  static async getCcssConfig(
    ownerId: string,
    ownerCompanie?: string,
  ): Promise<CcssConfig | null> {
    try {
      if (!ownerId) return null;

      const cached = this.cacheByOwnerId.get(ownerId);
      const now = Date.now();
      let configs: CcssConfig[];

      if (cached && now - cached.fetchedAt < this.CACHE_TTL_MS) {
        configs = cached.configs;
      } else {
        configs = await FirestoreService.query(this.COLLECTION_NAME, [
          { field: "ownerId", operator: "==", value: ownerId },
        ]);
        this.cacheByOwnerId.set(ownerId, { fetchedAt: now, configs });
      }

      // Find config by ownerId and optionally by ownerCompanie
      const config = configs.find((config: CcssConfig) => {
        if (ownerCompanie) {
          return (
            config.ownerId === ownerId &&
            config.companie?.some(
              (company) => company.ownerCompanie === ownerCompanie,
            )
          );
        }
        return config.ownerId === ownerId;
      });

      return config || null;
    } catch (error) {
      console.error("Error getting CCSS config:", error);
      return null;
    }
  }

  /**
   * Update CCSS configuration
   */
  static async updateCcssConfig(
    config: Omit<CcssConfig, "id" | "updatedAt">,
  ): Promise<void> {
    const configWithTimestamp = {
      ...config,
      companie: (config.companie || []).map((company) =>
        this.normalizeCompany(company),
      ),
      updatedAt: new Date(),
    };

    try {
      // Check if config exists for this owner
      const existingConfig = await this.getCcssConfig(config.ownerId);

      if (existingConfig && existingConfig.id) {
        // Update existing config - merge or replace the companies array
        await FirestoreService.update(
          this.COLLECTION_NAME,
          existingConfig.id,
          configWithTimestamp,
        );
      } else {
        // Create new config document
        await FirestoreService.add(this.COLLECTION_NAME, configWithTimestamp);
      }

      // Invalidate cache for this owner
      this.cacheByOwnerId.delete(config.ownerId);
    } catch (error) {
      console.error("Error updating CCSS config:", error);
      throw error;
    }
  }

  /**
   * Get all CCSS configurations for an owner
   */
  static async getAllCcssConfigsByOwner(
    ownerId: string,
  ): Promise<CcssConfig[]> {
    try {
      if (!ownerId) return [];

      const cached = this.cacheByOwnerId.get(ownerId);
      const now = Date.now();
      if (cached && now - cached.fetchedAt < this.CACHE_TTL_MS) {
        return cached.configs;
      }

      const configs = await FirestoreService.query(this.COLLECTION_NAME, [
        { field: "ownerId", operator: "==", value: ownerId },
      ]);
      this.cacheByOwnerId.set(ownerId, { fetchedAt: now, configs });
      return configs;
    } catch (error) {
      console.error("Error getting CCSS configs by owner:", error);
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
      console.error("Error deleting CCSS config:", error);
      throw error;
    }
  }

  /**
   * Create new CCSS configuration
   */
  static async createCcssConfig(
    ownerId: string,
    companieData: companies[],
  ): Promise<void> {
    const configData: Omit<CcssConfig, "id"> = {
      ownerId,
      companie: (companieData || []).map((company) =>
        this.normalizeCompany(company),
      ),
      updatedAt: new Date(),
    };

    try {
      await FirestoreService.add(this.COLLECTION_NAME, configData);
    } catch (error) {
      console.error("Error creating CCSS config:", error);
      throw error;
    }
  }
}
