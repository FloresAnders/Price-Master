"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Fingerprint,
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import type { PublicPasskey } from "@/lib/passkeys/types";
import { registerPasskey } from "@/lib/passkeys/client";

interface PasskeyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId?: string;
  targetUserName?: string;
}

async function readJson(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "passkey_management_failed");
  }
  return payload;
}

function formatDate(value: number | null): string {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function PasskeyManagerModal({
  isOpen,
  onClose,
  targetUserId,
  targetUserName,
}: PasskeyManagerModalProps) {
  const [passkeys, setPasskeys] = useState<PublicPasskey[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [password, setPassword] = useState("");

  const loadPasskeys = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setError("");
    try {
      const query = targetUserId
        ? `?userId=${encodeURIComponent(targetUserId)}`
        : "";
      const response = await fetch(`/api/auth/passkeys${query}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = await readJson(response);
      setPasskeys(payload.passkeys as PublicPasskey[]);
    } catch (loadError) {
      console.warn("No se pudieron cargar las passkeys", loadError);
      setError("No se pudieron cargar las passkeys.");
    } finally {
      setLoading(false);
    }
  }, [isOpen, targetUserId]);

  useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

  const renamePasskey = async (passkey: PublicPasskey) => {
    const label = editingLabel.trim();
    if (!label) return;
    setWorkingId(passkey.id);
    setError("");
    try {
      const response = await fetch(
        `/api/auth/passkeys/${encodeURIComponent(passkey.id)}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label }),
        },
      );
      const payload = await readJson(response);
      setPasskeys((current) =>
        current.map((item) =>
          item.id === passkey.id ? (payload.passkey as PublicPasskey) : item,
        ),
      );
      setEditingId(null);
      setEditingLabel("");
    } catch (renameError) {
      console.warn("No se pudo renombrar la passkey", renameError);
      setError("No se pudo cambiar el nombre de la passkey.");
    } finally {
      setWorkingId(null);
    }
  };

  const revokePasskey = async (passkey: PublicPasskey) => {
    const confirmed = window.confirm(
      `¿Revocar “${passkey.label}”? Los accesos vinculados se cerrarán.`,
    );
    if (!confirmed) return;
    setWorkingId(passkey.id);
    setError("");
    try {
      const response = await fetch(
        `/api/auth/passkeys/${encodeURIComponent(passkey.id)}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      const payload = await readJson(response);
      setPasskeys((current) =>
        current.map((item) =>
          item.id === passkey.id ? (payload.passkey as PublicPasskey) : item,
        ),
      );
    } catch (revokeError) {
      console.warn("No se pudo revocar la passkey", revokeError);
      setError("No se pudo revocar la passkey.");
    } finally {
      setWorkingId(null);
    }
  };

  const enroll = async (event: React.FormEvent) => {
    event.preventDefault();
    setWorkingId("new");
    setError("");
    try {
      const response = await fetch("/api/auth/passkeys/reauth", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await readJson(response);
      await registerPasskey(payload.enrollmentGrantId as string);
      setPassword("");
      setShowEnrollment(false);
      await loadPasskeys();
    } catch (enrollmentError) {
      console.warn("No se pudo registrar la passkey", enrollmentError);
      setError("No se pudo registrar la passkey. Verifica tu contraseña.");
    } finally {
      setWorkingId(null);
    }
  };

  if (!isOpen) return null;

  const title = targetUserId
    ? `Passkeys de ${targetUserName || "usuario"}`
    : "Mis passkeys";

  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="passkey-manager-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 text-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-800 bg-slate-950/95 px-5 py-5 backdrop-blur">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
              <Fingerprint className="h-7 w-7" />
            </span>
            <div>
              <h2 id="passkey-manager-title" className="text-xl font-semibold">
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Huella, rostro o PIN del dispositivo. TimeMaster no recibe datos biométricos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar gestión de passkeys"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          {error && (
            <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Cargando passkeys…
            </div>
          ) : passkeys.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 px-5 py-10 text-center">
              <KeyRound className="mx-auto mb-3 h-10 w-10 text-slate-500" />
              <p className="font-medium">Aún no tienes passkeys registradas.</p>
              <p className="mt-2 text-sm text-slate-400">
                Puedes seguir ingresando con tu contraseña.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {passkeys.map((passkey) => {
                const revoked = passkey.revokedAt !== null;
                const working = workingId === passkey.id;
                return (
                  <li
                    key={passkey.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row">
                      <div className="min-w-0 flex-1">
                        {editingId === passkey.id ? (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              void renamePasskey(passkey);
                            }}
                            className="flex gap-2"
                          >
                            <label htmlFor={`passkey-label-${passkey.id}`} className="sr-only">
                              Nombre de la passkey
                            </label>
                            <input
                              id={`passkey-label-${passkey.id}`}
                              value={editingLabel}
                              onChange={(event) => setEditingLabel(event.target.value)}
                              maxLength={80}
                              className="h-10 min-w-0 flex-1 rounded-lg border border-blue-500 bg-slate-950 px-3 outline-none"
                            />
                            <button
                              type="submit"
                              disabled={working || !editingLabel.trim()}
                              className="rounded-lg bg-blue-600 px-3 text-sm font-medium disabled:opacity-50"
                            >
                              Guardar nombre
                            </button>
                          </form>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-semibold">{passkey.label}</h3>
                            <span
                              className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                                revoked
                                  ? "bg-red-500/15 text-red-300"
                                  : "bg-emerald-500/15 text-emerald-300"
                              }`}
                            >
                              {revoked ? "Revocada" : "Activa"}
                            </span>
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {passkey.backedUp || passkey.deviceType === "multiDevice"
                              ? "Sincronizada"
                              : "Este dispositivo"}
                          </span>
                          <span className="rounded-full bg-slate-800 px-2.5 py-1">
                            Creada: {formatDate(passkey.createdAt)}
                          </span>
                          <span className="rounded-full bg-slate-800 px-2.5 py-1">
                            Último uso: {formatDate(passkey.lastUsedAt)}
                          </span>
                        </div>
                      </div>

                      {!revoked && editingId !== passkey.id && (
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(passkey.id);
                              setEditingLabel(passkey.label);
                            }}
                            disabled={working}
                            aria-label={`Renombrar ${passkey.label}`}
                            className="rounded-lg border border-slate-700 p-2.5 text-slate-300 hover:border-blue-500 hover:text-blue-300 disabled:opacity-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void revokePasskey(passkey)}
                            disabled={working}
                            aria-label={`Revocar ${passkey.label}`}
                            className="rounded-lg border border-red-500/40 p-2.5 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!targetUserId && !showEnrollment && (
            <button
              type="button"
              onClick={() => setShowEnrollment(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-medium hover:bg-blue-500"
            >
              <Plus className="h-5 w-5" />
              Agregar passkey
            </button>
          )}

          {!targetUserId && showEnrollment && (
            <form onSubmit={enroll} className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4">
              <h3 className="font-semibold">Confirma tu identidad</h3>
              <p className="mt-1 text-sm text-slate-400">
                Escribe la contraseña de tu cuenta antes de registrar este acceso.
              </p>
              <label htmlFor="passkey-current-password" className="mt-4 block text-sm font-medium">
                Contraseña actual
              </label>
              <input
                id="passkey-current-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 outline-none focus:border-blue-500"
              />
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowEnrollment(false);
                    setPassword("");
                  }}
                  disabled={workingId === "new"}
                  className="h-11 rounded-xl border border-slate-700 px-4 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={workingId === "new" || !password}
                  className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-medium disabled:opacity-50"
                >
                  {workingId === "new" ? "Verificando…" : "Verificar y registrar"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
