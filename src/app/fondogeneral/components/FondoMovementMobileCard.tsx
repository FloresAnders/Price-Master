import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  ChevronDown,
  Minus,
} from "lucide-react";
import type { ReactNode } from "react";

import type { MobileRecordDetail } from "./MobileRecordCard";
import styles from "./FondoMovementMobileCard.module.css";

export type FondoMovementDirection = "income" | "expense" | "neutral";

export type FondoMovementMobileCardProps = {
  ariaLabel: string;
  title: ReactNode;
  dateTime?: ReactNode;
  direction: FondoMovementDirection;
  movementType: ReactNode;
  amount: ReactNode;
  amountLabel?: string;
  balanceBefore?: ReactNode;
  balanceAfter?: ReactNode;
  balanceSummary?: ReactNode;
  badges?: ReactNode;
  details?: MobileRecordDetail[];
  observation?: string | null;
  expandedContent?: ReactNode;
  actions?: ReactNode;
  dimmed?: boolean;
};

const directionIcon = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  neutral: Minus,
} as const;

const observationTokenPattern = /\[(?:ALERT_ICON|CHECK_ICON)\]/g;

function getObservationPreview(observation: string) {
  const readableText = observation
    .replace(observationTokenPattern, "")
    .replace(/\s+/g, " ")
    .trim();
  const characters = Array.from(readableText);
  const preview = characters.slice(0, 9).join("");

  return `${preview}${characters.length > 9 ? "..." : ""}`;
}

function ObservationDisclosure({ observation }: { observation: string }) {
  const lines = observation
    .split(/\r?\n/)
    .map((line) => ({
      isAlert: line.includes("[ALERT_ICON]"),
      isCheck: line.includes("[CHECK_ICON]"),
      text: line.replace(observationTokenPattern, "").trim(),
    }))
    .filter((line) => line.text);

  return (
    <details className={styles.observationDisclosure}>
      <summary className={styles.observationSummary}>
        <span>{getObservationPreview(observation)}</span>
        <ChevronDown
          aria-hidden="true"
          className={styles.observationChevron}
        />
      </summary>
      <div className={styles.observationContent}>
        {lines.map((line, index) => (
          <div
            className={styles.observationLine}
            data-tone={line.isAlert ? "alert" : line.isCheck ? "check" : undefined}
            key={`${line.text}-${index}`}
          >
            {line.isAlert ? (
              <AlertTriangle aria-hidden="true" />
            ) : line.isCheck ? (
              <CheckCircle aria-hidden="true" />
            ) : null}
            <span>{line.text}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

export function FondoMovementMobileCard({
  ariaLabel,
  title,
  dateTime,
  direction,
  movementType,
  amount,
  amountLabel = "Monto del movimiento",
  balanceBefore,
  balanceAfter,
  balanceSummary,
  badges,
  details = [],
  observation,
  expandedContent,
  actions,
  dimmed = false,
}: FondoMovementMobileCardProps) {
  const DirectionIcon = directionIcon[direction];
  const hasBalances = balanceBefore != null || balanceAfter != null;

  return (
    <article
      aria-label={ariaLabel}
      className={`${styles.card} ${dimmed ? styles.dimmed : ""}`.trim()}
      data-layout="movement-card"
      data-direction={direction}
    >
      <header
        aria-label="Encabezado del movimiento"
        className={styles.header}
      >
        <span className={styles.directionIcon} aria-hidden="true">
          <DirectionIcon />
        </span>
        <div className={styles.headingCopy}>
          <div className={styles.titleRow}>
            <h3 className={styles.title}>{title}</h3>
            {badges ? <div className={styles.badges}>{badges}</div> : null}
          </div>
          {dateTime ? <p className={styles.dateTime}>{dateTime}</p> : null}
        </div>
      </header>

      <section className={styles.amountSection} aria-label={amountLabel}>
        <p className={styles.eyebrow}>{amountLabel}</p>
        <div className={styles.amountRow}>
          <div className={styles.amountValue}>{amount}</div>
          <span className={styles.movementType}>{movementType}</span>
        </div>
      </section>

      {hasBalances ? (
        <dl
          aria-label="Saldos del movimiento"
          className={styles.balances}
          role="group"
        >
          <div className={styles.balanceBlock}>
            <dt>Saldo anterior</dt>
            <dd>{balanceBefore ?? "-"}</dd>
          </div>
          <div className={styles.balanceBlock}>
            <dt>Saldo posterior</dt>
            <dd>{balanceAfter ?? "-"}</dd>
          </div>
        </dl>
      ) : null}

      {balanceSummary ? (
        <div className={styles.balanceSummary}>{balanceSummary}</div>
      ) : null}

      {details.length > 0 || observation ? (
        <dl aria-label="Datos del movimiento" className={styles.details}>
          {details.map((detail, index) => (
            <div className={styles.detail} key={`${detail.label}-${index}`}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
          {observation ? (
            <div className={`${styles.detail} ${styles.observationDetail}`}>
              <dt>Observación</dt>
              <dd>
                <ObservationDisclosure observation={observation} />
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {expandedContent ? (
        <div className={styles.expanded}>{expandedContent}</div>
      ) : null}

      {actions ? <footer className={styles.actions}>{actions}</footer> : null}
    </article>
  );
}
