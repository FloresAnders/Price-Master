import styles from "./fondoGeneralTutorial.module.css";

type TutorialNavigationProps = {
  currentIndex: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
};

export default function TutorialNavigation({
  currentIndex,
  total,
  onPrevious,
  onNext,
  onClose,
}: TutorialNavigationProps) {
  const isLast = currentIndex === total - 1;

  return (
    <div className={styles.navigation}>
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={onPrevious}
        disabled={currentIndex === 0}
      >
        Anterior
      </button>
      {isLast ? (
        <button type="button" className={styles.primaryButton} onClick={onClose}>
          Finalizar guía
        </button>
      ) : (
        <button type="button" className={styles.primaryButton} onClick={onNext}>
          Siguiente
        </button>
      )}
    </div>
  );
}

