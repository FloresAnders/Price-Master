import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import { generateMovementNotificationEmail } from "../../../services/email-templates/notificacion-movimiento";
import type { FondoEntry } from "../types";
import type { ToastType } from "@/components/layout/ToastContext";

export async function sendMovementNotification(
  entry: FondoEntry,
  operationType: "create" | "edit",
  company: string | null,
  providers: { code: string; name?: string; correonotifi?: string }[],
  showToast: (msg: string, type?: ToastType, duration?: number) => void,
): Promise<void> {
  try {
    const provider = providers.find((p) => p.code === entry.providerCode);
    if (!provider?.correonotifi || provider.correonotifi.trim().length === 0) {
      return;
    }

    const providerName = provider.name || entry.providerCode;
    const amount =
      entry.amountEgreso > 0 ? entry.amountEgreso : entry.amountIngreso;
    const amountType: "Egreso" | "Ingreso" =
      entry.amountEgreso > 0 ? "Egreso" : "Ingreso";
    const currency = (entry.currency as "CRC" | "USD") || "CRC";

    const emailContent = generateMovementNotificationEmail({
      company: company || "",
      providerName,
      providerCode: entry.providerCode,
      paymentType: entry.paymentType,
      invoiceNumber: entry.invoiceNumber,
      amount,
      amountType,
      currency,
      manager: entry.manager,
      notes: entry.notes,
      createdAt: entry.createdAt,
      operationType,
    });

    try {
      const docRef = await addDoc(collection(db, "mail"), {
        to: provider.correonotifi,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
        createdAt: serverTimestamp(),
      });
      console.log(
        `[MAIL-DOC] Documento creado en 'mail' para movimiento: ${docRef.id}`,
      );
      showToast("Correo de notificación enviado correctamente", "success");
    } catch (err) {
      console.error(
        '[MAIL-DOC] Error creando documento en "mail" para movimiento:',
        err,
      );
      showToast("Error al enviar correo de notificación", "error");
    }
  } catch (err) {
    console.error(
      "[EMAIL-NOTIFICATION] Error preparing notification:",
      err,
    );
  }
}
