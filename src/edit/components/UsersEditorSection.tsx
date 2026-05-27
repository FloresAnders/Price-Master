"use client";

import React from "react";
import {
  Save,
  Eye,
  EyeOff,
  Settings,
  Edit,
  UserPlus,
  Mail,
} from "lucide-react";

import type { User } from "../../types/firestore";
import ChangeEmailModal from "../../components/modals/ChangeEmailModal";

type Props = {
  usersData: User[];
  empresasData: any[];
  currentUser: User | null;
  isSuperadminAdminView?: boolean;

  addUser: () => void;
  updateUser: (index: number, field: keyof User, value: unknown) => void;
  removeUser: (index: number) => void | Promise<void>;
  saveIndividualUser: (index: number) => void | Promise<void>;

  hasUserChanged: (index: number) => boolean;
  getUserKey: (user: User, index: number) => string;

  savingUserKey: string | null;

  changePasswordMode: Record<string, boolean>;
  passwordVisibility: Record<string, boolean>;
  togglePasswordVisibility: (user: User, index: number) => void;

  setChangePasswordMode: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  setUsersData: React.Dispatch<React.SetStateAction<User[]>>;
  setPasswordStore: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  passwordBaseline: Record<string, string>;

  renderUserPermissions: (user: User, index: number) => React.ReactNode;
};

export default function UsersEditorSection({
  usersData,
  empresasData,
  currentUser,
  isSuperadminAdminView = false,
  addUser,
  updateUser,
  removeUser,
  saveIndividualUser,
  hasUserChanged,
  getUserKey,
  savingUserKey,
  changePasswordMode,
  passwordVisibility,
  togglePasswordVisibility,
  setChangePasswordMode,
  setUsersData,
  setPasswordStore,
  passwordBaseline,
  renderUserPermissions,
}: Props) {
  const [editMode, setEditMode] = React.useState<Record<string, boolean>>({});
  const [emailChangeTarget, setEmailChangeTarget] = React.useState<{
    userId: string;
    userRole?: User["role"];
    index: number;
  } | null>(null);

  const isEditingUser = (user: User, index: number) => {
    // New users must be editable so they can be saved.
    if (!user.id) return true;
    const key = getUserKey(user, index);
    return Boolean(editMode[key]);
  };

  const fieldClassName =
    "w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 sm:px-4 text-sm font-medium text-[var(--foreground)] outline-none transition-colors hover:border-[var(--accent)]/60 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  const passwordFieldClassName =
    `${fieldClassName} pr-10`;
  const primaryButtonClassName =
    "rounded-lg bg-[var(--accent)] px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:py-3 sm:text-sm";
  const secondaryButtonClassName =
    "rounded-lg border border-[var(--input-border)] bg-[var(--muted)]/50 px-4 py-2.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:py-3 sm:text-sm";
  const dangerButtonClassName =
    "rounded-lg bg-red-600 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:py-3 sm:text-sm";

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div>
          <h4 className="text-base sm:text-lg lg:text-xl font-semibold">
            Configuración de Usuarios
          </h4>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-0.5 sm:mt-1">
            Gestiona usuarios, roles y permisos del sistema
          </p>
        </div>
        <button
          onClick={addUser}
          className={`${primaryButtonClassName} w-full sm:w-auto flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap`}
        >
          <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Agregar Usuario</span>
        </button>
      </div>

      {usersData.map((user, index) => (
        <div
          key={user.id || index}
          className="border border-[var(--input-border)] rounded-lg p-2.5 sm:p-4 lg:p-5 relative"
        >
          {(() => {
            const key = getUserKey(user, index);
            const isEditing = isEditingUser(user, index);
            const isSaving = savingUserKey === key;
            const disableInputs = !isEditing || isSaving;

            return (
              <>
                {hasUserChanged(index) && (
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-yellow-100 text-yellow-800 rounded-full text-[10px] sm:text-xs font-medium">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-orange-500 rounded-full animate-pulse"></div>
                    <span>Pendiente</span>
                  </div>
                )}

                {!isEditing && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-4 sm:py-3">
                        <p className="text-[10px] sm:text-xs font-medium text-[var(--muted-foreground)]">
                          Usuario:
                        </p>
                        <p className="text-sm sm:text-base font-semibold text-[var(--foreground)] break-words">
                          {user.name || "Sin usuario"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-4 sm:py-3">
                        <p className="text-[10px] sm:text-xs font-medium text-[var(--muted-foreground)]">
                          Nombre Completo:
                        </p>
                        <p className="text-sm sm:text-base font-semibold text-[var(--foreground)] break-words">
                          {user.fullName || "Sin nombre completo"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!user.id) return;
                          setEditMode((prev) => ({ ...prev, [key]: true }));
                        }}
                        disabled={!user.id || isSaving}
                        className={`${primaryButtonClassName} flex items-center justify-center gap-1.5 sm:gap-2`}
                        title={
                          !user.id
                            ? "Usuario nuevo: edición activa"
                            : "Activar edición"
                        }
                      >
                        <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Editar
                      </button>
                    </div>
                  </>
                )}

                {isEditing && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1">
                          Usuario:
                        </label>
                        <input
                          type="text"
                          value={user.name}
                          onChange={(e) =>
                            updateUser(index, "name", e.target.value)
                          }
                          disabled={disableInputs}
                          className={fieldClassName}
                          placeholder="Nombre de usuario"
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1">
                          Nombre Completo:
                        </label>
                        <input
                          type="text"
                          value={user.fullName || ""}
                          onChange={(e) =>
                            updateUser(index, "fullName", e.target.value)
                          }
                          disabled={disableInputs}
                          className={fieldClassName}
                          placeholder="Nombre completo"
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1">
                          Correo:
                        </label>
                        {!user.id ? (
                          <input
                            type="email"
                            value={user.email || ""}
                            onChange={(e) =>
                              updateUser(index, "email", e.target.value)
                            }
                            disabled={disableInputs}
                            className={fieldClassName}
                            placeholder="correo@ejemplo.com"
                          />
                        ) : (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2.5 text-[var(--foreground)]">
                            <span className="text-xs sm:text-sm break-all">
                              {user.email || "Sin correo"}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (!user.id) return;
                                setEmailChangeTarget({
                                  userId: String(user.id),
                                  userRole: user.role,
                                  index,
                                });
                              }}
                              disabled={disableInputs}
                              className={`${primaryButtonClassName} flex items-center justify-center gap-1 whitespace-nowrap px-3 py-1.5 sm:px-3.5 sm:py-2`}
                              title="Cambiar correo"
                            >
                              <Mail className="w-3 h-3" />
                              Cambiar
                            </button>
                          </div>
                        )}
                      </div>
                      {user.role === "user" && (
                        <div>
                          <label className="block text-xs sm:text-sm font-medium mb-1">
                            Empresa a la que pertenece:
                          </label>
                          {(() => {
                            const resolvedOwnerId =
                              user.ownerId ||
                              (currentUser?.ownerId ??
                                (currentUser && currentUser.eliminate === false
                                  ? currentUser.id
                                  : "")) ||
                              "";
                            const allowedEmpresas = empresasData.filter(
                              (e) => (e?.ownerId || "") === resolvedOwnerId,
                            );
                            return (
                              <>
                                <select
                                  value={user.ownercompanie || ""}
                                  onChange={(e) =>
                                    updateUser(
                                      index,
                                      "ownercompanie",
                                      e.target.value,
                                    )
                                  }
                                  disabled={disableInputs}
                                  className={fieldClassName}
                                >
                                  <option value="">Seleccionar empresa</option>
                                  {allowedEmpresas.map((empresa) => (
                                    <option
                                      key={empresa.id || empresa.name}
                                      value={empresa.name}
                                    >
                                      {empresa.name}
                                    </option>
                                  ))}
                                </select>
                                {allowedEmpresas.length === 0 && (
                                  <p className="text-[10px] sm:text-xs mt-1 text-yellow-600">
                                    No hay empresas disponibles.
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1">
                          Contraseña:
                        </label>
                        {!user.id ? (
                          <input
                            type="text"
                            value={user.password || ""}
                            onChange={(e) =>
                              updateUser(index, "password", e.target.value)
                            }
                            disabled={disableInputs}
                            className={fieldClassName}
                            placeholder="Contraseña"
                          />
                        ) : changePasswordMode[getUserKey(user, index)] ? (
                          <div className="space-y-1.5 sm:space-y-2">
                            <div className="relative">
                              <input
                                type={
                                  passwordVisibility[getUserKey(user, index)]
                                    ? "text"
                                    : "password"
                                }
                                value={user.password || ""}
                                onChange={(e) =>
                                  updateUser(index, "password", e.target.value)
                                }
                                disabled={disableInputs}
                                className={passwordFieldClassName}
                                placeholder="Nueva contraseña"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  togglePasswordVisibility(user, index)
                                }
                                disabled={disableInputs}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={
                                  passwordVisibility[getUserKey(user, index)]
                                    ? "Ocultar contraseña"
                                    : "Mostrar contraseña"
                                }
                              >
                                {passwordVisibility[getUserKey(user, index)] ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const key = getUserKey(user, index);
                                setChangePasswordMode((prev) => ({
                                  ...prev,
                                  [key]: false,
                                }));
                                const updated = [...usersData];
                                updated[index] = {
                                  ...updated[index],
                                  password: "",
                                };
                                setUsersData(updated);
                                setPasswordStore((prev) => ({
                                  ...prev,
                                  [key]: passwordBaseline[key] ?? "",
                                }));
                              }}
                              disabled={isSaving}
                              className="text-[10px] sm:text-xs px-3 sm:px-3.5 py-1.5 sm:py-2 text-[var(--foreground)] hover:text-[var(--accent)] bg-[var(--muted)]/50 hover:bg-[var(--muted)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium border border-[var(--input-border)]"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm">********</span>
                            <button
                              type="button"
                              onClick={() => {
                                const key = getUserKey(user, index);
                                setChangePasswordMode((prev) => ({
                                  ...prev,
                                  [key]: true,
                                }));
                              }}
                              disabled={disableInputs}
                              className={secondaryButtonClassName + " px-3 py-1.5"}
                            >
                              Cambiar contraseña
                            </button>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1">
                          Rol:
                        </label>
                        <select
                          value={user.role || "user"}
                          onChange={(e) => {
                            const nextRole = e.target.value as any;
                            updateUser(index, "role", nextRole);
                            if (nextRole !== "user") {
                              updateUser(index, "ownercompanie", "");
                            }
                          }}
                          disabled={disableInputs}
                          className={fieldClassName}
                        >
                          <option value="user">Usuario</option>
                          <option value="admin">Administrador</option>
                          {currentUser?.role === "superadmin" && !isSuperadminAdminView && (
                            <option value="superadmin">Super Administrador</option>
                          )}
                        </select>
                      </div>

                      {user.role === "admin" &&
                        user.eliminate === false &&
                        currentUser?.role === "superadmin" && (
                          <div>
                            <label className="block text-xs sm:text-sm font-medium mb-1">
                              Máx. Empresas:
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={(user as any).maxCompanies ?? ""}
                              onChange={(e) =>
                                updateUser(
                                  index,
                                  "maxCompanies" as any,
                                  e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value),
                                )
                              }
                              disabled={disableInputs}
                              className={fieldClassName}
                              placeholder="Máx. empresas"
                            />
                          </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1">
                          Estado:
                        </label>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <input
                            type="checkbox"
                            checked={user.isActive ?? true}
                            onChange={(e) =>
                              updateUser(index, "isActive", e.target.checked)
                            }
                            disabled={disableInputs}
                            className="w-4 h-4 sm:w-5 sm:h-5 rounded border border-[var(--input-border)] cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              accentColor: "var(--primary)",
                            }}
                          />
                          <span className="text-xs sm:text-sm">
                            Usuario activo
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 sm:mb-4 p-2 sm:p-3 lg:p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                        <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-400" />
                        <h5
                          className="text-xs sm:text-sm font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
                          Permisos del Usuario
                        </h5>
                        <span className="text-[10px] sm:text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                          {user.role || "user"}
                        </span>
                      </div>
                      <div
                        className={
                          isEditing ? "" : "pointer-events-none opacity-60"
                        }
                      >
                        {renderUserPermissions(user, index)}
                      </div>
                      <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p
                          className="text-[10px] sm:text-xs"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          <strong>Nota:</strong> Edita los permisos y presiona
                          &quot;Guardar&quot; para aplicar cambios.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!user.id) return;
                          setEditMode((prev) => ({ ...prev, [key]: !isEditing }));
                        }}
                        disabled={!user.id || isSaving}
                        className={
                          isEditing
                            ? `${secondaryButtonClassName} flex items-center justify-center gap-1.5 sm:gap-2`
                            : `${primaryButtonClassName} flex items-center justify-center gap-1.5 sm:gap-2`
                        }
                        title={
                          !user.id
                            ? "Usuario nuevo: edición activa"
                            : isEditing
                              ? "Desactivar edición"
                              : "Activar edición"
                        }
                      >
                        <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        {isEditing ? "Cancelar edición" : "Editar"}
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await Promise.resolve(saveIndividualUser(index));
                            if (user.id) {
                              setEditMode((prev) => ({ ...prev, [key]: false }));
                            }
                          } catch {
                          }
                        }}
                        className={`${primaryButtonClassName} flex items-center justify-center gap-1.5 sm:gap-2`}
                        disabled={!isEditing || isSaving}
                        title={
                          !isEditing
                            ? 'Activa "Editar" para guardar cambios'
                            : "Guardar Usuario"
                        }
                      >
                        <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        {isSaving ? "Guardando..." : "Guardar"}
                      </button>
                      <button
                        onClick={() => removeUser(index)}
                        className={dangerButtonClassName}
                        disabled={
                          !isEditing ||
                          isSaving ||
                          (currentUser?.role === "admin" &&
                            (user.eliminate === false ||
                              user.eliminate === undefined))
                        }
                        title={
                          !isEditing
                            ? 'Activa "Editar" para eliminar'
                            : currentUser?.role === "admin" &&
                                (user.eliminate === false ||
                                  user.eliminate === undefined)
                              ? "No puedes eliminar este usuario: marcado como protegido"
                              : "Eliminar Usuario"
                        }
                      >
                        Eliminar Usuario
                      </button>
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </div>
      ))}

      <ChangeEmailModal
        isOpen={Boolean(emailChangeTarget)}
        onClose={() => setEmailChangeTarget(null)}
        userId={emailChangeTarget?.userId || ""}
        userRole={emailChangeTarget?.userRole}
        onSuccess={(newEmail) => {
          if (!emailChangeTarget) return;
          updateUser(emailChangeTarget.index, "email", newEmail);
          setEmailChangeTarget(null);
        }}
      />
    </div>
  );
}
