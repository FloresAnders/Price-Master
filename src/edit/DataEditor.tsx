// src/edit/DataEditor.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import useToast from "../hooks/useToast";
import {
  FileText,
  Users,
  DollarSign,
  Building,
  List,
  Check,
  X,
  Clipboard,
  Smartphone,
  Clock,
} from "lucide-react";
import { EmpresasService } from "../services/empresas";
import { SorteosService } from "../services/sorteos";
import { UsersService } from "../services/users";
import { useAuth } from "../hooks/useAuth";
import { useActorOwnership } from "../hooks/useActorOwnership";
import { CcssConfigService } from "../services/ccss-config";
import { FondoMovementTypesService } from "../services/fondo-movement-types";
import {
  Sorteo,
  User,
  CcssConfig,
  UserPermissions,
  companies,
  FondoMovementTypeConfig,
} from "../types/firestore";
import {
  getDefaultPermissions,
  getNoPermissions,
  hasPermission,
  normalizeUserPermissions,
} from "../utils/permissions";
import ScheduleReportTab from "../components/business/ScheduleReportTab";
import ConfirmModal from "../components/ui/ConfirmModal";
import { resolveActorOwnerId } from "../utils/actorOwnership";

import EmpresasEditorSection from "./components/EmpresasEditorSection";
import SorteosEditorSection from "./components/SorteosEditorSection";
import FondoTypesEditorSection from "./components/FondoTypesEditorSection";
import UsersEditorSection from "./components/UsersEditorSection";
import CcssEditorSection from "./components/CcssEditorSection";
import FuncionesEditorSection from "./components/FuncionesEditorSection";

type DataFile =
  | "sorteos"
  | "users"
  | "schedules"
  | "ccss"
  | "empresas"
  | "fondoTypes"
  | "funciones";

const MAINTENANCE_TAB_STORAGE_KEY = "pricemaster:maintenance-active-tab";
const MAINTENANCE_TAB_EVENT = "pricemaster:maintenance-tab-change";
const SUPERADMIN_SELF_VIEW = "__self__";

const getStoredMaintenanceTab = (): DataFile => {
  if (typeof window === "undefined") return "users";
  const saved = window.localStorage.getItem(MAINTENANCE_TAB_STORAGE_KEY);
  const validTabs: DataFile[] = [
    "users",
    "sorteos",
    "schedules",
    "ccss",
    "empresas",
    "fondoTypes",
    "funciones",
  ];
  return validTabs.includes(saved as DataFile) ? (saved as DataFile) : "users";
};

const normalizeUserId = (value?: string | null): string =>
  typeof value === "string" ? value.trim() : "";

const getVisibleUsersForActor = (
  users: User[],
  currentUser: User,
): User[] => {
  if (currentUser.role === "superadmin") {
    return users.filter((user) => {
      const role = user.role;
      return role === "admin" || role === "superadmin";
    });
  }

  if (currentUser.role !== "admin") {
    return users;
  }

  const visibleAdminIds = new Set<string>();
  const pendingAdminIds: string[] = [];
  const currentAdminId = normalizeUserId(currentUser.id);

  if (currentAdminId) pendingAdminIds.push(currentAdminId);

  while (pendingAdminIds.length > 0) {
    const adminId = pendingAdminIds.shift() as string;
    if (visibleAdminIds.has(adminId)) continue;
    visibleAdminIds.add(adminId);

    users.forEach((candidate) => {
      if (candidate.role !== "admin") return;
      const creatorId = normalizeUserId(candidate.createdById);
      const candidateId = normalizeUserId(candidate.id);
      if (!creatorId || !candidateId) return;
      if (creatorId === adminId && !visibleAdminIds.has(candidateId)) {
        pendingAdminIds.push(candidateId);
      }
    });
  }

  const legacyFallbackOwnerIds = new Set<string>();
  if (currentAdminId) legacyFallbackOwnerIds.add(currentAdminId);
  if (currentUser.eliminate === true) {
    const ownerId = normalizeUserId(currentUser.ownerId);
    if (ownerId) legacyFallbackOwnerIds.add(ownerId);
  }

  return users.filter((user) => {
    if (!user) return false;
    if (user.id && currentUser.id && String(user.id) === String(currentUser.id)) {
      return true;
    }
    if (user.role !== "admin" && user.role !== "user") {
      return false;
    }

    const creatorId = normalizeUserId(user.createdById);
    if (creatorId && visibleAdminIds.has(creatorId)) {
      return true;
    }

    const legacyOwnerId = normalizeUserId(user.ownerId);
    return legacyOwnerId ? legacyFallbackOwnerIds.has(legacyOwnerId) : false;
  });
};

export default function DataEditor() {
  const [activeFile, setActiveFile] = useState<DataFile>(
    getStoredMaintenanceTab,
  );
  const { user: currentUser } = useAuth();
  const [sorteosData, setSorteosData] = useState<Sorteo[]>([]);
  const [usersData, setUsersData] = useState<User[]>([]);
  const [superadminAdminUsers, setSuperadminAdminUsers] = useState<User[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>("");
  const [ccssConfigsData, setCcssConfigsData] = useState<CcssConfig[]>([]);
  const [empresasData, setEmpresasData] = useState<any[]>([]);
  const [fondoTypesData, setFondoTypesData] = useState<
    FondoMovementTypeConfig[]
  >([]);
  const [, setOriginalEmpresasData] = useState<any[]>([]);
  const [, setOriginalSorteosData] = useState<Sorteo[]>([]);
  const [originalUsersData, setOriginalUsersData] = useState<User[]>([]);
  const [originalCcssConfigsData, setOriginalCcssConfigsData] = useState<
    CcssConfig[]
  >([]);
  const [originalFondoTypesData, setOriginalFondoTypesData] = useState<
    FondoMovementTypeConfig[]
  >([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();
  const selectedAdminUser = useMemo(() => {
    if (currentUser?.role !== "superadmin") return null;
    if (selectedAdminId === SUPERADMIN_SELF_VIEW) return currentUser;
    return (
      superadminAdminUsers.find((user) => String(user.id || "") === selectedAdminId) ||
      null
    );
  }, [currentUser, selectedAdminId, superadminAdminUsers]);
  const activeViewActor =
    currentUser?.role === "superadmin" ? selectedAdminUser ?? currentUser : currentUser;
  const { ownerIds: actorOwnerIds, primaryOwnerId } =
    useActorOwnership(activeViewActor);
  const actorOwnerIdSet = useMemo(
    () => new Set(actorOwnerIds.map((id) => String(id))),
    [actorOwnerIds],
  );
  const resolveOwnerIdForActor = useCallback(
    (provided?: string) => {
      if (provided) return provided;
      return primaryOwnerId;
    },
    [primaryOwnerId],
  );
  const fondoTypesOwnerId = useMemo(
    () => normalizeUserId(resolveActorOwnerId(activeViewActor)),
    [activeViewActor],
  );
  const createTempFondoTypeId = useCallback(
    () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );
  const isTempFondoTypeId = useCallback(
    (id?: string | null) => String(id || "").startsWith("temp-"),
    [],
  );
  const [passwordVisibility, setPasswordVisibility] = useState<{
    [key: string]: boolean;
  }>({});
  const [passwordStore, setPasswordStore] = useState<Record<string, string>>(
    {},
  );
  const [passwordBaseline, setPasswordBaseline] = useState<
    Record<string, string>
  >({});
  const [savingUserKey, setSavingUserKey] = useState<string | null>(null);
  const [showPermissions, setShowPermissions] = useState<{
    [key: string]: boolean;
  }>({});
  const [changePasswordMode, setChangePasswordMode] = useState<{
    [key: string]: boolean;
  }>({});

  // Estado para trackear cambios individuales de ubicaciones (removed)

  // Estado para modal de confirmación
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
    loading: boolean;
    singleButton?: boolean;
    singleButtonText?: string;
  }>({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
    loading: false,
    singleButton: false,
    singleButtonText: undefined,
  });

  // Helpers para modal de confirmación
  const openConfirmModal = (
    title: string,
    message: string,
    onConfirm: () => void,
    opts?: { singleButton?: boolean; singleButtonText?: string },
  ) => {
    setConfirmModal({
      open: true,
      title,
      message,
      onConfirm,
      loading: false,
      singleButton: opts?.singleButton,
      singleButtonText: opts?.singleButtonText,
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal({
      open: false,
      title: "",
      message: "",
      onConfirm: null,
      loading: false,
      singleButton: false,
      singleButtonText: undefined,
    });
  };

  const handleConfirm = async () => {
    if (confirmModal.onConfirm) {
      try {
        setConfirmModal((prev) => ({ ...prev, loading: true }));
        await Promise.resolve(confirmModal.onConfirm());
      } catch (error: unknown) {
        console.error("Error in confirm action:", error);
        const msg =
          error instanceof Error ? error.message : String(error || "Error");
        showToast(
          msg.includes("Forbidden")
            ? "No tienes permisos para realizar esta acción"
            : "Error al ejecutar la acción",
          "error",
        );
      } finally {
        closeConfirmModal();
      }
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncMaintenanceTab = () => {
      const stored = getStoredMaintenanceTab();
      setActiveFile(stored);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === MAINTENANCE_TAB_STORAGE_KEY) {
        syncMaintenanceTab();
      }
    };

    const handleCustomEvent = () => {
      syncMaintenanceTab();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(MAINTENANCE_TAB_EVENT, handleCustomEvent);
    syncMaintenanceTab();

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(MAINTENANCE_TAB_EVENT, handleCustomEvent);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MAINTENANCE_TAB_STORAGE_KEY, activeFile);
  }, [activeFile]);

  // Detectar cambios
  const loadData = useCallback(async () => {
    try {
      // Cargar sorteos desde Firebase
      const sorteos = await SorteosService.getAllSorteos();
      setSorteosData(sorteos);
      setOriginalSorteosData(JSON.parse(JSON.stringify(sorteos)));

      const isSuperadmin = currentUser?.role === "superadmin";
      const effectiveViewActor =
        isSuperadmin && selectedAdminUser ? selectedAdminUser : currentUser;
      const effectiveViewOwnerId = normalizeUserId(
        resolveActorOwnerId(effectiveViewActor),
      );

      // Cargar empresas desde Firebase
      // hoist a variable so later user-filtering can re-use the fetched empresas
      let empresasToShow: any[] = [];
      try {
        const empresas = await EmpresasService.getAllEmpresas();
        if (isSuperadmin && effectiveViewOwnerId) {
          empresasToShow = (empresas || []).filter(
            (e: any) => e && e.ownerId && String(e.ownerId) === effectiveViewOwnerId,
          );
        } else {
          // Si el actor autenticado tiene permiso de mantenimiento, solo mostrar
          // las empresas cuyo ownerId coincide con los ownerIds permitidos del actor.
          empresasToShow = empresas;
          try {
            if (
              currentUser &&
              hasPermission(currentUser.permissions, "mantenimiento")
            ) {
              if (actorOwnerIdSet.size > 0) {
                empresasToShow = (empresas || []).filter(
                  (e: any) =>
                    e && e.ownerId && actorOwnerIdSet.has(String(e.ownerId)),
                );
              } else {
                // Fallback: usar currentUser.id u ownerId si no se pudo resolver un ownerId válido
                empresasToShow = (empresas || []).filter(
                  (e: any) =>
                    e &&
                    ((currentUser.id &&
                      String(e.ownerId) === String(currentUser.id)) ||
                      (currentUser.ownerId &&
                        String(e.ownerId) === String(currentUser.ownerId))),
                );
              }
            }
          } catch (err) {
            // Si ocurre algún error durante el filtrado, dejar las empresas tal cual
            console.warn("Error filtrando empresas por ownerId:", err);
            empresasToShow = empresas;
          }
        }

        // Additionally, if the current actor is an admin, exclude empresas
        // that belong to a superadmin (i.e., empresas whose ownerId user.role === 'superadmin')
        try {
          if (currentUser?.role === "admin") {
            const ownerIds = Array.from(
              new Set(
                (empresasToShow || [])
                  .map((e: any) => e.ownerId)
                  .filter(Boolean),
              ),
            );
            const owners = await Promise.all(
              ownerIds.map((id) => UsersService.getUserById(id)),
            );
            const ownerRoleById = new Map<string, string | undefined>();
            ownerIds.forEach((id, idx) =>
              ownerRoleById.set(id, owners[idx]?.role),
            );

            // Debug info to help diagnose missing empresas
            console.debug(
              "[DataEditor] currentUser:",
              currentUser?.id,
              currentUser?.ownerId,
              "resolved actorOwnerId:",
              primaryOwnerId,
            );
            console.debug(
              "[DataEditor] empresas fetched:",
              (empresas || []).length,
              "ownerIds:",
              ownerIds,
            );
            console.debug(
              "[DataEditor] owner roles:",
              Array.from(ownerRoleById.entries()),
            );

            empresasToShow = (empresasToShow || []).filter((e: any) => {
              const ownerRole = ownerRoleById.get(e.ownerId);
              // if owner is superadmin, hide from admin actors
              if (ownerRole === "superadmin") return false;
              return true;
            });

            console.debug(
              "[DataEditor] empresas after filtering:",
              empresasToShow.map((x: any) => ({
                id: x.id,
                ownerId: x.ownerId,
                name: x.name,
              })),
            );
          }
        } catch (err) {
          console.warn(
            "Error resolving empresa owners while filtering superadmin-owned empresas:",
            err,
          );
        }

        setEmpresasData(empresasToShow);
        setOriginalEmpresasData(JSON.parse(JSON.stringify(empresasToShow)));
      } catch (err) {
        console.warn("No se pudo cargar empresas:", err);
        setEmpresasData([]);
        setOriginalEmpresasData([]);
      }

      // Cargar usuarios desde Firebase (solo si hay un usuario actual que actúe)
      if (currentUser) {
        const users = isSuperadmin
          ? await UsersService.getAllUsers()
          : await UsersService.getAllUsersAs(currentUser);

        // Asegurar que todos los usuarios tengan todos los permisos disponibles
        try {
          await UsersService.ensureAllPermissions();
        } catch (error) {
          console.warn("Error ensuring all permissions:", error);
        }

        // Filtrar usuarios usando la jerarquía de creación para respetar admins
        // hijos y sus usuarios; para datos antiguos se mantiene un fallback por ownerId.
        let usersToShow = users;
        try {
          if (isSuperadmin) {
            const adminUsers = (users || []).filter(
              (user) => user && user.role === "admin",
            );
            setSuperadminAdminUsers(adminUsers);

            const effectiveAdmin =
              selectedAdminId === SUPERADMIN_SELF_VIEW
                ? currentUser
                : adminUsers.find(
                    (user) => String(user.id || "") === selectedAdminId,
                  ) || null;

            if (!selectedAdminId) {
              setSelectedAdminId(SUPERADMIN_SELF_VIEW);
            } else if (
              selectedAdminId !== SUPERADMIN_SELF_VIEW &&
              effectiveAdmin?.id &&
              effectiveAdmin.id !== selectedAdminId
            ) {
              setSelectedAdminId(SUPERADMIN_SELF_VIEW);
            }

            usersToShow = getVisibleUsersForActor(
              users || [],
              (effectiveAdmin || currentUser) as User,
            );
          } else if (currentUser.role === "admin") {
            usersToShow = getVisibleUsersForActor(users || [], currentUser);
          }
        } catch (err) {
          console.warn("Error filtering users by visibility tree:", err);
          usersToShow = users;
        }

        const passwordMap: Record<string, string> = {};
        const baselineMap: Record<string, string> = {};
        const sanitizedUsers = usersToShow.map((user, index) => {
          const sanitized = { ...user } as User;
          const key =
            user.id ??
            (user as unknown as { __localId?: string }).__localId ??
            `tmp-${index}`;
          const storedPassword =
            typeof user.password === "string" ? user.password : "";
          passwordMap[key] = storedPassword;
          baselineMap[key] = storedPassword;
          sanitized.password = "";
          sanitized.permissions = normalizeUserPermissions(
            user.permissions,
            (user.role || "user") as any,
          );
          return sanitized;
        });

        setUsersData(sanitizedUsers);
        setOriginalUsersData(JSON.parse(JSON.stringify(sanitizedUsers)));
        setPasswordStore(passwordMap);
        setPasswordBaseline(baselineMap);

        // Re-apply empresa filtering so admins see empresas owned by users they can see.
        try {
          if (currentUser && !isSuperadmin) {
            const visibleOwnerIds = (usersToShow || [])
              .map((u) => u.id)
              .filter(Boolean)
              .map(String);
            if (visibleOwnerIds.length > 0) {
              // Use the empresas we just fetched/filtered earlier in this function
              const filteredEmpresas = (empresasToShow || []).filter(
                (e) =>
                  e && e.ownerId && visibleOwnerIds.includes(String(e.ownerId)),
              );
              // Only set if we have results; otherwise keep current empresasData (avoid hiding unintentionally)
              if (filteredEmpresas.length > 0) {
                setEmpresasData(filteredEmpresas);
                setOriginalEmpresasData(
                  JSON.parse(JSON.stringify(filteredEmpresas)),
                );
              }
            }
          }
        } catch (err) {
          console.warn(
            "Error re-filtering empresas based on visible users:",
            err,
          );
        }
      } else {
        // Si no hay currentUser (por ejemplo durante SSR/hydration temprana), inicializar vacíos
        setUsersData([]);
        setOriginalUsersData([]);
      }

      // Cargar configuración CCSS desde Firebase
      if (currentUser) {
        const ownerId = resolveOwnerIdForActor();
        const ccssConfigs =
          await CcssConfigService.getAllCcssConfigsByOwner(ownerId);
        setCcssConfigsData(ccssConfigs);
        setOriginalCcssConfigsData(JSON.parse(JSON.stringify(ccssConfigs)));
      } else {
        setCcssConfigsData([]);
        setOriginalCcssConfigsData([]);
      }

      // Cargar tipos de movimientos de fondo desde Firebase (para superadmins y admins)
      if (currentUser?.role !== "user") {
        try {
          const fondoTypes =
            await FondoMovementTypesService.getTypesFromCacheOrDB(
              fondoTypesOwnerId,
            );
          setFondoTypesData(fondoTypes);
          setOriginalFondoTypesData(JSON.parse(JSON.stringify(fondoTypes)));
        } catch (error) {
          console.error("Error loading fondo movement types:", error);
          setFondoTypesData([]);
          setOriginalFondoTypesData([]);
        }
      } else {
        setFondoTypesData([]);
        setOriginalFondoTypesData([]);
      }
    } catch (error) {
      showToast("Error al cargar los datos de Firebase", "error");
      console.error("Error loading data from Firebase:", error);
    }
  }, [
    actorOwnerIdSet,
    currentUser,
    fondoTypesOwnerId,
    primaryOwnerId,
    resolveOwnerIdForActor,
    selectedAdminId,
    selectedAdminUser,
    showToast,
  ]);

  // Keep a ref so effects can call the latest loadData without
  // re-triggering on every currentUser object identity change.
  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  const currentUserId = currentUser?.id ? String(currentUser.id) : null;

  // Cargar datos al montar el componente o cuando cambie el usuario autenticado
  useEffect(() => {
    // Solo ejecutar la carga (loadData) cuando React haya inicializado el componente.
    // loadData internamente chequea `currentUser` antes de pedir usuarios.
    loadDataRef.current();
  }, [currentUserId, selectedAdminId]);

  useEffect(() => {
    if (currentUser?.role !== "superadmin") return;
    if (superadminAdminUsers.length === 0) return;
    if (selectedAdminId === SUPERADMIN_SELF_VIEW) return;

    const hasSelectedAdmin = superadminAdminUsers.some(
      (user) => String(user.id || "") === selectedAdminId,
    );

    if (!selectedAdminId || !hasSelectedAdmin) {
      const firstAdmin = superadminAdminUsers[0];
      if (firstAdmin?.id && String(firstAdmin.id) !== selectedAdminId) {
        setSelectedAdminId(String(firstAdmin.id));
      }
    }
  }, [currentUser?.role, selectedAdminId, superadminAdminUsers]);

  // Listener para actualizaciones en tiempo real de tipos de fondo
  useEffect(() => {
    const handleFondoTypesUpdate = async (event: Event) => {
      if (currentUser?.role !== "user") {
        try {
          const eventOwnerId = normalizeUserId(
            (event as CustomEvent<{ ownerId?: string }>).detail?.ownerId,
          );
          if (eventOwnerId && eventOwnerId !== fondoTypesOwnerId) {
            return;
          }

          console.log("[DataEditor] Fondo types updated, reloading...");
          const fondoTypes =
            await FondoMovementTypesService.getTypesFromCacheOrDB(
              fondoTypesOwnerId,
            );
          setFondoTypesData(fondoTypes);
          // No actualizar originalFondoTypesData para mantener el tracking de cambios
        } catch (error) {
          console.error("Error reloading fondo types:", error);
        }
      }
    };

    window.addEventListener(
      "fondoMovementTypesUpdated",
      handleFondoTypesUpdate,
    );

    return () => {
      window.removeEventListener(
        "fondoMovementTypesUpdated",
        handleFondoTypesUpdate,
      );
    };
  }, [currentUser?.role, fondoTypesOwnerId]);

  // Función para verificar si una ubicación específica ha cambiado (removed - locations tab deleted)

  // Función para verificar si un usuario específico ha cambiado
  // Helper: obtener key única para un usuario (id o __localId)
  const getUserKey = (user: User, index: number) => {
    return (
      user.id ??
      (user as unknown as { __localId?: string }).__localId ??
      `tmp-${index}`
    );
  };

  const hasUserChanged = (index: number): boolean => {
    const currentUser = usersData[index];
    if (!currentUser) return false;

    // const key = getUserKey(currentUser, index);

    // Buscar original por id si existe
    let originalUser: User | null = null;
    if (currentUser.id) {
      originalUser =
        originalUsersData.find((u) => u.id === currentUser.id) || null;
    } else {
      // intentar buscar por __localId si fue asignado previamente
      originalUser =
        originalUsersData.find(
          (u) =>
            (u as unknown as { __localId?: string }).__localId ===
            (currentUser as unknown as { __localId?: string }).__localId,
        ) || null;
    }

    if (!originalUser) return true;

    const sanitize = (u: User | null | undefined) => {
      if (!u) return u;
      const copy = { ...u } as Partial<User>;
      delete (copy as Partial<User>).createdAt;
      delete (copy as Partial<User>).updatedAt;
      return copy;
    };

    return (
      JSON.stringify(sanitize(currentUser)) !==
      JSON.stringify(sanitize(originalUser))
    );
  };

  const saveData = async () => {
    setIsSaving(true);
    try {
      // Guardar sorteos
      const existingSorteos = await SorteosService.getAllSorteos();
      for (const s of existingSorteos) {
        if (s.id) await SorteosService.deleteSorteo(s.id);
      }
      for (const s of sorteosData) {
        await SorteosService.addSorteo({ name: s.name });
      }

      // Guardar usuarios
      const existingUsers = await UsersService.getAllUsers();
      for (const u of existingUsers) {
        if (!u.id) continue;
        const existingOwnerId = normalizeUserId(u.ownerId);
        if (existingOwnerId && existingOwnerId !== fondoTypesOwnerId) continue;
        try {
          await UsersService.deleteUserAs(currentUser, u.id);
        } catch {}
      }
      for (let index = 0; index < usersData.length; index++) {
        const u = usersData[index];
        const key = getUserKey(u, index);
        const storedPassword = passwordStore[key] ?? u.password;
        const perms = { ...(u.permissions || {}) } as Record<string, unknown>;
        await UsersService.createUserAs(currentUser, {
          name: u.name,
          ownercompanie: u.ownercompanie,
          password: storedPassword,
          role: u.role,
          isActive: u.isActive,
          permissions: perms as any,
          maxCompanies: u.maxCompanies,
          email: u.email,
          fullName: u.fullName,
          eliminate: u.eliminate ?? false,
          ownerId: u.ownerId,
        });
      }

      // Guardar configuraciones CCSS
      for (const ccssConfig of ccssConfigsData) {
        await CcssConfigService.updateCcssConfig(ccssConfig);
      }

      // Guardar empresas
      try {
        const existingEmpresas = await EmpresasService.getAllEmpresas();
        for (const e of existingEmpresas) {
          if (!e.id) continue;
          if (normalizeUserId(e.ownerId) !== fondoTypesOwnerId) continue;
          await EmpresasService.deleteEmpresa(e.id);
        }
        for (const empresa of empresasData) {
          const ownerIdToUse = fondoTypesOwnerId || resolveOwnerIdForActor(empresa.ownerId);
          const idToUse = empresa.name || undefined;
          await EmpresasService.addEmpresa({
            id: idToUse,
            ownerId: ownerIdToUse,
            name: empresa.name || "",
            ubicacion: empresa.ubicacion || "",
            horarioApertura: empresa.horarioApertura || "",
            horarioCierre: empresa.horarioCierre || "",
            empleados: empresa.empleados || [],
          });
        }
      } catch (err) {
        console.warn("Error al guardar empresas:", err);
      }

      // Guardar tipos de movimientos de fondo (para superadmins y admins)
      if (currentUser?.role !== "user") {
        try {
          const existingFondoTypes =
            await FondoMovementTypesService.getAllMovementTypes(
              fondoTypesOwnerId,
            );
          for (const ft of existingFondoTypes) {
            if (ft.id)
              await FondoMovementTypesService.deleteMovementType(
                ft.id,
                fondoTypesOwnerId,
              );
          }
          for (const fondoType of fondoTypesData) {
            await FondoMovementTypesService.addMovementType({
              category: fondoType.category,
              name: fondoType.name,
              order: fondoType.order,
            }, fondoTypesOwnerId);
          }
        } catch (err) {
          console.warn("Error al guardar tipos de movimientos de fondo:", err);
        }
      }

      // Local storage and update originals
      localStorage.setItem("editedSorteos", JSON.stringify(sorteosData));
      localStorage.setItem("editedUsers", JSON.stringify(usersData));

      await loadData();

      setHasChanges(false);
      showToast("¡Datos actualizados exitosamente en Firebase!", "success");
    } catch (error) {
      console.error("Error saving data to Firebase:", error);
      showToast("Error al guardar los datos en Firebase", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Location helpers removed (locations tab deleted)

  // Funciones para manejar sorteos
  const addSorteo = () => {
    const newSorteo: Sorteo = {
      name: "",
    };
    setSorteosData([...sorteosData, newSorteo]);
  };

  const updateSorteo = (index: number, field: keyof Sorteo, value: string) => {
    const updated = [...sorteosData];
    updated[index] = { ...updated[index], [field]: value };
    setSorteosData(updated);
  };

  const removeSorteo = (index: number) => {
    const sorteo = sorteosData[index];
    const sorteoName = sorteo.name || `Sorteo ${index + 1}`;

    openConfirmModal(
      "Eliminar Sorteo",
      `¿Está seguro de que desea eliminar el sorteo "${sorteoName}"? Esta acción no se puede deshacer.`,
      () => {
        setSorteosData(sorteosData.filter((_, i) => i !== index));
      },
    );
  };

  // Funciones para manejar tipos de movimientos de fondo
  const addFondoType = async (category: "INGRESO" | "GASTO" | "EGRESO") => {
    const maxOrder = Math.max(...fondoTypesData.map((t) => t.order ?? 0), -1);
    const newType: FondoMovementTypeConfig = {
      id: createTempFondoTypeId(),
      category,
      name: "",
      order: maxOrder + 1,
    };

    setFondoTypesData([...fondoTypesData, newType]);
    showToast(
      `Nuevo tipo de ${category} agregado. Presiona el check para guardar.`,
      "info",
    );
  };

  const updateFondoType = async (
    index: number,
    field: keyof FondoMovementTypeConfig,
    value: string | number,
  ) => {
    const updated = [...fondoTypesData];
    updated[index] = { ...updated[index], [field]: value };
    setFondoTypesData(updated);

  };

  const saveFondoType = async (index: number) => {
    const current = fondoTypesData[index];
    if (!current) return;

    const name = String(current.name || "").trim();
    if (!name) {
      showToast("El nombre es requerido para guardar.", "error");
      return;
    }

    try {
      if (!current.id || isTempFondoTypeId(current.id)) {
        const savedId = await FondoMovementTypesService.addMovementType(
          {
            category: current.category,
            name,
            order: current.order ?? index,
          },
          fondoTypesOwnerId,
        );

        const savedItem = {
          ...current,
          id: savedId,
          name,
          order: current.order ?? index,
        };

        setFondoTypesData((prev) => {
          const next = [...prev];
          next[index] = savedItem;
          return next;
        });
        setOriginalFondoTypesData((prev) => {
          const next = [...prev];
          next[index] = savedItem;
          return next;
        });
        showToast("Tipo guardado correctamente", "success");
        return;
      }

      await FondoMovementTypesService.updateMovementType(
        current.id,
        {
          category: current.category,
          name,
          order: current.order ?? index,
        },
        fondoTypesOwnerId,
      );

      const savedItem = { ...current, name };
      setFondoTypesData((prev) => {
        const next = [...prev];
        next[index] = savedItem;
        return next;
      });
      setOriginalFondoTypesData((prev) => {
        const next = [...prev];
        const originalIndex = next.findIndex((item) => item.id === current.id);
        if (originalIndex >= 0) {
          next[originalIndex] = savedItem;
        }
        return next;
      });
      showToast("Tipo guardado correctamente", "success");
    } catch (error) {
      console.error("Error saving fondo type:", error);
      showToast("Error al guardar el tipo", "error");
    }
  };

  const removeFondoType = (index: number) => {
    const fondoType = fondoTypesData[index];
    const typeName = fondoType.name || `Tipo ${index + 1}`;

    openConfirmModal(
      "Eliminar Tipo de Movimiento",
      `¿Está seguro de que desea eliminar el tipo "${typeName}"? Esta acción no se puede deshacer.`,
      async () => {
        try {
          // Eliminar de la base de datos si tiene ID persistido.
          if (fondoType.id && !isTempFondoTypeId(fondoType.id)) {
            await FondoMovementTypesService.deleteMovementType(
              fondoType.id,
              fondoTypesOwnerId,
            );
          }

          const filtered = fondoTypesData.filter((_, i) => i !== index);
          setFondoTypesData(filtered);
          setOriginalFondoTypesData(filtered);
          showToast("Tipo eliminado correctamente", "success");
        } catch (error) {
          console.error("Error deleting fondo type:", error);
          showToast("Error al eliminar el tipo", "error");
        }
      },
    );
  };

  const moveFondoTypeUp = async (index: number) => {
    if (index === 0) return;
    const updated = [...fondoTypesData];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    // Update order values
    updated.forEach((item, idx) => {
      item.order = idx;
    });
    setFondoTypesData(updated);

    // Guardar cambios de orden en la base de datos
    try {
      const promises = [];
      if (updated[index - 1].id) {
        promises.push(
          FondoMovementTypesService.updateMovementType(updated[index - 1].id!, {
            order: index - 1,
          }, fondoTypesOwnerId),
        );
      }
      if (updated[index].id) {
        promises.push(
          FondoMovementTypesService.updateMovementType(updated[index].id!, {
            order: index,
          }, fondoTypesOwnerId),
        );
      }
      await Promise.all(promises);
      setOriginalFondoTypesData([...updated]);
    } catch (error) {
      console.error("Error updating order:", error);
      showToast("Error al actualizar el orden", "error");
    }
  };

  const moveFondoTypeDown = async (index: number) => {
    if (index === fondoTypesData.length - 1) return;
    const updated = [...fondoTypesData];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    // Update order values
    updated.forEach((item, idx) => {
      item.order = idx;
    });
    setFondoTypesData(updated);

    // Guardar cambios de orden en la base de datos
    try {
      const promises = [];
      if (updated[index].id) {
        promises.push(
          FondoMovementTypesService.updateMovementType(updated[index].id!, {
            order: index,
          }, fondoTypesOwnerId),
        );
      }
      if (updated[index + 1].id) {
        promises.push(
          FondoMovementTypesService.updateMovementType(updated[index + 1].id!, {
            order: index + 1,
          }, fondoTypesOwnerId),
        );
      }
      await Promise.all(promises);
      setOriginalFondoTypesData([...updated]);
    } catch (error) {
      console.error("Error updating order:", error);
      showToast("Error al actualizar el orden", "error");
    }
  };

  const isFondoTypeDirty = (type: FondoMovementTypeConfig) => {
    if (!type.id || isTempFondoTypeId(type.id)) return true;
    const original = originalFondoTypesData.find((item) => item.id === type.id);
    if (!original) return true;
    return (
      original.category !== type.category ||
      original.name !== type.name ||
      (original.order ?? 0) !== (type.order ?? 0)
    );
  };

  const seedFondoTypes = async () => {
    openConfirmModal(
      "Inicializar Tipos de Movimientos",
      "¿Deseas cargar los tipos de movimientos por defecto? Esta acción agregará los tipos que no existan en la base de datos.",
      async () => {
        try {
          await FondoMovementTypesService.seedInitialData(fondoTypesOwnerId);
          showToast(
            "Tipos de movimientos inicializados correctamente",
            "success",
          );
          await loadData(); // Reload data to show the new types
        } catch (error) {
          console.error("Error seeding fondo types:", error);
          showToast("Error al inicializar los tipos de movimientos", "error");
        }
      },
    );
  }; // Funciones para manejar usuarios
  const addUser = () => {
    const defaultRole: User["role"] =
      currentUser?.role === "superadmin" ? "admin" : "user";
    const resolvedOwnerId = normalizeUserId(resolveActorOwnerId(activeViewActor));
    const isSuperadminAdminView =
      currentUser?.role === "superadmin" && selectedAdminId !== SUPERADMIN_SELF_VIEW;
    const newUser: User = {
      name: "",
      ownercompanie: "",
      password: "",
      role: defaultRole,
      isActive: true,
      eliminate: isSuperadminAdminView,
      ownerId: resolvedOwnerId,
    };
    // Añadir campos solicitados: email, fullName y eliminate por defecto false
    (newUser as Partial<User>).email = "";
    (newUser as Partial<User>).fullName = "";
    if (!isSuperadminAdminView) {
      (newUser as Partial<User>).eliminate = false;
    }
    // Insertar al inicio
    // Give new user no permissions by default (no privileges)
    newUser.permissions = getNoPermissions();
    // Assign a temporary local id so per-user keyed state can reference it
    const localId = `local-${Date.now()}`;
    (newUser as unknown as { __localId?: string }).__localId = localId;
    setUsersData((prev) => [newUser, ...prev]);

    // Initialize per-user keyed UI state for the new user
    setPasswordVisibility((prev) => ({ ...prev, [localId]: false }));
    setShowPermissions((prev) => ({ ...prev, [localId]: true }));
    setPasswordStore((prev) => ({ ...prev, [localId]: "" }));
    setPasswordBaseline((prev) => ({ ...prev, [localId]: "" }));
    setChangePasswordMode((prev) => ({ ...prev, [localId]: false }));
  };

  const updateUser = (index: number, field: keyof User, value: unknown) => {
    if (field === "password") {
      const key = getUserKey(usersData[index], index);
      const newValue = typeof value === "string" ? value : "";
      const updated = [...usersData];
      updated[index] = { ...updated[index], password: newValue };
      setUsersData(updated);

      if (newValue.length > 0) {
        setPasswordStore((prev) => ({ ...prev, [key]: newValue }));
      } else {
        setPasswordStore((prev) => ({
          ...prev,
          [key]: passwordBaseline[key] ?? "",
        }));
      }
      return;
    }

    const updated = [...usersData];

    // No cambiar permisos automáticamente al cambiar rol. Solo actualizar campo.
    updated[index] = { ...updated[index], [field]: value };

    setUsersData(updated);
  };

  const removeUser = (index: number) => {
    const user = usersData[index];
    const userName = user.name || `Usuario ${index + 1}`;

    openConfirmModal(
      "Eliminar Usuario",
      `¿Está seguro de que desea eliminar al usuario "${userName}"? Esta acción no se puede deshacer.`,
      async () => {
        try {
          setConfirmModal((prev) => ({ ...prev, loading: true }));

          // Si el usuario tiene id, eliminar en backend primero con validación de actor
          if (user.id) {
            await UsersService.deleteUserAs(currentUser, user.id);
          }

          // Eliminar del estado local
          setUsersData((prev) => prev.filter((_, i) => i !== index));

          // Actualizar originalUsersData para eliminarlo también
          setOriginalUsersData((prev) =>
            prev.filter(
              (u) =>
                u.id !== user.id &&
                (u as unknown as { __localId?: string }).__localId !==
                  (user as unknown as { __localId?: string }).__localId,
            ),
          );

          const keyToRemove = getUserKey(user, index);
          setPasswordStore((prev) => {
            const copy = { ...prev };
            delete copy[keyToRemove];
            return copy;
          });
          setPasswordBaseline((prev) => {
            const copy = { ...prev };
            delete copy[keyToRemove];
            return copy;
          });

          showToast(`Usuario ${userName} eliminado exitosamente`, "success");
        } catch (error: unknown) {
          console.error("Error deleting user:", error);
          const msg =
            error instanceof Error
              ? error.message
              : String(error || "Error al eliminar el usuario");
          showToast(
            msg.includes("Forbidden")
              ? "No tienes permisos para eliminar este usuario"
              : "Error al eliminar el usuario",
            "error",
          );
        } finally {
          // Cerrar modal y quitar loading
          closeConfirmModal();
        }
      },
    );
  };

  // Funciones para manejar visibilidad de contraseñas
  const togglePasswordVisibility = (user: User, index: number) => {
    const key = getUserKey(user, index);
    setPasswordVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // showPermissions is toggled inline where needed

  // Note: permission-specific auto-save functions were removed because permissions are edited locally
  // and saved when the user presses the 'Guardar' button. Keep UsersService functions available
  // if needed elsewhere.

  // Función para habilitar/deshabilitar todos los permisos con guardado automático
  const setAllUserPermissions = (userIndex: number, value: boolean) => {
    const user = usersData[userIndex];
    const action = value ? "habilitar todos" : "deshabilitar todos";

    openConfirmModal(
      `${value ? "Habilitar" : "Deshabilitar"} Todos los Permisos`,
      `¿Estás seguro de ${action} los permisos para "${user.name}"?`,
      async () => {
        const updated = [...usersData];
        const permissionKeys: (keyof UserPermissions)[] = [
          "scanner",
          "calculator",
          "converter",
          "cashcounter",
          "timingcontrol",
          "controlhorario",
          "calculohorasprecios",
          "supplierorders",
          "mantenimiento",
          "cajaNegra",
          "solicitud",
          "scanhistory",
        ];

        if (!updated[userIndex].permissions) {
          updated[userIndex].permissions = getDefaultPermissions(
            updated[userIndex].role || "user",
          );
        }

        const newPermissions: Partial<UserPermissions> = {};
        permissionKeys.forEach((key) => {
          (updated[userIndex].permissions as unknown as Record<
            string,
            unknown
          >)![key] = value;
          (newPermissions as unknown as Record<string, unknown>)[key] = value;
        });

        // Si se están desactivando todos los permisos, limpiar las empresas seleccionadas
        if (!value) {
          updated[userIndex].permissions!.scanhistoryEmpresas = [];
          newPermissions.scanhistoryEmpresas = [];
        }

        setUsersData(updated);

        // Guardar en base de datos si el usuario tiene ID
        if (user.id) {
          try {
            const key = getUserKey(user, userIndex);
            setSavingUserKey(key);
            await UsersService.updateUserPermissions(user.id, newPermissions);

            showToast(
              `Todos los permisos ${value ? "habilitados" : "deshabilitados"} para ${user.name}`,
              "success",
              3000,
            );
          } catch (error) {
            console.error("Error updating all user permissions:", error);
            showToast(
              `Error al actualizar permisos para ${user.name}`,
              "error",
              5000,
            );
          } finally {
            setSavingUserKey(null);
          }
        }
      },
    );
  };

  // Función para obtener etiquetas de permisos
  const getPermissionLabel = (permission: string): string => {
    const labels: { [key: string]: string } = {
      scanner: "Escáner",
      calculator: "Calculadora",
      converter: "Conversor",
      cashcounter: "Contador Efectivo",
      timingcontrol: "Control Tiempos",
      controlhorario: "Control Horario",
      calculohorasprecios: "Calculo Horas Precios",
      supplierorders: "Órdenes Proveedor",
      mantenimiento: "Mantenimiento",
      cajaNegra: "Caja Negra",
      solicitud: "Solicitud",
      scanhistory: "Historial de Escaneos",
    };    return labels[permission] || permission;
  };

  // Función para obtener descripciones de permisos
  const getPermissionDescription = (permission: string): string => {
    const descriptions: { [key: string]: string } = {
      scanner: "Escanear códigos de barras",
      calculator: "Calcular precios con descuentos",
      converter: "Convertir y transformar texto",
      cashcounter: "Contar billetes y monedas",
      timingcontrol: "Registro de venta de tiempos",
      controlhorario: "Registro de horarios de trabajo",
      calculohorasprecios: "Cálculo de horas y precios (planilla)",
      supplierorders: "Gestión de órdenes de proveedores",
      mantenimiento: "Acceso al panel de administración",
      cajaNegra: "Manejar dineros extra del Fondo General",
      solicitud:
        "Permite gestionar solicitudes dentro del módulo de mantenimiento",
      scanhistory: "Ver historial completo de escaneos realizados",
    };    return descriptions[permission] || permission;
  };

  // Función para renderizar la lista de permisos editables
  const renderUserPermissions = (user: User, index: number) => {
    const userPermissions = normalizeUserPermissions(
      user.permissions,
      (user.role || "user") as any,
    );
    // allow editing permissions for new users; only disable while saving
    const key = getUserKey(user, index);
    const isDisabled = savingUserKey === key;

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
          <span
            className="text-sm sm:text-base font-medium"
            style={{ color: "var(--foreground)" }}
          >
            Permisos de Usuario:
          </span>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {savingUserKey === key && (
              <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-600 dark:text-blue-400 order-first sm:order-none">
                <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-blue-600 dark:border-blue-400"></div>
                <span>Guardando...</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAllUserPermissions(index, true)}
                disabled={isDisabled}
                className="text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap font-medium flex items-center justify-center gap-1.5"
              >
                <span className="hidden sm:inline">Habilitar Todo</span>
                <span className="sm:hidden flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Todo
                </span>
              </button>
              <button
                onClick={() => setAllUserPermissions(index, false)}
                disabled={isDisabled}
                className="text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap font-medium flex items-center justify-center gap-1.5"
              >
                <span className="hidden sm:inline">Deshabilitar Todo</span>
                <span className="sm:hidden flex items-center gap-1">
                  <X className="w-3 h-3" />
                  Todo
                </span>
              </button>
              <button
                onClick={() =>
                  setShowPermissions((prev) => ({ ...prev, [key]: !prev[key] }))
                }
                className="text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap font-medium flex items-center justify-center gap-1.5"
              >
                {showPermissions[key] ? (
                  <span className="hidden sm:inline">Vista Compacta</span>
                ) : (
                  <span className="hidden sm:inline">Vista Detallada</span>
                )}
                <span className="sm:hidden flex items-center gap-1">
                  {showPermissions[key] ? (
                    <Smartphone className="w-3 h-3" />
                  ) : (
                    <Clipboard className="w-3 h-3" />
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>

        {showPermissions[key] ? (
          // Vista detallada con checkboxes editables
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {Object.entries(userPermissions)
              .filter(
                ([permission]) =>
                  permission !== "scanhistoryEmpresas" &&
                  permission !== "scanhistoryLocations",
              )
              .map(([permission, hasAccess]) => (
                <div
                  key={permission}
                  className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border rounded-lg transition-colors ${
                    hasAccess
                      ? "border-[var(--success)] bg-[var(--muted)] hover:opacity-90"
                      : "border-[var(--border)] bg-[var(--card-bg)] hover:opacity-90"
                  }`}
                >
                  <input
                    type="checkbox"
                    id={`${index}-${permission}`}
                    checked={hasAccess === true}
                    disabled={isDisabled}
                    onChange={(e) => {
                      // Only update in local state; do not auto-save
                      const checked = e.target.checked;
                      setUsersData((prev) => {
                        const updated = [...prev];
                        const current = updated[index];
                        if (!current) return prev;

                        const basePermissions = normalizeUserPermissions(
                          current.permissions,
                          (current.role || "user") as any,
                        );

                        const nextPermissions = {
                          ...basePermissions,
                          [permission]: checked,
                        } as any;

                        updated[index] = { ...current, permissions: nextPermissions };
                        return updated;
                      });
                    }}
                    className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--success)] border rounded focus-visible:ring-[var(--accent)]/60 focus-visible:ring-2 focus-visible:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: "var(--input-bg)",
                      borderColor: "var(--input-border)",
                    }}
                  />
                  <label
                    htmlFor={`${index}-${permission}`}
                    className="cursor-pointer flex-1"
                  >
                    <div
                      className="font-medium text-sm"
                      style={{ color: "var(--foreground)" }}
                    >
                      {getPermissionLabel(permission)}
                    </div>
                    <div
                      className="text-xs sm:text-sm"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {getPermissionDescription(permission)}
                    </div>
                  </label>
                  <div
                    className={`px-1 sm:px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                      hasAccess
                        ? "bg-[var(--success)] text-white"
                        : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    <span className="hidden sm:inline">
                      {hasAccess ? "Activo" : "Inactivo"}
                    </span>
                    <span className="sm:hidden">
                      {hasAccess ? "On" : "Off"}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          // Vista compacta con indicadores
          <div className="flex flex-wrap gap-1 sm:gap-2">
            {Object.entries(userPermissions)
              .filter(
                ([permission]) =>
                  permission !== "scanhistoryEmpresas" &&
                  permission !== "scanhistoryLocations",
              )
              .map(([permission, hasAccess]) => (
                <label
                  key={permission}
                  className={`flex items-center gap-1 text-xs sm:text-sm px-2 py-1 rounded cursor-pointer border transition-colors ${
                    hasAccess
                      ? "bg-[var(--success)] text-white border-[var(--success)] hover:opacity-90"
                      : "bg-[var(--error)] text-white border-[var(--error)] hover:opacity-90"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={hasAccess === true}
                    disabled={isDisabled}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setUsersData((prev) => {
                        const updated = [...prev];
                        const current = updated[index];
                        if (!current) return prev;

                        const basePermissions = normalizeUserPermissions(
                          current.permissions,
                          (current.role || "user") as any,
                        );

                        const nextPermissions = {
                          ...basePermissions,
                          [permission]: checked,
                        } as any;

                        updated[index] = { ...current, permissions: nextPermissions };
                        return updated;
                      });
                    }}
                    className="w-3 h-3 sm:w-4 sm:h-4 rounded border border-current cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="hidden sm:inline">
                    {getPermissionLabel(permission)}
                  </span>
                  <span className="sm:hidden">
                    {getPermissionLabel(permission).split(" ")[0]}
                  </span>
                </label>
              ))}
          </div>
        )}

        {/* Selector de empresas para scanhistory */}
        {userPermissions.scanhistory && (
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <div className="mb-3 sm:mb-4">
              <h4
                className="font-medium text-sm sm:text-base mb-2"
                style={{ color: "var(--foreground)" }}
              >
                Empresas para Historial de Escaneos
              </h4>
              <p
                className="text-xs sm:text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                Selecciona las empresas específicas a las que este usuario
                tendrá acceso en el historial de escaneos.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
              {empresasData
                .filter((empresa) => {
                  // Mostrar solo empresas dentro del alcance del actor (ownerId match)
                  if (actorOwnerIdSet.size === 0) return true;
                  return (
                    empresa.ownerId &&
                    actorOwnerIdSet.has(String(empresa.ownerId))
                  );
                })
                .map((empresa) => (
                  <label
                    key={empresa.id || empresa.name}
                    className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 border border-[var(--input-border)] rounded-lg cursor-pointer text-sm hover:bg-[var(--muted)]/30 transition-colors bg-[var(--card-bg)]/50"
                  >
                    <input
                      type="checkbox"
                      // almacenamos por empresa.name para mantener compatibilidad con la estructura actual
                      checked={
                        userPermissions.scanhistoryEmpresas?.includes(
                          empresa.name,
                        ) || false
                      }
                      disabled={isDisabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUsersData((prev) => {
                          const updated = [...prev];
                          const currentUserRow = updated[index];
                          if (!currentUserRow) return prev;

                          const basePermissions = normalizeUserPermissions(
                            currentUserRow.permissions,
                            (currentUserRow.role || "user") as any,
                          );

                          const currentList =
                            (basePermissions as any).scanhistoryEmpresas || [];
                          const nextList = checked
                            ? Array.from(
                                new Set([...currentList, empresa.name]),
                              )
                            : currentList.filter((l: string) => l !== empresa.name);

                          const nextPermissions = {
                            ...basePermissions,
                            scanhistoryEmpresas: nextList,
                          } as any;

                          updated[index] = {
                            ...currentUserRow,
                            permissions: nextPermissions,
                          };
                          return updated;
                        });
                      }}
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded border border-[var(--input-border)] cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span
                      className="flex-1 truncate"
                      style={{ color: "var(--foreground)" }}
                    >
                      {empresa.name}
                    </span>
                  </label>
                ))}
            </div>
            {userPermissions.scanhistoryEmpresas &&
              userPermissions.scanhistoryEmpresas.length > 0 && (
                <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-md">
                  <p
                    className="text-xs sm:text-sm"
                    style={{ color: "var(--foreground)" }}
                  >
                    <strong className="text-green-700 dark:text-green-300">
                      Empresas seleccionadas:
                    </strong>
                    <span className="ml-1 text-green-600 dark:text-green-400">
                      {userPermissions.scanhistoryEmpresas.join(", ")}
                    </span>
                  </p>
                </div>
              )}
          </div>
        )}
      </div>
    );
  };

  // Función para guardar usuario individual
  const saveIndividualUser = async (index: number) => {
    const key = getUserKey(usersData[index], index);
    setSavingUserKey(key);
    try {
      const user = usersData[index];
      if (user.id) {
        // Actualizar usuario existente (actor-aware)
        // Clean stale properties before saving
        const permissionsToSave = { ...(user.permissions || {}) } as Record<
          string,
          unknown
        >;
        const storedPassword = passwordStore[key] ?? "";
        const baselinePassword = passwordBaseline[key] ?? "";
        const passwordHasInput =
          typeof user.password === "string" && user.password.length > 0;
        const shouldUpdatePassword =
          passwordHasInput ||
          (storedPassword.length > 0 && storedPassword !== baselinePassword);

        const updatePayload: Partial<User> = {
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          permissions: permissionsToSave as any,
          email: user.email,
          fullName: user.fullName,
          maxCompanies: user.maxCompanies,
          eliminate: user.eliminate ?? false,
          ownerId: user.ownerId,
          ownercompanie: user.ownercompanie,
        };

        if (shouldUpdatePassword) {
          updatePayload.password = storedPassword;
        }

        await UsersService.updateUserAs(currentUser, user.id, updatePayload);

        const refreshed = await UsersService.getUserById(user.id);

        if (refreshed) {
          const sanitizedRefreshed = { ...refreshed, password: "" } as User;

          setUsersData((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], ...sanitizedRefreshed };
            return updated;
          });

          setOriginalUsersData((prev) => {
            try {
              const copy = JSON.parse(JSON.stringify(prev)) as User[];
              const idx = copy.findIndex((u) => u.id === user.id);
              if (idx !== -1) {
                copy[idx] = JSON.parse(JSON.stringify(sanitizedRefreshed));
              }
              return copy;
            } catch {
              return prev;
            }
          });

          const refreshedPassword =
            typeof refreshed.password === "string" ? refreshed.password : "";
          setPasswordStore((prev) => ({ ...prev, [key]: refreshedPassword }));
          setPasswordBaseline((prev) => ({
            ...prev,
            [key]: refreshedPassword,
          }));
        } else {
          setUsersData((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], password: "" };
            return updated;
          });

          if (shouldUpdatePassword) {
            setPasswordStore((prev) => ({ ...prev, [key]: storedPassword }));
            setPasswordBaseline((prev) => ({ ...prev, [key]: storedPassword }));
          }
        }

        // Resetear modo de cambio de contraseña
        setChangePasswordMode((prev) => ({ ...prev, [key]: false }));
      } else {
        // Crear nuevo usuario (actor-aware)
        const permissionsToCreate = { ...(user.permissions || {}) } as Record<
          string,
          unknown
        >;
        await UsersService.createUserAs(currentUser, {
          name: user.name,
          password: passwordStore[key] ?? user.password,
          role: user.role,
          isActive: user.isActive,
          permissions: permissionsToCreate as any,
          maxCompanies: user.maxCompanies,
          email: user.email,
          fullName: user.fullName,
          eliminate: user.eliminate ?? false,
          ownerId: user.ownerId || resolveOwnerIdForActor(),
          ownercompanie: user.ownercompanie,
        });
        // Recargar datos para obtener el ID generado
        await loadData();
        // Resetear modo de cambio de contraseña
        setChangePasswordMode((prev) => ({ ...prev, [key]: false }));
      }
      showToast(`Usuario ${user.name} guardado exitosamente`, "success");
      // Clear global changes flag so UI removes "Cambios pendientes" badges
      setHasChanges(false);
    } catch (error) {
      showToast("Error al guardar el usuario", "error");
      console.error("Error saving user:", error);
    } finally {
      setSavingUserKey(null);
    }
  };

  // (locations individual save removed with locations tab)

  // Funciones para manejar configuración CCSS
  const getDefaultCcssCompany = (): companies => ({
    ownerCompanie: "",
    mt: 3672.46,
    tc: 11017.39,
    valorhora: 1441,
    horabruta: 1529.62,
    pagoTotalMT: 3672.46,
    pagoTotalTC: 11017.39,
    pagoTotalPH: 1441,
  });

  const normalizeCcssCompany = (company?: Partial<companies>): companies => {
    const fallback = getDefaultCcssCompany();
    const mt = Number(company?.mt ?? fallback.mt) || 0;
    const tc = Number(company?.tc ?? fallback.tc) || 0;
    const valorhora = Number(company?.valorhora ?? fallback.valorhora) || 0;

    return {
      ownerCompanie: company?.ownerCompanie ?? "",
      mt,
      tc,
      valorhora,
      horabruta: Number(company?.horabruta ?? fallback.horabruta) || 0,
      pagoTotalMT:
        typeof company?.pagoTotalMT === "number" ? company.pagoTotalMT : mt,
      pagoTotalTC:
        typeof company?.pagoTotalTC === "number" ? company.pagoTotalTC : tc,
      pagoTotalPH:
        typeof company?.pagoTotalPH === "number"
          ? company.pagoTotalPH
          : valorhora,
    };
  };

  const getLastSavedCcssCompany = (ownerId: string): companies => {
    const savedConfig = originalCcssConfigsData.find(
      (config) => config.ownerId === ownerId,
    );
    const savedCompanies = savedConfig?.companie || [];
    const lastSavedCompany =
      savedCompanies.length > 0 ? savedCompanies[savedCompanies.length - 1] : null;

    if (lastSavedCompany) {
      return normalizeCcssCompany(lastSavedCompany);
    }

    return getDefaultCcssCompany();
  };

  const addCcssConfig = () => {
    const ownerId = resolveOwnerIdForActor();
    const baseCompany = getLastSavedCcssCompany(ownerId);
    const newCompany = {
      ...baseCompany,
      ownerCompanie: "",
    };

    // Verificar si ya existe un config para este owner
    const existingConfigIndex = ccssConfigsData.findIndex(
      (config) => config.ownerId === ownerId,
    );

    if (existingConfigIndex !== -1) {
      // Si existe, agregar una nueva company al array
      const updatedConfigs = [...ccssConfigsData];
      updatedConfigs[existingConfigIndex] = {
        ...updatedConfigs[existingConfigIndex],
        companie: [
          ...updatedConfigs[existingConfigIndex].companie,
          newCompany,
        ],
      };
      setCcssConfigsData(updatedConfigs);
    } else {
      // Si no existe, crear un nuevo config con una company
      const newConfig: CcssConfig = {
        ownerId,
        companie: [newCompany],
      };
      setCcssConfigsData([...ccssConfigsData, newConfig]);
    }
  };

  const updateCcssConfig = (
    configIndex: number,
    companyIndex: number,
    field: string,
    value: string | number,
  ) => {
    const updated = [...ccssConfigsData];
    const updatedCompanies = [...updated[configIndex].companie];

    const currentCompany = normalizeCcssCompany(updatedCompanies[companyIndex]);

    if (field === "ownerCompanie") {
      updatedCompanies[companyIndex] = {
        ...currentCompany,
        ownerCompanie: value as string,
      };
    } else if (
      [
        "mt",
        "tc",
        "valorhora",
        "horabruta",
        "pagoTotalMT",
        "pagoTotalTC",
        "pagoTotalPH",
      ].includes(field)
    ) {
      const numericValue = value as number;
      const nextCompany: companies = {
        ...currentCompany,
        [field]: numericValue,
      };

      if (field === "mt") {
        nextCompany.pagoTotalMT = numericValue;
      } else if (field === "tc") {
        nextCompany.pagoTotalTC = numericValue;
      } else if (field === "valorhora") {
        nextCompany.pagoTotalPH = numericValue;
      }

      updatedCompanies[companyIndex] = nextCompany;
    }

    updated[configIndex] = {
      ...updated[configIndex],
      companie: updatedCompanies,
    };
    setCcssConfigsData(updated);
  };

  // Función auxiliar para aplanar los datos de CCSS para la UI
  const getFlattenedCcssData = () => {
    const flattened: Array<{
      configIndex: number;
      companyIndex: number;
      config: CcssConfig;
      company: companies;
    }> = [];

    ccssConfigsData.forEach((config, configIndex) => {
      config.companie.forEach((company, companyIndex) => {
        flattened.push({
          configIndex,
          companyIndex,
          config,
          company,
        });
      });
    });

    return flattened;
  };

  const removeCcssConfig = (configIndex: number, companyIndex: number) => {
    const config = ccssConfigsData[configIndex];
    const company = config.companie[companyIndex];
    const configName =
      company.ownerCompanie ||
      `Configuración ${configIndex + 1}-${companyIndex + 1}`;

    openConfirmModal(
      "Eliminar Configuración CCSS",
      `¿Está seguro de que desea eliminar la configuración para "${configName}"? Esta acción no se puede deshacer.`,
      async () => {
        try {
          const updatedConfigs = [...ccssConfigsData];
          const updatedCompanies = [...updatedConfigs[configIndex].companie];

          // Remover la company específica
          updatedCompanies.splice(companyIndex, 1);

          if (updatedCompanies.length === 0) {
            // Si no quedan companies, eliminar todo el config
            if (config.id) {
              await CcssConfigService.deleteCcssConfig(config.id);
            }
            updatedConfigs.splice(configIndex, 1);
          } else {
            // Si quedan companies, actualizar el config
            updatedConfigs[configIndex] = {
              ...updatedConfigs[configIndex],
              companie: updatedCompanies,
            };
            if (config.id) {
              await CcssConfigService.updateCcssConfig(
                updatedConfigs[configIndex],
              );
            }
          }

          setCcssConfigsData(updatedConfigs);
          showToast(
            `Configuración para ${configName} eliminada exitosamente`,
            "success",
          );
        } catch (error) {
          console.error("Error deleting CCSS config:", error);
          showToast("Error al eliminar la configuración", "error");
        }
      },
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto bg-[var(--card-bg)] rounded-lg shadow py-3 px-2 sm:py-4 sm:px-3 md:py-6 md:px-4 lg:px-6">
      {" "}
      {/* Loading Modal */}
      {isSaving && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-[var(--card-bg)] rounded-xl p-8 flex flex-col items-center justify-center shadow-2xl border border-[var(--input-border)] max-w-sm mx-4 animate-scale-in">
            <div className="relative flex items-center justify-center mb-6">
              {/* Outer pulse ring */}
              <div className="absolute inset-0 rounded-full animate-ping bg-blue-400 opacity-20"></div>
              {/* Clock SVG */}
              <svg
                className="animate-spin w-16 h-16 text-blue-600 relative z-10"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="24"
                  cy="24"
                  r="22"
                  stroke="currentColor"
                  strokeWidth="4"
                  opacity="0.2"
                />
                <line
                  x1="24"
                  y1="24"
                  x2="24"
                  y2="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <line
                  x1="24"
                  y1="24"
                  x2="36"
                  y2="24"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="text-xl font-semibold text-[var(--foreground)] mb-3">
              Guardando cambios...
            </div>
            <div className="text-sm text-[var(--muted-foreground)] text-center leading-relaxed">
              Por favor espera mientras se actualizan
              <br />
              los datos en Firebase
            </div>
            {/* Progress bar animation */}
            <div className="w-full max-w-xs mt-4">
              <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-transparent via-blue-600 to-transparent rounded-full animate-shimmer bg-[length:200%_100%]"></div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* notifications now use global ToastProvider */}
      {/* File Tabs */}
      <div className="mb-4 sm:mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-[var(--foreground)]">
              Mantenimiento
            </h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              Elige una sección para administrar los datos del sistema.
            </p>
          </div>
            {currentUser?.role === "superadmin" ? (
              <div className="w-full sm:w-auto sm:min-w-[280px]">
                <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                  Ver configuración de admin
                </label>
                <select
                  value={selectedAdminId}
                  onChange={(e) => setSelectedAdminId(e.target.value)}
                  className="w-full rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
                >
                  <option value={SUPERADMIN_SELF_VIEW}>YO</option>
                  {superadminAdminUsers
                    .filter((user) => user.role === "admin")
                    .filter(
                      (user) => String(user.id || "") !== String(currentUser?.id || ""),
                    )
                    .sort((a, b) =>
                      String(a.fullName || a.name || "").localeCompare(
                        String(b.fullName || b.name || ""),
                        "es",
                      ),
                    )
                    .map((user) => (
                      <option
                        key={user.id || user.email || user.name}
                        value={String(user.id || "")}
                      >
                        {user.fullName || user.name || "Administrador sin nombre"}
                      </option>
                    ))}
                </select>
              </div>
            ) : null}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-2">
          {[
            {
              key: "users" as DataFile,
              label: "Usuarios",
              count: usersData.length,
              icon: Users,
            },
            {
              key: "sorteos" as DataFile,
              label: "Sorteos",
              count: sorteosData.length,
              icon: FileText,
            },
            { key: "schedules" as DataFile, label: "Planilla", icon: Clock },
            {
              key: "ccss" as DataFile,
              label: "Configuracion",
              count: ccssConfigsData.length,
              icon: DollarSign,
            },
            {
              key: "empresas" as DataFile,
              label: "Empresas",
              count: empresasData.length,
              icon: Building,
            },
            {
              key: "fondoTypes" as DataFile,
              label: "Tipos Fondo",
              count: fondoTypesData.length,
              icon: List,
              requiresAdmin: true,
            },
            {
              key: "funciones" as DataFile,
              label: "Funciones",
              icon: List,
              requiresAdmin: true,
            },
          ]
            .filter((tab) => !tab.requiresAdmin || currentUser?.role !== "user")
            .map((tab) => {
              const Icon = tab.icon;
              const isActive = activeFile === tab.key;
              const label =
                tab.count !== undefined
                  ? `${tab.label} (${tab.count})`
                  : tab.label;

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFile(tab.key)}
                  className={`min-h-16 rounded-xl border px-3 py-2 text-left transition-all flex items-center gap-3 ${
                    isActive
                      ? "border-blue-500 bg-blue-500/10 text-blue-600 shadow-sm"
                      : "border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-blue-300 hover:bg-[var(--hover-bg)]"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${isActive ? "bg-blue-500 text-white" : "bg-[var(--hover-bg)] text-[var(--muted-foreground)]"}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {label}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </div>
      {/* Content */}
      {activeFile === "empresas" && (
        <EmpresasEditorSection
          empresasData={empresasData}
          setEmpresasData={setEmpresasData}
          currentUser={currentUser}
          openConfirmModal={openConfirmModal}
          showToast={showToast}
          resolveOwnerIdForActor={resolveOwnerIdForActor}
          loadData={loadData}
        />
      )}
      {activeFile === "sorteos" && (
        <SorteosEditorSection
          sorteosData={sorteosData}
          addSorteo={addSorteo}
          updateSorteo={updateSorteo}
          removeSorteo={removeSorteo}
        />
      )}
      {activeFile === "fondoTypes" && currentUser?.role !== "user" && (
        <FondoTypesEditorSection
          fondoTypesData={fondoTypesData}
          seedFondoTypes={seedFondoTypes}
          addFondoType={addFondoType}
          updateFondoType={updateFondoType}
          saveFondoType={saveFondoType}
          removeFondoType={removeFondoType}
          moveFondoTypeUp={moveFondoTypeUp}
          moveFondoTypeDown={moveFondoTypeDown}
          isFondoTypeDirty={isFondoTypeDirty}
        />
      )}
      {activeFile === "funciones" && currentUser?.role !== "user" && (
        <FuncionesEditorSection ownerId={fondoTypesOwnerId} />
      )}
      {activeFile === "users" && (
        <UsersEditorSection
          usersData={usersData}
          empresasData={empresasData}
          currentUser={currentUser}
          isSuperadminAdminView={
            currentUser?.role === "superadmin" && selectedAdminId !== SUPERADMIN_SELF_VIEW
          }
          addUser={addUser}
          updateUser={updateUser}
          removeUser={removeUser}
          saveIndividualUser={saveIndividualUser}
          hasUserChanged={hasUserChanged}
          getUserKey={getUserKey}
          savingUserKey={savingUserKey}
          changePasswordMode={changePasswordMode}
          passwordVisibility={passwordVisibility}
          togglePasswordVisibility={togglePasswordVisibility}
          setChangePasswordMode={setChangePasswordMode}
          setUsersData={setUsersData}
          setPasswordStore={setPasswordStore}
          passwordBaseline={passwordBaseline}
          renderUserPermissions={renderUserPermissions}
        />
      )}
      {/* Schedule Report Content */}
      {activeFile === "schedules" && <ScheduleReportTab />}{" "}
      {/* CCSS Payment Configuration */}
      {activeFile === "ccss" && (
        <CcssEditorSection
          currentUser={currentUser}
          empresasData={empresasData}
          actorOwnerIdSet={actorOwnerIdSet}
          ccssConfigsData={ccssConfigsData}
          hasChanges={hasChanges}
          isSaving={isSaving}
          addCcssConfig={addCcssConfig}
          getFlattenedCcssData={getFlattenedCcssData}
          updateCcssConfig={updateCcssConfig}
          removeCcssConfig={removeCcssConfig}
          saveData={saveData}
          loadData={loadData}
          showToast={showToast}
        />
      )}
      {/* Modal de confirmación */}
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Eliminar"
        cancelText="Cancelar"
        singleButton={confirmModal.singleButton}
        singleButtonText={confirmModal.singleButtonText}
        loading={confirmModal.loading}
        onConfirm={handleConfirm}
        onCancel={closeConfirmModal}
        actionType="delete"
      />
    </div>
  );
}
