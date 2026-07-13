"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, RefreshCw, Save } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getDefaultPermissions } from "../../utils/permissions";
import {
  MovimientosFondosService,
  type MovementStorage,
} from "../../services/movimientos-fondos";
import { RegistroTucanService } from "../../services/registro-tucan";
import type { RegistroTucanRecord } from "../../types/firestore";
import {
  calculateRegistroTucanTotal,
  formatRegistroTucanDateInput,
  parseRegistroTucanAmount,
} from "../../utils/registroTucan";

const formatCRC = (value: number) =>
  new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const resolveTucanBalance = (ledger: MovementStorage | null): number => {
  const balance = ledger?.state?.balancesByAccount?.find(
    (item) => item.accountId === "Tucan" && item.currency === "CRC",
  );
  return Number(balance?.currentBalance || 0);
};

export default function RegistroTucan() {
  const { user, loading } = useAuth();
  const [fecha, setFecha] = useState(() =>
    formatRegistroTucanDateInput(new Date()),
  );
  const [saldoPaginaTucanInput, setSaldoPaginaTucanInput] = useState("");
  const [saldoSinpesInput, setSaldoSinpesInput] = useState("");
  const [saldoFondoTucan, setSaldoFondoTucan] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [records, setRecords] = useState<RegistroTucanRecord[]>([]);

  const resolvedPermissions = user
    ? user.permissions || getDefaultPermissions(user.role || "user")
    : null;
  const hasPermission = Boolean(resolvedPermissions?.registroTucan);
  const empresa = String(user?.ownercompanie || "").trim();

  const saldoPaginaTucan = useMemo(
    () => parseRegistroTucanAmount(saldoPaginaTucanInput),
    [saldoPaginaTucanInput],
  );
  const saldoSinpesRecibidos = useMemo(
    () => parseRegistroTucanAmount(saldoSinpesInput),
    [saldoSinpesInput],
  );
  const total = useMemo(
    () =>
      calculateRegistroTucanTotal({
        saldoPaginaTucan,
        saldoFondoTucan,
        saldoSinpesRecibidos,
      }),
    [saldoPaginaTucan, saldoFondoTucan, saldoSinpesRecibidos],
  );

  const loadRecentRecords = useCallback(async () => {
    if (!empresa || !hasPermission) return;
    setRecordsLoading(true);
    try {
      const recent = await RegistroTucanService.getRecentRecords(empresa, 20);
      setRecords(recent);
    } catch (err) {
      console.error("Error loading Registro Tucan records:", err);
      setError("No se pudieron cargar los registros.");
    } finally {
      setRecordsLoading(false);
    }
  }, [empresa, hasPermission]);

  const loadTucanBalance = useCallback(async () => {
    if (!empresa || !hasPermission) return;
    setBalanceLoading(true);
    setError("");
    try {
      const docKey = MovimientosFondosService.buildCompanyMovementsKey(empresa);
      const ledger = await MovimientosFondosService.getDocument(docKey);
      setSaldoFondoTucan(resolveTucanBalance(ledger));
    } catch (err) {
      console.error("Error loading Fondo Tucan balance:", err);
      setError("No se pudo cargar el saldo del Fondo Tucan.");
    } finally {
      setBalanceLoading(false);
    }
  }, [empresa, hasPermission]);

  useEffect(() => {
    void loadTucanBalance();
    void loadRecentRecords();
  }, [loadTucanBalance, loadRecentRecords]);

  const handleSave = async () => {
    if (!user || !hasPermission || !empresa || !fecha || balanceLoading) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const dateKey = new Date(`${fecha}T00:00:00`).getTime();
      if (!Number.isFinite(dateKey)) {
        setError("Fecha inválida.");
        return;
      }

      await RegistroTucanService.createRecord({
        empresa,
        dateKey,
        fecha,
        saldoPaginaTucan,
        saldoFondoTucan,
        saldoSinpesRecibidos,
        total,
        createdById: user.id,
        createdByName: user.name || user.email || "",
      });

      setSaldoPaginaTucanInput("");
      setSaldoSinpesInput("");
      setSuccess("Registro guardado.");
      await loadRecentRecords();
    } catch (err) {
      console.error("Error saving Registro Tucan record:", err);
      setError("No se pudo guardar el registro.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl py-10 text-center text-[var(--muted-foreground)]">
        Cargando...
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-8 text-center">
        <Lock className="mx-auto mb-4 h-10 w-10 text-[var(--muted-foreground)]" />
        <h2 className="text-xl font-semibold text-[var(--foreground)]">
          Acceso restringido
        </h2>
        <p className="mt-2 text-[var(--muted-foreground)]">
          No tienes permisos para acceder a Registro Tucan.
        </p>
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-8 text-center">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">
          Empresa requerida
        </h2>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Tu usuario no tiene empresa asignada.
        </p>
      </div>
    );
  }

  const saveDisabled = saving || balanceLoading || !fecha;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Registro Tucan
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {empresa}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {[
          ["Saldo página Tucan", saldoPaginaTucan],
          ["Saldo Fondo Tucan", saldoFondoTucan],
          ["SINPEs recibidos", saldoSinpesRecibidos],
          ["Total", total],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-4"
          >
            <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
            <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">
              {formatCRC(Number(value))}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">
              Fecha
            </span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--foreground)]"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">
              Saldo página Tucan
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={saldoPaginaTucanInput}
              onChange={(e) => setSaldoPaginaTucanInput(e.target.value)}
              placeholder="0"
              className="w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--foreground)]"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">
              SINPEs recibidos
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={saldoSinpesInput}
              onChange={(e) => setSaldoSinpesInput(e.target.value)}
              placeholder="0"
              className="w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--foreground)]"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">
              Fondo Tucan
            </span>
            <div className="flex gap-2">
              <input
                value={balanceLoading ? "Cargando..." : formatCRC(saldoFondoTucan)}
                readOnly
                className="w-full rounded-md border border-[var(--input-border)] bg-[var(--muted)] px-3 py-2 text-[var(--foreground)]"
              />
              <button
                type="button"
                onClick={() => void loadTucanBalance()}
                disabled={balanceLoading}
                className="rounded-md border border-[var(--input-border)] px-3 text-[var(--foreground)] transition hover:bg-[var(--hover-bg)] disabled:opacity-50"
                title="Actualizar saldo Fondo Tucan"
                aria-label="Actualizar saldo Fondo Tucan"
              >
                <RefreshCw className={`h-4 w-4 ${balanceLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </label>
        </div>

        {(error || success) && (
          <p
            className={`mt-4 text-sm ${error ? "text-red-500" : "text-emerald-500"}`}
          >
            {error || success}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saveDisabled}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Registros recientes
          </h2>
          <button
            type="button"
            onClick={() => void loadRecentRecords()}
            disabled={recordsLoading}
            className="rounded-md border border-[var(--input-border)] px-3 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--hover-bg)] disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>

        {recordsLoading ? (
          <p className="text-sm text-[var(--muted-foreground)]">Cargando...</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            No hay registros guardados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-[var(--muted-foreground)]">
                <tr className="border-b border-[var(--input-border)]">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Página Tucan</th>
                  <th className="py-2 pr-3">Fondo Tucan</th>
                  <th className="py-2 pr-3">SINPEs</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-[var(--input-border)] last:border-0"
                  >
                    <td className="py-3 pr-3 text-[var(--foreground)]">
                      {record.fecha}
                    </td>
                    <td className="py-3 pr-3 text-[var(--foreground)]">
                      {formatCRC(record.saldoPaginaTucan)}
                    </td>
                    <td className="py-3 pr-3 text-[var(--foreground)]">
                      {formatCRC(record.saldoFondoTucan)}
                    </td>
                    <td className="py-3 pr-3 text-[var(--foreground)]">
                      {formatCRC(record.saldoSinpesRecibidos)}
                    </td>
                    <td className="py-3 pr-3 font-semibold text-[var(--foreground)]">
                      {formatCRC(record.total)}
                    </td>
                    <td className="py-3 pr-3 text-[var(--muted-foreground)]">
                      {record.createdByName || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
