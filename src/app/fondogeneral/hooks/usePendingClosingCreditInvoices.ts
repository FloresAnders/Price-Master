import { useEffect, useState } from "react";
import {
  FacturasService,
  type FacturaMovement,
} from "@/services/facturas";
import { normalizeInvoiceDocType } from "../utils/helpers";

interface Props {
  company: string;
}

export function usePendingClosingCreditInvoices({ company }: Props) {
  const [pendingClosingCreditInvoices, setPendingClosingCreditInvoices] =
    useState<FacturaMovement[]>([]);
  const [pendingZeroAmountCreditNotes, setPendingZeroAmountCreditNotes] =
    useState<FacturaMovement[]>([]);

  useEffect(() => {
    let cancelled = false;

    if (!company) {
      setPendingClosingCreditInvoices([]);
      setPendingZeroAmountCreditNotes([]);
      return () => {
        cancelled = true;
      };
    }

    FacturasService.listMovementsByEmpresa(company, { limit: 800 })
      .then((movements) => {
        if (cancelled) return;
        const pending = movements
          .filter((movement) => {
            if (normalizeInvoiceDocType(movement.invoiceDocType) !== "FCR") {
              return false;
            }
            const totalAmount = Math.max(
              0,
              Math.trunc(Number(movement.originalAmount ?? movement.amount) || 0),
            );
            const paidAmount = Math.max(
              0,
              Math.trunc(Number(movement.paidAmount) || 0),
            );
            const balanceDue = Math.max(
              0,
              Math.trunc(
                Number(movement.balanceDue ?? totalAmount - paidAmount) || 0,
              ),
            );
            return (
              balanceDue > 0 &&
              !["PAGADA", "REBAJADA"].includes(
                String(movement.paymentStatus || "").toUpperCase(),
              )
            );
          })
          .sort((a, b) => {
            const aDate = new Date(a.createdAt || 0).getTime();
            const bDate = new Date(b.createdAt || 0).getTime();
            return bDate - aDate;
          });
        setPendingClosingCreditInvoices(pending);
        const pendingZeroNotes = movements.filter((movement) => {
          if (normalizeInvoiceDocType(movement.invoiceDocType) !== "NC") {
            return false;
          }
          if (Math.max(0, Math.trunc(Number(movement.amount) || 0)) !== 0) {
            return false;
          }
          return !["PAGADA", "REBAJADA"].includes(
            String(movement.paymentStatus || "PENDIENTE").toUpperCase(),
          );
        });
        setPendingZeroAmountCreditNotes(pendingZeroNotes);
      })
      .catch((error) => {
        console.error("[FONDO] Error loading pending credit invoices:", error);
        if (!cancelled) {
          setPendingClosingCreditInvoices([]);
          setPendingZeroAmountCreditNotes([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [company]);

  return {
    pendingClosingCreditInvoices,
    setPendingClosingCreditInvoices,
    pendingZeroAmountCreditNotes,
    setPendingZeroAmountCreditNotes,
  };
}
