import { FirestoreService } from './firestore';

export type MovementCurrencyKey = 'CRC' | 'USD';
export type MovementAccountKey = 'FondoGeneral' | 'BCR' | 'BN' | 'BAC';

const ACCOUNT_KEYS: MovementAccountKey[] = ['FondoGeneral', 'BCR', 'BN', 'BAC'];
const CURRENCY_KEYS: MovementCurrencyKey[] = ['CRC', 'USD'];

type LegacyMovementBucket<T = unknown> = {
  movements?: T[];
};

type LegacyMovementAccount<T = unknown> = Partial<Record<MovementCurrencyKey, LegacyMovementBucket<T>>>;
type LegacyMovementAccounts<T = unknown> = Partial<Record<MovementAccountKey, LegacyMovementAccount<T>>>;

export type MovementCurrencySettings = {
  enabled: boolean;
  initialBalance: number;
  currentBalance: number;
};

export type MovementConfigurationAccount = {
  id: MovementAccountKey;
  label: string;
  supportedCurrencies: MovementCurrencyKey[];
};

export type MovementConfigurationCurrency = {
  code: MovementCurrencyKey;
  enabled: boolean;
};

export type MovementConfiguration = {
  accounts: MovementConfigurationAccount[];
  currencies: MovementConfigurationCurrency[];
};

export type MovementOperations<T = unknown> = {
  movements: T[];
};

export type MovementAccountBalance = MovementCurrencySettings & {
  accountId: MovementAccountKey;
  currency: MovementCurrencyKey;
};

export type MovementStorageState = {
  balancesByAccount: MovementAccountBalance[];
  updatedAt: string;
};

type LegacyMovementMetadata = {
  accounts?: Record<MovementAccountKey, Record<MovementCurrencyKey, MovementCurrencySettings>>;
  currencies?: Record<MovementCurrencyKey, MovementCurrencySettings>;
  updatedAt?: string;
};

export type MovementStorage<T = unknown> = {
  company: string;
  configuration: MovementConfiguration;
  operations: MovementOperations<T>;
  state: MovementStorageState;
};

const MOVEMENT_STORAGE_PREFIX = 'movements';
const DEFAULT_ACCOUNT_LABELS: Record<MovementAccountKey, string> = {
  FondoGeneral: 'Fondo General',
  BCR: 'BCR',
  BN: 'BN',
  BAC: 'BAC',
};

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

  static createEmptyMovementStorage<T = unknown>(company: string): MovementStorage<T> {
    return {
      company,
      configuration: this.defaultConfiguration(),
      operations: { movements: [] },
      state: this.defaultState(),
    };
  }

  static ensureMovementStorageShape<T = unknown>(raw: unknown, company: string): MovementStorage<T> {
    const normalizedCompany = company || '';
    if (!raw || typeof raw !== 'object') {
      return this.createEmptyMovementStorage<T>(normalizedCompany);
    }

    const candidate = raw as Partial<MovementStorage<T>> & {
      ownerId?: string;
      accounts?: LegacyMovementAccounts<T>;
      metadata?: LegacyMovementMetadata;
    };

    const storage = this.createEmptyMovementStorage<T>(normalizedCompany);
    storage.company = this.resolveCompany(candidate.company, candidate.ownerId, normalizedCompany);
    storage.configuration = this.sanitizeConfiguration(candidate.configuration);
    storage.operations = this.sanitizeOperations(candidate.operations, candidate.accounts);
    storage.state = this.sanitizeState(candidate.state, candidate.metadata);

    return storage;
  }

  private static resolveCompany(candidateCompany?: unknown, fallbackOwner?: unknown, defaultCompany?: string): string {
    if (typeof candidateCompany === 'string' && candidateCompany.trim().length > 0) {
      return candidateCompany.trim();
    }
    if (typeof fallbackOwner === 'string' && fallbackOwner.trim().length > 0) {
      return fallbackOwner.trim();
    }
    return defaultCompany || '';
  }

  private static defaultConfiguration(): MovementConfiguration {
    return {
      accounts: ACCOUNT_KEYS.map(id => ({
        id,
        label: DEFAULT_ACCOUNT_LABELS[id],
        supportedCurrencies: [...CURRENCY_KEYS],
      })),
      currencies: CURRENCY_KEYS.map(code => ({ code, enabled: true })),
    };
  }

  private static defaultState(): MovementStorageState {
    return {
      balancesByAccount: this.defaultAccountBalances(),
      updatedAt: new Date().toISOString(),
    };
  }

  private static defaultAccountBalances(): MovementAccountBalance[] {
    return ACCOUNT_KEYS.flatMap(accountId =>
      CURRENCY_KEYS.map(currency => ({
        accountId,
        currency,
        enabled: true,
        initialBalance: 0,
        currentBalance: 0,
      })),
    );
  }

  private static sanitizeConfiguration(config?: Partial<MovementConfiguration>): MovementConfiguration {
    const defaults = this.defaultConfiguration();
    if (!config) return defaults;

    const accountsSource = Array.isArray(config.accounts) ? config.accounts : [];
    const sanitizedAccounts: MovementConfigurationAccount[] = [];
    const seenAccounts = new Set<MovementAccountKey>();
    accountsSource.forEach(account => {
      if (!this.isMovementAccountKey(account?.id)) return;
      const id = account!.id as MovementAccountKey;
      if (seenAccounts.has(id)) return;
      seenAccounts.add(id);
      sanitizedAccounts.push({
        id,
        label: this.resolveAccountLabel(account?.label, id),
        supportedCurrencies: this.sanitizeSupportedCurrencies(account?.supportedCurrencies),
      });
    });

    const currencySource = Array.isArray(config.currencies) ? config.currencies : [];
    const seenCurrencies = new Set<MovementCurrencyKey>();
    const sanitizedCurrencies: MovementConfigurationCurrency[] = [];
    currencySource.forEach(currency => {
      if (!this.isMovementCurrencyKey(currency?.code)) return;
      const code = currency!.code as MovementCurrencyKey;
      if (seenCurrencies.has(code)) return;
      seenCurrencies.add(code);
      sanitizedCurrencies.push({
        code,
        enabled: currency?.enabled === undefined ? true : Boolean(currency.enabled),
      });
    });

    return {
      accounts: sanitizedAccounts.length > 0 ? sanitizedAccounts : defaults.accounts,
      currencies: sanitizedCurrencies.length > 0 ? sanitizedCurrencies : defaults.currencies,
    };
  }

  private static sanitizeSupportedCurrencies(input?: unknown): MovementCurrencyKey[] {
    const list = Array.isArray(input) ? input : CURRENCY_KEYS;
    const seen = new Set<MovementCurrencyKey>();
    const sanitized: MovementCurrencyKey[] = [];
    list.forEach(item => {
      if (!this.isMovementCurrencyKey(item)) return;
      const code = item as MovementCurrencyKey;
      if (seen.has(code)) return;
      seen.add(code);
      sanitized.push(code);
    });
    return sanitized.length > 0 ? sanitized : [...CURRENCY_KEYS];
  }

  private static resolveAccountLabel(label: unknown, accountId: MovementAccountKey): string {
    if (typeof label === 'string' && label.trim().length > 0) {
      return label.trim();
    }
    return DEFAULT_ACCOUNT_LABELS[accountId] ?? accountId;
  }

  private static sanitizeOperations<T>(
    operations?: Partial<MovementOperations<T>>,
    legacyAccounts?: LegacyMovementAccounts<T>,
  ): MovementOperations<T> {
    if (operations && Array.isArray(operations.movements)) {
      return {
        movements: operations.movements.map(movement => this.ensureMovementEnvelope<T>(movement)),
      };
    }

    if (legacyAccounts) {
      const flattened: T[] = [];
      ACCOUNT_KEYS.forEach(accountId => {
        const account = legacyAccounts[accountId];
        if (!account) return;
        CURRENCY_KEYS.forEach(currency => {
          const bucket = account[currency];
          if (!bucket?.movements || !Array.isArray(bucket.movements)) return;
          bucket.movements.forEach(movement => {
            flattened.push(this.ensureMovementEnvelope<T>(movement, accountId, currency));
          });
        });
      });
      return { movements: flattened };
    }

    return { movements: [] };
  }

  private static sanitizeState(
    state?: Partial<MovementStorageState> | null,
    legacyMetadata?: LegacyMovementMetadata,
  ): MovementStorageState {
    const defaults = this.defaultState();
    if (!state && !legacyMetadata) {
      return defaults;
    }

    const balancesByAccount = this.sanitizeAccountBalances(
      state?.balancesByAccount,
      legacyMetadata?.accounts,
      legacyMetadata?.currencies,
    );
    const updatedAt = this.resolveTimestamp(state?.updatedAt ?? legacyMetadata?.updatedAt ?? defaults.updatedAt);

    return {
      balancesByAccount,
      updatedAt,
    };
  }

  private static sanitizeAccountBalances(
    balances?: MovementAccountBalance[] | null,
    legacyAccounts?: Record<MovementAccountKey, Record<MovementCurrencyKey, MovementCurrencySettings>>,
    legacyCurrencies?: Record<MovementCurrencyKey, MovementCurrencySettings>,
  ): MovementAccountBalance[] {
    const defaults = this.defaultAccountBalances();
    const map = new Map<string, MovementAccountBalance>();

    if (Array.isArray(balances)) {
      balances.forEach(balance => {
        if (!this.isMovementAccountKey(balance?.accountId) || !this.isMovementCurrencyKey(balance?.currency)) return;
        const key = this.buildAccountBalanceKey(balance.accountId as MovementAccountKey, balance.currency as MovementCurrencyKey);
        map.set(key, {
          accountId: balance.accountId as MovementAccountKey,
          currency: balance.currency as MovementCurrencyKey,
          enabled: balance.enabled === undefined ? true : Boolean(balance.enabled),
          initialBalance: this.sanitizeBalance(balance.initialBalance),
          currentBalance: this.sanitizeBalance(balance.currentBalance),
        });
      });
    }

    if (map.size === 0 && legacyAccounts) {
      ACCOUNT_KEYS.forEach(accountId => {
        const account = legacyAccounts[accountId];
        if (!account) return;
        CURRENCY_KEYS.forEach(currency => {
          const settings = account[currency];
          if (!settings) return;
          const key = this.buildAccountBalanceKey(accountId, currency);
          map.set(key, {
            accountId,
            currency,
            enabled: settings.enabled === undefined ? true : Boolean(settings.enabled),
            initialBalance: this.sanitizeBalance(settings.initialBalance),
            currentBalance: this.sanitizeBalance(settings.currentBalance),
          });
        });
      });
    }

    if (map.size === 0 && legacyCurrencies) {
      ACCOUNT_KEYS.forEach(accountId => {
        CURRENCY_KEYS.forEach(currency => {
          const settings = legacyCurrencies[currency];
          if (!settings) return;
          const key = this.buildAccountBalanceKey(accountId, currency);
          if (map.has(key)) return;
          map.set(key, {
            accountId,
            currency,
            enabled: settings.enabled === undefined ? true : Boolean(settings.enabled),
            initialBalance: this.sanitizeBalance(settings.initialBalance),
            currentBalance: this.sanitizeBalance(settings.currentBalance),
          });
        });
      });
    }

    return defaults.map(defaultBalance => map.get(this.buildAccountBalanceKey(defaultBalance.accountId, defaultBalance.currency)) ?? defaultBalance);
  }

  private static ensureMovementEnvelope<T>(
    movement: unknown,
    fallbackAccount?: MovementAccountKey,
    fallbackCurrency?: MovementCurrencyKey,
  ): T {
    const base = movement && typeof movement === 'object' ? { ...(movement as Record<string, unknown>) } : {};
    const accountId = this.isMovementAccountKey((base as { accountId?: unknown }).accountId)
      ? ((base as { accountId?: MovementAccountKey }).accountId as MovementAccountKey)
      : fallbackAccount ?? 'FondoGeneral';
    const currency = this.isMovementCurrencyKey((base as { currency?: unknown }).currency)
      ? ((base as { currency?: MovementCurrencyKey }).currency as MovementCurrencyKey)
      : fallbackCurrency ?? 'CRC';
    return {
      ...base,
      accountId,
      currency,
    } as T;
  }

  private static sanitizeBalance(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
    return 0;
  }

  private static buildAccountBalanceKey(accountId: MovementAccountKey, currency: MovementCurrencyKey): string {
    return `${accountId}_${currency}`;
  }

  private static resolveTimestamp(value: unknown): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return new Date().toISOString();
  }

  private static isMovementAccountKey(value: unknown): value is MovementAccountKey {
    return typeof value === 'string' && ACCOUNT_KEYS.includes(value as MovementAccountKey);
  }

  private static isMovementCurrencyKey(value: unknown): value is MovementCurrencyKey {
    return typeof value === 'string' && CURRENCY_KEYS.includes(value as MovementCurrencyKey);
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
