import {
	doc,
	getDoc,
	runTransaction,
	serverTimestamp,
	Timestamp,
	onSnapshot,
	type Unsubscribe,
} from "firebase/firestore";
import { db } from "../config/firebase";

export interface ControlPedidoEntry {
	id: string;
	providerCode: string;
	providerName: string;
	createDateKey: number;
	receiveDateKey: number;
	amount: number;
	createdAt?: unknown;
}

interface ControlPedidoWeekDoc {
	company: string;
	weekStartKey: number;
	entries: ControlPedidoEntry[];
	updatedAt?: unknown;
}

const COLLECTION_NAME = "controlpedido";

const createEntryId = (): string => {
	try {
		const c: any = typeof crypto !== "undefined" ? crypto : undefined;
		if (c && typeof c.randomUUID === "function") return c.randomUUID();
	} catch {
		// ignore
	}
	return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const asFiniteNumber = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};

const normalizeEntry = (raw: unknown): ControlPedidoEntry | null => {
	if (!raw || typeof raw !== "object") return null;
	const data = raw as Record<string, unknown>;
	const id = typeof data.id === "string" ? data.id.trim() : "";
	const providerCode =
		typeof data.providerCode === "string" ? data.providerCode.trim() : "";
	const providerName =
		typeof data.providerName === "string" ? data.providerName.trim() : "";
	const createDateKey = asFiniteNumber(data.createDateKey);
	const receiveDateKey = asFiniteNumber(data.receiveDateKey);
	const amount = asFiniteNumber(data.amount);
	if (!id || !providerCode || !providerName) return null;
	if (createDateKey === null || receiveDateKey === null || amount === null)
		return null;
	return {
		id,
		providerCode,
		providerName,
		createDateKey,
		receiveDateKey,
		amount,
		createdAt: data.createdAt,
	};
};

const normalizeWeekDoc = (
	raw: unknown,
	company: string,
	weekStartKey: number
): ControlPedidoWeekDoc => {
	if (!raw || typeof raw !== "object") {
		return { company, weekStartKey, entries: [] };
	}
	const data = raw as Record<string, unknown>;
	const entriesRaw = Array.isArray(data.entries) ? data.entries : [];
	const entries = entriesRaw
		.map((e) => normalizeEntry(e))
		.filter((e): e is ControlPedidoEntry => e !== null);
	return {
		company:
			typeof data.company === "string" && data.company.trim()
				? data.company.trim()
				: company,
		weekStartKey:
			asFiniteNumber(data.weekStartKey) ?? weekStartKey,
		entries,
		updatedAt: data.updatedAt,
	};
};

const weekDocId = (company: string, weekStartKey: number): string => {
	const c = (company || "").trim();
	return `${c}__${weekStartKey}`;
};

export class ControlPedidoService {
	static subscribeWeek(
		company: string,
		weekStartKey: number,
		onValue: (entries: ControlPedidoEntry[]) => void,
		onError?: (error: unknown) => void
	): Unsubscribe {
		const trimmedCompany = (company || "").trim();
		if (!trimmedCompany || !Number.isFinite(weekStartKey)) {
			onValue([]);
			return () => {};
		}

		const docRef = doc(db, COLLECTION_NAME, weekDocId(trimmedCompany, weekStartKey));
		return onSnapshot(
			docRef,
			(snapshot) => {
				if (!snapshot.exists()) {
					onValue([]);
					return;
				}
				const normalized = normalizeWeekDoc(snapshot.data(), trimmedCompany, weekStartKey);
				onValue(normalized.entries);
			},
			(err) => {
				if (onError) onError(err);
			}
		);
	}

	static async addEntry(
		company: string,
		weekStartKey: number,
		payload: Omit<ControlPedidoEntry, "id" | "createdAt">
	): Promise<ControlPedidoEntry> {
		const trimmedCompany = (company || "").trim();
		if (!trimmedCompany) {
			throw new Error("No se pudo determinar la empresa del usuario.");
		}
		if (!Number.isFinite(weekStartKey)) {
			throw new Error("Semana inválida.");
		}
		const amount = asFiniteNumber(payload.amount);
		if (amount === null || amount <= 0) {
			throw new Error("Monto inválido.");
		}
		if (!payload.providerCode?.trim() || !payload.providerName?.trim()) {
			throw new Error("Proveedor inválido.");
		}
		if (!Number.isFinite(payload.createDateKey) || !Number.isFinite(payload.receiveDateKey)) {
			throw new Error("Fechas inválidas.");
		}

		const entry: ControlPedidoEntry = {
			id: createEntryId(),
			providerCode: payload.providerCode.trim(),
			providerName: payload.providerName.trim(),
			createDateKey: payload.createDateKey,
			receiveDateKey: payload.receiveDateKey,
			amount,
			createdAt: Timestamp.now(),
		};

		const docRef = doc(db, COLLECTION_NAME, weekDocId(trimmedCompany, weekStartKey));

		await runTransaction(db, async (tx) => {
			const snap = await tx.get(docRef);
			const existing = snap.exists()
				? normalizeWeekDoc(snap.data(), trimmedCompany, weekStartKey)
				: { company: trimmedCompany, weekStartKey, entries: [] as ControlPedidoEntry[] };

			const entries = Array.isArray(existing.entries) ? existing.entries : [];
			entries.push(entry);

			tx.set(
				docRef,
				{
					company: trimmedCompany,
					weekStartKey,
					entries,
					updatedAt: serverTimestamp(),
				},
				{ merge: true }
			);
		});

		// Return without the server timestamp (caller can rely on snapshot for authoritative state)
		return entry;
	}

	static async getWeek(company: string, weekStartKey: number): Promise<ControlPedidoEntry[]> {
		const trimmedCompany = (company || "").trim();
		if (!trimmedCompany || !Number.isFinite(weekStartKey)) return [];
		const docRef = doc(db, COLLECTION_NAME, weekDocId(trimmedCompany, weekStartKey));
		const snap = await getDoc(docRef);
		if (!snap.exists()) return [];
		return normalizeWeekDoc(snap.data(), trimmedCompany, weekStartKey).entries;
	}
}
