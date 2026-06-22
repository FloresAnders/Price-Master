"use client";

import { AlertTriangle, CalendarClock, LogOut, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UsersService } from "@/services/users";
import type { User, UserSubscription } from "@/types/firestore";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOTICE_DAYS = 5;

function parseDateKey(value?: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getDaysUntil(paymentDate?: string): number | null {
  const dueDate = parseDateKey(paymentDate);
  if (!dueDate) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((dueDate.getTime() - today.getTime()) / MS_PER_DAY);
}

function shouldUseOwnSubscription(user: User): boolean {
  return user.role === "admin" && user.eliminate !== true;
}

export default function SubscriptionNotice() {
  const { user, logout } = useAuth();
  const [ownerSubscription, setOwnerSubscription] =
    useState<UserSubscription | null>(null);
  const [dismissedKey, setDismissedKey] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadOwnerSubscription() {
      if (!user) {
        setOwnerSubscription(null);
        return;
      }

      const ownerId = shouldUseOwnSubscription(user)
        ? String(user.id || "").trim()
        : String(user.ownerId || "").trim();
      if (!ownerId) {
        setOwnerSubscription(user.subscription ?? null);
        return;
      }

      try {
        const owner = await UsersService.getUserById(ownerId);
        if (!cancelled) setOwnerSubscription(owner?.subscription ?? null);
      } catch (error) {
        console.warn("Error loading owner subscription:", error);
        if (!cancelled) setOwnerSubscription(null);
      }
    }

    void loadOwnerSubscription();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const notice = useMemo(() => {
    const subscription = ownerSubscription;
    if (!subscription?.paymentDate) return null;

    const daysUntil = getDaysUntil(subscription.paymentDate);
    if (daysUntil === null) return null;

    if (subscription.status === "pagado" && daysUntil < 0) {
      return null;
    }

    if (daysUntil < 0 || subscription.status === "vencido") {
      const overdueDays = Math.abs(daysUntil);
      const gracePeriodMessage =
        daysUntil < 0 && overdueDays <= 5
          ? " Al pasar 5 dias de vencida, acceso se bloqueara."
          : "";
      return {
        key: `${subscription.paymentDate}-overdue-${overdueDays}`,
        tone: "danger" as const,
        title: "Suscripcion vencida",
        message:
          daysUntil >= 0
            ? "Suscripcion marcada como vencida"
            : overdueDays === 1
            ? `Suscripcion vencida hace 1 dia.${gracePeriodMessage}`
            : `Suscripcion vencida hace ${overdueDays} dias.${gracePeriodMessage}`,
      };
    }

    if (daysUntil >= 0 && daysUntil <= NOTICE_DAYS) {
      return {
        key: `${subscription.paymentDate}-due-${daysUntil}`,
        tone: "warning" as const,
        title: "Suscripcion pendiente",
        message:
          daysUntil === 0
            ? "La suscripcion vence hoy"
            : daysUntil === 1
              ? "Falta 1 dia para vencimiento"
              : `Faltan ${daysUntil} dias para vencimiento`,
      };
    }

    return null;
  }, [ownerSubscription]);

  const daysUntil = getDaysUntil(ownerSubscription?.paymentDate);
  const overdueDays = daysUntil === null ? 0 : Math.max(0, -daysUntil);
  const accessBlocked = notice?.tone === "danger" && overdueDays >= 6;

  const handleLogout = async () => {
    await logout("subscription_expired");
  };

  if (!notice || dismissedKey === notice.key) return null;

  return (
    <>
      {accessBlocked && (
        <div
          className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscription-expired-title"
        >
          <div className="w-full max-w-md rounded-lg bg-background p-6 text-foreground shadow-2xl">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-red-600" />
            <h2 id="subscription-expired-title" className="text-center text-xl font-bold">
              Suscripcion vencida
            </h2>
            <p className="mt-2 text-center text-muted-foreground">
              Acceso bloqueado. No se desbloqueara hasta realizar pago correspondiente.
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesion
            </button>
          </div>
        </div>
      )}
      <div
        className={`sticky top-0 z-[60] border-b px-3 py-2 text-sm shadow-sm lg:pl-[var(--admin-sidebar-width)] ${
        notice.tone === "danger"
          ? "border-red-700 bg-red-700 text-white"
          : "border-yellow-500 bg-yellow-500 text-white"
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="relative mx-auto flex max-w-7xl items-center justify-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {notice.tone === "danger" ? (
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            ) : (
              <CalendarClock className="h-4 w-4 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <span className="font-semibold">{notice.title}: </span>
              <span>{notice.message}</span>
            </div>
          </div>
          {!accessBlocked && (
            <button
              type="button"
              onClick={() => setDismissedKey(notice.key)}
              className="absolute right-3 rounded p-1 hover:bg-white/15 lg:right-[calc(1rem+var(--admin-sidebar-width))]"
              aria-label="Cerrar aviso de suscripcion"
              title="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
