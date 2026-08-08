"use client";

import React, { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { X } from "lucide-react";
import { TokenService } from "../../services/tokenService";

interface DeviceLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DeviceLinkModal({ isOpen, onClose }: DeviceLinkModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQrDataUrl("");
      setRequestId(null);
      setExpiresAt(null);
      setStatus(null);
      setLoading(false);
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    // fetch current device sessions for this user
    (async () => {
      try {
        const rawToken = TokenService.getRawToken?.() ?? null;
        const headers: Record<string, string> = {};
        if (rawToken) headers['Authorization'] = `Bearer ${rawToken}`;
        const res = await fetch('/api/device-link/sessions', { headers });
        const data = await res.json();
        if (res.ok && data.sessions) setSessions(data.sessions);
      } catch (e) {
        // ignore
      }
    })();
  }, [isOpen]);

  const createRequest = async (durationMinutes = 60) => {
    setLoading(true);
    setQrDataUrl("");
    setRequestId(null);
    setExpiresAt(null);
    setStatus(null);

    try {
      const rawToken = TokenService.getRawToken?.() ?? null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (rawToken) headers["Authorization"] = `Bearer ${rawToken}`;

      const res = await fetch("/api/device-link/create", {
        method: "POST",
        headers,
        body: JSON.stringify({ durationMinutes, permissions: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");

      setRequestId(data.requestId);
      setExpiresAt(data.expiresAt);

      const absolute = `${window.location.origin}${data.qrUrl}`;
      const dataUrl = await QRCode.toDataURL(absolute, { width: 260 });
      setQrDataUrl(dataUrl);
      setStatus("pending");

      // start polling
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(async () => {
        try {
          const sres = await fetch(`/api/device-link/status?requestId=${data.requestId}`);
          const sdata = await sres.json();
          if (sres.ok) {
            const st = (sdata.request && sdata.request.status) || null;
            setStatus(st);
            if (st === 'scanned') {
              // keep polling so user can approve
            }
            if (st === 'approved') {
              // show approved state briefly then close modal
              setStatus('approved');
              if (pollRef.current) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
              }
              setTimeout(() => {
                onClose();
              }, 1500);
            }
            if (st === 'rejected' || st === 'expired' || st === 'used') {
              if (pollRef.current) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
              }
            }
          }
        } catch (err) {
          // ignore
        }
      }, 2000);
    } catch (err: any) {
      console.error("Error creating device link:", err);
      alert(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const approveRequest = async () => {
    if (!requestId) return;
    try {
      const rawToken = TokenService.getRawToken?.() ?? null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (rawToken) headers["Authorization"] = `Bearer ${rawToken}`;
      const res = await fetch(`/api/device-link/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "approve_failed");
      setStatus("approved");
      // refresh sessions list
      try {
        const sres = await fetch('/api/device-link/sessions', { headers });
        const sdata = await sres.json();
        if (sres.ok && sdata.sessions) setSessions(sdata.sessions);
      } catch (e) {
        // ignore
      }
    } catch (err: any) {
      alert(err?.message || String(err));
    }
  };

  const rejectRequest = async () => {
    if (!requestId) return;
    try {
      const rawToken = TokenService.getRawToken?.() ?? null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (rawToken) headers["Authorization"] = `Bearer ${rawToken}`;
      await fetch(`/api/device-link/reject`, {
        method: "POST",
        headers,
        body: JSON.stringify({ requestId }),
      });
      setStatus("rejected");
    } catch (err) {
      console.error(err);
      alert("Error rejecting");
    }
  };

  return isOpen ? (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Cerrar modal"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <h3 className="text-lg font-semibold text-center mb-4 text-gray-900 dark:text-gray-100">
          Vincular dispositivo móvil
        </h3>

        <div className="flex flex-col items-center gap-4">
          {!qrDataUrl && (
            <div className="flex gap-2">
              <button
                onClick={() => createRequest(15)}
                className="px-4 py-2 bg-gray-100 rounded"
              >
                15 min
              </button>
              <button
                onClick={() => createRequest(60)}
                className="px-4 py-2 bg-gray-100 rounded"
              >
                1 hora
              </button>
              <button
                onClick={() => createRequest(120)}
                className="px-4 py-2 bg-gray-100 rounded"
              >
                2 horas
              </button>
            </div>
          )}

          {loading && <div>Generando QR…</div>}

          {qrDataUrl && (
            <div className="flex flex-col items-center gap-2">
              <img src={qrDataUrl} alt="QR" width={260} height={260} />
              <div className="text-sm text-gray-600">Estado: {status}</div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={approveRequest}
                  className="px-4 py-2 bg-green-500 text-white rounded"
                >
                  Autorizar
                </button>
                <button
                  onClick={rejectRequest}
                  className="px-4 py-2 bg-red-500 text-white rounded"
                >
                  Rechazar
                </button>
                <button
                  onClick={() => {
                    // cancelar
                    if (pollRef.current) {
                      window.clearInterval(pollRef.current);
                      pollRef.current = null;
                    }
                    setQrDataUrl("");
                    setRequestId(null);
                    setExpiresAt(null);
                    setStatus(null);
                  }}
                  className="px-4 py-2 bg-gray-200 rounded"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {/* sessions list */}
          {sessions.length > 0 && (
            <div className="w-full mt-4">
              <h4 className="text-sm font-medium mb-2">Dispositivos vinculados</h4>
              <div className="flex flex-col gap-2 max-h-48 overflow-auto">
                {sessions.map((s) => (
                  <div key={s.id} className="p-2 rounded border bg-gray-50 dark:bg-gray-700">
                    <div className="text-xs text-gray-700 dark:text-gray-200">ID: {s.id}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-300">Creado: {new Date(s.createdAt).toLocaleString()}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-300">Expira: {new Date(s.expiresAt).toLocaleString()}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-300">Permisos: {(s.permissions || []).join(', ') || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;
}
