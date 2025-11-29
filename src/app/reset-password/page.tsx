'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Key, Eye, EyeOff, CheckCircle, XCircle, Loader, ArrowLeft, AlertCircle } from 'lucide-react';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Validación de requisitos de contraseña
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  // Valida el token al cargar
  useEffect(() => {
    if (token) {
      validateToken();
    } else {
      setValidating(false);
      setTokenValid(false);
      setError('Token no proporcionado');
    }
  }, [token]);

  // Actualiza checks de contraseña
  useEffect(() => {
    setPasswordChecks({
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[!@#$%^&*(),.?":{}|<>@$!%*?&]/.test(newPassword)
    });
  }, [newPassword]);

  const validateToken = async () => {
    setValidating(true);
    try {
      // Simulamos validación (la validación real se hará en el servidor al hacer submit)
      // Por ahora solo verificamos que el token exista
      if (token && token.length > 10) {
        setTokenValid(true);
      } else {
        setTokenValid(false);
        setError('Token inválido');
      }
    } catch (err) {
      setTokenValid(false);
      setError('Error al validar el token');
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validaciones
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    const allChecksPassed = Object.values(passwordChecks).every(check => check);
    if (!allChecksPassed) {
      setError('La contraseña no cumple con todos los requisitos');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al restablecer la contraseña');
      }

      setSuccess(true);

      // Redirige al login después de 3 segundos
      setTimeout(() => {
        router.push('/');
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'Error al restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-[var(--primary)] animate-spin mx-auto mb-4" />
          <p className="text-[var(--muted-foreground)]">Validando token...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
        <div className="bg-[var(--card-bg)] p-8 rounded-lg shadow-lg max-w-md w-full text-center border border-[var(--border)]">
          <XCircle className="w-16 h-16 text-[var(--error)] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
            Token Inválido
          </h2>
          <p className="text-[var(--muted-foreground)] mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full px-4 py-2 bg-[var(--button-bg)] text-[var(--button-text)] rounded-lg hover:bg-[var(--button-hover)] flex items-center justify-center space-x-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Volver al Login</span>
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
        <div className="bg-[var(--card-bg)] p-8 rounded-lg shadow-lg max-w-md w-full text-center border border-[var(--border)]">
          <CheckCircle className="w-16 h-16 text-[var(--success)] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
            ¡Contraseña Actualizada!
          </h2>
          <p className="text-[var(--muted-foreground)] mb-4">
            Tu contraseña ha sido restablecida exitosamente.
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            Redirigiendo al login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center py-12 px-4">
      <div className="bg-[var(--card-bg)] p-8 rounded-lg shadow-lg max-w-md w-full border border-[var(--border)]">
        {/* Header */}
        <div className="text-center mb-8">
          <Key className="w-12 h-12 text-[var(--primary)] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[var(--foreground)]">
            Restablecer Contraseña
          </h2>
          <p className="text-[var(--muted-foreground)] mt-2">
            Ingresa tu nueva contraseña
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-[var(--error)] flex-shrink-0 mt-0.5" />
              <span className="text-red-700 dark:text-red-400 text-sm">{error}</span>
            </div>
          )}

          {/* Nueva Contraseña */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Nueva Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] pr-10"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirmar Contraseña */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Confirmar Contraseña
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
              required
              disabled={loading}
            />
          </div>

          {/* Requisitos de Contraseña */}
          <div className="mb-6 p-4 bg-[var(--muted)] rounded-lg border border-[var(--border)]">
            <p className="text-sm font-medium text-[var(--foreground)] mb-2">
              Requisitos de contraseña:
            </p>
            <div className="space-y-1">
              {[
                { key: 'length', label: 'Mínimo 8 caracteres' },
                { key: 'uppercase', label: 'Al menos una mayúscula' },
                { key: 'lowercase', label: 'Al menos una minúscula' },
                { key: 'number', label: 'Al menos un número' },
                { key: 'special', label: 'Al menos un carácter especial' }
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  {passwordChecks[key as keyof typeof passwordChecks] ? (
                    <CheckCircle className="w-4 h-4 text-[var(--success)]" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[var(--muted-foreground)] opacity-30" />
                  )}
                  <span className={`text-sm ${
                    passwordChecks[key as keyof typeof passwordChecks]
                      ? 'text-[var(--success)]'
                      : 'text-[var(--muted-foreground)]'
                  }`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Botones */}
          <div className="space-y-3">
            <button
              type="submit"
              className="w-full px-4 py-3 bg-[var(--primary)] text-[var(--button-text)] rounded-lg hover:bg-[var(--button-hover)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              disabled={loading || !Object.values(passwordChecks).every(check => check)}
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Actualizando...</span>
                </>
              ) : (
                <>
                  <Key className="w-5 h-5" />
                  <span>Restablecer Contraseña</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full px-4 py-2 border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--hover-bg)] flex items-center justify-center space-x-2"
              disabled={loading}
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Volver al Login</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-[var(--primary)] animate-spin mx-auto mb-4" />
          <p className="text-[var(--muted-foreground)]">Cargando...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
