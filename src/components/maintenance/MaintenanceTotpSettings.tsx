"use client";

import { Check, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { User } from "@/types/firestore";

type EnrollmentState = "loading" | "inactive" | "enrolling" | "active";

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

export function MaintenanceTotpSettings({ role }: { role?: User["role"] }) {
  const [state, setState] = useState<EnrollmentState>("loading");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (role !== "superadmin") return;
    let mounted = true;
    void fetch("/api/me/maintenance-totp/status", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await readJson(response);
        if (!response.ok) throw new Error("status_failed");
        if (mounted) setState(data.active === true ? "active" : "inactive");
      })
      .catch(() => {
        if (mounted) {
          setState("inactive");
          setError("No se pudo consultar el acceso de mantenimiento.");
        }
      });
    return () => {
      mounted = false;
    };
  }, [role]);

  if (role !== "superadmin") return null;

  const startEnrollment = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/me/maintenance-totp/start", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await readJson(response);
      if (!response.ok || typeof data.qrDataUrl !== "string") {
        throw new Error("start_failed");
      }
      setQrDataUrl(data.qrDataUrl);
      setCode("");
      setState("enrolling");
    } catch {
      setError("No se pudo iniciar la activación.");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnrollment = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError("Ingresa un código válido de 6 dígitos.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/me/maintenance-totp/confirm", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) throw new Error("confirm_failed");
      setQrDataUrl("");
      setCode("");
      setState("active");
    } catch {
      setError("Código inválido.");
    } finally {
      setBusy(false);
    }
  };

  const disableEnrollment = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/me/maintenance-totp", {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("disable_failed");
      setState("inactive");
      setQrDataUrl("");
      setCode("");
    } catch {
      setError("No se pudo desactivar el acceso de mantenimiento.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-cyan-400/15 bg-cyan-500/5 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 bg-slate-900/60 text-cyan-400">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-200">
              Acceso de mantenimiento
            </p>
            {state === "active" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                <Check className="h-3.5 w-3.5" aria-hidden="true" /> Activo
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Usa tu autenticador para obtener un pase temporal durante mantenimiento.
          </p>
        </div>
      </div>

      {state === "loading" && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Verificando…
        </div>
      )}

      {state === "inactive" && (
        <button
          type="button"
          onClick={startEnrollment}
          disabled={busy}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Activar acceso de mantenimiento
        </button>
      )}

      {state === "enrolling" && qrDataUrl && (
        <div className="space-y-3">
          <p className="text-xs text-slate-300">
            Escanea este QR ahora. Por seguridad solo se muestra durante esta activación.
          </p>
          {/* The QR is generated by our authenticated server endpoint. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="Código QR para acceso de mantenimiento"
            className="mx-auto h-48 w-48 rounded-xl bg-white p-2"
          />
          <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            Primer código de 6 dígitos
            <input
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="h-11 rounded-lg border border-white/10 bg-slate-900/80 px-3 text-center text-lg tracking-[0.35em] text-slate-100 outline-none focus:border-cyan-400/40"
            />
          </label>
          <button
            type="button"
            onClick={confirmEnrollment}
            disabled={busy || code.length !== 6}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar
          </button>
        </div>
      )}

      {state === "active" && (
        <button
          type="button"
          onClick={disableEnrollment}
          disabled={busy}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-4 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Desactivar
        </button>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
