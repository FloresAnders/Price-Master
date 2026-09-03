"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

interface TokenInfoProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
}

interface ServerSessionInfo {
  id: string;
  authMethod: "password" | "passkey";
  keepActive: boolean;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
}

interface SessionResponse {
  ok: boolean;
  session?: ServerSessionInfo;
}

export default function TokenInfo({ isOpen, onClose, inline = false }: TokenInfoProps) {
  const { user, getFormattedTimeLeft } = useAuth();
  const [showDetails, setShowDetails] = useState(false);
  const [session, setSession] = useState<ServerSessionInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void fetch("/api/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as SessionResponse | null;
        if (!response.ok || !payload?.ok || !payload.session) {
          throw new Error("session_unavailable");
        }
        if (active) setSession(payload.session);
      })
      .catch(() => {
        if (active) setError("No se pudo consultar la sesión del servidor.");
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDate = (value?: number) =>
    value ? new Date(value).toLocaleString("es-CR") : "No disponible";

  const content = (
    <>
      <div className="mb-4 rounded-lg border border-emerald-800 bg-emerald-900/20 p-4">
        <div className="mb-2 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span className="font-medium text-emerald-200">Sesión segura activa</span>
        </div>
        <div className="mb-1 font-mono text-2xl font-bold text-slate-100">
          {getFormattedTimeLeft()}
        </div>
        <div className="text-sm text-slate-400">
          Protegida por una cookie segura administrada por el servidor
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-white/10 bg-slate-900/50 p-4">
        <h3 className="mb-3 font-medium text-slate-100">Usuario autenticado</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Nombre:</span>
            <span className="font-medium text-slate-100">{user?.name}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Rol:</span>
            <span className="font-medium text-slate-100">{user?.role}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Empresa asignada:</span>
            <span className="text-right font-medium text-slate-100">
              {user?.ownercompanie || "No especificada"}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-white/10 bg-slate-900/50 p-4">
        <div className="flex items-start gap-3">
          {session?.keepActive ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 text-cyan-400" />
          ) : (
            <Clock className="mt-0.5 h-5 w-5 text-slate-400" />
          )}
          <div>
            <div className="font-medium text-slate-100">
              Mantener sesión al cerrar el navegador
            </div>
            <div className="mt-1 text-sm text-slate-400">
              {!session && !error
                ? "Consultando configuración…"
                : session?.keepActive
                  ? "Activado: podrás continuar hasta que venza la sesión."
                  : "Desactivado: la sesión termina al cerrar el navegador."}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowDetails((visible) => !visible)}
          className="flex items-center gap-2 text-sm text-cyan-400 transition-colors hover:text-cyan-300"
        >
          {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showDetails ? "Ocultar" : "Mostrar"} detalles técnicos
        </button>

        {showDetails && session && (
          <div className="mt-3 grid gap-2 rounded-lg bg-slate-900 p-3 font-mono text-xs">
            <div>
              <span className="text-slate-400">ID de sesión:</span>
              <div className="break-all text-slate-100">{session.id}</div>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Método:</span>
              <span className="text-slate-100">
                {session.authMethod === "passkey" ? "Passkey" : "Contraseña"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Inicio:</span>
              <span className="text-right text-slate-100">{formatDate(session.createdAt)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Última actividad:</span>
              <span className="text-right text-slate-100">{formatDate(session.lastSeenAt)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Expira:</span>
              <span className="text-right text-slate-100">{formatDate(session.expiresAt)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-blue-800 bg-blue-900/20 p-3">
        <h4 className="mb-2 text-sm font-medium text-blue-200">Protección de la sesión</h4>
        <ul className="space-y-1 text-xs text-blue-300">
          <li>• El token no queda accesible para JavaScript.</li>
          <li>• La sesión puede revocarse desde el servidor.</li>
          <li>• La cuenta se vuelve a validar periódicamente.</li>
          <li>• Cerrar sesión invalida el acceso en este navegador.</li>
        </ul>
      </div>
    </>
  );

  if (inline) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-cyan-400" />
            <h2 className="text-xl font-semibold text-slate-100">Información de la sesión</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-100">
            <X className="h-6 w-6" />
          </button>
        </div>
        {content}
      </div>
    </div>
  );
}
