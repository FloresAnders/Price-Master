"use client";

import React, { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { X } from "lucide-react";
import { TokenService } from "../../services/tokenService";
import { canApproveOrCancelDeviceLink } from "./deviceLinkModalState";

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
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const canActOnScannedRequest = canApproveOrCancelDeviceLink(status);

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
          // refresh sessions list
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
      alert("Error al crear el enlace. Contacta al administrador.");
    } finally {
      setLoading(false);
    }
  };

  const approveRequest = async () => {
    if (!requestId || !canActOnScannedRequest) return;
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
      console.error('Error approving device link:', err);
      alert('Error al autorizar. Inténtalo de nuevo.');
    }
  };

  const cancelRequestDisplay = () => {
    if (!canActOnScannedRequest) return;
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setQrDataUrl("");
    setRequestId(null);
    setExpiresAt(null);
    setStatus(null);
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
      alert("Error al rechazar la solicitud. Inténtalo de nuevo.");
    }
  };

  return isOpen ? (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-lg">
        <div className="rounded-2xl overflow-hidden shadow-xl border border-[var(--input-border)] bg-[var(--card-bg)]">
          <div className="p-4 border-b border-[var(--input-border)] flex items-center justify-between bg-[var(--card-bg)]">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Vincular dispositivo móvil</h3>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--muted)]/10 transition-colors" aria-label="Cerrar modal">
              <X className="w-5 h-5 text-[var(--muted-foreground)]" />
            </button>
          </div>

          <div className="p-6">
            <div className="flex flex-col items-center gap-4">
              {!qrDataUrl && (
                <div className="w-full">
                  <div className="text-sm text-gray-600 mb-3">Duración</div>
                  <div className="flex gap-2">
                    {[15, 60, 120].map((d) => {
                      const selected = selectedDuration === d;
                      return (
                        <button
                          key={d}
                          onClick={() => { setSelectedDuration(d); createRequest(d); }}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selected ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200'}`}
                        >
                          {d === 15 ? '15 min' : d === 60 ? '1 hora' : '2 horas'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {loading && <div className="text-sm text-gray-600">Generando QR…</div>}

              {qrDataUrl && (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 rounded-md border bg-[var(--card-bg)]">
                    <img src={qrDataUrl} alt="QR" width={260} height={260} />
                  </div>
                  <div className="text-sm text-[var(--muted-foreground)]">Estado: <span className="font-medium text-[var(--foreground)]">{status}</span></div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={approveRequest} disabled={!canActOnScannedRequest} className="px-4 py-2 bg-[var(--accent)] text-white rounded-md shadow disabled:cursor-not-allowed disabled:opacity-50">Autorizar</button>
                    <button onClick={rejectRequest} className="px-4 py-2 bg-[var(--error)] text-white rounded-md shadow">Rechazar</button>
                    <button onClick={cancelRequestDisplay} disabled={!canActOnScannedRequest} className="px-4 py-2 bg-[var(--card-bg)] border border-[var(--input-border)] rounded-md disabled:cursor-not-allowed disabled:opacity-50">Cancelar</button>
                  </div>
                </div>
              )}

              {sessions.length > 0 && (
                <div className="w-full mt-4">
                  <h4 className="text-sm font-medium mb-2">Dispositivos vinculados</h4>
                  <div className="flex flex-col gap-2 max-h-48 overflow-auto">
                    {sessions.map((s) => (
                      <div key={s.id} className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{s.deviceName || 'Dispositivo móvil'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-300">Creado: {new Date(s.createdAt).toLocaleString()}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-300">Expira: {new Date(s.expiresAt).toLocaleString()}</div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-xs text-gray-600 dark:text-gray-300">Permisos: {(s.permissions || []).join(', ') || '—'}</div>
                          <button className="text-sm text-red-600 dark:text-red-400">Revocar</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;
}
