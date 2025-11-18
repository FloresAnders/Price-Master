import { FirestoreService } from './firestore';

export type MovementCurrencyKey = 'CRC' | 'USD';
export type MovementAccountKey = 'FondoGeneral' | 'BCR' | 'BN' | 'BAC';

export type MovementBucket<T = unknown> = {
  movements: T[];
};

export type MovementAccount<T = unknown> = Record<MovementCurrencyKey, MovementBucket<T>>;

export type MovementCurrencySettings = {
  enabled: boolean;
  initialBalance: number;
  currentBalance: number;
};

export type MovementStorageMetadata = {
  accounts: Record<MovementAccountKey, Record<MovementCurrencyKey, MovementCurrencySettings>>;
  currencies?: Record<MovementCurrencyKey, MovementCurrencySettings>; // legacy fallback
  updatedAt?: string;
};

export type MovementStorage<T = unknown> = {
  company: string;
  accounts: Record<MovementAccountKey, MovementAccount<T>>;
  metadata?: MovementStorageMetadata;
};

const MOVEMENT_STORAGE_PREFIX = 'movements';

export class MovimientosFondosService {
  static readonly COLLECTION_NAME = 'MovimientosFondos';

  static buildMovementStorageKey(identifier: string): string {
    return `${MOVEMENT_STORAGE_PREFIX}_${identifier && identifier.length > 0 ? identifier : 'global'}`;
  }

  static buildCompanyMovementsKey(companyName: string): string {
    return this.buildMovementStorageKey((companyName || '').trim());
  }

  static buildLegacyOwnerMovementsKey(ownerId: string): string {
    return this.buildMovementStorageKey((ownerId || '').trim());
  }

  static createEmptyMovementAccount<T = unknown>(): MovementAccount<T> {
    return {
      CRC: { movements: [] },
      USD: { movements: [] },
    };
  }

  static createEmptyMovementStorage<T = unknown>(company: string): MovementStorage<T> {
    return {
      company,
      accounts: {
        FondoGeneral: this.createEmptyMovementAccount<T>(),
        BCR: this.createEmptyMovementAccount<T>(),
        BN: this.createEmptyMovementAccount<T>(),
        BAC: this.createEmptyMovementAccount<T>(),
      },
      metadata: this.defaultMetadata(),
    };
  }

  static ensureMovementStorageShape<T = unknown>(raw: unknown, company: string): MovementStorage<T> {
    const normalizedCompany = company || '';
    if (!raw || typeof raw !== 'object') {
      return this.createEmptyMovementStorage<T>(normalizedCompany);
    }

    const candidate = raw as Partial<MovementStorage<T>> & {
      ownerId?: string;
      accounts?: Partial<Record<MovementAccountKey, Partial<MovementAccount<T>>>>;
    };

    const storage = this.createEmptyMovementStorage<T>(normalizedCompany);
    const sourceCompany =
      typeof candidate.company === 'string'
        ? candidate.company
        : typeof candidate.ownerId === 'string'
          ? candidate.ownerId
          : normalizedCompany;
    storage.company = sourceCompany;

    (Object.keys(storage.accounts) as MovementAccountKey[]).forEach(accountKey => {
      const sourceAccount = candidate.accounts?.[accountKey];
      storage.accounts[accountKey] = {
        CRC: {
          movements: Array.isArray(sourceAccount?.CRC?.movements)
            ? (sourceAccount?.CRC?.movements as T[])
            : [],
        },
        USD: {
          movements: Array.isArray(sourceAccount?.USD?.movements)
            ? (sourceAccount?.USD?.movements as T[])
            : [],
        },
      };
    });

    const candidateMetadata = (candidate as { metadata?: MovementStorageMetadata }).metadata;
    storage.metadata = this.sanitizeMetadata(candidateMetadata);

    return storage;
  }

  private static sanitizeMetadata(metadata?: MovementStorageMetadata): MovementStorageMetadata {
    const fallbackCurrencies = metadata?.currencies
      ? this.sanitizeCurrencySettings(metadata.currencies)
      : undefined;
    return {
      accounts: this.sanitizeAccountMetadata(metadata?.accounts, fallbackCurrencies),
      currencies: fallbackCurrencies,
      updatedAt:
        typeof metadata?.updatedAt === 'string'
          ? metadata.updatedAt
          : new Date().toISOString(),
    };
  }

  private static defaultCurrencySettings(): Record<MovementCurrencyKey, MovementCurrencySettings> {
    return {
      CRC: { enabled: true, initialBalance: 0, currentBalance: 0 },
      USD: { enabled: true, initialBalance: 0, currentBalance: 0 },
    };
  }

  private static cloneCurrencySettings(
    source?: Partial<Record<MovementCurrencyKey, MovementCurrencySettings>>,
  ): Record<MovementCurrencyKey, MovementCurrencySettings> {
    const defaults = this.defaultCurrencySettings();
    return {
      CRC: { ...(source?.CRC ?? defaults.CRC) },
      USD: { ...(source?.USD ?? defaults.USD) },
    };
  }

  private static defaultAccountMetadata(): Record<MovementAccountKey, Record<MovementCurrencyKey, MovementCurrencySettings>> {
    return {
      FondoGeneral: this.cloneCurrencySettings(),
      BCR: this.cloneCurrencySettings(),
      BN: this.cloneCurrencySettings(),
      BAC: this.cloneCurrencySettings(),
    };
  }

  private static defaultMetadata(): MovementStorageMetadata {
    return {
      accounts: this.defaultAccountMetadata(),
      updatedAt: new Date().toISOString(),
    };
  }

  private static sanitizeAccountMetadata(
    accounts?: Partial<Record<MovementAccountKey, Partial<Record<MovementCurrencyKey, Partial<MovementCurrencySettings>>>>>,
    fallback?: Record<MovementCurrencyKey, MovementCurrencySettings>,
  ): Record<MovementAccountKey, Record<MovementCurrencyKey, MovementCurrencySettings>> {
    const defaults = this.defaultAccountMetadata();
    const sanitizedFallback = fallback ? this.cloneCurrencySettings(fallback) : undefined;

    (Object.keys(defaults) as MovementAccountKey[]).forEach(accountKey => {
      const source = accounts?.[accountKey];
      if (source) {
        defaults[accountKey] = this.sanitizeCurrencySettings(source);
      } else if (sanitizedFallback) {
        defaults[accountKey] = this.cloneCurrencySettings(sanitizedFallback);
      }
    });

    return defaults;
  }

  private static sanitizeCurrencySettings(
    currencies?: Partial<Record<MovementCurrencyKey, Partial<MovementCurrencySettings>>>
  ): Record<MovementCurrencyKey, MovementCurrencySettings> {
    const defaults = this.defaultCurrencySettings();
    if (!currencies || typeof currencies !== 'object') {
      return defaults;
    }

    (Object.keys(defaults) as MovementCurrencyKey[]).forEach(currencyKey => {
      const source = currencies[currencyKey];
      if (!source) return;
      defaults[currencyKey] = {
        enabled: source.enabled === undefined ? defaults[currencyKey].enabled : Boolean(source.enabled),
        initialBalance: this.sanitizeBalance(source.initialBalance ?? defaults[currencyKey].initialBalance),
        currentBalance: this.sanitizeBalance(source.currentBalance ?? defaults[currencyKey].currentBalance),
      };
    });

    return defaults;
  }

  private static sanitizeBalance(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
    return 0;
  }

  static async getDocument<T = unknown>(docId: string): Promise<MovementStorage<T> | null> {
    if (!docId) return null;
    const doc = await FirestoreService.getById(this.COLLECTION_NAME, docId);
    if (!doc) return null;
    const company = typeof (doc as MovementStorage<T>).company === 'string' ? (doc as MovementStorage<T>).company : '';
    return this.ensureMovementStorageShape<T>(doc, company);
  }

  static async getAllDocuments<T = unknown>(): Promise<Array<MovementStorage<T> & { id: string }>> {
    const documents = await FirestoreService.getAll(this.COLLECTION_NAME);
    return documents.map(rawDoc => {
      const { id, ...data } = rawDoc as MovementStorage<T> & { id: string };
      const company = typeof data.company === 'string' ? data.company : '';
      const storage = this.ensureMovementStorageShape<T>(data, company);
      return {
        ...storage,
        id,
      };
    });
  }

  static async saveDocument<T = unknown>(docId: string, data: MovementStorage<T>): Promise<void> {
    if (!docId) return;
    await FirestoreService.addWithId(this.COLLECTION_NAME, docId, data);
  }

  static async deleteDocument(docId: string): Promise<void> {
    if (!docId) return;
    await FirestoreService.delete(this.COLLECTION_NAME, docId);
  }
}
