"use client";

import {
  Eye,
  EyeOff,
  Info,
  Loader2,
  User as UserIcon,
  X,
  Check,
  Camera,
  ChevronDown,
  ChevronUp,
  Lock,
  Trash2,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import useToast from "../../hooks/useToast";
import { useAuth } from "../../hooks/useAuth";
import { UsersService } from "../../services/users";
import type { User as UserRecord } from "../../types/firestore";
import { verifyPassword } from "../../lib/auth/password";
import { useProfileImageUpload } from "../../hooks/useProfileImageUpload";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EditProfileModal({
  isOpen,
  onClose,
}: EditProfileModalProps) {
  const { showToast } = useToast();
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const { user } = useAuth();

  const [profile, setProfile] = useState<UserRecord | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    fullName: "",
    email: "",
    currentPassword: "",
    password: "",
    passwordConfirm: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerInfo, setOwnerInfo] = useState<UserRecord | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  const baseUser = profile ?? user ?? null;

  const imageUpload = useProfileImageUpload({
    user: baseUser,
    onSuccess: () => {
      showToast("Foto de perfil actualizada correctamente.", "success");
    },
    onError: (error) => {
      setError(error);
      showToast(error, "error");
    },
    onDeleteSuccess: () => {
      showToast("Foto de perfil eliminada correctamente.", "success");
      try {
        if (typeof window !== "undefined") {
          const sessionRaw = window.localStorage.getItem("pricemaster_session");
          if (sessionRaw) {
            const sessionData = JSON.parse(sessionRaw);
            delete sessionData.photoUrl;
            window.localStorage.setItem(
              "pricemaster_session",
              JSON.stringify(sessionData),
            );
          }
        }
      } catch (e) {
        console.warn("No se pudo actualizar la sesión local", e);
      }
    },
  });

  const loadProfile = useCallback(async (silent = false) => {
    if (!user?.id) {
      setProfile(null);
      setFormData({
        name: "",
        fullName: "",
        email: "",
        currentPassword: "",
        password: "",
        passwordConfirm: "",
      });
      setProfileError("No se encontró el usuario en la sesión actual.");
      return;
    }

    if (!silent) setProfileLoading(true);
    setProfileError(null);

    try {
      const record = await UsersService.getUserById(user.id);
      const source = record ?? user;

      setProfile(record ?? null);
      setHasPassword(Boolean(source?.password));
      setFormData({
        name: source?.name ?? "",
        fullName: source?.fullName ?? "",
        email: source?.email ?? "",
        currentPassword: "",
        password: "",
        passwordConfirm: "",
      });
    } catch (err) {
      console.error("Error fetching user profile", err);
      const fallback = user ?? null;
      setProfile(null);
      setHasPassword(Boolean(fallback?.password));
      setFormData({
        name: fallback?.name ?? "",
        fullName: fallback?.fullName ?? "",
        email: fallback?.email ?? "",
        currentPassword: "",
        password: "",
        passwordConfirm: "",
      });
      setProfileError(
        "No se pudo cargar la información desde la base de datos.",
      );
    } finally {
      if (!silent) setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isOpen) {
      setProfile(null);
      setProfileError(null);
      setFormData({
        name: "",
        fullName: "",
        email: "",
        currentPassword: "",
        password: "",
        passwordConfirm: "",
      });
      setShowChangePassword(false);
      return;
    }

    loadProfile();
    setError(null);
  }, [isOpen, user?.id]);

  const ownerId = baseUser?.ownerId ?? null;

  useEffect(() => {
    if (!isOpen) return;
    if (!ownerId) {
      setOwnerInfo(null);
      setOwnerLoading(false);
      return;
    }

    let isMounted = true;
    setOwnerLoading(true);
    setOwnerInfo(null);

    UsersService.getUserById(ownerId)
      .then((owner) => {
        if (isMounted && owner) {
          setOwnerInfo(owner);
        }
      })
      .catch((err) => {
        console.error("Error fetching owner user", err);
        if (isMounted) {
          setOwnerInfo(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setOwnerLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, ownerId]);

  const hasChanges = useMemo(() => {
    if (!baseUser) return false;
    const baseName = baseUser.name ?? "";
    const baseFullName = baseUser.fullName ?? "";
    const baseEmail = baseUser.email ?? "";

    return (
      formData.name !== baseName ||
      formData.fullName !== baseFullName ||
      formData.email !== baseEmail ||
      formData.password.length > 0 ||
      imageUpload.hasSelectedFile ||
      imageUpload.pendingDelete
    );
  }, [formData, baseUser, imageUpload.hasSelectedFile, imageUpload.pendingDelete]);

  const handleChange =
    (field: keyof typeof formData) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setFormData((prev) => ({ ...prev, [field]: value }));
    };

  useEffect(() => {
    if (!formData.password && formData.passwordConfirm) {
      setFormData((prev) => ({ ...prev, passwordConfirm: "" }));
    }
  }, [formData.password, formData.passwordConfirm]);

  useEffect(() => {
    if (!formData.password) {
      setShowPasswordConfirm(false);
    }
  }, [formData.password]);

  useEffect(() => {
    if (!showChangePassword) {
      setFormData((prev) => ({
        ...prev,
        currentPassword: "",
        password: "",
        passwordConfirm: "",
      }));
      setShowCurrentPassword(false);
      setShowPassword(false);
      setShowPasswordConfirm(false);
    }
  }, [showChangePassword]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setError("No hay una sesión activa.");
      return;
    }

    const targetId = baseUser?.id ?? user.id;
    if (!targetId) {
      setError("No se encontró el identificador del usuario actual.");
      return;
    }

    const trimmedName = formData.name.trim();
    const trimmedFullName = formData.fullName.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedPassword = formData.password;

    if (!trimmedName) {
      setError("El nombre es obligatorio.");
      return;
    }

    if (trimmedPassword) {
      if (!formData.currentPassword) {
        setError("Debes ingresar tu contraseña actual.");
        return;
      }

      if (trimmedPassword !== formData.passwordConfirm) {
        setError("Las contraseñas nuevas no coinciden.");
        return;
      }

      const storedPassword = baseUser?.password;
      if (storedPassword) {
        const isValid = await verifyPassword(
          formData.currentPassword,
          storedPassword,
        );
        if (!isValid) {
          setError("La contraseña actual es incorrecta.");
          return;
        }
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload: Partial<UserRecord> = {
        name: trimmedName,
        fullName: trimmedFullName || undefined,
        email: trimmedEmail || undefined,
      };

      if (trimmedPassword) {
        payload.password = trimmedPassword;
      }

      await UsersService.updateUserAs(user, targetId, payload);

      let uploadedPhotoUrl: string | null = null;
      if (imageUpload.hasSelectedFile) {
        uploadedPhotoUrl = await imageUpload.uploadImage();
      }

      if (imageUpload.pendingDelete) {
        await imageUpload.confirmDelete();
      }

      try {
        if (typeof window !== "undefined") {
          const sessionRaw = window.localStorage.getItem("pricemaster_session");
          if (sessionRaw) {
            const sessionData = JSON.parse(sessionRaw);
            sessionData.name = payload.name ?? sessionData.name;
            if (payload.fullName !== undefined) {
              sessionData.fullName = payload.fullName;
            }
            if (payload.email !== undefined) {
              sessionData.email = payload.email;
            }
            if (uploadedPhotoUrl) {
              sessionData.photoUrl = uploadedPhotoUrl;
            }
            if (imageUpload.pendingDelete) {
              delete sessionData.photoUrl;
            }
            window.localStorage.setItem(
              "pricemaster_session",
              JSON.stringify(sessionData),
            );
          }
        }
      } catch (storageError) {
        console.warn("No se pudo sincronizar la sesión local", storageError);
      }

      await loadProfile(true);
      setShowChangePassword(false);
      showToast("Perfil actualizado correctamente.", "success");
    } catch (err) {
      console.error("Error updating profile", err);
      const message =
        err instanceof Error ? err.message : "No se pudo actualizar el perfil.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const isFormLocked = profileLoading || isSaving || imageUpload.isProcessing;

  const initials = useMemo(() => {
    const source = profile ?? user ?? null;
    const name = source?.fullName || source?.name || "";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    const first = parts[0]?.[0] ?? "";
    const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";
    return (first + second).toUpperCase();
  }, [profile, user]);

  const role = baseUser?.role || "user";
  const roleLabel =
    role === "superadmin"
      ? "Superadmin"
      : role === "admin"
        ? "Administrador"
        : "Usuario";
  const ownerDisplayName =
    ownerInfo?.fullName ||
    ownerInfo?.name ||
    baseUser?.ownercompanie ||
    "Sin asignar";
  const ownerEmail = ownerInfo?.email;
  const showOwnerInfo = Boolean(ownerId || baseUser?.ownercompanie);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="animate-scale-in w-full max-w-lg mx-auto max-h-[90vh] overflow-y-auto rounded-2xl border border-white/5 bg-[var(--card-bg)] shadow-[0_16px_50px_rgba(2,6,23,0.26)]">
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-100 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-900/50 text-cyan-400">
                <UserIcon className="w-5 h-5" />
              </span>
              Editar Perfil
            </h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!user ? (
            <div className="rounded-lg border border-white/10 bg-slate-900/50 px-4 py-8 text-center text-sm text-slate-400">
              No se pudo cargar la información del usuario.
            </div>
          ) : profileLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col items-center gap-4 pb-2">
                <div className="relative">
                  <div className="w-28 h-28 rounded-full border border-white/5 bg-[var(--card-bg)] flex items-center justify-center overflow-hidden shadow-[0_0_24px_rgba(0,0,0,0.4)]">
                    {imageUpload.imagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUpload.imagePreview}
                        alt="Vista previa"
                        className="w-full h-full object-cover"
                      />
                    ) : !imageUpload.pendingDelete && (baseUser as any)?.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={(baseUser as any).photoUrl}
                        alt="Foto de perfil"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-slate-200">
                        {initials}
                      </span>
                    )}
                  </div>
                  {imageUpload.hasSelectedFile && (
                    <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500 shadow-lg">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <input
                    ref={imageUpload.fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={imageUpload.handleFileSelect}
                    className="hidden"
                    disabled={isFormLocked}
                  />
                  {imageUpload.hasSelectedFile || imageUpload.pendingDelete ? (
                    <button
                      type="button"
                      onClick={imageUpload.cancelSelection}
                      disabled={isFormLocked}
                      className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-white/10 bg-slate-800/80 px-3 text-xs font-medium text-slate-300 outline-none transition-all hover:border-white/20 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancelar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={imageUpload.openFileDialog}
                      disabled={isFormLocked}
                      className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-white/10 bg-slate-800/80 px-3 text-xs font-medium text-slate-300 outline-none transition-all hover:border-white/20 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {imageUpload.isUploading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Camera className="w-3.5 h-3.5" />
                      )}
                      {imageUpload.isUploading ? "Subiendo..." : "Cambiar foto"}
                    </button>
                  )}
                  {imageUpload.canDelete && (
                    <button
                      type="button"
                      onClick={imageUpload.markForDeletion}
                      disabled={isFormLocked}
                      className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-red-400/20 bg-red-500/10 px-3 text-xs font-medium text-red-400 outline-none transition-all hover:border-red-400/40 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar
                    </button>
                  )}
                </div>
              </div>

              <div className="h-px bg-white/5" />

              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-200">
                  Datos del usuario
                </p>
                <span className="rounded-md border border-white/5 bg-slate-800/60 px-2 py-0.5 text-[11px] font-medium text-slate-400 capitalize">
                  {roleLabel}
                </span>
              </div>

              {profileError && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm text-yellow-400">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{profileError}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                  Nombre de usuario
                  <input
                    type="text"
                    value={formData.name}
                    onChange={handleChange("name")}
                    required
                    autoComplete="username"
                    disabled={isFormLocked}
                    className="h-11 w-full rounded-lg border border-white/5 bg-slate-900/50 px-3 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-500 hover:border-white/10 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                  Nombre completo
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={handleChange("fullName")}
                    autoComplete="name"
                    disabled={isFormLocked}
                    className="h-11 w-full rounded-lg border border-white/5 bg-slate-900/50 px-3 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-500 hover:border-white/10 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                Correo electrónico
                <input
                  type="email"
                  value={formData.email}
                  onChange={handleChange("email")}
                  autoComplete="email"
                  disabled={isFormLocked}
                  className="h-11 w-full rounded-lg border border-white/5 bg-slate-900/50 px-3 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-500 hover:border-white/10 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              <div className="h-px bg-white/5" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-slate-900/50 text-cyan-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <span className="text-sm font-medium text-slate-200">
                      Contraseña
                    </span>
                  </div>
                  {hasPassword && (
                    <span className="text-[11px] text-green-400 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Configurada
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowChangePassword(!showChangePassword)}
                  disabled={isFormLocked}
                  className="w-full flex items-center justify-between h-11 rounded-lg border border-white/10 bg-slate-900/50 px-4 text-sm text-slate-300 outline-none transition-all hover:border-white/20 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>
                    {showChangePassword
                      ? "Cancelar cambio de contraseña"
                      : "Cambiar contraseña"}
                  </span>
                  {showChangePassword ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {showChangePassword && (
                  <div className="space-y-4 rounded-xl border border-white/10 bg-slate-900/40 p-4">
                    <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                      Contraseña actual
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          value={formData.currentPassword}
                          onChange={handleChange("currentPassword")}
                          autoComplete="current-password"
                          disabled={isFormLocked}
                          className="h-11 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 pr-10 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-500 hover:border-white/20 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder="Ingresa tu contraseña actual"
                          required={showChangePassword}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowCurrentPassword((prev) => !prev)
                          }
                          disabled={isFormLocked}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={
                            showCurrentPassword
                              ? "Ocultar contraseña actual"
                              : "Mostrar contraseña actual"
                          }
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                        Nueva contraseña
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={handleChange("password")}
                            autoComplete="new-password"
                            disabled={isFormLocked}
                            className="h-11 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 pr-10 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-500 hover:border-white/20 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-60"
                            placeholder="Nueva contraseña"
                            required={showChangePassword}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            disabled={isFormLocked}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={
                              showPassword
                                ? "Ocultar nueva contraseña"
                                : "Mostrar nueva contraseña"
                            }
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </label>

                      <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                        Confirmar contraseña
                        <div className="relative">
                          <input
                            type={showPasswordConfirm ? "text" : "password"}
                            value={formData.passwordConfirm}
                            onChange={handleChange("passwordConfirm")}
                            autoComplete="new-password"
                            disabled={isFormLocked}
                            className="h-11 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 pr-10 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-500 hover:border-white/20 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-60"
                            placeholder="Confirmar contraseña"
                            required={showChangePassword}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowPasswordConfirm((prev) => !prev)
                            }
                            disabled={isFormLocked}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={
                              showPasswordConfirm
                                ? "Ocultar confirmación"
                                : "Mostrar confirmación"
                            }
                          >
                            {showPasswordConfirm ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </label>
                    </div>

                    <div className="flex items-start gap-2 rounded-lg border border-white/5 bg-slate-900/30 px-3 py-2.5">
                      <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-500" />
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Asegúrate de usar una contraseña segura y diferente a la
                        actual. Mínimo 8 caracteres.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {showOwnerInfo && (
                <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-900/50 text-cyan-400 flex-shrink-0">
                      <Info className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 mb-0.5">
                        Usuario Encargado
                      </p>
                      {ownerLoading ? (
                        <p className="text-sm text-slate-400 flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Cargando…
                        </p>
                      ) : (
                        <>
                          <p className="text-sm text-slate-400 truncate">
                            {ownerDisplayName}
                            {ownerEmail && (
                              <span className="text-slate-500"> · {ownerEmail}</span>
                            )}
                          </p>
                          {baseUser?.ownercompanie && (
                            <p className="text-xs text-slate-500 mt-1">
                              {ownerDisplayName !== baseUser.ownercompanie
                                ? `Empresa asignada: ${baseUser.ownercompanie}`
                                : "Empresa asignada vinculada a este usuario."}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center gap-2 h-11 w-full sm:w-auto rounded-lg border border-white/10 bg-slate-900/50 px-5 text-sm font-medium text-slate-300 outline-none transition-all hover:border-white/20 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!hasChanges || isSaving || profileLoading}
                  className="inline-flex items-center justify-center gap-2 h-11 w-full sm:w-auto rounded-lg bg-cyan-600 px-5 text-sm font-medium text-white outline-none transition-all hover:bg-cyan-500 active:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg shadow-cyan-600/20"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Guardar cambios
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
