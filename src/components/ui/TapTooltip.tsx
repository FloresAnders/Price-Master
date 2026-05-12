"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function TooltipLines({ text }: { text: string }) {
  return (
    <div className="text-xs leading-5">
      {String(text)
        .split("\n")
        .filter(Boolean)
        .map((line, idx) => (
          <div key={idx}>{line}</div>
        ))}
    </div>
  );
}

export default function TapTooltip({
  content,
  children,
  disabled,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    placement: "top" | "bottom";
  } | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [sheetDragY, setSheetDragY] = useState(0);
  const [sheetDragging, setSheetDragging] = useState(false);
  const sheetStartYRef = useRef(0);
  const sheetLastYRef = useRef(0);
  const sheetLastTRef = useRef(0);
  const sheetVelocityRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsSmallScreen(mq.matches);
    update();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }

    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  const computePosition = () => {
    const el = triggerRef.current;
    if (!el || typeof window === "undefined") return null;
    const rect = el.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const preferredTop = rect.top - 10;
    const placement: "top" | "bottom" = preferredTop > 80 ? "top" : "bottom";
    const top = placement === "top" ? rect.top - 10 : rect.bottom + 10;

    const left = Math.min(window.innerWidth - 8, Math.max(8, centerX));
    return { top, left, placement };
  };

  const adjustPositionWithinViewport = () => {
    const el = triggerRef.current;
    const tip = tooltipRef.current;
    if (!el || !tip || typeof window === "undefined") return;

    const triggerRect = el.getBoundingClientRect();
    const tooltipRect = tip.getBoundingClientRect();

    const padding = 8;
    let placement: "top" | "bottom" =
      triggerRect.top - tooltipRect.height - 12 > padding ? "top" : "bottom";

    if (
      placement === "bottom" &&
      triggerRect.bottom + 10 + tooltipRect.height >
        window.innerHeight - padding &&
      triggerRect.top - tooltipRect.height - 12 > padding
    ) {
      placement = "top";
    }

    const top =
      placement === "top" ? triggerRect.top - 10 : triggerRect.bottom + 10;
    const desiredCenterX = triggerRect.left + triggerRect.width / 2;
    const minCenterX = padding + tooltipRect.width / 2;
    const maxCenterX = window.innerWidth - padding - tooltipRect.width / 2;
    const left = Math.min(maxCenterX, Math.max(minCenterX, desiredCenterX));

    setPos({ top, left, placement });
  };

  const openTooltip = () => {
    if (disabled) return;
    const nextPos = computePosition();
    setPos(nextPos);
    setOpen(true);
  };

  const closeTooltip = () => {
    setOpen(false);
    setSheetDragY(0);
    setSheetDragging(false);
  };

  useEffect(() => {
    if (!open) return;
    if (isSmallScreen) {
      setSheetDragY(0);
      setSheetDragging(false);
    }
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (triggerRef.current?.contains(t)) return;
      if (tooltipRef.current?.contains(t)) return;
      closeTooltip();
    };

    const onResizeOrScroll = () => {
      if (isSmallScreen) return;
      adjustPositionWithinViewport();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);

    if (!isSmallScreen) {
      requestAnimationFrame(() => adjustPositionWithinViewport());
    }

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isSmallScreen]);

  const onSheetHandlePointerDown = (e: React.PointerEvent) => {
    if (!isSmallScreen) return;
    if (disabled) return;
    e.preventDefault();

    const y = e.clientY;
    sheetStartYRef.current = y;
    sheetLastYRef.current = y;
    sheetLastTRef.current = performance.now();
    sheetVelocityRef.current = 0;
    setSheetDragging(true);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onSheetHandlePointerMove = (e: React.PointerEvent) => {
    if (!isSmallScreen) return;
    if (!sheetDragging) return;

    const now = performance.now();
    const y = e.clientY;
    const dy = Math.max(0, y - sheetStartYRef.current);

    const dt = Math.max(1, now - sheetLastTRef.current);
    const vy = (y - sheetLastYRef.current) / dt;
    sheetVelocityRef.current = vy;
    sheetLastYRef.current = y;
    sheetLastTRef.current = now;

    setSheetDragY(dy);
  };

  const onSheetHandlePointerUp = (e: React.PointerEvent) => {
    if (!isSmallScreen) return;
    if (!sheetDragging) return;
    e.preventDefault();

    const closeThresholdPx = 90;
    const velocityThreshold = 0.9;

    const shouldClose =
      sheetDragY > closeThresholdPx ||
      sheetVelocityRef.current > velocityThreshold;
    setSheetDragging(false);

    if (shouldClose) {
      closeTooltip();
      return;
    }

    setSheetDragY(0);

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-block"
        tabIndex={disabled ? -1 : 0}
        role={disabled ? undefined : "button"}
        aria-haspopup={disabled ? undefined : "dialog"}
        aria-expanded={disabled ? undefined : open}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => {
            const next = !prev;
            if (next) setPos(computePosition());
            return next;
          });
        }}
        onMouseEnter={() => {
          if (disabled) return;
          if (isSmallScreen) return;
          openTooltip();
        }}
        onMouseLeave={() => {
          if (disabled) return;
          if (isSmallScreen) return;
          closeTooltip();
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((prev) => {
              const next = !prev;
              if (next) setPos(computePosition());
              return next;
            });
          }
          if (e.key === "Escape") closeTooltip();
        }}
      >
        {children}
      </span>

      {open && isSmallScreen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[9999]">
              <button
                type="button"
                aria-label="Cerrar"
                className="absolute inset-0 bg-black/40"
                onClick={closeTooltip}
              />

              <div className="absolute inset-x-0 bottom-0 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                <div
                  ref={tooltipRef}
                  role="dialog"
                  aria-modal="true"
                  className="w-full max-w-md mx-auto rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] shadow-xl"
                  style={{
                    transform: `translateY(${sheetDragY}px)`,
                    transition: sheetDragging
                      ? "none"
                      : "transform 180ms ease-out",
                    willChange: "transform",
                  }}
                >
                  <div
                    className="px-4 pt-3 pb-2"
                    onPointerDown={onSheetHandlePointerDown}
                    onPointerMove={onSheetHandlePointerMove}
                    onPointerUp={onSheetHandlePointerUp}
                    onPointerCancel={onSheetHandlePointerUp}
                    style={{ touchAction: "none" }}
                  >
                    <div className="mx-auto h-1.5 w-12 rounded-full bg-[var(--input-border)]" />
                  </div>

                  <div className="px-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">{content}</div>
                      <button
                        type="button"
                        onClick={closeTooltip}
                        className="flex-none rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-cyan-500 hover:bg-[var(--muted)] transition-all px-3 py-1.5 text-xs"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {open && !isSmallScreen && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tooltipRef}
              role="dialog"
              className="z-[9999] rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] shadow-lg px-3 py-2"
              style={{
                position: "fixed",
                left: pos.left,
                top: pos.top,
                transform:
                  pos.placement === "top"
                    ? "translate(-50%, -100%)"
                    : "translate(-50%, 0)",
                maxWidth: "min(360px, calc(100vw - 16px))",
                pointerEvents: "auto",
              }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
