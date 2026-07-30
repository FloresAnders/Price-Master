"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ChevronUp,
  MoreHorizontal,
  Pin,
  PinOff,
  type LucideIcon,
} from "lucide-react";

export type FloatingActionVariant = "primary" | "blue" | "emerald" | "slate";

export type FloatingActionConfig = {
  id: string;
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  order?: number;
  badge?: number | string;
  variant?: FloatingActionVariant;
  visible?: boolean;
};

export type RegisteredFloatingAction = Required<
  Pick<FloatingActionConfig, "id" | "label" | "Icon" | "onClick" | "variant">
> &
  Pick<FloatingActionConfig, "badge" | "visible"> & {
    order: number;
  };

type FloatingActionsRegistryContextValue = {
  registerAction: (action: FloatingActionConfig) => void;
  unregisterAction: (id: string) => void;
};

const FloatingActionsRegistryContext =
  createContext<FloatingActionsRegistryContextValue | null>(null);
const FloatingActionsStateContext = createContext<
  Record<string, RegisteredFloatingAction>
>({});

const PINNED_KEY = "pricemaster-floating-actions-pinned";

function deferStateUpdate(update: () => void): void {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(update);
    return;
  }
  void Promise.resolve().then(update);
}

function readPinnedPreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PINNED_KEY) === "true";
}

function writePinnedPreference(pinned: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PINNED_KEY, String(pinned));
}

function getVariantClass(variant: FloatingActionVariant): string {
  if (variant === "blue") return "bg-blue-600 hover:bg-blue-700";
  if (variant === "emerald") return "bg-emerald-600 hover:bg-emerald-700";
  if (variant === "slate") {
    return "border border-white/20 bg-slate-700 hover:bg-slate-600";
  }
  return "border border-white/20 bg-[var(--primary)] hover:opacity-95";
}

export function sortVisibleFloatingActions<T extends RegisteredFloatingAction>(
  actionsById: Record<string, T>,
): T[] {
  return Object.values(actionsById)
    .filter((action) => action.visible !== false)
    .sort(
      (left, right) =>
        left.order - right.order || left.label.localeCompare(right.label, "es"),
    );
}

function FloatingCircleButton({
  label,
  Icon,
  onClick,
  badge,
  variant = "primary",
}: {
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  badge?: number | string;
  variant?: FloatingActionVariant;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/70 ${getVariantClass(
        variant,
      )}`}
    >
      <Icon className="h-6 w-6" aria-hidden="true" />
      {badge ? (
        <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function areActionsEqual(
  left: RegisteredFloatingAction | undefined,
  right: RegisteredFloatingAction,
): boolean {
  return (
    Boolean(left) &&
    left?.label === right.label &&
    left.Icon === right.Icon &&
    left.onClick === right.onClick &&
    left.order === right.order &&
    left.badge === right.badge &&
    left.variant === right.variant &&
    left.visible === right.visible
  );
}

export function FloatingActionsProvider({ children }: { children: ReactNode }) {
  const [actionsById, setActionsById] = useState<
    Record<string, RegisteredFloatingAction>
  >({});

  const unregisterAction = useCallback((id: string) => {
    setActionsById((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const registerAction = useCallback((action: FloatingActionConfig) => {
    const registered: RegisteredFloatingAction = {
      id: action.id,
      label: action.label,
      Icon: action.Icon,
      onClick: action.onClick,
      order: action.order ?? 100,
      badge: action.badge,
      variant: action.variant ?? "primary",
      visible: action.visible,
    };

    setActionsById((current) => {
      if (action.visible === false) {
        if (!current[action.id]) return current;
        const next = { ...current };
        delete next[action.id];
        return next;
      }

      if (areActionsEqual(current[action.id], registered)) return current;
      return { ...current, [action.id]: registered };
    });
  }, []);

  const registryValue = useMemo(
    () => ({ registerAction, unregisterAction }),
    [registerAction, unregisterAction],
  );

  return (
    <FloatingActionsRegistryContext.Provider value={registryValue}>
      <FloatingActionsStateContext.Provider value={actionsById}>
        {children}
      </FloatingActionsStateContext.Provider>
    </FloatingActionsRegistryContext.Provider>
  );
}

export function useFloatingAction(action: FloatingActionConfig): void {
  const context = useContext(FloatingActionsRegistryContext);
  const { id, label, Icon, onClick, order, badge, variant, visible } = action;

  useEffect(() => {
    if (!context) return;
    context.registerAction({
      id,
      label,
      Icon,
      onClick,
      order,
      badge,
      variant,
      visible,
    });
  }, [context, id, label, Icon, onClick, order, badge, variant, visible]);

  useEffect(() => {
    if (!context) return;
    return () => context.unregisterAction(id);
  }, [context, id]);
}

export function FloatingActionsDock() {
  const actionsById = useContext(FloatingActionsStateContext);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState<boolean | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const actions = useMemo(
    () => sortVisibleFloatingActions(actionsById),
    [actionsById],
  );

  useEffect(() => {
    let active = true;
    deferStateUpdate(() => {
      if (active) setPinned(readPinnedPreference());
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (pinned === null) return;
    writePinnedPreference(pinned);
  }, [pinned]);

  useEffect(() => {
    if (pinned || !open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!hostRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, pinned]);

  const isPinned = pinned === true;
  const expanded = isPinned || open;
  if (actions.length === 0) return null;

  return (
    <div
      ref={hostRef}
      className="fixed z-[99980] flex flex-col items-center gap-3"
      style={{
        bottom: "calc(92px + env(safe-area-inset-bottom, 0px))",
        right: "calc(20px + env(safe-area-inset-right, 0px))",
      }}
    >
      <div
        className={`flex flex-col items-center gap-3 transition-all duration-200 ${
          expanded
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <FloatingCircleButton
          label={isPinned ? "No mantener acciones" : "Mantener acciones"}
          Icon={isPinned ? PinOff : Pin}
          onClick={() => setPinned((current) => !(current ?? false))}
          variant="slate"
        />
        {actions.map((action) => (
          <FloatingCircleButton
            key={action.id}
            label={action.label}
            Icon={action.Icon}
            onClick={() => {
              action.onClick();
              if (!isPinned) setOpen(false);
            }}
            badge={action.badge}
            variant={action.variant}
          />
        ))}
      </div>

      <FloatingCircleButton
        label={expanded ? "Cerrar acciones" : "Abrir acciones"}
        Icon={expanded ? ChevronUp : MoreHorizontal}
        onClick={() => setOpen((current) => !current)}
        variant="primary"
      />
    </div>
  );
}
