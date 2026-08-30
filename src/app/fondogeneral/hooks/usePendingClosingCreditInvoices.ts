import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  FacturasService,
  type FacturaMovement,
  type PendingFacturaPage,
} from "@/services/facturas";
import { isFacturaPendingForClosing } from "@/lib/factura-pending";

interface Props {
  company: string;
  enabled: boolean;
}

const PAGE_SIZE = 50;

const isCreditInvoice = (movement: FacturaMovement) =>
  movement.invoiceDocType === "FCR";

const isCreditNote = (movement: FacturaMovement) =>
  movement.invoiceDocType === "NC";

const isZeroAmountCreditNote = (movement: FacturaMovement) => {
  const amount = Number(movement.amount);
  return (
    isCreditNote(movement) &&
    Number.isFinite(amount) &&
    Math.round(amount * 100) === 0
  );
};

const mergeById = (
  current: FacturaMovement[],
  incoming: FacturaMovement[],
) => {
  const merged = new Map(current.map((movement) => [movement.id, movement]));
  incoming.forEach((movement) => merged.set(movement.id, movement));
  return Array.from(merged.values());
};

export function usePendingClosingCreditInvoices({ company, enabled }: Props) {
  const [pendingMovements, setPendingMovements] =
    useState<FacturaMovement[]>([]);
  const [pendingInvoicesLoading, setPendingInvoicesLoading] = useState(false);
  const [pendingInvoicesError, setPendingInvoicesError] = useState("");
  const [hasMorePendingInvoices, setHasMorePendingInvoices] = useState(false);
  const cursorRef = useRef<PendingFacturaPage["cursor"]>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(false);
  const requestVersionRef = useRef(0);

  const loadPage = useCallback(
    async (append: boolean) => {
      if (!enabled || !company || loadingRef.current) return;
      if (append && !hasMoreRef.current) return;

      const requestVersion = requestVersionRef.current;
      loadingRef.current = true;
      setPendingInvoicesLoading(true);
      setPendingInvoicesError("");

      try {
        const page = await FacturasService.listPendingForClosingPage(company, {
          pageSize: PAGE_SIZE,
          cursor: append ? cursorRef.current : null,
        });
        if (requestVersion !== requestVersionRef.current) return;

        const indexedPending = page.items.filter(isFacturaPendingForClosing);
        setPendingMovements((current) =>
          append ? mergeById(current, indexedPending) : indexedPending,
        );
        cursorRef.current = page.cursor;
        hasMoreRef.current = !page.exhausted;
        setHasMorePendingInvoices(!page.exhausted);
      } catch (error) {
        if (requestVersion !== requestVersionRef.current) return;
        console.error("[FONDO] Error loading pending credit invoices:", error);
        setPendingInvoicesError(
          "No se pudieron cargar las facturas pendientes.",
        );
      } finally {
        if (requestVersion === requestVersionRef.current) {
          loadingRef.current = false;
          setPendingInvoicesLoading(false);
        }
      }
    },
    [company, enabled],
  );

  useEffect(() => {
    requestVersionRef.current += 1;
    loadingRef.current = false;
    cursorRef.current = null;
    hasMoreRef.current = false;
    setPendingMovements([]);
    setHasMorePendingInvoices(false);
    setPendingInvoicesError("");
    setPendingInvoicesLoading(false);

    if (enabled && company) {
      void loadPage(false);
    }

    return () => {
      requestVersionRef.current += 1;
    };
  }, [company, enabled, loadPage]);

  const pendingClosingCreditInvoices = useMemo(
    () => pendingMovements.filter(isCreditInvoice),
    [pendingMovements],
  );
  const pendingCreditNotes = useMemo(
    () => pendingMovements.filter(isCreditNote),
    [pendingMovements],
  );
  const pendingZeroAmountCreditNotes = useMemo(
    () => pendingMovements.filter(isZeroAmountCreditNote),
    [pendingMovements],
  );

  const replaceMatching = useCallback(
    (
      predicate: (movement: FacturaMovement) => boolean,
      update: SetStateAction<FacturaMovement[]>,
    ) => {
      setPendingMovements((current) => {
        const matching = current.filter(predicate);
        const replacement =
          typeof update === "function" ? update(matching) : update;
        return [
          ...replacement,
          ...current.filter((movement) => !predicate(movement)),
        ];
      });
    },
    [],
  );

  const setPendingClosingCreditInvoices = useCallback<
    Dispatch<SetStateAction<FacturaMovement[]>>
  >(
    (update) => replaceMatching(isCreditInvoice, update),
    [replaceMatching],
  );
  const setPendingCreditNotes = useCallback<
    Dispatch<SetStateAction<FacturaMovement[]>>
  >(
    (update) => replaceMatching(isCreditNote, update),
    [replaceMatching],
  );
  const setPendingZeroAmountCreditNotes = useCallback<
    Dispatch<SetStateAction<FacturaMovement[]>>
  >(
    (update) => replaceMatching(isZeroAmountCreditNote, update),
    [replaceMatching],
  );

  const loadMorePendingInvoices = useCallback(
    () => loadPage(true),
    [loadPage],
  );
  const reloadPendingInvoices = useCallback(
    () => loadPage(false),
    [loadPage],
  );

  return {
    pendingClosingCreditInvoices,
    setPendingClosingCreditInvoices,
    pendingCreditNotes,
    setPendingCreditNotes,
    pendingZeroAmountCreditNotes,
    setPendingZeroAmountCreditNotes,
    pendingInvoicesLoading,
    pendingInvoicesError,
    hasMorePendingInvoices,
    loadMorePendingInvoices,
    reloadPendingInvoices,
  };
}
