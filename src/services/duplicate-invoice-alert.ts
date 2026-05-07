import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { buildDuplicateInvoiceAlertEmailTemplate } from "./email-templates/duplicate-invoice-alert";
import { MovimientosFondosService } from "./movimientos-fondos";
import { UsersService } from "./users";

type Currency = "CRC" | "USD";

export type DuplicateInvoiceAlertCurrentEntry = {
  providerCode: string;
  manager: string;
  amountEgreso: number;
  amountIngreso: number;
  currency?: Currency;
  createdAt: string;
  notes?: string;
  invoiceNumber: string;
};

export type DuplicateInvoiceAlertPreviousEntry = {
  providerCode: string;
  manager: string;
  amountEgreso: number;
  amountIngreso: number;
  currency: Currency;
  createdAt: string;
  notes?: string;
};

export type DuplicateInvoiceMovementSnapshot = {
  id: string;
  providerCode: string;
  paymentType: string;
  manager: string;
  notes: string;
  createdAt: string;
  invoiceNumber: string;
  amountEgreso: number;
  amountIngreso: number;
  currency: Currency;
};

export type SendDuplicateInvoiceAlertParams = {
  company: string;
  ownerAdminEmail?: string | null;
  activeOwnerId?: string | null;
  userEmail?: string | null;
  currentEntry: DuplicateInvoiceAlertCurrentEntry;
  previousEntry: DuplicateInvoiceAlertPreviousEntry;
  resolveProviderName?: (providerCode: string) => string;
};

const isInventoryPurchasePaymentType = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toUpperCase();
  return (
    normalized === "COMPRA INVENTARIO" || normalized === "COMPRA DE INVENTARIO"
  );
};

export const findLatestMovementByInvoiceNumber = async (
  normalizedCompany: string,
  invoice: string,
  providerCode: string,
): Promise<DuplicateInvoiceMovementSnapshot | null> => {
  try {
    if (!normalizedCompany || !invoice || !providerCode) return null;

    const docKey =
      MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);
    if (!docKey) return null;

    const movementsRef = collection(
      db,
      "MovimientosFondos",
      docKey,
      MovimientosFondosService.MOVEMENTS_SUBCOLLECTION,
    );
    const duplicateQuery = query(
      movementsRef,
      where("invoiceNumber", "==", invoice),
      where("providerCode", "==", providerCode),
    );
    const snapshot = await getDocs(duplicateQuery);

    if (snapshot.empty) return null;

    let latest: DuplicateInvoiceMovementSnapshot | null = null;
    let latestTs = -Infinity;

    snapshot.forEach((movementDoc) => {
      const data = movementDoc.data() as {
        providerCode?: unknown;
        paymentType?: unknown;
        manager?: unknown;
        notes?: unknown;
        createdAt?: unknown;
        invoiceNumber?: unknown;
        amountEgreso?: unknown;
        amountIngreso?: unknown;
        currency?: unknown;
      };
      const createdAt = String(data.createdAt || "");
      const parsedTs = new Date(createdAt).getTime();
      const ts = Number.isFinite(parsedTs) ? parsedTs : 0;

      const candidate: DuplicateInvoiceMovementSnapshot = {
        id: movementDoc.id,
        providerCode: String(data.providerCode || ""),
        paymentType: String(data.paymentType || ""),
        manager: String(data.manager || ""),
        notes: String(data.notes || ""),
        createdAt,
        invoiceNumber: String(data.invoiceNumber || invoice),
        amountEgreso: Math.trunc(Number(data.amountEgreso || 0)) || 0,
        amountIngreso: Math.trunc(Number(data.amountIngreso || 0)) || 0,
        currency: data.currency === "USD" ? "USD" : "CRC",
      };

      // Solo considerar movimientos de compra inventario para detectar el "anterior".
      if (!isInventoryPurchasePaymentType(candidate.paymentType)) {
        return;
      }

      if (
        !latest ||
        ts > latestTs ||
        (ts === latestTs && candidate.id.localeCompare(latest.id) > 0)
      ) {
        latest = candidate;
        latestTs = ts;
      }
    });

    return latest;
  } catch (error) {
    console.error(
      "[INVOICE-DUPLICATE] Error consultando invoiceNumber en movimientos:",
      error,
    );
    return null;
  }
};

export const sendDuplicateInvoiceAlertEmail = async (
  params: SendDuplicateInvoiceAlertParams,
): Promise<void> => {
  try {
    const normalizedCompany = (params.company || "").trim();
    const recipients = new Set<string>();

    const adminRecipient = (params.ownerAdminEmail || "").trim();
    if (adminRecipient.length > 0) {
      recipients.add(adminRecipient);
    } else {
      const fallbackOwnerId = (params.activeOwnerId || "").trim();
      if (fallbackOwnerId.length > 0) {
        const fallbackAdmin =
          await UsersService.getPrimaryAdminByOwner(fallbackOwnerId);
        const fallbackEmail =
          typeof fallbackAdmin?.email === "string"
            ? fallbackAdmin.email.trim()
            : "";
        if (fallbackEmail.length > 0) recipients.add(fallbackEmail);
      }
    }

    const userRecipient = (params.userEmail || "").trim();
    if (userRecipient.length > 0) recipients.add(userRecipient);

    if (recipients.size === 0) {
      console.log(
        "[INVOICE-DUPLICATE] Coincidencia detectada, pero no hay destinatarios de correo configurados.",
        {
          company: normalizedCompany,
          invoiceNumber: params.currentEntry.invoiceNumber,
        },
      );
      return;
    }

    const resolveProviderName =
      params.resolveProviderName ?? ((providerCode: string) => providerCode);

    const currentProviderName = resolveProviderName(
      params.currentEntry.providerCode,
    );
    const previousProviderName = resolveProviderName(
      params.previousEntry.providerCode,
    );

    const currentAmount =
      params.currentEntry.amountIngreso > 0
        ? params.currentEntry.amountIngreso
        : params.currentEntry.amountEgreso;
    const previousAmount =
      params.previousEntry.amountIngreso > 0
        ? params.previousEntry.amountIngreso
        : params.previousEntry.amountEgreso;

    const emailTemplate = buildDuplicateInvoiceAlertEmailTemplate({
      company: normalizedCompany,
      invoiceNumber: params.currentEntry.invoiceNumber,
      currentMovement: {
        providerName: currentProviderName,
        manager: params.currentEntry.manager,
        amount: currentAmount,
        currency: params.currentEntry.currency === "USD" ? "USD" : "CRC",
        createdAt: params.currentEntry.createdAt,
        notes: params.currentEntry.notes,
      },
      previousMovement: {
        providerName: previousProviderName,
        manager: params.previousEntry.manager,
        amount: previousAmount,
        currency: params.previousEntry.currency,
        createdAt: params.previousEntry.createdAt,
        notes: params.previousEntry.notes,
      },
    });

    for (const recipient of recipients) {
      try {
        const mailDoc = await addDoc(collection(db, "mail"), {
          to: recipient,
          subject: emailTemplate.subject,
          text: emailTemplate.text,
          html: emailTemplate.html,
          createdAt: serverTimestamp(),
        });

        console.log(
          `[INVOICE-DUPLICATE] Correo de alerta encolado para ${recipient}. mailId=${mailDoc.id}`,
        );
      } catch (mailError) {
        console.error(
          `[INVOICE-DUPLICATE] Error encolando correo para ${recipient}:`,
          mailError,
        );
      }
    }
  } catch (error) {
    console.error(
      "[INVOICE-DUPLICATE] Error preparando alerta de invoice repetido:",
      error,
    );
  }
};
