"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, Send, X } from 'lucide-react';
import useToast from '@/hooks/useToast';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userRole?: 'admin' | 'user' | 'superadmin';
  onSuccess?: (newEmail: string) => void;
};

export default function ChangeEmailModal({ isOpen, onClose, userId, userRole, onSuccess }: Props) {
  const { showToast } = useToast();

  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canShowSupport = useMemo(() => {
    return (userRole || 'user') !== 'superadmin';
  }, [userRole]);

  useEffect(() => {
    if (!isOpen) return;
    setNewEmail('');
    setCode('');
    setStep('request');
    setIsSending(false);
    setIsConfirming(false);
    setError(null);
  }, [isOpen]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isValidEmail = (value: string) => {
    const trimmed = String(value || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  };

  const sendCode = async () => {
    if (!userId) return;

    setError(null);
    setIsSending(true);

    try {
      const resp = await fetch('/api/auth/request-email-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || 'No se pudo enviar el código.');
      }

      setStep('confirm');
      showToast('Código enviado al correo registrado. Revisa tu correo.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al enviar el código.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const confirmChange = async () => {
    if (!userId) return;

    const normalized = newEmail.trim().toLowerCase();
    const normalizedCode = code.trim();

    if (!isValidEmail(normalized)) {
      setError('Ingresa un correo válido.');
      return;
    }

    if (!normalizedCode) {
      setError('Ingresa el código.');
      return;
    }

    setError(null);
    setIsConfirming(true);

    try {
      const resp = await fetch('/api/auth/confirm-email-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newEmail: normalized, code: normalizedCode }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || 'No se pudo confirmar el cambio.');
      }

      showToast('Correo actualizado correctamente.', 'success');
      onSuccess?.(normalized);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al confirmar el cambio.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsConfirming(false);
    }
  };

  const openSupport = () => {
    onClose();
    // Reutiliza un flujo existente del sistema (solicitudes) para contacto.
    window.location.href = '/solicitud';
  };

  const busy = isSending || isConfirming;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-[var(--input-border)] bg-[var(--background)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--input-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[var(--primary)]" />
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Cambiar correo</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Cerrar"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {step === 'request' ? (
            <div className="space-y-2">
              <p className="text-sm text-[var(--muted-foreground)]">
                Enviaremos un código de verificación al correo que este usuario tiene registrado actualmente.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-sm text-[var(--foreground)]">Nuevo correo electrónico</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="correo@ejemplo.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-[var(--foreground)]">Código de verificación</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="000000"
                  inputMode="numeric"
                />
              </div>
            </>
          )}

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            {step === 'request' ? (
              <button
                type="button"
                onClick={sendCode}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm text-white hover:bg-[var(--button-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar código
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
                  title="Reenviar código"
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Reenviar
                </button>
                <button
                  type="button"
                  onClick={confirmChange}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm text-white hover:bg-[var(--button-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Guardar
                </button>
              </>
            )}
          </div>

          {canShowSupport && (
            <button
              type="button"
              onClick={openSupport}
              disabled={busy}
              className="w-full text-center text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              ¿Perdió acceso a su correo? contacte a soporte
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
