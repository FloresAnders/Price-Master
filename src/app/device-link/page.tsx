"use client";

import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function DeviceLinkPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestId = searchParams.get("r") || searchParams.get("requestId");
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [authUser, setAuthUser] = useState<any | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!requestId || !token) {
      setError("Parámetros incompletos en el QR.");
      return;
    }

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
          setError(data?.error || "Error reclamando QR");
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
        const sres = await fetch(`/api/device-link/status?requestId=${encodeURIComponent(requestId)}`);
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
                body: JSON.stringify({ requestId, token }),
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
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const { TokenService } = require('../../services/tokenService');
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
                setError(ed?.error || "exchange_failed");
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
      <div className="max-w-md w-full bg-white p-6 rounded shadow">
        <h1 className="text-lg font-semibold mb-4">Vincular dispositivo</h1>
        {!requestId || !token ? (
          <p className="text-sm text-red-600">QR inválido o incompleto.</p>
        ) : (
          <>
            <p className="mb-2">Solicitud: <strong>{requestId}</strong></p>
            <p className="mb-2">Estado: <strong>{status || 'en proceso'}</strong></p>
            {loading && <p>Registrando escaneo…</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { window.location.reload(); }}
                className="px-3 py-2 bg-gray-100 rounded"
              >Reintentar</button>
              <button
                onClick={() => router.push('/')}
                className="px-3 py-2 bg-gray-100 rounded"
              >Cancelar</button>
            </div>
          </>
        )}
        {/* Authenticated modal */}
        {authenticated && (
          <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 relative">
              <button
                onClick={() => { window.location.reload(); }}
                className="absolute top-3 right-3 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Cerrar"
              >
                ×
              </button>

              <h3 className="text-lg font-semibold text-center mb-3 text-gray-900 dark:text-gray-100">Autenticado</h3>
              <p className="text-sm text-center text-gray-700 dark:text-gray-300 mb-4">Tu dispositivo ha sido vinculado correctamente.</p>
              {authUser && (
                <div className="text-center text-sm text-gray-600 dark:text-gray-300 mb-4">
                  <div>{authUser.displayName || authUser.name || authUser.email || authUser.id}</div>
                </div>
              )}

              <div className="flex justify-center">
              <button
                onClick={() => { window.location.href = '/home'; }}
                className="px-4 py-2 bg-green-500 text-white rounded"
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
