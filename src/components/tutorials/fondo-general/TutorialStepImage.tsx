import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import styles from "./fondoGeneralTutorial.module.css";

type TutorialStepImageProps = {
  src: string;
  alt: string;
};

export default function TutorialStepImage({ src, alt }: TutorialStepImageProps) {
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);
  const expansionTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!expanded) return;
    expandButtonRef.current?.focus();
    const expansionTrigger = expansionTriggerRef.current;
    return () => expansionTrigger?.focus();
  }, [expanded]);

  if (failed) {
    return (
      <div className={styles.imageFallback} role="status">
        <strong>Captura no disponible.</strong>
        <span>
          Siga la explicación de este paso. La ausencia de la imagen no cambia ni
          valida ningún importe.
        </span>
      </div>
    );
  }

  return (
    <div
      className={expanded ? styles.expandedImage : styles.imageBlock}
      data-tutorial-image-expanded={expanded ? "true" : undefined}
      role={expanded ? "dialog" : undefined}
      aria-label={expanded ? "Vista ampliada de la captura" : undefined}
      onKeyDown={(event) => {
        if (expanded && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setExpanded(false);
        }
      }}
    >
      <div className={styles.imageToolbar} aria-label="Controles de imagen">
        <button
          type="button"
          onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
          disabled={zoom === 1}
          aria-label="Alejar imagen"
        >
          <ZoomOut aria-hidden="true" />
        </button>
        <output aria-live="polite">{Math.round(zoom * 100)}%</output>
        <button
          type="button"
          onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
          disabled={zoom === 3}
          aria-label="Acercar imagen"
        >
          <ZoomIn aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          disabled={zoom === 1}
          aria-label="Restablecer zoom"
        >
          <RotateCcw aria-hidden="true" />
        </button>
        <button
          ref={expandButtonRef}
          type="button"
          onClick={(event) => {
            if (!expanded) expansionTriggerRef.current = event.currentTarget;
            setExpanded((value) => !value);
          }}
          aria-label={expanded ? "Reducir imagen" : "Ampliar imagen"}
        >
          {expanded ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
        </button>
      </div>
      <div className={styles.imageViewport}>
        {/* Las capturas conservan sus dimensiones naturales para que el zoom no pierda legibilidad. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
        />
      </div>
    </div>
  );
}
