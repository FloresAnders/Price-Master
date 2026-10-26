import type { FestivityConfig } from "../types";
import styles from "../styles/seasonal-effects.module.css";

export default function FestivityBanner({
  config,
  onHide,
}: {
  config: FestivityConfig;
  onHide?: () => void;
}) {
  if (!config.showBanner) return null;
  return (
    <aside className={`${styles.banner} ${styles[config.id]}`} role="status" aria-live="polite">
      <div className={styles.bannerInner}>
        <span className={styles.bannerMark} aria-hidden="true" />
        <div className={styles.bannerCopy}>
          <p className={styles.bannerTitle}>{config.title}</p>
          {config.message ? <p className={styles.bannerMessage}>{config.message}</p> : null}
        </div>
        {onHide ? (
          <button type="button" className={styles.hideButton} onClick={onHide}>
            Ocultar efectos por hoy
          </button>
        ) : null}
      </div>
    </aside>
  );
}
