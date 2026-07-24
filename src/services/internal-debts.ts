import { doc, runTransaction } from "firebase/firestore";
import { db } from "@/config/firebase";
import { FirestoreService } from "./firestore";

export type InternalDebtPartyType = "empresa" | "user" | "empleado";
export type InternalDebtStatus = "open" | "paid";
export type InternalDebtMovementType = "charge" | "payment";

export interface InternalDebtParty {
  type: InternalDebtPartyType;
  id: string;
  name: string;
  roleLabel?: string;
}

export interface InternalDebtMovement {
  id: string;
  type: InternalDebtMovementType;
  amount: number;
  reason: string;
  reference?: string;
  date: string;
  createdAt: Date;
  createdById: string;
  createdByName: string;
}

export interface InternalDebt {
  id?: string;
  ownerId: string;
  debtor: InternalDebtParty;
  creditor: InternalDebtParty;
  participantIds: string[];
  amountOriginal: number;
  balance: number;
  reason: string;
  reference?: string;
  date: string;
  status: InternalDebtStatus;
  movements: InternalDebtMovement[];
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  createdByName: string;
}

export interface CreateInternalDebtInput {
  ownerId: string;
  debtor: InternalDebtParty;
  creditor: InternalDebtParty;
  amount: number;
  reason: string;
  reference?: string;
  date: string;
  createdById: string;
  createdByName: string;
  actorPartyKeys: string[];
}

export interface AddInternalDebtMovementInput {
  type: InternalDebtMovementType;
  amount: number;
  reason: string;
  reference?: string;
  date: string;
  createdById: string;
  createdByName: string;
}

const COLLECTION_NAME = "internalDebts";

const createId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeText = (value: string, fieldName: string): string => {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${fieldName} es requerido.`);
  return normalized;
};

const normalizeAmount = (amount: number): number => {
  const value = Number(amount);
  if (!Number.isFinite(value) || amount <= 0) {
    throw new Error("El monto debe ser mayor a cero.");
  }
  return Math.round(value * 100) / 100;
};

const optionalTextField = (key: string, value?: string): Record<string, string> => {
  const normalized = String(value || "").trim();
  return normalized ? { [key]: normalized } : {};
};

export function buildPartyKey(party: InternalDebtParty): string {
  const type = normalizeText(party.type, "Tipo de parte");
  const id = normalizeText(party.id, "Id de parte");
  return `${type}:${id}`;
}

export function createInternalDebtDraft(
  input: CreateInternalDebtInput,
): Omit<InternalDebt, "id"> {
  const ownerId = normalizeText(input.ownerId, "ownerId");
  const debtorKey = buildPartyKey(input.debtor);
  const creditorKey = buildPartyKey(input.creditor);

  if (debtorKey === creditorKey) {
    throw new Error("El deudor y el acreedor deben ser diferentes.");
  }
  if (!input.actorPartyKeys.includes(debtorKey)) {
    throw new Error("Solo el deudor puede registrar la deuda.");
  }

  const amount = normalizeAmount(input.amount);
  const reason = normalizeText(input.reason, "Motivo");
  const date = normalizeText(input.date, "Fecha");
  const createdById = normalizeText(input.createdById, "Usuario");
  const createdByName = normalizeText(input.createdByName, "Nombre de usuario");
  const now = new Date();
  const initialMovement: InternalDebtMovement = {
    id: createId(),
    type: "charge",
    amount,
    reason,
    ...optionalTextField("reference", input.reference),
    date,
    createdAt: now,
    createdById,
    createdByName,
  };

  return {
    ownerId,
    debtor: {
      type: input.debtor.type,
      id: input.debtor.id,
      name: normalizeText(input.debtor.name, "Deudor"),
      ...optionalTextField("roleLabel", input.debtor.roleLabel),
    },
    creditor: {
      type: input.creditor.type,
      id: input.creditor.id,
      name: normalizeText(input.creditor.name, "Acreedor"),
      ...optionalTextField("roleLabel", input.creditor.roleLabel),
    },
    participantIds: Array.from(
      new Set([debtorKey, creditorKey, ...input.actorPartyKeys]),
    ),
    amountOriginal: amount,
    balance: amount,
    reason,
    ...optionalTextField("reference", input.reference),
    date,
    status: "open",
    movements: [initialMovement],
    createdAt: now,
    updatedAt: now,
    createdById,
    createdByName,
  };
}

export function applyInternalDebtMovement(
  debt: InternalDebt,
  movement: AddInternalDebtMovementInput,
  actorPartyKeys: string[],
): InternalDebt {
  const debtorKey = buildPartyKey(debt.debtor);
  const creditorKey = buildPartyKey(debt.creditor);
  const amount = normalizeAmount(movement.amount);

  if (debt.status === "paid" || debt.balance <= 0) {
    throw new Error("La deuda ya esta pagada y no se puede modificar.");
  }
  if (movement.type === "charge" && !actorPartyKeys.includes(debtorKey)) {
    throw new Error("Solo el deudor puede agregar cargos.");
  }
  if (movement.type === "payment" && !actorPartyKeys.includes(creditorKey)) {
    throw new Error("Solo el acreedor puede registrar abonos.");
  }
  if (movement.type === "payment" && amount > debt.balance) {
    throw new Error("El abono no puede exceder el saldo pendiente.");
  }

  const reason = normalizeText(movement.reason, "Motivo");
  const createdById = normalizeText(movement.createdById, "Usuario");
  const createdByName = normalizeText(movement.createdByName, "Nombre de usuario");
  const date = normalizeText(movement.date, "Fecha");
  const balance =
    movement.type === "payment" ? debt.balance - amount : debt.balance + amount;
  const nextMovement: InternalDebtMovement = {
    id: createId(),
    type: movement.type,
    amount,
    reason,
    ...optionalTextField("reference", movement.reference),
    date,
    createdAt: new Date(),
    createdById,
    createdByName,
  };

  return {
    ...debt,
    balance: Math.max(0, Math.round(balance * 100) / 100),
    status: balance <= 0 ? "paid" : "open",
    movements: [...(debt.movements || []), nextMovement],
    updatedAt: new Date(),
  };
}

export class InternalDebtsService {
  static async getByOwnerAndParticipant(
    ownerId: string,
    actorPartyKey: string,
  ): Promise<InternalDebt[]> {
    const normalizedOwnerId = String(ownerId || "").trim();
    const normalizedPartyKey = String(actorPartyKey || "").trim();
    if (!normalizedOwnerId || !normalizedPartyKey) return [];
    return (await FirestoreService.query(
      COLLECTION_NAME,
      [
        { field: "ownerId", operator: "==", value: normalizedOwnerId },
        { field: "participantIds", operator: "array-contains", value: normalizedPartyKey },
      ],
    )) as InternalDebt[];
  }

  static async getVisibleDebts(
    ownerId: string,
    actorPartyKeys: string[],
  ): Promise<InternalDebt[]> {
    const normalizedOwnerId = String(ownerId || "").trim();
    if (!normalizedOwnerId || actorPartyKeys.length === 0) return [];
    const readablePartyKeys = actorPartyKeys.filter((key) =>
      String(key || "").startsWith("user:"),
    );
    if (readablePartyKeys.length === 0) return [];
    const batches = await Promise.all(
      readablePartyKeys.map((key) =>
        this.getByOwnerAndParticipant(normalizedOwnerId, key),
      ),
    );
    const byId = new Map<string, InternalDebt>();
    for (const debt of batches.flat()) {
      if (!debt.id) continue;
      byId.set(debt.id, debt);
    }
    return Array.from(byId.values()).sort(
      (a, b) =>
        new Date((b.updatedAt as unknown as string) || 0).getTime() -
        new Date((a.updatedAt as unknown as string) || 0).getTime(),
    );
  }

  static async createDebt(input: CreateInternalDebtInput): Promise<string> {
    const draft = createInternalDebtDraft(input);
    return FirestoreService.add(COLLECTION_NAME, draft);
  }

  static async addMovement(
    debtId: string,
    movement: AddInternalDebtMovementInput,
    actorPartyKeys: string[],
  ): Promise<void> {
    const id = normalizeText(debtId, "Id de deuda");
    const debtRef = doc(db, COLLECTION_NAME, id);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(debtRef);
      if (!snapshot.exists()) throw new Error("Deuda no encontrada.");
      const current = { id: snapshot.id, ...snapshot.data() } as InternalDebt;
      const updated = applyInternalDebtMovement(
        current,
        movement,
        actorPartyKeys,
      );
      transaction.update(debtRef, {
        balance: updated.balance,
        status: updated.status,
        movements: updated.movements,
        updatedAt: updated.updatedAt,
      });
    });
  }
}
