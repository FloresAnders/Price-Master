import {
  collection,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { ProviderEntry } from "../types/firestore";
import type { MovementAccountKey } from "./movimientos-fondos";

type ProviderVisitDay = "D" | "L" | "M" | "MI" | "J" | "V" | "S";
type ProviderVisitFrequency = "SEMANAL" | "QUINCENAL" | "MENSUAL" | "22 DIAS";

const VISIT_DAYS: ProviderVisitDay[] = ["D", "L", "M", "MI", "J", "V", "S"];
const VISIT_FREQUENCIES: ProviderVisitFrequency[] = [
  "SEMANAL",
  "QUINCENAL",
  "MENSUAL",
  "22 DIAS",
];
const PROVIDER_ACCOUNT_IDS: MovementAccountKey[] = [
  "FondoGeneral",
  "BCR",
  "BN",
  "BAC",
  "CajaNegra",
  "Tucan",
];

const normalizeProviderAccountId = (
  raw: unknown,
): MovementAccountKey | undefined => {
  return typeof raw === "string" &&
    PROVIDER_ACCOUNT_IDS.includes(raw as MovementAccountKey)
    ? (raw as MovementAccountKey)
    : undefined;
};

const normalizeVisitDays = (raw: unknown): ProviderVisitDay[] => {
  if (!Array.isArray(raw)) return [];
  const out: ProviderVisitDay[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const normalized = item.trim().toUpperCase();
    if (VISIT_DAYS.includes(normalized as ProviderVisitDay)) {
      out.push(normalized as ProviderVisitDay);
    }
  }
  return out.filter((d, idx) => out.indexOf(d) === idx);
};

const normalizeVisitFrequency = (
  raw: unknown,
): ProviderVisitFrequency | undefined => {
  if (typeof raw !== "string") return undefined;
  const normalized = raw.trim().toUpperCase();
  return VISIT_FREQUENCIES.includes(normalized as ProviderVisitFrequency)
    ? (normalized as ProviderVisitFrequency)
    : undefined;
};

const normalizeVisitConfig = (
  raw: unknown,
): ProviderEntry["visit"] | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const data = raw as Record<string, unknown>;
  const createOrderDays = normalizeVisitDays(data.createOrderDays);
  const receiveOrderDays = normalizeVisitDays(data.receiveOrderDays);
  const frequency = normalizeVisitFrequency(data.frequency);
  if (!frequency) return undefined;
  if (createOrderDays.length === 0 && receiveOrderDays.length === 0) {
    return undefined;
  }

  const startDateKeyRaw =
    data.startDateKey ?? (data as any).startdatekey ?? (data as any).startDate;
  let startDateKey: number | undefined;
  if (
    typeof startDateKeyRaw === "number" &&
    Number.isFinite(startDateKeyRaw) &&
    startDateKeyRaw > 0
  ) {
    startDateKey = startDateKeyRaw;
  } else if (typeof startDateKeyRaw === "string") {
    const parsed = Number.parseInt(startDateKeyRaw.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) startDateKey = parsed;
  }

  if (frequency === "SEMANAL") startDateKey = undefined;
  return {
    createOrderDays,
    receiveOrderDays,
    frequency,
    startDateKey,
  };
};

const normalizeProviderAgent = (
  raw: unknown,
): ProviderEntry["agent"] | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const data = raw as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const phone = typeof data.phone === "string" ? data.phone.trim() : "";
  if (!name && !phone) return undefined;
  return { name, phone };
};

const getCategoryFromType = (
  type?: string,
): "Ingreso" | "Gasto" | "Egreso" | undefined => {
  if (!type || typeof type !== "string") return undefined;

  const normalizedType = type.trim().toUpperCase();
  if (normalizedType === "VENTAS" || normalizedType === "OTROS INGRESOS") {
    return "Ingreso";
  }

  const gastos = [
    "SALARIOS",
    "TELEFONOS",
    "CARGAS SOCIALES",
    "AGUINALDOS",
    "VACACIONES",
    "POLIZA RIESGOS DE TRABAJO",
    "PAGO TIMBRE Y EDUCACION",
    "PAGO IMPUESTOS A SOCIEDADES",
    "PATENTES MUNICIPALES",
    "ALQUILER LOCAL",
    "ELECTRICIDAD",
    "AGUA",
    "INTERNET",
    "MANTENIMIENTO INSTALACIONES",
    "PAPELERIA Y UTILES",
    "ASEO Y LIMPIEZA",
    "REDES SOCIALES",
    "MATERIALES DE EMPAQUE",
    "CONTROL PLAGAS",
    "MONITOREO DE ALARMAS",
    "FACTURA ELECTRONICA",
    "GASTOS VARIOS",
    "TRANSPORTE",
    "SERVICIOS PROFESIONALES",
    "MANTENIMIENTO MOBILIARIO Y EQUIPO",
  ];
  if (gastos.includes(normalizedType)) return "Gasto";

  const egresos = [
    "EGRESOS VARIOS",
    "PAGO TIEMPOS",
    "PAGO BANCA",
    "COMPRA INVENTARIO",
    "COMPRA ACTIVOS",
    "PAGO IMPUESTO RENTA",
    "PAGO IMPUESTO IVA",
    "RETIRO EFECTIVO",
  ];
  if (egresos.includes(normalizedType)) return "Egreso";

  return undefined;
};

const padCode = (value: unknown): string => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return String(value).padStart(4, "0");
  }

  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isNaN(parsed) && parsed >= 0) {
    return String(parsed).padStart(4, "0");
  }
  return raw.padStart(4, "0");
};

const normalizeProviderEntry = (
  raw: unknown,
  fallbackCompany: string,
): ProviderEntry | null => {
  if (!raw || typeof raw !== "object") return null;

  const data = raw as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) return null;

  const code = padCode(data.code ?? data.id ?? data.identifier);
  if (!code.trim()) return null;

  const company =
    typeof data.company === "string" && data.company.trim().length > 0
      ? data.company.trim()
      : fallbackCompany;
  const type =
    typeof data.type === "string" && data.type.trim().length > 0
      ? data.type.trim().toUpperCase()
      : undefined;
  const category =
    typeof data.category === "string"
      ? (data.category.trim() as "Ingreso" | "Gasto" | "Egreso")
      : getCategoryFromType(type);
  const movementCount =
    typeof data.movementCount === "number" &&
    Number.isFinite(data.movementCount) &&
    data.movementCount >= 0
      ? data.movementCount
      : 0;

  return {
    code,
    name,
    company,
    accountId: normalizeProviderAccountId(data.accountId),
    type,
    category,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : undefined,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
    correonotifi:
      typeof data.correonotifi === "string"
        ? data.correonotifi.trim()
        : undefined,
    agent: normalizeProviderAgent(data.agent),
    visit: normalizeVisitConfig(data.visit),
    movementCount,
  };
};

const serializeProviderEntry = (
  provider: ProviderEntry,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {
    code: provider.code,
    name: provider.name,
    company: provider.company,
    movementCount:
      typeof provider.movementCount === "number" &&
      Number.isFinite(provider.movementCount)
        ? provider.movementCount
        : 0,
  };
  if (provider.accountId) out.accountId = provider.accountId;
  if (provider.type) out.type = provider.type;
  if (provider.category) out.category = provider.category;
  if (provider.createdAt) out.createdAt = provider.createdAt;
  if (provider.updatedAt) out.updatedAt = provider.updatedAt;
  if (provider.correonotifi) out.correonotifi = provider.correonotifi;
  if (provider.agent) out.agent = provider.agent;
  if (provider.visit) {
    out.visit = {
      createOrderDays: provider.visit.createOrderDays,
      receiveOrderDays: provider.visit.receiveOrderDays,
      frequency: provider.visit.frequency,
      ...(typeof provider.visit.startDateKey === "number" &&
      Number.isFinite(provider.visit.startDateKey)
        ? { startDateKey: provider.visit.startDateKey }
        : {}),
    };
  }
  return out;
};

const deriveNextCode = (nextCodeValue: unknown): number => {
  return typeof nextCodeValue === "number" &&
    Number.isFinite(nextCodeValue) &&
    nextCodeValue >= 0
    ? nextCodeValue
    : 0;
};

const providerNameKey = (value: string): string => {
  return encodeURIComponent(value.trim().toUpperCase()).slice(0, 1200);
};

export class ProvidersService {
  private static readonly COLLECTION_NAME = "proveedores";
  private static readonly PROVIDERS_SUBCOLLECTION = "items";
  private static readonly PROVIDER_NAMES_SUBCOLLECTION = "names";
  private static readonly CACHE_TTL_MS = 15_000;
  private static readonly providersCache = new Map<
    string,
    { expiresAt: number; providers: ProviderEntry[] }
  >();

  private static parentRef(company: string) {
    return doc(db, this.COLLECTION_NAME, company);
  }

  private static itemsRef(company: string) {
    return collection(
      db,
      this.COLLECTION_NAME,
      company,
      this.PROVIDERS_SUBCOLLECTION,
    );
  }

  private static itemRef(company: string, providerCode: string) {
    return doc(
      db,
      this.COLLECTION_NAME,
      company,
      this.PROVIDERS_SUBCOLLECTION,
      providerCode,
    );
  }

  private static nameRef(company: string, providerName: string) {
    return doc(
      db,
      this.COLLECTION_NAME,
      company,
      this.PROVIDER_NAMES_SUBCOLLECTION,
      providerNameKey(providerName),
    );
  }

  private static cloneProviders(providers: ProviderEntry[]): ProviderEntry[] {
    return (providers || []).map((p) => ({
      ...p,
      agent: p.agent ? { ...p.agent } : undefined,
      visit: p.visit
        ? {
            ...p.visit,
            createOrderDays: Array.isArray(p.visit.createOrderDays)
              ? [...p.visit.createOrderDays]
              : [],
            receiveOrderDays: Array.isArray(p.visit.receiveOrderDays)
              ? [...p.visit.receiveOrderDays]
              : [],
          }
        : undefined,
    }));
  }

  static async getProviders(company: string): Promise<ProviderEntry[]> {
    const trimmedCompany = (company || "").trim();
    if (!trimmedCompany) return [];

    const cached = this.providersCache.get(trimmedCompany);
    if (cached && cached.expiresAt > Date.now()) {
      return this.cloneProviders(cached.providers);
    }

    const snapshot = await getDocs(
      query(
        collection(
          db,
          this.COLLECTION_NAME,
          trimmedCompany,
          this.PROVIDERS_SUBCOLLECTION,
        ),
        orderBy("code", "desc"),
      ),
    );
    const normalized = snapshot.docs
      .map((item) => normalizeProviderEntry(item.data(), trimmedCompany))
      .filter((item): item is ProviderEntry => item !== null);

    this.providersCache.set(trimmedCompany, {
      expiresAt: Date.now() + this.CACHE_TTL_MS,
      providers: normalized,
    });
    return this.cloneProviders(normalized);
  }

  static async addProvider(
    company: string,
    providerName: string,
    providerType?: string,
    correonotifi?: string,
    agent?: ProviderEntry["agent"],
    visit?: ProviderEntry["visit"],
    accountId?: ProviderEntry["accountId"],
    explicitCategory?: "Ingreso" | "Gasto" | "Egreso",
  ): Promise<ProviderEntry> {
    const trimmedCompany = (company || "").trim();
    if (!trimmedCompany) {
      throw new Error("No se pudo determinar la empresa del usuario.");
    }

    const trimmedName = (providerName || "").trim();
    if (!trimmedName) throw new Error("El nombre del proveedor es obligatorio.");

    const normalizedName = trimmedName.toUpperCase();
    const normalizedType =
      typeof providerType === "string" && providerType.trim().length > 0
        ? providerType.trim().toUpperCase()
        : undefined;
    const sanitizedAgent = normalizeProviderAgent(agent);
    const sanitizedVisit = visit
      ? normalizeVisitConfig(visit as unknown)
      : undefined;
    const shouldPersistAgent = Boolean(
      sanitizedAgent &&
        (sanitizedAgent.name.length > 0 || sanitizedAgent.phone.length > 0),
    );
    const shouldPersistVisit = Boolean(
      normalizedType === "COMPRA INVENTARIO" &&
        sanitizedVisit &&
        sanitizedVisit.frequency &&
        sanitizedVisit.createOrderDays.length > 0 &&
        sanitizedVisit.receiveOrderDays.length > 0,
    );
    const now = new Date().toISOString();

    const parentRef = this.parentRef(trimmedCompany);
    const createdProvider = await runTransaction(db, async (transaction) => {
      const nameRef = this.nameRef(trimmedCompany, normalizedName);
      const nameSnapshot = await transaction.get(nameRef);
      if (nameSnapshot.exists()) {
        throw new Error("Ya existe un proveedor con ese nombre.");
      }

      const snapshot = await transaction.get(parentRef);
      const nextCode = snapshot.exists()
        ? deriveNextCode(snapshot.data().nextCode)
        : 0;
      const candidateCode = String(nextCode).padStart(4, "0");
      const candidateRef = this.itemRef(trimmedCompany, candidateCode);
      const candidateSnapshot = await transaction.get(candidateRef);
      if (candidateSnapshot.exists()) {
        throw new Error(
          "Ya existe un proveedor con el siguiente código disponible.",
        );
      }

      const provider: ProviderEntry = {
        code: candidateCode,
        name: normalizedName,
        company: trimmedCompany,
        accountId: normalizeProviderAccountId(accountId),
        type: normalizedType,
        category: explicitCategory || getCategoryFromType(normalizedType),
        createdAt: now,
        updatedAt: now,
        correonotifi:
          typeof correonotifi === "string" && correonotifi.trim().length > 0
            ? correonotifi.trim()
            : undefined,
        agent: shouldPersistAgent ? sanitizedAgent : undefined,
        visit: shouldPersistVisit ? sanitizedVisit : undefined,
        movementCount: 0,
      };

      transaction.set(
        parentRef,
        {
          company: trimmedCompany,
          nextCode: nextCode + 1,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      transaction.set(candidateRef, serializeProviderEntry(provider));
      transaction.set(nameRef, {
        code: candidateCode,
        name: normalizedName,
        updatedAt: serverTimestamp(),
      });
      return provider;
    });
    this.providersCache.delete(trimmedCompany);
    return createdProvider;
  }

  static async removeProvider(
    company: string,
    providerCode: string,
  ): Promise<ProviderEntry> {
    const trimmedCompany = (company || "").trim();
    if (!trimmedCompany) {
      throw new Error("No se pudo determinar la empresa del usuario.");
    }

    const normalizedCode = padCode(providerCode);
    if (!normalizedCode) throw new Error("Código de proveedor no válido.");

    const ref = this.itemRef(trimmedCompany, normalizedCode);
    const removedProvider = await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error("El proveedor no existe.");
      const provider = normalizeProviderEntry(snapshot.data(), trimmedCompany);
      if (!provider) throw new Error("El proveedor no existe.");
      transaction.delete(ref);
      transaction.delete(this.nameRef(trimmedCompany, provider.name));
      transaction.set(
        this.parentRef(trimmedCompany),
        { company: trimmedCompany, updatedAt: serverTimestamp() },
        { merge: true },
      );
      return provider;
    });
    this.providersCache.delete(trimmedCompany);
    return removedProvider;
  }

  static async incrementMovementCount(
    company: string,
    providerCode: string,
  ): Promise<ProviderEntry> {
    const trimmedCompany = (company || "").trim();
    if (!trimmedCompany) {
      throw new Error("No se pudo determinar la empresa del usuario.");
    }

    const normalizedCode = padCode(providerCode);
    if (!normalizedCode) throw new Error("Código de proveedor no válido.");

    const ref = this.itemRef(trimmedCompany, normalizedCode);
    const updated = await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error("El proveedor no existe.");
      const provider = normalizeProviderEntry(snapshot.data(), trimmedCompany);
      if (!provider) throw new Error("El proveedor no existe.");
      transaction.update(ref, { movementCount: increment(1) });
      return {
        ...provider,
        movementCount: (provider.movementCount ?? 0) + 1,
      };
    });

    this.providersCache.delete(trimmedCompany);
    return updated;
  }

  static async updateProvider(
    company: string,
    providerCode: string,
    providerName: string,
    providerType?: string,
    correonotifi?: string,
    agent?: ProviderEntry["agent"],
    visit?: ProviderEntry["visit"],
    accountId?: ProviderEntry["accountId"],
    explicitCategory?: "Ingreso" | "Gasto" | "Egreso",
  ): Promise<ProviderEntry> {
    const trimmedCompany = (company || "").trim();
    if (!trimmedCompany) {
      throw new Error("No se pudo determinar la empresa del usuario.");
    }

    const code = padCode(providerCode);
    if (!code) throw new Error("Código de proveedor no válido.");

    const trimmedName = (providerName || "").trim();
    if (!trimmedName) throw new Error("El nombre del proveedor es obligatorio.");

    const normalizedName = trimmedName.toUpperCase();
    const normalizedType =
      typeof providerType === "string" && providerType.trim().length > 0
        ? providerType.trim().toUpperCase()
        : undefined;
    const sanitizedAgent = normalizeProviderAgent(agent);
    const sanitizedVisit = visit
      ? normalizeVisitConfig(visit as unknown)
      : undefined;
    const shouldPersistAgent = Boolean(
      sanitizedAgent &&
        (sanitizedAgent.name.length > 0 || sanitizedAgent.phone.length > 0),
    );
    const shouldPersistVisit = Boolean(
      normalizedType === "COMPRA INVENTARIO" &&
        sanitizedVisit &&
        sanitizedVisit.frequency &&
        sanitizedVisit.createOrderDays.length > 0 &&
        sanitizedVisit.receiveOrderDays.length > 0,
    );

    const ref = this.itemRef(trimmedCompany, code);
    const updatedProvider = await runTransaction(db, async (transaction) => {
      const latestSnapshot = await transaction.get(ref);
      if (!latestSnapshot.exists()) throw new Error("El proveedor no existe.");
      const latest = normalizeProviderEntry(
        latestSnapshot.data(),
        trimmedCompany,
      );
      if (!latest) throw new Error("El proveedor no existe.");

      const previousNameKey = providerNameKey(latest.name);
      const nextNameKey = providerNameKey(normalizedName);
      if (previousNameKey !== nextNameKey) {
        const nextNameRef = this.nameRef(trimmedCompany, normalizedName);
        const nextNameSnapshot = await transaction.get(nextNameRef);
        if (nextNameSnapshot.exists()) {
          throw new Error("Ya existe un proveedor con ese nombre.");
        }
        transaction.delete(this.nameRef(trimmedCompany, latest.name));
        transaction.set(nextNameRef, {
          code,
          name: normalizedName,
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(
          this.nameRef(trimmedCompany, normalizedName),
          { code, name: normalizedName, updatedAt: serverTimestamp() },
          { merge: true },
        );
      }

      const provider: ProviderEntry = {
        ...latest,
        name: normalizedName,
        accountId: normalizeProviderAccountId(accountId),
        type: normalizedType,
        category: explicitCategory || getCategoryFromType(normalizedType),
        updatedAt: new Date().toISOString(),
        correonotifi:
          typeof correonotifi === "string" && correonotifi.trim().length > 0
            ? correonotifi.trim()
            : undefined,
        agent: shouldPersistAgent ? sanitizedAgent : undefined,
        visit: shouldPersistVisit ? sanitizedVisit : undefined,
        movementCount: latest.movementCount ?? 0,
      };

      transaction.set(ref, serializeProviderEntry(provider));
      transaction.set(
        this.parentRef(trimmedCompany),
        { company: trimmedCompany, updatedAt: serverTimestamp() },
        { merge: true },
      );
      return provider;
    });
    this.providersCache.delete(trimmedCompany);
    return updatedProvider;
  }
}
