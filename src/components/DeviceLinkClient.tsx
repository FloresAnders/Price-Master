"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function DeviceLinkClient() {
  const router = useRouter();
  const [requestId, setRequestId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [authUser, setAuthUser] = useState<any | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    const mapServerError = (e?: string | null) =>
      e === 'internal_server_error'
        ? 'Error del servidor. Contacta al administrador.'
        : e || 'Error reclamando QR';

    // parse search params on client
    const sp = new URLSearchParams(window.location.search);
    const r = sp.get("r") || sp.get("requestId");
    const t = sp.get("t") || sp.get("token");
    setRequestId(r);
    setToken(t);
    if (!r || !t) {
      setError("Parámetros incompletos en el QR.");
      return;
    }
    const rid = r;
    const tok = t;

    // claim immediately
    const doClaim = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/device-link/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId, token, deviceInfo: { userAgent: navigator.userAgent } }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(mapServerError(data?.error));
          setStatus(data?.status || null);
          setLoading(false);
          return;
        }
        setStatus(data.status || "scanned");
      } catch (err: any) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    void doClaim();

    // start polling status
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const sres = await fetch(`/api/device-link/status?requestId=${encodeURIComponent(rid)}`);
        const sdata = await sres.json();
        if (sres.ok) {
          const st = (sdata.request && sdata.request.status) || null;
          setStatus(st);
          if (st === "approved") {
            // exchange to get session cookie
            try {
              const ex = await fetch(`/api/device-link/exchange`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId: rid, token: tok }),
              });
              if (ex.ok) {
                // Exchange succeeded. Retry whoami for a short time to allow session visibility
                try {
                  const maxRetries = 6;
                  let whoData: any = null;
                  for (let i = 0; i < maxRetries; i++) {
                    const who = await fetch('/api/device-link/whoami', { credentials: 'include' });
                    const json = await who.json().catch(() => null);
                    if (who.ok && json && json.user) {
                      whoData = json;
                      break;
                    }
                    // small backoff
                    await new Promise((r) => setTimeout(r, 400));
                  }

                  if (whoData && whoData.user) {
                    // Create token session locally so AuthWrapper recognizes the user
                     
                    const { TokenService } = require('../shared/services/tokenService');
                    const u = whoData.user;
                    TokenService.createTokenSession(u);
                    setAuthUser(u);
                    setAuthenticated(true);
                    if (pollRef.current) {
                      window.clearInterval(pollRef.current);
                      pollRef.current = null;
                    }
                    return;
                  }
                } catch (e) {
                  // ignore and fallback to home
                }
                if (pollRef.current) {
                  window.clearInterval(pollRef.current);
                  pollRef.current = null;
                }
                setError('No se pudo autenticar automáticamente. Pulsa Reintentar.');
                } else {
                const ed = await ex.json();
                setError(mapServerError(ed?.error));
              }
            } catch (e) {
              setError(String(e));
            }
          }
          if (st === "rejected" || st === "expired" || st === "used") {
            if (pollRef.current) {
              window.clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        }
      } catch (err) {
        // ignore polling errors
      }
    }, 2000);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [requestId, token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[var(--card-bg)] border border-[var(--input-border)] p-6 rounded shadow text-[var(--foreground)]">
        <h1 className="text-lg font-semibold mb-4 text-[var(--foreground)]">Vincular dispositivo</h1>
        {!requestId || !token ? (
          <p className="text-sm text-red-600">QR inválido o incompleto.</p>
        ) : (
          <>
            <p className="mb-2">Solicitud: <strong>{requestId}</strong></p>
            <p className="mb-2">Estado: <strong>{status || 'en proceso'}</strong></p>
            {loading && <p>Registrando escaneo…</p>}
            {error && <p className="text-sm text-black">{error}</p>}
            <div className="mt-4 flex gap-2 disabled:">
             {/* <button
                onClick={() => { window.location.reload(); }}
                className="px-3 py-2 bg-[var(--card-bg)] border border-[var(--input-border)] rounded disabled"
              >Reintentar</button>
              <button
                onClick={() => router.push('/')}
                className="px-3 py-2 bg-[var(--card-bg)] border border-[var(--input-border)] rounded"
              >Cancelar</button> */}
            </div>
          </>
        )}
        {/* Authenticated modal */}
        {authenticated && (
          <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
            <div className="rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] shadow-xl w-full max-w-sm p-6 relative">
              <button
                onClick={() => { window.location.href = '/home'; }}
                className="absolute top-3 right-3 p-1 rounded-md hover:bg-[var(--muted)]/10 transition-colors"
                aria-label="Cerrar"
              >
                ×
              </button>
              <h3 className="text-lg font-semibold text-center mb-3 text-[var(--foreground)]">Autenticado</h3>
              <p className="text-sm text-center text-[var(--muted-foreground)] mb-4">Tu dispositivo ha sido vinculado correctamente.</p>
              {authUser && (
                <div className="text-center text-sm text-gray-600 dark:text-gray-300 mb-4">
                  <div>{authUser.displayName || authUser.name || authUser.email || authUser.id}</div>
                </div>
              )}

              <div className="flex justify-center">
                <button
                  onClick={() => { window.location.href = '/home'; }}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
