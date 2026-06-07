import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { DailyClosingsService, DailyClosingRecord } from "@/services/daily-closings";
import {
  buildDailyClosingStorageKey,
  sanitizeDailyClosings,
  dailyClosingSortValue,
} from "../../utils/helpers";
import type { MovementAccountKey } from "@/services/movimientos-fondos";
import type { DailyClosingFormValues } from "../../components/modals/DailyClosingModal";

interface Props {
  company: string;
  accountKey: MovementAccountKey;
}

export function useDailyClosingState({ company, accountKey }: Props) {
  const [dailyClosingModalOpen, setDailyClosingModalOpen] = useState(false);
  const [editingDailyClosingId, setEditingDailyClosingId] = useState<string | null>(null);
  const [dailyClosingInitialValues, setDailyClosingInitialValues] =
    useState<DailyClosingFormValues | null>(null);
  const [dailyClosings, setDailyClosings] = useState<DailyClosingRecord[]>([]);
  const [dailyClosingsHydrated, setDailyClosingsHydrated] = useState(false);
  const [dailyClosingsRefreshing, setDailyClosingsRefreshing] = useState(false);
  const [dailyClosingHistoryOpen, setDailyClosingHistoryOpen] = useState(false);
  const [dailyClosingHistoryRange, setDailyClosingHistoryRange] = useState<string>("today");

  const dailyClosingsRequestCountRef = useRef(0);
  const dailyClosingHistoryRequestIdRef = useRef(0);
  const loadedDailyClosingKeysRef = useRef<Set<string>>(new Set());
  const loadingDailyClosingKeysRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const closingsStorageKey = useMemo(() => {
    if (accountKey !== "FondoGeneral") return null;
    const normalizedCompany = (company || "").trim();
    if (normalizedCompany.length === 0) return null;
    return buildDailyClosingStorageKey(normalizedCompany, accountKey);
  }, [company, accountKey]);

  const beginDailyClosingsRequest = useCallback(() => {
    dailyClosingsRequestCountRef.current += 1;
    setDailyClosingsRefreshing(true);
  }, []);

  const finishDailyClosingsRequest = useCallback(() => {
    dailyClosingsRequestCountRef.current = Math.max(
      0,
      dailyClosingsRequestCountRef.current - 1,
    );
    if (!isMountedRef.current) return;
    if (dailyClosingsRequestCountRef.current === 0) {
      setDailyClosingsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadedDailyClosingKeysRef.current = new Set();
    loadingDailyClosingKeysRef.current = new Set();
    dailyClosingsRequestCountRef.current = 0;
    dailyClosingHistoryRequestIdRef.current += 1;
    setDailyClosingsRefreshing(false);
    setDailyClosingsHydrated(false);
    setDailyClosings([]);
  }, [company, accountKey]);

  const resolveDailyClosingRangeBounds = useCallback(
    (range: string): { fromTs: number; toTs: number } | null => {
      if (!range || range === "todo") return null;
      const now = new Date();
      let from: Date | null = null;
      let to: Date | null = null;

      if (range === "today") {
        const t = new Date(now);
        from = t;
        to = t;
      } else if (range === "yesterday") {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        from = y;
        to = y;
      } else if (range === "thisweek") {
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(d);
        start.setDate(diff);
        from = start;
        to = new Date(now);
      } else if (range === "lastweek") {
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
        const start = new Date(d);
        start.setDate(diff);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        from = start;
        to = end;
      } else if (range === "lastmonth") {
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0);
      } else if (range === "month") {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else if (range === "last30") {
        const end = new Date(now);
        const start = new Date(now);
        start.setDate(start.getDate() - 29);
        from = start;
        to = end;
      }

      if (!from || !to) return null;
      const fromTs = new Date(
        from.getFullYear(),
        from.getMonth(),
        from.getDate(),
        0, 0, 0, 0,
      ).getTime();
      const toTs = new Date(
        to.getFullYear(),
        to.getMonth(),
        to.getDate(),
        23, 59, 59, 999,
      ).getTime();
      return { fromTs, toTs };
    },
    [],
  );

  const loadDailyClosingsForHistoryRange = useCallback(
    async (range: string) => {
      if (accountKey !== "FondoGeneral") {
        setDailyClosings([]);
        setDailyClosingsHydrated(true);
        return;
      }

      const normalizedCompany = (company || "").trim();
      if (normalizedCompany.length === 0) {
        setDailyClosings([]);
        setDailyClosingsHydrated(true);
        return;
      }

      const resolvedRange = range && range.length > 0 ? range : "today";

      dailyClosingHistoryRequestIdRef.current += 1;
      const requestId = dailyClosingHistoryRequestIdRef.current;
      setDailyClosingsHydrated(false);
      beginDailyClosingsRequest();

      try {
        const bounds = resolveDailyClosingRangeBounds(resolvedRange);
        const document =
          await DailyClosingsService.getDocument(normalizedCompany);
        if (!isMountedRef.current) return;
        if (requestId !== dailyClosingHistoryRequestIdRef.current) return;

        const base = document
          ? DailyClosingsService.extractAllClosings(document)
          : [];

        if (closingsStorageKey) {
          try {
            localStorage.setItem(closingsStorageKey, JSON.stringify(base));
          } catch (storageErr) {
            console.error("Error storing daily closings:", storageErr);
          }
        }
        const filtered = bounds
          ? base.filter((record) => {
              const ts = Date.parse(record?.closingDate ?? "");
              if (Number.isNaN(ts)) return true;
              if (ts < bounds.fromTs) return false;
              if (ts > bounds.toTs) return false;
              return true;
            })
          : base;
        setDailyClosings(filtered);
      } catch (err) {
        console.error("Error reading daily closings from Firestore:", err);
        if (!isMountedRef.current) return;
        if (requestId !== dailyClosingHistoryRequestIdRef.current) return;

        try {
          if (closingsStorageKey) {
            const stored = localStorage.getItem(closingsStorageKey);
            if (stored) {
              const parsed = JSON.parse(stored) as unknown;
              const all = sanitizeDailyClosings(parsed);
              const bounds = resolveDailyClosingRangeBounds(resolvedRange);
              const filtered = bounds
                ? all.filter((record) => {
                    const ts = Date.parse(record?.closingDate ?? "");
                    if (Number.isNaN(ts)) return true;
                    if (ts < bounds.fromTs) return false;
                    if (ts > bounds.toTs) return false;
                    return true;
                  })
                : all;
              setDailyClosings(filtered);
            } else {
              setDailyClosings([]);
            }
          } else {
            setDailyClosings([]);
          }
        } catch (storageErr) {
          console.error("Error reading stored daily closings:", storageErr);
          setDailyClosings([]);
        }
      } finally {
        if (
          isMountedRef.current &&
          requestId === dailyClosingHistoryRequestIdRef.current
        ) {
          setDailyClosingsHydrated(true);
        }
        finishDailyClosingsRequest();
      }
    },
    [
      accountKey,
      company,
      closingsStorageKey,
      beginDailyClosingsRequest,
      finishDailyClosingsRequest,
      resolveDailyClosingRangeBounds,
    ],
  );

  useEffect(() => {
    if (!dailyClosingHistoryOpen) return;
    void loadDailyClosingsForHistoryRange(dailyClosingHistoryRange);
  }, [
    dailyClosingHistoryOpen,
    dailyClosingHistoryRange,
    loadDailyClosingsForHistoryRange,
  ]);

  const latestDailyClosing = useMemo(() => {
    if (!dailyClosings || dailyClosings.length === 0) return null;
    const sorted = dailyClosings
      .slice()
      .sort((a, b) => dailyClosingSortValue(b) - dailyClosingSortValue(a));
    return sorted[0] ?? null;
  }, [dailyClosings]);

  const latestDailyClosingLabel = useMemo(() => {
    if (!latestDailyClosing) return "";
    try {
      const localDailyClosingDateFormatter = new Intl.DateTimeFormat("es-CR", {
        dateStyle: "long",
      });
      const localDateTimeFormatter = new Intl.DateTimeFormat("es-CR", {
        dateStyle: "short",
        timeStyle: "short",
      });
      const closingDate = new Date(latestDailyClosing.closingDate);
      const closingLabel = Number.isNaN(closingDate.getTime())
        ? String(latestDailyClosing.closingDate)
        : localDailyClosingDateFormatter.format(closingDate);
      const createdAtDate = new Date(latestDailyClosing.createdAt);
      const createdLabel = Number.isNaN(createdAtDate.getTime())
        ? String(latestDailyClosing.createdAt)
        : localDateTimeFormatter.format(createdAtDate);
      return `${closingLabel} (registrado: ${createdLabel})`;
    } catch {
      return String(
        latestDailyClosing.closingDate || latestDailyClosing.createdAt || "",
      );
    }
  }, [latestDailyClosing]);

  const dailyClosingDateFormatter = useMemo(
    () => new Intl.DateTimeFormat("es-CR", { dateStyle: "long" }),
    [],
  );

  return {
    dailyClosingModalOpen,
    setDailyClosingModalOpen,
    editingDailyClosingId,
    setEditingDailyClosingId,
    dailyClosingInitialValues,
    setDailyClosingInitialValues,
    dailyClosings,
    setDailyClosings,
    dailyClosingsHydrated,
    setDailyClosingsHydrated,
    dailyClosingsRefreshing,
    setDailyClosingsRefreshing,
    dailyClosingHistoryOpen,
    setDailyClosingHistoryOpen,
    dailyClosingHistoryRange,
    setDailyClosingHistoryRange,
    closingsStorageKey,
    beginDailyClosingsRequest,
    finishDailyClosingsRequest,
    loadDailyClosingsForHistoryRange,
    latestDailyClosing,
    latestDailyClosingLabel,
    dailyClosingDateFormatter,
    dailyClosingsRequestCountRef,
    loadedDailyClosingKeysRef,
    loadingDailyClosingKeysRef,
  };
}
