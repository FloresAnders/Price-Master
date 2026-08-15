"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  UserRound,
} from "lucide-react";
import type { User } from "@/types/firestore";
import { useVersion } from "@/hooks/useVersion";
import { hashPassword } from "@/lib/auth/password";
import { PHASH_KEY } from "@/hooks/useUnlockPastDays";
import {
  authenticateWithPasskey,
  isPasskeySupported,
  PasskeyClientError,
  registerPasskey,
} from "@/lib/passkeys/client";
import { getPasskeyPreference } from "@/lib/passkeys/preference.client";
import { PasswordRecoveryModal } from "./PasswordRecoveryModal";

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: User) => void;
  onClose: () => void;
  title: string;
  canClose?: boolean;
}

const REMEMBERED_USER_KEY = "timemaster_remembered_user";

function passkeyMessage(error: unknown): string {
  if (error instanceof PasskeyClientError) {
    if (error.code === "cancelled") {
      return "La verificación del dispositivo fue cancelada.";
    }
    if (error.code === "unsupported") {
      return "Este navegador no admite passkeys. Ingresa con contraseña.";
    }
    if (error.code === "network") {
      return "No se pudo conectar con TimeMaster.";
    }
  }
  return "No fue posible verificar la passkey. Puedes ingresar con contraseña.";
}

export default function LoginModal({
  isOpen,
  onLoginSuccess,
  onClose,
  title,
  canClose = true,
}: LoginModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberUser, setRememberUser] = useState(false);
  const [enrollPasskey, setEnrollPasskey] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const remembered = localStorage.getItem(REMEMBERED_USER_KEY) || "";
    if (remembered) {
      setUsername(remembered);
      setRememberUser(true);
    }

    void getPasskeyPreference().then((preference) => {
      if (!active) return;
      const available = preference.passkeyAvailable && isPasskeySupported();
      setPasskeyAvailable(available);
      setShowPasswordLogin(!available);
    });
    return () => {
      active = false;
    };
  }, [isOpen]);

  const handlePasskeyLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const safeUser = await authenticateWithPasskey();
      onLoginSuccess(safeUser as User);
    } catch (passkeyError) {
      setError(passkeyMessage(passkeyError));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const normalizedUsername = username.trim();
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizedUsername,
          password,
          enrollPasskey,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok || !payload.user) {
        setError(payload?.error || "Usuario o contraseña incorrectos.");
        return;
      }

      if (rememberUser) {
        localStorage.setItem(REMEMBERED_USER_KEY, normalizedUsername);
      } else {
        localStorage.removeItem(REMEMBERED_USER_KEY);
      }

      if (enrollPasskey && payload.enrollmentGrantId) {
        try {
          await registerPasskey(payload.enrollmentGrantId);
        } catch (registrationError) {
          console.warn("No se completó el registro de la passkey", registrationError);
        }
      }

      const safeUser = payload.user as User;
      if (safeUser.role === "user") {
        void hashPassword(password)
          .then((hash) => localStorage.setItem(PHASH_KEY, hash))
          .catch(() => undefined);
      }
      onLoginSuccess(safeUser);
    } catch (requestError) {
      console.error("Error durante el ingreso", requestError);
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass =
    "h-16 w-full rounded-2xl border border-blue-500/70 bg-slate-950/35 pl-14 pr-12 text-base text-white outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/25 disabled:opacity-60";

  return (
    <div className="relative flex min-h-full w-full items-center justify-center overflow-hidden bg-[#020713] px-5 py-8 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_35%,rgba(88,28,135,0.24),transparent_28%),radial-gradient(circle_at_20%_45%,rgba(14,116,144,0.2),transparent_33%)]" />

      <main className="relative z-10 w-full max-w-[430px]" aria-label={title}>
        <header className="mb-9 text-center">
          <Image
            src="/Logos/LogoBlanco.png"
            alt="Time Master"
            width={126}
            height={126}
            priority
            className="mx-auto h-[126px] w-[126px] object-contain"
          />
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Bienvenido</h1>
          <p className="mt-2 text-base text-slate-400">Inicia sesión para continuar</p>
        </header>

        {passkeyAvailable && !showPasswordLogin ? (
          <section className="space-y-5 text-center">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-blue-500/35 bg-blue-500/10 shadow-[0_0_45px_rgba(37,99,235,0.28)]">
              <Fingerprint className="h-16 w-16 text-blue-400" strokeWidth={1.6} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Tu passkey está lista</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Usa la huella, el rostro o el PIN configurado en tu dispositivo.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={loading}
              className="h-16 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-blue-700 text-lg font-semibold shadow-[0_12px_35px_rgba(37,99,235,0.3)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? "Verificando…" : "Ingresar con biometría"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError("");
                setShowPasswordLogin(true);
              }}
              disabled={loading}
              className="h-14 w-full rounded-2xl border border-slate-600/80 bg-slate-950/30 font-medium text-slate-200 transition hover:border-blue-500/70 hover:bg-blue-500/5"
            >
              Ingresar con contraseña
            </button>
          </section>
        ) : (
          <section>
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="relative">
                <label htmlFor="login-username" className="sr-only">
                  Usuario
                </label>
                <UserRound className="pointer-events-none absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-300" />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username webauthn"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className={inputClass}
                  placeholder="Usuario"
                  required
                  disabled={loading}
                />
              </div>

              <div className="flex items-center justify-end gap-3 py-1">
                <label htmlFor="remember-user" className="text-sm text-slate-300">
                  Recordar usuario
                </label>
                <input
                  id="remember-user"
                  type="checkbox"
                  checked={rememberUser}
                  onChange={(event) => setRememberUser(event.target.checked)}
                  className="h-5 w-9 appearance-none rounded-full bg-slate-700 transition before:block before:h-5 before:w-5 before:rounded-full before:bg-white before:transition checked:bg-blue-600 checked:before:translate-x-4"
                />
              </div>

              <div className="relative">
                <label htmlFor="login-password" className="sr-only">
                  Contraseña
                </label>
                <Lock className="pointer-events-none absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-300" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClass}
                  placeholder="Contraseña"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-300 hover:text-white"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
                </button>
              </div>

              <label className="flex min-h-14 cursor-pointer items-center gap-4 py-1">
                <input
                  type="checkbox"
                  checked={enrollPasskey}
                  onChange={(event) => setEnrollPasskey(event.target.checked)}
                  disabled={loading || !isPasskeySupported()}
                  className="h-6 w-11 shrink-0 appearance-none rounded-full bg-slate-700 p-1 transition before:block before:h-4 before:w-4 before:rounded-full before:bg-white before:transition checked:bg-blue-600 checked:before:translate-x-5 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Activar biometría en este dispositivo"
                />
                <Fingerprint className="h-10 w-10 shrink-0 text-blue-500" />
                <span className="text-sm font-medium text-slate-100">
                  Activar biometría en este dispositivo
                </span>
              </label>

              {error && (
                <div role="alert" className="flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="h-16 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-blue-700 text-lg font-semibold shadow-[0_12px_35px_rgba(37,99,235,0.3)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? "Ingresando…" : "Ingresar"}
              </button>
            </form>

            {!passkeyAvailable && isPasskeySupported() && (
              <button
                type="button"
                onClick={handlePasskeyLogin}
                disabled={loading}
                className="mt-4 flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-blue-500/45 bg-blue-500/5 font-medium text-blue-200 transition hover:bg-blue-500/10 disabled:opacity-60"
              >
                <Fingerprint className="h-7 w-7" />
                Ya tengo una passkey
              </button>
            )}

            {passkeyAvailable && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setShowPasswordLogin(false);
                }}
                className="mt-4 w-full text-sm font-medium text-blue-300 hover:text-blue-200"
              >
                Volver a ingresar con biometría
              </button>
            )}
          </section>
        )}

        {error && passkeyAvailable && !showPasswordLogin && (
          <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 space-y-4">
          <button
            type="button"
            disabled
            onClick={() => setShowRecoveryModal(true)}
            className="h-14 w-full rounded-2xl border border-slate-600/80 bg-slate-950/30 text-sm text-slate-200 transition hover:border-blue-500/70 cursor-not-allowed"
          >
            ¿Olvidó su usuario o contraseña?
          </button>
          <button
            type="button"
            disabled
            className="relative h-14 w-full cursor-not-allowed rounded-2xl border border-slate-700 bg-slate-950/20 text-blue-400 opacity-60"
          >
            Regístrese
            <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-400">
              Próximamente
            </span>
          </button>
        </div>

        {canClose && (
          <button type="button" onClick={onClose} className="mt-5 w-full text-sm text-slate-400 hover:text-white">
            Cerrar
          </button>
        )}
      </main>

      <PasswordRecoveryModal
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
      />
    </div>
  );
}
