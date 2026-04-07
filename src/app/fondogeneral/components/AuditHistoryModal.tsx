import React from "react";

export type AuditHistoryModalData = {
  history?: any[];
} | null;

export function AuditHistoryModal({
  open,
  onClose,
  auditModalData,
  dateTimeFormatter,
  formatByCurrency,
  providersMap,
}: {
  open: boolean;
  onClose: () => void;
  auditModalData: AuditHistoryModalData;
  dateTimeFormatter: Intl.DateTimeFormat;
  formatByCurrency: (currency: "CRC" | "USD", value: number) => string;
  providersMap: Map<string, string>;
}) {
  const auditPreferredFieldOrder = [
    "providerCode",
    "provider",
    "providerName",
    "paymentType",
    "type",
    "movementType",
    "amountIngreso",
    "amountEgreso",
    "ingreso",
    "egreso",
    "amount",
    "monto",
    "currency",
    "invoiceNumber",
    "notes",
    "manager",
  ] as const;

  const isPlainObject = (value: unknown): value is Record<string, any> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  const normalizeAuditSnapshot = (snapshot: unknown): Record<string, any> =>
    isPlainObject(snapshot) ? snapshot : {};

  const coerceFiniteNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) return null;
      const parsed = Number(trimmed.replaceAll(",", ""));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const isIngresoKey = (key: string) =>
    key.toLowerCase().includes("ingreso") ||
    key.toLowerCase() === "amountingreso";

  const isEgresoKey = (key: string) =>
    key.toLowerCase().includes("egreso") || key.toLowerCase() === "amountegreso";

  const getAuditCurrency = (
    before: Record<string, any>,
    after: Record<string, any>
  ): "CRC" | "USD" => {
    const raw = (after?.currency ?? before?.currency) as unknown;
    return raw === "USD" ? "USD" : "CRC";
  };

  const stableValueString = (value: unknown) => {
    if (value === undefined) return "undefined";
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const formatAuditValue = (
    key: string,
    value: unknown,
    currency: "CRC" | "USD"
  ) => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Sí" : "No";

    if (key === "providerCode") {
      const code = String(value).trim();
      const resolvedName = providersMap.get(code);
      return resolvedName ? `${code} — ${resolvedName}` : code || "—";
    }

    if (typeof value === "string") return value.trim().length ? value : "—";

    const numeric = coerceFiniteNumber(value);
    if (numeric !== null) {
      if (
        isIngresoKey(key) ||
        isEgresoKey(key) ||
        key === "amount" ||
        key === "monto"
      ) {
        return formatByCurrency(currency, numeric);
      }
      return String(numeric);
    }

    if (Array.isArray(value)) return value.length ? "[lista]" : "[]";
    if (isPlainObject(value)) return "[objeto]";
    return String(value);
  };

  const buildAuditDiffKeys = (
    before: Record<string, any>,
    after: Record<string, any>
  ) => {
    const allKeys = new Set<string>([
      ...Object.keys(before || {}),
      ...Object.keys(after || {}),
    ]);

    const changedKeys = Array.from(allKeys).filter(
      (k) => stableValueString(before?.[k]) !== stableValueString(after?.[k])
    );

    const ordered = auditPreferredFieldOrder
      .filter((k) => allKeys.has(k as string))
      .map((k) => k as string);

    const rest = changedKeys
      .filter((k) => !ordered.includes(k))
      .sort((a, b) => a.localeCompare(b));

    const alwaysInclude = ["amountIngreso", "amountEgreso", "ingreso", "egreso"].filter(
      (k) => allKeys.has(k)
    );
    const base = Array.from(new Set([...ordered, ...alwaysInclude]));

    const result = base.filter(
      (k) => changedKeys.includes(k) || alwaysInclude.includes(k)
    );
    return Array.from(new Set([...result, ...rest]));
  };

  const pickAuditField = (snapshot: Record<string, any>, keys: string[]) => {
    for (const k of keys) {
      const v = snapshot?.[k];
      if (v !== undefined && v !== null && String(v).trim().length > 0) return v;
    }
    return undefined;
  };

  const getAuditFinancialSummary = (
    before: Record<string, any>,
    after: Record<string, any>,
    currency: "CRC" | "USD"
  ) => {
    const beforeIngreso =
      coerceFiniteNumber(before?.amountIngreso ?? before?.ingreso) ?? 0;
    const afterIngreso =
      coerceFiniteNumber(after?.amountIngreso ?? after?.ingreso) ?? 0;
    const beforeEgreso =
      coerceFiniteNumber(before?.amountEgreso ?? before?.egreso) ?? 0;
    const afterEgreso =
      coerceFiniteNumber(after?.amountEgreso ?? after?.egreso) ?? 0;

    const deltaIngreso = afterIngreso - beforeIngreso;
    const deltaEgreso = afterEgreso - beforeEgreso;

    const arrow = (from: number, to: number) =>
      to > from ? "↑" : to < from ? "↓" : "→";

    const ingresoLine = `Ingreso: ${formatByCurrency(
      currency,
      beforeIngreso
    )} → ${formatByCurrency(currency, afterIngreso)} ${arrow(
      beforeIngreso,
      afterIngreso
    )}`;
    const egresoLine = `Egreso: ${formatByCurrency(
      currency,
      beforeEgreso
    )} → ${formatByCurrency(currency, afterEgreso)} ${arrow(
      beforeEgreso,
      afterEgreso
    )}`;

    const approxEqual = (a: number, b: number) => Math.abs(a - b) <= 0.0001;
    let headline: string | null = null;

    if (
      beforeIngreso > 0 &&
      afterIngreso <= 0 &&
      beforeEgreso <= 0 &&
      afterEgreso > 0
    ) {
      const amount = approxEqual(beforeIngreso, afterEgreso)
        ? afterEgreso
        : Math.max(beforeIngreso, afterEgreso);
      headline = `Cambio financiero detectado: Ingreso → Egreso (${formatByCurrency(
        currency,
        amount
      )})`;
    } else if (
      beforeEgreso > 0 &&
      afterEgreso <= 0 &&
      beforeIngreso <= 0 &&
      afterIngreso > 0
    ) {
      const amount = approxEqual(beforeEgreso, afterIngreso)
        ? afterIngreso
        : Math.max(beforeEgreso, afterIngreso);
      headline = `Cambio financiero detectado: Egreso → Ingreso (${formatByCurrency(
        currency,
        amount
      )})`;
    } else if (deltaIngreso !== 0 || deltaEgreso !== 0) {
      headline = "Cambio financiero detectado";
    }

    return {
      headline,
      ingresoLine,
      egresoLine,
      beforeIngreso,
      afterIngreso,
      beforeEgreso,
      afterEgreso,
      deltaIngreso,
      deltaEgreso,
    };
  };

  const getAuditChangeClass = (
    key: string,
    beforeValue: unknown,
    afterValue: unknown
  ) => {
    const beforeNum = coerceFiniteNumber(beforeValue);
    const afterNum = coerceFiniteNumber(afterValue);
    const changed = stableValueString(beforeValue) !== stableValueString(afterValue);
    if (!changed) return "text-[var(--foreground)]";

    if (
      (isIngresoKey(key) || key === "amountIngreso") &&
      beforeNum !== null &&
      afterNum !== null
    ) {
      return afterNum < beforeNum
        ? "text-red-400 font-semibold"
        : "text-green-400 font-semibold";
    }
    if (
      (isEgresoKey(key) || key === "amountEgreso") &&
      beforeNum !== null &&
      afterNum !== null
    ) {
      return afterNum > beforeNum
        ? "text-red-400 font-semibold"
        : "text-green-400 font-semibold";
    }

    return "text-yellow-300 font-semibold";
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-800/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded border border-[var(--input-border)] bg-[#1f262a] p-6 shadow-lg text-white"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-modal-title"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 id="audit-modal-title" className="text-lg font-semibold">
            Historial de edición
          </h3>

          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted-foreground)]"
            aria-label="Leyenda de colores del historial"
          >
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500" />
              <span>Ingreso</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-yellow-400" />
              <span>Modificado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500" />
              <span>Egreso</span>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3 max-h-[60vh] overflow-auto">
          {!auditModalData?.history || auditModalData.history.length === 0 ? (
            <div className="p-3 bg-[#0f1516] rounded text-sm text-[var(--muted-foreground)]">
              No hay cambios registrados.
            </div>
          ) : (
            auditModalData.history.map((h, idx) => {
              const before = normalizeAuditSnapshot(h?.before);
              const after = normalizeAuditSnapshot(h?.after);
              const currency = getAuditCurrency(before, after);
              const diffKeys = buildAuditDiffKeys(before, after);
              const impact = getAuditFinancialSummary(before, after, currency);

              const providerBefore = pickAuditField(before, [
                "providerCode",
                "provider",
                "providerName",
              ]);
              const providerAfter = pickAuditField(after, [
                "providerCode",
                "provider",
                "providerName",
              ]);
              const typeBefore = pickAuditField(before, [
                "paymentType",
                "type",
                "movementType",
              ]);
              const typeAfter = pickAuditField(after, [
                "paymentType",
                "type",
                "movementType",
              ]);

              return (
                <details
                  key={idx}
                  className="rounded border border-[var(--input-border)] bg-[#0f1516]"
                  open={idx === 0}
                >
                  <summary className="cursor-pointer select-none px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="text-xs text-[var(--muted-foreground)]">
                      Cambio {idx + 1} —{" "}
                      {h?.at ? dateTimeFormatter.format(new Date(h.at)) : "—"}
                    </div>
                    {impact.headline && (
                      <div className="text-xs text-[var(--foreground)] font-medium">
                        {impact.headline}
                      </div>
                    )}
                  </summary>

                  <div className="px-3 pb-3">
                    {(impact.deltaIngreso !== 0 || impact.deltaEgreso !== 0) && (
                      <div className="mt-2 rounded border border-[var(--input-border)] bg-[#0b1011] p-3">
                        <div className="text-xs font-semibold text-[var(--foreground)]">
                          Indicadores de cambio
                        </div>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[var(--muted-foreground)]">
                          <div
                            className={
                              impact.deltaIngreso < 0
                                ? "text-red-400"
                                : impact.deltaIngreso > 0
                                  ? "text-green-400"
                                  : "text-[var(--muted-foreground)]"
                            }
                          >
                            {impact.ingresoLine}
                          </div>
                          <div
                            className={
                              impact.deltaEgreso > 0
                                ? "text-red-400"
                                : impact.deltaEgreso < 0
                                  ? "text-green-400"
                                  : "text-[var(--muted-foreground)]"
                            }
                          >
                            {impact.egresoLine}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded border border-[var(--input-border)] bg-[#0b1011] p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                          Antes
                        </div>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between gap-3">
                            <span className="text-xs text-[var(--muted-foreground)]">
                              Proveedor
                            </span>
                            <span
                              className={
                                stableValueString(providerBefore) !==
                                stableValueString(providerAfter)
                                  ? "text-yellow-300 font-semibold"
                                  : "text-[var(--foreground)]"
                              }
                            >
                              {formatAuditValue(
                                "providerCode",
                                providerBefore,
                                currency
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-xs text-[var(--muted-foreground)]">
                              Tipo
                            </span>
                            <span
                              className={
                                stableValueString(typeBefore) !==
                                stableValueString(typeAfter)
                                  ? "text-yellow-300 font-semibold"
                                  : "text-[var(--foreground)]"
                              }
                            >
                              {formatAuditValue(
                                "paymentType",
                                typeBefore,
                                currency
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-xs text-[var(--muted-foreground)]">
                              Ingreso
                            </span>
                            <span
                              className={getAuditChangeClass(
                                "amountIngreso",
                                before?.amountIngreso ?? before?.ingreso,
                                after?.amountIngreso ?? after?.ingreso
                              )}
                            >
                              {formatByCurrency(currency, impact.beforeIngreso)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-xs text-[var(--muted-foreground)]">
                              Egreso
                            </span>
                            <span
                              className={getAuditChangeClass(
                                "amountEgreso",
                                before?.amountEgreso ?? before?.egreso,
                                after?.amountEgreso ?? after?.egreso
                              )}
                            >
                              {formatByCurrency(currency, impact.beforeEgreso)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded border border-[var(--input-border)] bg-[#0b1011] p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                          Después
                        </div>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between gap-3">
                            <span className="text-xs text-[var(--muted-foreground)]">
                              Proveedor
                            </span>
                            <span
                              className={
                                stableValueString(providerBefore) !==
                                stableValueString(providerAfter)
                                  ? "text-yellow-300 font-semibold"
                                  : "text-[var(--foreground)]"
                              }
                            >
                              {formatAuditValue(
                                "providerCode",
                                providerAfter,
                                currency
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-xs text-[var(--muted-foreground)]">
                              Tipo
                            </span>
                            <span
                              className={
                                stableValueString(typeBefore) !==
                                stableValueString(typeAfter)
                                  ? "text-yellow-300 font-semibold"
                                  : "text-[var(--foreground)]"
                              }
                            >
                              {formatAuditValue(
                                "paymentType",
                                typeAfter,
                                currency
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-xs text-[var(--muted-foreground)]">
                              Ingreso
                            </span>
                            <span
                              className={getAuditChangeClass(
                                "amountIngreso",
                                before?.amountIngreso ?? before?.ingreso,
                                after?.amountIngreso ?? after?.ingreso
                              )}
                            >
                              {formatByCurrency(currency, impact.afterIngreso)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-xs text-[var(--muted-foreground)]">
                              Egreso
                            </span>
                            <span
                              className={getAuditChangeClass(
                                "amountEgreso",
                                before?.amountEgreso ?? before?.egreso,
                                after?.amountEgreso ?? after?.egreso
                              )}
                            >
                              {formatByCurrency(currency, impact.afterEgreso)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded border border-[var(--input-border)] bg-[#0b1011] p-3 overflow-auto">
                      <div className="text-xs font-semibold text-[var(--foreground)]">
                        Cambios (vista tipo diff)
                      </div>
                      <table className="w-full mt-2 text-xs sm:text-sm min-w-[520px]">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                            <th className="text-left py-2 pr-3">Campo</th>
                            <th className="text-left py-2 pr-3">Antes</th>
                            <th className="text-left py-2">Después</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--input-border)]">
                          {diffKeys.length === 0 ? (
                            <tr>
                              <td
                                colSpan={3}
                                className="py-3 text-[var(--muted-foreground)]"
                              >
                                No se detectaron diferencias.
                              </td>
                            </tr>
                          ) : (
                            diffKeys.map((key) => {
                              const b = before?.[key];
                              const a = after?.[key];
                              const changed =
                                stableValueString(b) !== stableValueString(a);
                              return (
                                <tr key={key}>
                                  <td className="py-2 pr-3 text-[var(--muted-foreground)] align-top whitespace-nowrap">
                                    {key}
                                  </td>
                                  <td className="py-2 pr-3 align-top">
                                    <span
                                      className={
                                        changed &&
                                        (isIngresoKey(key) || key === "amountIngreso")
                                          ? "text-green-400"
                                          : changed &&
                                              (isEgresoKey(key) ||
                                                key === "amountEgreso")
                                            ? "text-red-400"
                                            : "text-[var(--foreground)]"
                                      }
                                    >
                                      {formatAuditValue(key, b, currency)}
                                    </span>
                                  </td>
                                  <td className="py-2 align-top">
                                    <span
                                      className={getAuditChangeClass(key, b, a)}
                                    >
                                      {formatAuditValue(key, a, currency)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              );
            })
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[var(--input-border)] rounded"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
