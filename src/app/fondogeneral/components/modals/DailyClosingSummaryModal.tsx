import React from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coins,
  Download,
  DollarSign,
  Loader2,
  QrCode,
  RefreshCw,
  Smartphone,
  User,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";

import type { DailyClosingRecord } from "@/services/daily-closings";
import { storage } from "@/config/firebase";

type Currency = "CRC" | "USD";

type DailyClosingSummaryModalProps = {
  open: boolean;
  record: DailyClosingRecord | null;
  onClose: () => void;
};

const crcFormatter = new Intl.NumberFormat("es-CR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-CR", {
  dateStyle: "long",
  timeStyle: "short",
});

const formatCurrency = (currency: Currency, value: number) =>
  currency === "USD"
    ? `$ ${usdFormatter.format(value)}`
    : `CRC ${crcFormatter.format(value)}`;

const formatDiff = (currency: Currency, value: number) => {
  if (value === 0) return "Sin diferencias";
  const sign = value > 0 ? "+" : "-";
  return `${sign} ${formatCurrency(currency, Math.abs(value))}`;
};

const formatReconciliationDiff = (value: number) => {
  if (value === 0) return "Cuadra";
  return value > 0
    ? `Sobra ${formatCurrency("CRC", Math.abs(value))}`
    : `Falta ${formatCurrency("CRC", Math.abs(value))}`;
};

const buildBreakdownLines = (currency: Currency, breakdown: Record<number, number>) =>
  Object.entries(breakdown || {})
    .map(([denomination, count]) => ({
      denomination: Number(denomination),
      count: Number(count),
    }))
    .filter((item) => Number.isFinite(item.denomination) && item.count > 0)
    .sort((a, b) => b.denomination - a.denomination)
    .map(
      (item) =>
        `${item.count} x ${formatCurrency(currency, item.denomination)} = ${formatCurrency(
          currency,
          item.count * item.denomination,
        )}`,
    );

const sanitizeFilenamePart = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);

const diffClass = (value: number) => {
  if (value === 0) return "text-emerald-300";
  return value > 0 ? "text-sky-300" : "text-red-300";
};

const reconciliationTone = (record: DailyClosingRecord) => {
  const reconciliation = record.reconciliation;
  if (!reconciliation) return "success";
  if (
    reconciliation.calculated.tucanDifference !== 0 ||
    reconciliation.tiemposStatus === "REAL_DIFFERENCE" ||
    reconciliation.tiemposStatus === "DAILY_UNRESOLVED"
  ) {
    return "danger";
  }
  if (
    reconciliation.tiemposStatus === "TEMPORARY_PENDING" ||
    reconciliation.tiemposStatus === "PARTIALLY_RESOLVED"
  ) {
    return "warning";
  }
  return "success";
};

const toneClass = (tone: string) => {
  if (tone === "danger") return "border-red-500/30 bg-red-500/10 text-red-100";
  if (tone === "warning") return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
};

const reconciliationStatusLabel = (status: string | undefined) => {
  switch (status) {
    case "MATCHED":
      return "Todo cuadra";
    case "TEMPORARY_PENDING":
      return "Pendiente para siguiente turno";
    case "PARTIALLY_RESOLVED":
      return "Compensado parcialmente";
    case "RESOLVED":
      return "Diferencia anterior resuelta";
    case "REAL_DIFFERENCE":
      return "Diferencia real";
    case "DAILY_UNRESOLVED":
      return "Dia no cuadra";
    default:
      return "Revision pendiente";
  }
};

const buildTiemposCompensationSummary = (record: DailyClosingRecord) => {
  const reconciliation = record.reconciliation;
  if (!reconciliation) return null;

  const calculated = reconciliation.calculated;
  const hasTiemposDifference =
    calculated.tiemposRawDifference !== 0 ||
    calculated.tiemposDifference !== 0 ||
    calculated.previousTiemposPending !== 0 ||
    calculated.compensatedTiemposAmount !== 0 ||
    calculated.tiemposPendingAfterClosing !== 0 ||
    calculated.tiemposRealShiftDifference !== 0;

  if (!hasTiemposDifference) return null;

  if (record.turno === "D") {
    return {
      title: "Diferencia pendiente",
      text: "La diferencia de Tiempos queda pendiente para el turno N.",
      rows: [
        ["Diferencia Tiempos", formatReconciliationDiff(calculated.tiemposDifference)],
        ["Pendiente siguiente", formatReconciliationDiff(calculated.tiemposPendingAfterClosing)],
      ],
    };
  }

  if (reconciliation.tiemposStatus === "RESOLVED") {
    return {
      title: "Diferencia resuelta",
      text: "La diferencia pendiente de Tiempos fue resuelta en este turno.",
      rows: [
        ["Pendiente anterior", formatReconciliationDiff(calculated.previousTiemposPending)],
        ["Compensado", formatCurrency("CRC", Math.abs(calculated.compensatedTiemposAmount))],
      ],
    };
  }

  if (reconciliation.tiemposStatus === "PARTIALLY_RESOLVED") {
    return {
      title: "Diferencia parcialmente resuelta",
      text: "La diferencia pendiente de Tiempos fue compensada parcialmente.",
      rows: [
        ["Pendiente anterior", formatReconciliationDiff(calculated.previousTiemposPending)],
        ["Compensado", formatCurrency("CRC", Math.abs(calculated.compensatedTiemposAmount))],
        ["Pendiente final", formatReconciliationDiff(calculated.tiemposPendingAfterClosing)],
      ],
    };
  }

  return {
    title: "Diferencia no resuelta",
    text: "La diferencia de Tiempos no quedó resuelta en este cierre.",
    rows: [
      ["Pendiente anterior", formatReconciliationDiff(calculated.previousTiemposPending)],
      ["Diferencia actual", formatReconciliationDiff(calculated.tiemposDifference)],
      ["Pendiente final", formatReconciliationDiff(calculated.tiemposPendingAfterClosing)],
    ],
  };
};

const moneyRows = (
  title: string,
  currency: Currency,
  total: number,
  recorded: number,
  diff: number,
  breakdown: Record<number, number>,
  icon: React.ReactNode,
) => {
  const lines = buildBreakdownLines(currency, breakdown);

  return (
    <section className="rounded border border-[var(--input-border)] bg-[var(--muted)]/10 p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
        {icon}
        {title}
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-[var(--muted-foreground)]">Conteo registrado</span>
          <span className="font-semibold">{formatCurrency(currency, total)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[var(--muted-foreground)]">Saldo registrado</span>
          <span className="font-semibold">{formatCurrency(currency, recorded)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[var(--muted-foreground)]">Diferencia</span>
          <span className={`font-semibold ${diffClass(diff)}`}>{formatDiff(currency, diff)}</span>
        </div>
      </div>
      <div className="mt-3 border-t border-[var(--input-border)]/50 pt-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Billetes registrados
        </div>
        {lines.length > 0 ? (
          <div className="grid gap-1 text-xs text-[var(--muted-foreground)]">
            {lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        ) : (
          <div className="text-xs text-[var(--muted-foreground)]">Sin billetes registrados</div>
        )}
      </div>
    </section>
  );
};

const DailyClosingSummaryModal: React.FC<DailyClosingSummaryModalProps> = ({
  open,
  record,
  onClose,
}) => {
  const summaryRef = React.useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  const [mobileDownloading, setMobileDownloading] = React.useState(false);
  const [showQRModal, setShowQRModal] = React.useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = React.useState("");
  const [downloadURL, setDownloadURL] = React.useState("");
  const [downloadFileName, setDownloadFileName] = React.useState("");
  const [mobileDownloadError, setMobileDownloadError] = React.useState("");
  const mobileDownloadRequestRef = React.useRef(0);
  const openRef = React.useRef(open);

  const resetMobileDownloadState = React.useCallback(() => {
    setMobileDownloading(false);
    setShowQRModal(false);
    setQrCodeDataURL("");
    setDownloadURL("");
    setDownloadFileName("");
    setMobileDownloadError("");
  }, []);

  const handleCloseQRModal = React.useCallback(() => {
    mobileDownloadRequestRef.current += 1;
    resetMobileDownloadState();
    onClose();
  }, [onClose, resetMobileDownloadState]);

  const handleCloseSummary = React.useCallback(() => {
    mobileDownloadRequestRef.current += 1;
    resetMobileDownloadState();
    onClose();
  }, [onClose, resetMobileDownloadState]);

  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (showQRModal) {
        handleCloseQRModal();
        return;
      }
      handleCloseSummary();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleCloseQRModal, handleCloseSummary, open, showQRModal]);

  if (!open || !record) return null;

  const closingDate = new Date(record.closingDate);
  const createdAtDate = new Date(record.createdAt);
  const closingLabel = Number.isNaN(closingDate.getTime())
    ? record.closingDate
    : dateTimeFormatter.format(closingDate);
  const createdLabel = Number.isNaN(createdAtDate.getTime())
    ? record.createdAt
    : dateTimeFormatter.format(createdAtDate);
  const reconciliation = record.reconciliation;
  const tone = reconciliationTone(record);
  const tiemposCompensationSummary = buildTiemposCompensationSummary(record);
  const captureSummaryImage = async () => {
    if (!summaryRef.current) return null;
    const html2canvas = (await import("html2canvas")).default;
    const target = summaryRef.current;
    const previousHeight = target.style.height;
    const previousMaxHeight = target.style.maxHeight;
    const previousOverflow = target.style.overflow;

    try {
      target.style.height = `${target.scrollHeight}px`;
      target.style.maxHeight = "none";
      target.style.overflow = "visible";
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      const captureOptions = {
        background: getComputedStyle(target).backgroundColor || "#ffffff",
        height: target.scrollHeight,
        scale: 2,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
        windowHeight: target.scrollHeight,
        windowWidth: target.scrollWidth,
        width: target.scrollWidth,
        logging: false,
      } as Parameters<typeof html2canvas>[1] & {
        background: string;
        height: number;
        scale: number;
        scrollX: number;
        scrollY: number;
        useCORS: boolean;
        windowHeight: number;
        windowWidth: number;
        width: number;
        logging: boolean;
      };
      const canvas = await html2canvas(target, captureOptions);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) return null;
      const turnoPart = record.turno ?? "D";
      const managerPart = sanitizeFilenamePart(record.manager || "sin_encargado");
      const datePart = record.closingDate.slice(0, 10);
      const fileName = `CierreFG-${turnoPart}-${managerPart}-${datePart}.png`;

      return { blob, fileName };
    } finally {
      target.style.height = previousHeight;
      target.style.maxHeight = previousMaxHeight;
      target.style.overflow = previousOverflow;
    }
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadImage = async () => {
    if (downloading || mobileDownloading) return;
    setDownloading(true);
    try {
      const image = await captureSummaryImage();
      if (!image) return;
      downloadBlob(image.blob, image.fileName);
    } finally {
      setDownloading(false);
    }
  };

  const handleMobileDownload = async () => {
    if (downloading || mobileDownloading) return;
    const requestId = mobileDownloadRequestRef.current + 1;
    mobileDownloadRequestRef.current = requestId;
    setMobileDownloading(true);
    setMobileDownloadError("");
    try {
      const image = await captureSummaryImage();
      if (!image) return;

      const path = `exports/daily-closings/${Date.now()}_${image.fileName}`;
      const imageRef = storageRef(storage, path);
      await uploadBytes(imageRef, image.blob);
      const url = await getDownloadURL(imageRef);
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      if (mobileDownloadRequestRef.current !== requestId || !openRef.current) return;

      setDownloadURL(url);
      setDownloadFileName(image.fileName);
      setQrCodeDataURL(qrDataUrl);
      downloadBlob(image.blob, image.fileName);
      setShowQRModal(true);
    } catch (error) {
      console.error("Error al generar descarga movil:", error);
      if (mobileDownloadRequestRef.current === requestId && openRef.current) {
        setMobileDownloadError("No se pudo generar la descarga movil.");
      }
    } finally {
      if (mobileDownloadRequestRef.current === requestId) {
        setMobileDownloading(false);
      }
    }
  };

  const handleDirectDownload = async () => {
    if (!downloadURL) return;
    try {
      const response = await fetch(downloadURL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      downloadBlob(blob, downloadFileName || "cierre-fondo-general.png");
    } catch (error) {
      console.error("Error al descargar imagen remota:", error);
      window.open(downloadURL, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 px-4">
      {showQRModal ? (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-4">
          <div className="w-[96vw] max-w-md rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-6 text-[var(--foreground)] shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-[var(--accent)]" strokeWidth={1.8} />
                <h3 className="text-lg font-semibold">Descarga movil</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseQRModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--input-border)] hover:bg-[var(--muted)]/20"
                aria-label="Cerrar modal QR"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
            <p className="mb-4 text-sm text-[var(--muted-foreground)]">
              Escanea este codigo QR con tu movil para descargar la imagen.
            </p>
            <div className="mb-4 flex justify-center">
              <div className="rounded-lg bg-white p-4 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCodeDataURL}
                  alt="QR Code para descarga"
                  className="h-48 w-48"
                />
              </div>
            </div>
            <div className="grid gap-3">
              <button
                type="button"
                onClick={handleDirectDownload}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                <Download className="h-4 w-4" strokeWidth={1.8} />
                Descargar directamente
              </button>
              <button
                type="button"
                onClick={handleCloseQRModal}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--input-border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]/20"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--input-border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Resumen del cierre guardado</h2>
            <div className="mt-1 text-xs text-[var(--muted-foreground)]">
              Fondo General {record.turno ? `- Turno ${record.turno}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseSummary}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--input-border)] text-[var(--foreground)] hover:bg-[var(--muted)]/20"
            aria-label="Cerrar resumen"
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        <div
          ref={summaryRef}
          className="flex-1 overflow-y-auto bg-[var(--card-bg)] px-5 py-4 text-[var(--foreground)]"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded border border-[var(--input-border)] bg-[var(--muted)]/10 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.6} />
                Fecha cierre
              </div>
              <div className="text-sm font-semibold">{closingLabel}</div>
            </div>
            <div className="rounded border border-[var(--input-border)] bg-[var(--muted)]/10 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                <Clock3 className="h-3.5 w-3.5" strokeWidth={1.6} />
                Guardado
              </div>
              <div className="text-sm font-semibold">{createdLabel}</div>
            </div>
            <div className="rounded border border-[var(--input-border)] bg-[var(--muted)]/10 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                <User className="h-3.5 w-3.5" strokeWidth={1.6} />
                Encargado
              </div>
              <div className="text-sm font-semibold">{record.manager || "-"}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {moneyRows(
              "Colones",
              "CRC",
              record.totalCRC,
              record.recordedBalanceCRC,
              record.diffCRC,
              record.breakdownCRC,
              <Coins className="h-4 w-4 text-amber-300" strokeWidth={1.7} />,
            )}
            {moneyRows(
              "Dolares",
              "USD",
              record.totalUSD,
              record.recordedBalanceUSD,
              record.diffUSD,
              record.breakdownUSD,
              <DollarSign className="h-4 w-4 text-emerald-300" strokeWidth={1.7} />,
            )}
          </div>

          {reconciliation ? (
            <section className="mt-4 rounded border border-[var(--input-border)] bg-[var(--muted)]/10 p-4">
              <div className={`mb-4 rounded border px-3 py-3 ${toneClass(tone)}`}>
                <div className="flex items-start gap-2">
                  {tone === "success" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                  )}
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-wide">
                      {reconciliationStatusLabel(reconciliation.tiemposStatus)}
                    </div>
                    <div className="mt-1 text-xs">
                      Comparacion Contica / Tucan / Tiempos guardada en este cierre.
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border border-[var(--input-border)] bg-[var(--card-bg)]/40 p-3">
                  <div className="mb-2 text-sm font-semibold">Tucan vs R08</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--muted-foreground)]">Tucan digitado</span>
                      <span className="font-semibold">{formatCurrency("CRC", reconciliation.externalSnapshots.tucanCumulative)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--muted-foreground)]">Tucan turno</span>
                      <span className="font-semibold">{formatCurrency("CRC", reconciliation.calculated.tucanForShift)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--muted-foreground)]">R08</span>
                      <span className="font-semibold">{formatCurrency("CRC", reconciliation.contica.r08)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--muted-foreground)]">Diferencia</span>
                      <span className={`font-semibold ${diffClass(reconciliation.calculated.tucanDifference)}`}>
                        {formatReconciliationDiff(reconciliation.calculated.tucanDifference)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded border border-[var(--input-border)] bg-[var(--card-bg)]/40 p-3">
                  <div className="mb-2 text-sm font-semibold">Tiempos vs T11</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--muted-foreground)]">Tiempos digitado</span>
                      <span className="font-semibold">{formatCurrency("CRC", reconciliation.externalSnapshots.tiemposCumulative)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--muted-foreground)]">Tiempos turno</span>
                      <span className="font-semibold">{formatCurrency("CRC", reconciliation.calculated.tiemposForShift)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--muted-foreground)]">T11</span>
                      <span className="font-semibold">{formatCurrency("CRC", reconciliation.contica.t11)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--muted-foreground)]">Diferencia</span>
                      <span className={`font-semibold ${diffClass(reconciliation.calculated.tiemposDifference)}`}>
                        {formatReconciliationDiff(reconciliation.calculated.tiemposDifference)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {tiemposCompensationSummary ? (
                <div className="mt-3 rounded border border-[var(--input-border)] bg-[var(--card-bg)]/40 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <RefreshCw className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.7} />
                    Compensacion
                  </div>
                  <div className="text-sm font-semibold">{tiemposCompensationSummary.title}</div>
                  <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {tiemposCompensationSummary.text}
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--muted-foreground)] md:grid-cols-3">
                    {tiemposCompensationSummary.rows.map(([label, value]) => (
                      <span key={label}>
                        {label}: {value}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <div className="flex flex-col justify-end gap-2 border-t border-[var(--input-border)] px-5 py-4 sm:flex-row">
          {mobileDownloadError ? (
            <div className="self-center text-sm text-red-300 sm:mr-auto">
              {mobileDownloadError}
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={downloading || mobileDownloading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--input-border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
            ) : (
              <Download className="h-4 w-4" strokeWidth={1.8} />
            )}
            {downloading ? "Generando..." : "Descargar imagen"}
          </button>
          <button
            type="button"
            onClick={handleMobileDownload}
            disabled={downloading || mobileDownloading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--input-border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mobileDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
            ) : (
              <QrCode className="h-4 w-4" strokeWidth={1.8} />
            )}
            {mobileDownloading ? "Generando..." : "Descarga movil"}
          </button>
          <button
            type="button"
            onClick={handleCloseSummary}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyClosingSummaryModal;
