import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ProviderEntry } from '../types/firestore';

interface ProvidersDocument {
	company: string;
	nextCode: number;
	providers: ProviderEntry[];
}

const padCode = (value: unknown): string => {
	if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
		return String(value).padStart(4, '0');
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) return '';
		const parsed = Number.parseInt(trimmed, 10);
		if (!Number.isNaN(parsed) && parsed >= 0) {
			return String(parsed).padStart(4, '0');
		}
		return trimmed.padStart(4, '0');
	}

	const fallback = String(value ?? '').trim();
	if (!fallback) return '';
	const parsed = Number.parseInt(fallback, 10);
	if (!Number.isNaN(parsed) && parsed >= 0) {
		return String(parsed).padStart(4, '0');
	}
	return fallback.padStart(4, '0');
};

const normalizeProviderEntry = (raw: unknown, fallbackCompany: string): ProviderEntry | null => {
	if (!raw || typeof raw !== 'object') return null;

	const data = raw as Record<string, unknown>;
	const name = typeof data.name === 'string' ? data.name.trim() : '';
	if (!name) return null;

	const codeSource = data.code ?? data.id ?? data.identifier;
	const code = padCode(codeSource ?? '');
	if (!code.trim()) return null;

	const companyCandidate = typeof data.company === 'string' ? data.company.trim() : '';
	const typeCandidate = typeof data.type === 'string' ? data.type.trim().toUpperCase() : undefined;

	return {
		name,
		code,
		company: companyCandidate || fallbackCompany,
		type: typeCandidate && typeCandidate.length > 0 ? typeCandidate : undefined
	};
};

const highestCode = (providers: ProviderEntry[]): number => {
	return providers.reduce((max, provider) => {
		const numeric = Number.parseInt(provider.code, 10);
		if (Number.isFinite(numeric) && numeric > max) {
			return numeric;
		}
		return max;
	}, -1);
};

const deriveNextCode = (nextCodeValue: unknown, providers: ProviderEntry[]): number => {
	const stored = typeof nextCodeValue === 'number' && Number.isFinite(nextCodeValue) && nextCodeValue >= 0
		? nextCodeValue
		: undefined;

	const maxExisting = highestCode(providers);

	if (typeof stored === 'number' && stored > maxExisting) {
		return stored;
	}

	return maxExisting + 1;
};

const normalizeProvidersDocument = (raw: unknown, company: string): ProvidersDocument => {
	if (!raw || typeof raw !== 'object') {
		return {
			company,
			nextCode: 0,
			providers: []
		};
	}

	const data = raw as Record<string, unknown>;
	const companyCandidate = typeof data.company === 'string' && data.company.trim().length > 0
		? data.company.trim()
		: company;

	const providersArray = Array.isArray(data.providers) ? data.providers : [];
	const providers = providersArray
		.map(item => normalizeProviderEntry(item, companyCandidate))
		.filter((item): item is ProviderEntry => item !== null);

	return {
		company: companyCandidate,
		nextCode: deriveNextCode(data.nextCode, providers),
		providers
	};
};

export class ProvidersService {
	private static readonly COLLECTION_NAME = 'proveedores';

	static async getProviders(company: string): Promise<ProviderEntry[]> {
		const trimmedCompany = (company || '').trim();
		if (!trimmedCompany) {
			return [];
		}

		const docRef = doc(db, this.COLLECTION_NAME, trimmedCompany);
		const snapshot = await getDoc(docRef);

		if (!snapshot.exists()) {
			return [];
		}

		const normalized = normalizeProvidersDocument(snapshot.data(), trimmedCompany);
		return normalized.providers;
	}

	static async addProvider(company: string, providerName: string, providerType?: string): Promise<ProviderEntry> {
		const trimmedCompany = (company || '').trim();
		if (!trimmedCompany) {
			throw new Error('No se pudo determinar la empresa del usuario.');
		}

			const trimmedName = (providerName || '').trim();
		if (!trimmedName) {
			throw new Error('El nombre del proveedor es obligatorio.');
		}

		const docRef = doc(db, this.COLLECTION_NAME, trimmedCompany);

		const newProvider = await runTransaction(db, async transaction => {
			const snapshot = await transaction.get(docRef);
			const document = snapshot.exists()
				? normalizeProvidersDocument(snapshot.data(), trimmedCompany)
				: {
						company: trimmedCompany,
						nextCode: 0,
						providers: [] as ProviderEntry[]
					};

				const normalizedName = trimmedName.toUpperCase();
				const normalizedType = typeof providerType === 'string' && providerType.trim().length > 0
					? providerType.trim().toUpperCase()
					: undefined;
				const duplicate = document.providers.some(
					provider => provider.name.toUpperCase() === normalizedName
				);

				if (duplicate) {
					throw new Error('Ya existe un proveedor con ese nombre.');
				}

			const nextNumericCode = deriveNextCode(document.nextCode, document.providers);
			const createdProvider: ProviderEntry = {
				code: String(nextNumericCode).padStart(4, '0'),
					name: normalizedName,
				company: document.company,
				type: normalizedType
			};

			const updatedDocument: ProvidersDocument = {
				company: document.company,
				nextCode: nextNumericCode + 1,
				providers: [createdProvider, ...document.providers]
			};

			// Firestore rejects fields with `undefined`. Sanitize providers array to omit
			// undefined properties before writing.
			const firestoreDoc: Record<string, unknown> = {
				company: updatedDocument.company,
				nextCode: updatedDocument.nextCode,
				providers: updatedDocument.providers.map(p => {
					const out: Record<string, unknown> = {
						code: p.code,
						name: p.name,
						company: p.company,
					};
					if (typeof p.type === 'string' && p.type.length > 0) out.type = p.type;
					return out;
				}),
			};

			transaction.set(docRef, firestoreDoc);
			return createdProvider;
		});

		return newProvider;
	}

			static async removeProvider(company: string, providerCode: string): Promise<ProviderEntry> {
				const trimmedCompany = (company || '').trim();
				if (!trimmedCompany) {
					throw new Error('No se pudo determinar la empresa del usuario.');
				}

				const normalizedCode = padCode(providerCode);
				if (!normalizedCode) {
					throw new Error('Código de proveedor no válido.');
				}

				const docRef = doc(db, this.COLLECTION_NAME, trimmedCompany);

				const removedProvider = await runTransaction(db, async transaction => {
					const snapshot = await transaction.get(docRef);
					if (!snapshot.exists()) {
						throw new Error('El proveedor no existe.');
					}

					const document = normalizeProvidersDocument(snapshot.data(), trimmedCompany);
					const targetIndex = document.providers.findIndex(p => p.code === normalizedCode);

					if (targetIndex === -1) {
						throw new Error('El proveedor no existe.');
					}

					const providerToRemove = document.providers[targetIndex];
					const updatedProviders = document.providers.filter((_, idx) => idx !== targetIndex);
					const highestRemaining = highestCode(updatedProviders);

					const updatedDocument: ProvidersDocument = {
						company: document.company,
						nextCode: Math.max(document.nextCode, highestRemaining + 1, 0),
						providers: updatedProviders
					};

					// Sanitize before writing to Firestore to avoid `undefined` values.
					const firestoreDoc: Record<string, unknown> = {
						company: updatedDocument.company,
						nextCode: updatedDocument.nextCode,
						providers: updatedDocument.providers.map(p => {
							const out: Record<string, unknown> = {
								code: p.code,
								name: p.name,
								company: p.company,
							};
							if (typeof p.type === 'string' && p.type.length > 0) out.type = p.type;
							return out;
						}),
					};

					transaction.set(docRef, firestoreDoc);
					return providerToRemove;
				});

				return removedProvider;
			}

			static async updateProvider(company: string, providerCode: string, providerName: string, providerType?: string): Promise<ProviderEntry> {
				const trimmedCompany = (company || '').trim();
				if (!trimmedCompany) {
					throw new Error('No se pudo determinar la empresa del usuario.');
				}

				const code = padCode(providerCode);
				if (!code) {
					throw new Error('Codigo de proveedor no valido.');
				}

				const trimmedName = (providerName || '').trim();
				if (!trimmedName) {
					throw new Error('El nombre del proveedor es obligatorio.');
				}

				const docRef = doc(db, this.COLLECTION_NAME, trimmedCompany);

				const updated = await runTransaction(db, async transaction => {
					const snapshot = await transaction.get(docRef);
					if (!snapshot.exists()) {
						throw new Error('El proveedor no existe.');
					}

					const document = normalizeProvidersDocument(snapshot.data(), trimmedCompany);
					const targetIndex = document.providers.findIndex(p => p.code === code);
					if (targetIndex === -1) {
						throw new Error('El proveedor no existe.');
					}

					// Prevent duplicate name with other providers
					const normalizedName = trimmedName.toUpperCase();
					const duplicate = document.providers.some((p, idx) => idx !== targetIndex && p.name.toUpperCase() === normalizedName);
					if (duplicate) {
						throw new Error('Ya existe un proveedor con ese nombre.');
					}

					const normalizedType = typeof providerType === 'string' && providerType.trim().length > 0
						? providerType.trim().toUpperCase()
						: undefined;

					const updatedProvider: ProviderEntry = {
						...document.providers[targetIndex],
						name: normalizedName,
						type: normalizedType,
					};

					const updatedProviders = [...document.providers];
					updatedProviders[targetIndex] = updatedProvider;

					const updatedDocument: ProvidersDocument = {
						company: document.company,
						nextCode: document.nextCode,
						providers: updatedProviders,
					};

					const firestoreDoc: Record<string, unknown> = {
						company: updatedDocument.company,
						nextCode: updatedDocument.nextCode,
						providers: updatedDocument.providers.map(p => {
							const out: Record<string, unknown> = {
								code: p.code,
								name: p.name,
								company: p.company,
							};
							if (typeof p.type === 'string' && p.type.length > 0) out.type = p.type;
							return out;
						}),
					};

					transaction.set(docRef, firestoreDoc);
					return updatedProvider;
				});

				return updated;
			}

}
