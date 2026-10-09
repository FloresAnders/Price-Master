import { Eye, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import type { FondoGeneralTutorialStep } from "@/config/tutorials/fondoGeneralSteps";

import styles from "./fondoGeneralTutorial.module.css";
import TutorialNavigation from "./TutorialNavigation";
import TutorialStepImage from "./TutorialStepImage";

type FondoGeneralTutorialModalProps = {
  open: boolean;
  steps: FondoGeneralTutorialStep[];
  currentIndex: number;
  targetError?: string | null;
  onIndexChange: (index: number) => void;
  onShowTarget: (step: FondoGeneralTutorialStep) => void;
  onClose: () => void;
};

const SYSTEM_LABELS: Record<FondoGeneralTutorialStep["system"], string> = {
  tucan: "Tucán",
  contica: "Contica",
  tm: "TimeMaster",
  tiempos: "Gestor Tiempos",
};

export default function FondoGeneralTutorialModal({
  open,
  steps,
  currentIndex,
  targetError,
  onIndexChange,
  onShowTarget,
  onClose,
}: FondoGeneralTutorialModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      const expandedViewer = dialogRef.current?.querySelector<HTMLElement>(
        '[data-tutorial-image-expanded="true"]',
      );
      if (event.key === "Escape") {
        if (expandedViewer) return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(
        (expandedViewer ?? dialogRef.current)?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElementIsInScope = (expandedViewer ?? dialogRef.current)?.contains(
        document.activeElement,
      );
      if (!activeElementIsInScope) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  if (!open || steps.length === 0) return null;

  const step = steps[currentIndex] ?? steps[0];

  return (
    <div className={styles.backdrop} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.dialog}
      >
        <header className={styles.header}>
          <div>
            <h2 id={titleId} className={styles.eyebrow}>Guía de verificación de sistemas</h2>
            <h3>{step.title}</h3>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Cerrar guía"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className={styles.progressRow}>
          <span className={styles.systemBadge}>{SYSTEM_LABELS[step.system]}</span>
          <span aria-live="polite">Paso {step.number} de {steps.length}</span>
        </div>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label="Progreso de la guía"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={step.number}
        >
          <span style={{ width: `${(step.number / steps.length) * 100}%` }} />
        </div>

        <main className={styles.content}>
          <p className={styles.description}>{step.description}</p>
          {step.image && step.alt ? <TutorialStepImage key={step.id} src={step.image} alt={step.alt} /> : null}
          {step.targetSelector ? (
            <div className={styles.liveTargetCard}>
              <Eye aria-hidden="true" />
              <div>
                <strong>Este paso se muestra en la pantalla real.</strong>
                <span>El modal se ocultará mientras se resalta el control, sin cambiar sus valores.</span>
              </div>
              <button type="button" onClick={() => onShowTarget(step)}>
                Resaltar en TM
              </button>
            </div>
          ) : null}
          {targetError ? <p className={styles.targetError} role="alert">{targetError}</p> : null}
          <p className={styles.disclaimer}>
            Esta guía es informativa: avanzar o finalizar no verifica ni guarda el cierre.
          </p>
        </main>

        <TutorialNavigation
          currentIndex={currentIndex}
          total={steps.length}
          onPrevious={() => onIndexChange(Math.max(0, currentIndex - 1))}
          onNext={() => onIndexChange(Math.min(steps.length - 1, currentIndex + 1))}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
