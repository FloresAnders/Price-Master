"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  CircleDollarSign,
  Download,
  Eye,
  Loader2,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  ShieldAlert,
  Smartphone,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useActorOwnership } from "@/hooks/useActorOwnership";
import useToast from "@/hooks/useToast";
import { getDefaultPermissions } from "@/utils/permissions";
import { EmpresasService } from "@/services/empresas";
import { UsersService } from "@/services/users";
import {
  buildPartyKey,
  formatInternalDebtRoute,
  getInternalDebtActorRole,
  InternalDebtsService,
  type InternalDebt,
  type InternalDebtMovementType,
  type InternalDebtParty,
  type InternalDebtPartyType,
} from "@/services/internal-debts";
import type { Empresas, User } from "@/types/firestore";
import {
  buildPaidInternalDebtReceiptData,
  buildPaidInternalDebtReceiptFileName,
  buildPaidInternalDebtReceiptStoragePath,
} from "./paidDebtReceipt";

type ActorOption = InternalDebtParty & {
  key: string;
  ownerId?: string;
  empresaId?: string;
  empresaName?: string;
  searchText: string;
};

type DebtFormState = {
  debtorKey: string;
  creditorKey: string;
  amount: string;
  date: string;
  reason: string;
  reference: string;
};

type MovementFormState = {
  type: InternalDebtMovementType;
  amount: string;
  date: string;
  reason: string;
  reference: string;
};

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const crcFormatter = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  maximumFractionDigits: 0,
});

const EMPTY_DEBT_FORM: DebtFormState = {
  debtorKey: "",
  creditorKey: "",
  amount: "",
  date: todayInputValue(),
  reason: "",
  reference: "",
};

const EMPTY_MOVEMENT_FORM: MovementFormState = {
  type: "payment",
  amount: "",
  date: todayInputValue(),
  reason: "",
  reference: "",
};

function getDateValue(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toLocaleDateString("es-CR");
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString("es-CR");
  }
  return "";
}

function isDebtPaid(debt: InternalDebt): boolean {
  return debt.status === "paid" || Number(debt.balance || 0) <= 0;
}

function isEmployeeUserDebt(debt: InternalDebt | null): debt is InternalDebt {
  if (!debt) return false;
  const types = new Set([debt.debtor.type, debt.creditor.type]);
  return types.has("empleado") && types.has("user");
}

function parseMoneyInput(value: string): number {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function formatMoneyInput(value: string): string {
  const amount = parseMoneyInput(value);
  return amount > 0 ? crcFormatter.format(amount) : "";
}

function sanitizeMoneyInput(value: string): string {
  return String(value || "").replace(/[^\d]/g, "");
}

function normalizeSearch(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildEmbeddedEmpleadoId(
  empresaId: string,
  empleado: Empresas["empleados"][number],
): string {
  const safeEmpresa = String(empresaId || "").trim().replace(/\//g, "_");
  const slug =
    String(empleado?.Empleado || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "empleado";
  const signature = [
    empleado?.Empleado,
    empleado?.ccssType,
    empleado?.hoursPerShift,
    empleado?.extraAmount,
    empleado?.calculoprecios ? "cp" : "",
    empleado?.amboshorarios ? "ah" : "",
  ]
    .map((value) => String(value ?? "").trim())
    .join("|");
  let hash = 0;
  for (let index = 0; index < signature.length; index += 1) {
    hash = (hash * 31 + signature.charCodeAt(index)) >>> 0;
  }
  return `${safeEmpresa}__${slug}__${hash.toString(36)}`;
}

function createActor(
  type: InternalDebtPartyType,
  id: string,
  name: string,
  roleLabel: string,
  ownerId?: string,
): ActorOption | null {
  const safeId = String(id || "").trim();
  const safeName = String(name || "").trim();
  if (!safeId || !safeName) return null;
  const party = { type, id: safeId, name: safeName, roleLabel };
  return {
    ...party,
    key: buildPartyKey(party),
    ownerId,
    searchText: normalizeSearch(`${safeName} ${roleLabel} ${type}`),
  };
}

function getActorSortRank(actor: ActorOption): number {
  if (actor.roleLabel === "Admin") return 0;
  if (actor.roleLabel === "Usuario") return 1;
  if (actor.roleLabel === "Colaborador") return 2;
  return 3;
}

function sortActors(a: ActorOption, b: ActorOption): number {
  const rankDiff = getActorSortRank(a) - getActorSortRank(b);
  if (rankDiff !== 0) return rankDiff;
  return a.name.localeCompare(b.name, "es");
}

function getActorIcon(type: InternalDebtPartyType) {
  if (type === "empresa") return Building2;
  if (type === "empleado") return UsersRound;
  return UserRound;
}

function ModalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-[var(--input-border)] bg-[#0b1118] p-4 shadow-2xl sm:p-5">
        <div className="mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function ActorSelect({
  label,
  value,
  actors,
  onChange,
}: {
  label: string;
  value: string;
  actors: ActorOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
      >
        <option value="">Selecciona una parte</option>
        {actors.map((actor) => (
          <option key={actor.key} value={actor.key}>
            {actor.name} - {actor.roleLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function DeudasInternasPage() {
  const { user, loading: authLoading } = useAuth();
  const { ownerIds, primaryOwnerId } = useActorOwnership(user);
  const { showToast } = useToast();
  const permissions =
    user?.permissions || getDefaultPermissions(user?.role || "user");
  const canUse = Boolean(permissions.deudasInternas);
  const isSuperAdmin = user?.role === "superadmin";
  const canSeeAllCollaborators =
    user?.role === "admin" || user?.role === "superadmin";
  const [actors, setActors] = useState<ActorOption[]>([]);
  const [debts, setDebts] = useState<InternalDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<
    "all" | "debtor" | "creditor" | "admin" | "user"
  >("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showPaidDebts, setShowPaidDebts] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<InternalDebt | null>(null);
  const [debtForm, setDebtForm] = useState<DebtFormState>(EMPTY_DEBT_FORM);
  const [movementForm, setMovementForm] =
    useState<MovementFormState>(EMPTY_MOVEMENT_FORM);
  const paidDebtReceiptRef = useRef<HTMLDivElement | null>(null);
  const paidDebtDownloadRequestRef = useRef(0);
  const [receiptDownloading, setReceiptDownloading] = useState(false);
  const [receiptMobileDownloading, setReceiptMobileDownloading] =
    useState(false);
  const [showReceiptQrModal, setShowReceiptQrModal] = useState(false);
  const [receiptQrCodeDataUrl, setReceiptQrCodeDataUrl] = useState("");
  const [receiptDownloadUrl, setReceiptDownloadUrl] = useState("");
  const [receiptDownloadFileName, setReceiptDownloadFileName] = useState("");
  const [receiptDownloadError, setReceiptDownloadError] = useState("");

  const ownerSet = useMemo(() => new Set(ownerIds), [ownerIds]);
  const activeCompanyKey = useMemo(
    () => normalizeSearch(user?.ownercompanie || ""),
    [user?.ownercompanie],
  );
  const readPartyKeys = useMemo(
    () => (user?.id ? [`user:${user.id}`] : []),
    [user?.id],
  );

  const activeCompanyEmpresaId = useMemo(() => {
    if (!activeCompanyKey) return "";
    const empresa = actors.find(
      (actor) =>
        actor.type === "empresa" &&
        (normalizeSearch(actor.id) === activeCompanyKey ||
          normalizeSearch(actor.name) === activeCompanyKey ||
          actor.searchText.includes(activeCompanyKey)),
    );
    return empresa?.empresaId || empresa?.id || "";
  }, [activeCompanyKey, actors]);

  const editPartyKeys = useMemo(() => {
    const keys = new Set<string>();
    if (user?.id) keys.add(`user:${user.id}`);
    if (activeCompanyEmpresaId) keys.add(`empresa:${activeCompanyEmpresaId}`);
    return Array.from(keys);
  }, [activeCompanyEmpresaId, user?.id]);

  const visibleDebtorActors = useMemo(() => {
    return actors
      .filter((actor) => actor.type === "empleado" || actor.type === "user")
      .filter((actor) => {
        if (canSeeAllCollaborators) return true;
        if (actor.type === "user") return actor.id === user?.id;
        return actor.empresaId === activeCompanyEmpresaId;
      });
  }, [activeCompanyEmpresaId, actors, canSeeAllCollaborators, user?.id]);
  const visibleCreditorActors = useMemo(() => {
    return actors
      .filter((actor) => actor.type === "empleado" || actor.type === "user")
      .filter((actor) => {
        if (canSeeAllCollaborators) return true;
        if (actor.type === "user") return true;
        return actor.empresaId === activeCompanyEmpresaId;
      });
  }, [activeCompanyEmpresaId, actors, canSeeAllCollaborators]);
  const debtorActors = useMemo(
    () => visibleDebtorActors,
    [visibleDebtorActors],
  );
  const creditorActors = useMemo(
    () => visibleCreditorActors,
    [visibleCreditorActors],
  );
  const debtorByKey = useMemo(() => {
    const map = new Map<string, ActorOption>();
    debtorActors.forEach((actor) => map.set(actor.key, actor));
    return map;
  }, [debtorActors]);
  const creditorByKey = useMemo(() => {
    const map = new Map<string, ActorOption>();
    creditorActors.forEach((actor) => map.set(actor.key, actor));
    return map;
  }, [creditorActors]);

  const loadActors = useCallback(async () => {
    if (!primaryOwnerId || !canUse) {
      setActors([]);
      return [];
    }

    const [empresas, users] = await Promise.all([
      EmpresasService.getAllEmpresas(),
      isSuperAdmin ? UsersService.getAllUsers() : UsersService.getUsersForActor(user || null),
    ]);
    const visibleEmpresas = isSuperAdmin
      ? (empresas as Empresas[])
      : (empresas as Empresas[]).filter((empresa) =>
          ownerSet.has(String(empresa.ownerId || "")),
        );
    const nextActors = new Map<string, ActorOption>();
    const currentUserActor = createActor(
      "user",
      String(user?.id || ""),
      user?.fullName || user?.name || "",
      user?.role === "admin" || user?.role === "superadmin" ? "Admin" : "Usuario",
      user?.ownerId || primaryOwnerId,
    );
    if (currentUserActor) nextActors.set(currentUserActor.key, currentUserActor);

    visibleEmpresas.forEach((empresa) => {
      const actor = createActor(
        "empresa",
        String(empresa.id || empresa.name),
        empresa.name,
        "Empresa",
        empresa.ownerId,
      );
      if (actor) {
        nextActors.set(actor.key, {
          ...actor,
          empresaId: String(empresa.id || empresa.name),
          empresaName: empresa.name,
          searchText: normalizeSearch(
            `${actor.searchText} ${empresa.name} ${empresa.ubicacion} ${empresa.id || ""}`,
          ),
        });
      }
    });

    const ownerUsers = (users as User[]).filter((candidate) => {
      if (!candidate.id) return false;
      if (isSuperAdmin) return true;
      return (
        ownerSet.has(String(candidate.ownerId || "")) ||
        ownerSet.has(String(candidate.id || ""))
      );
    });
    ownerUsers.forEach((candidate) => {
      const actor = createActor(
        "user",
        String(candidate.id || ""),
        candidate.fullName || candidate.name,
        candidate.role === "admin" || candidate.role === "superadmin"
          ? "Admin"
          : "Usuario",
        candidate.ownerId,
      );
      if (actor) nextActors.set(actor.key, actor);
    });

    visibleEmpresas.forEach((empresa) => {
      const empresaId = String(empresa.id || empresa.name || "");
      const empleados = Array.isArray(empresa.empleados) ? empresa.empleados : [];
      empleados.forEach((empleado) => {
        const actor = createActor(
          "empleado",
          buildEmbeddedEmpleadoId(empresaId, empleado),
          empleado.Empleado,
          "Colaborador",
          empresa.ownerId || primaryOwnerId,
        );
        if (actor) {
          nextActors.set(actor.key, {
            ...actor,
            empresaId,
            empresaName: empresa.name,
            searchText: normalizeSearch(
              `${actor.searchText} ${empresa.name} ${empresa.ubicacion} ${empresaId}`,
            ),
          });
        }
      });
    });

    const list = Array.from(nextActors.values()).sort((a, b) =>
      sortActors(a, b),
    );
    setActors(list);
    return list;
  }, [canUse, isSuperAdmin, ownerSet, primaryOwnerId, user]);

  const loadDebts = useCallback(
    async (keys = readPartyKeys) => {
      if (!canUse || (!isSuperAdmin && (!primaryOwnerId || keys.length === 0))) {
        setDebts([]);
        return;
      }
      const list = isSuperAdmin
        ? await InternalDebtsService.getVisibleDebtsForSuperAdmin()
        : await InternalDebtsService.getVisibleDebts(
            primaryOwnerId,
            keys,
            user?.role === "admin",
          );
      setDebts(list);
    },
    [canUse, isSuperAdmin, primaryOwnerId, readPartyKeys, user?.role],
  );

  const refresh = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    try {
      await loadActors();
      await loadDebts();
    } catch (err) {
      console.error("Error loading internal debts:", err);
      showToast("No se pudieron cargar las deudas internas.", "error", 5000);
    } finally {
      setLoading(false);
    }
  }, [authLoading, loadActors, loadDebts, showToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeDebts = useMemo(
    () => debts.filter((debt) => !isDebtPaid(debt)),
    [debts],
  );
  const paidDebts = useMemo(
    () => debts.filter((debt) => isDebtPaid(debt)),
    [debts],
  );
  const selectedDebtRole = useMemo<"debtor" | "creditor" | null>(() => {
    if (!selectedDebt) return null;
    return getInternalDebtActorRole(selectedDebt, editPartyKeys, isSuperAdmin);
  }, [editPartyKeys, isSuperAdmin, selectedDebt]);
  const roleMovementType: InternalDebtMovementType =
    selectedDebtRole === "creditor" ? "payment" : "charge";
  const canChooseMovementType =
    Boolean(selectedDebtRole) && (isSuperAdmin || isEmployeeUserDebt(selectedDebt));
  const selectedMovementType: InternalDebtMovementType = canChooseMovementType
    ? movementForm.type
    : roleMovementType;

  const filteredDebts = useMemo(() => {
    const query = normalizeSearch(search);
    return activeDebts.filter((debt) => {
      const debtorKey = buildPartyKey(debt.debtor);
      const creditorKey = buildPartyKey(debt.creditor);
      const visibleParty =
        roleFilter === "creditor" ? debt.debtor : debt.creditor;
      const roleMatch =
        roleFilter === "all" ||
        (roleFilter === "debtor" && editPartyKeys.includes(debtorKey)) ||
        (roleFilter === "creditor" && editPartyKeys.includes(creditorKey)) ||
        (roleFilter === "admin" &&
          [debt.debtor, debt.creditor].some(
            (party) => party.type === "user" && party.roleLabel === "Admin",
          )) ||
        (roleFilter === "user" &&
          [debt.debtor, debt.creditor].some(
            (party) => party.type === "user" && party.roleLabel === "Usuario",
          ));
      const text = normalizeSearch(
        `${debt.debtor.name} ${debt.creditor.name} ${visibleParty.name} ${debt.reason}`,
      );
      return roleMatch && (!query || text.includes(query));
    });
  }, [activeDebts, editPartyKeys, roleFilter, search]);

  const stats = useMemo(() => {
    const payable = activeDebts.filter((debt) =>
      editPartyKeys.includes(buildPartyKey(debt.creditor)),
    ).length;
    const involved = activeDebts.filter((debt) =>
      getInternalDebtActorRole(debt, editPartyKeys, isSuperAdmin),
    ).length;
    return {
      visible: activeDebts.length,
      involved,
      payable: isSuperAdmin ? activeDebts.length : payable,
    };
  }, [activeDebts, editPartyKeys, isSuperAdmin]);
  const selectedDebtIsPaid = selectedDebt ? isDebtPaid(selectedDebt) : false;
  const selectedPaidDebtReceipt = useMemo(
    () =>
      selectedDebt && selectedDebtIsPaid
        ? buildPaidInternalDebtReceiptData(selectedDebt)
        : null,
    [selectedDebt, selectedDebtIsPaid],
  );
  const canSubmitDebt = Boolean(
    debtForm.debtorKey &&
      debtForm.creditorKey &&
      debtorByKey.has(debtForm.debtorKey) &&
      creditorByKey.has(debtForm.creditorKey) &&
      parseMoneyInput(debtForm.amount) > 0 &&
      debtForm.date &&
      debtForm.reason.trim() &&
      user &&
      primaryOwnerId,
  );
  const canSubmitMovement = Boolean(
    selectedDebtRole &&
      !selectedDebtIsPaid &&
      parseMoneyInput(movementForm.amount) > 0 &&
      movementForm.date &&
      movementForm.reason.trim() &&
      user &&
      selectedDebt,
  );
  const debtMissingFields = [
    !debtForm.debtorKey || !debtorByKey.has(debtForm.debtorKey) ? "deudor" : "",
    !debtForm.creditorKey || !creditorByKey.has(debtForm.creditorKey)
      ? "acreedor"
      : "",
    parseMoneyInput(debtForm.amount) <= 0 ? "monto" : "",
    !debtForm.date ? "fecha" : "",
    !debtForm.reason.trim() ? "motivo" : "",
  ].filter(Boolean);
  const movementMissingFields = [
    parseMoneyInput(movementForm.amount) <= 0 ? "monto" : "",
    !movementForm.date ? "fecha" : "",
    !movementForm.reason.trim() ? "motivo" : "",
  ].filter(Boolean);
  const debtSubmitTooltip = debtMissingFields.length
    ? `Falta: ${debtMissingFields.join(", ")}`
    : "Guardar deuda";
  const movementSubmitTooltip = movementMissingFields.length
    ? `Falta: ${movementMissingFields.join(", ")}`
    : "Guardar movimiento";

  const handleCreateDebt = async (event: React.FormEvent) => {
    event.preventDefault();
    const debtor = debtorByKey.get(debtForm.debtorKey);
    const creditor = creditorByKey.get(debtForm.creditorKey);
    if (!canSubmitDebt || !debtor || !creditor || !user || !primaryOwnerId) {
      showToast("Complete los datos requeridos.", "error", 3000);
      return;
    }
    setSaving(true);
    try {
      const visibilityKeys = new Set([`user:${user.id || ""}`, debtForm.debtorKey]);
      await InternalDebtsService.createDebt({
        ownerId: primaryOwnerId,
        debtor,
        creditor,
        amount: parseMoneyInput(debtForm.amount),
        reason: debtForm.reason,
        reference: debtForm.reference,
        date: debtForm.date,
        createdById: String(user.id || ""),
        createdByName: user.fullName || user.name,
        actorPartyKeys: Array.from(visibilityKeys),
      });
      setDebtForm({ ...EMPTY_DEBT_FORM, date: todayInputValue() });
      setShowCreate(false);
      showToast("Deuda guardada.", "success", 3000);
      await loadDebts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo guardar.", "error", 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMovement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDebt || !user) return;
    if (isDebtPaid(selectedDebt)) {
      showToast("La deuda ya esta pagada y no se puede modificar.", "error", 5000);
      return;
    }
    if (!canSubmitMovement) {
      showToast("Complete los datos requeridos.", "error", 3000);
      return;
    }
    setSaving(true);
    try {
      const movementActorKeys = new Set(editPartyKeys);
      if (canChooseMovementType && selectedMovementType === "charge") {
        const debtorKey = buildPartyKey(selectedDebt.debtor);
        if (selectedDebt.debtor.type === "empleado") movementActorKeys.add(debtorKey);
      }
      if (canChooseMovementType && selectedMovementType === "payment") {
        const creditorKey = buildPartyKey(selectedDebt.creditor);
        if (selectedDebt.creditor.type === "empleado") {
          movementActorKeys.add(creditorKey);
        }
      }
      await InternalDebtsService.addMovement(
        String(selectedDebt.id || ""),
        {
          type: selectedMovementType,
          amount: parseMoneyInput(movementForm.amount),
          reason: movementForm.reason,
          reference: movementForm.reference,
          date: movementForm.date,
          createdById: String(user.id || ""),
          createdByName: user.fullName || user.name,
        },
        Array.from(movementActorKeys),
        isSuperAdmin,
      );
      setMovementForm({ ...EMPTY_MOVEMENT_FORM, date: todayInputValue() });
      setSelectedDebt(null);
      showToast("Movimiento guardado.", "success", 3000);
      await loadDebts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo guardar.", "error", 5000);
    } finally {
      setSaving(false);
    }
  };

  const resetPaidDebtReceiptDownload = useCallback(() => {
    setReceiptDownloading(false);
    setReceiptMobileDownloading(false);
    setShowReceiptQrModal(false);
    setReceiptQrCodeDataUrl("");
    setReceiptDownloadUrl("");
    setReceiptDownloadFileName("");
    setReceiptDownloadError("");
  }, []);

  const closeSelectedDebt = useCallback(() => {
    paidDebtDownloadRequestRef.current += 1;
    resetPaidDebtReceiptDownload();
    setSelectedDebt(null);
  }, [resetPaidDebtReceiptDownload]);

  const downloadBlob = useCallback((blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const capturePaidDebtReceiptImage = useCallback(async () => {
    if (!paidDebtReceiptRef.current || !selectedPaidDebtReceipt) return null;

    const html2canvas = (await import("html2canvas")).default;
    const target = paidDebtReceiptRef.current;
    const previousHeight = target.style.height;
    const previousMaxHeight = target.style.maxHeight;
    const previousOverflow = target.style.overflow;

    try {
      target.style.height = `${target.scrollHeight}px`;
      target.style.maxHeight = "none";
      target.style.overflow = "visible";
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );

      const captureOptions = {
        background: "#ffffff",
        height: target.scrollHeight,
        scale: 2,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
        windowHeight: target.scrollHeight,
        windowWidth: target.scrollWidth,
        width: target.scrollWidth,
        logging: false,
      } as Parameters<typeof html2canvas>[1] & {
        background: string;
        height: number;
        scale: number;
        scrollX: number;
        scrollY: number;
        useCORS: boolean;
        windowHeight: number;
        windowWidth: number;
        width: number;
        logging: boolean;
      };
      const canvas = await html2canvas(target, captureOptions);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("No se pudo generar la imagen.");

      return {
        blob,
        fileName: buildPaidInternalDebtReceiptFileName(selectedPaidDebtReceipt),
      };
    } finally {
      target.style.height = previousHeight;
      target.style.maxHeight = previousMaxHeight;
      target.style.overflow = previousOverflow;
    }
  }, [selectedPaidDebtReceipt]);

  const handlePaidDebtImageDownload = useCallback(async () => {
    if (receiptDownloading || receiptMobileDownloading) return;
    setReceiptDownloading(true);
    setReceiptDownloadError("");

    try {
      const image = await capturePaidDebtReceiptImage();
      if (!image) throw new Error("No se pudo preparar el recibo.");
      downloadBlob(image.blob, image.fileName);
      showToast("Imagen descargada.", "success", 3000);
    } catch (error) {
      console.error("Error al generar recibo de deuda pagada:", error);
      showToast("No se pudo generar la imagen.", "error", 5000);
    } finally {
      setReceiptDownloading(false);
    }
  }, [
    capturePaidDebtReceiptImage,
    downloadBlob,
    receiptDownloading,
    receiptMobileDownloading,
    showToast,
  ]);

  const handlePaidDebtMobileDownload = useCallback(async () => {
    if (receiptDownloading || receiptMobileDownloading) return;
    const requestId = paidDebtDownloadRequestRef.current + 1;
    paidDebtDownloadRequestRef.current = requestId;
    setReceiptMobileDownloading(true);
    setReceiptDownloadError("");

    try {
      const image = await capturePaidDebtReceiptImage();
      if (!image) throw new Error("No se pudo preparar el recibo.");

      downloadBlob(image.blob, image.fileName);
      const path = buildPaidInternalDebtReceiptStoragePath(image.fileName);
      const imageRef = storageRef(storage, path);
      await uploadBytes(imageRef, image.blob);
      const downloadUrl = await getDownloadURL(imageRef);
      const qrDataUrl = await QRCode.toDataURL(downloadUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      if (paidDebtDownloadRequestRef.current !== requestId) return;

      setReceiptDownloadUrl(downloadUrl);
      setReceiptDownloadFileName(image.fileName);
      setReceiptQrCodeDataUrl(qrDataUrl);
      setShowReceiptQrModal(true);
      showToast("QR de descarga generado.", "success", 3000);
    } catch (error) {
      console.error("Error al generar descarga movil de deuda pagada:", error);
      if (paidDebtDownloadRequestRef.current === requestId) {
        const message = "No se pudo generar la descarga movil.";
        setReceiptDownloadError(message);
        showToast(message, "error", 5000);
      }
    } finally {
      if (paidDebtDownloadRequestRef.current === requestId) {
        setReceiptMobileDownloading(false);
      }
    }
  }, [
    capturePaidDebtReceiptImage,
    downloadBlob,
    receiptDownloading,
    receiptMobileDownloading,
    showToast,
  ]);

  const handlePaidDebtDirectDownload = useCallback(async () => {
    if (!receiptDownloadUrl) return;
    try {
      const response = await fetch(receiptDownloadUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      downloadBlob(
        blob,
        receiptDownloadFileName || "DeudaInternaPagada.png",
      );
    } catch (error) {
      console.error("Error al descargar recibo remoto:", error);
      window.open(receiptDownloadUrl, "_blank", "noopener,noreferrer");
    }
  }, [downloadBlob, receiptDownloadFileName, receiptDownloadUrl]);

  const handleClosePaidDebtQrModal = useCallback(() => {
    paidDebtDownloadRequestRef.current += 1;
    setShowReceiptQrModal(false);
    setReceiptQrCodeDataUrl("");
    setReceiptDownloadUrl("");
    setReceiptDownloadFileName("");
    setReceiptDownloadError("");
    setReceiptMobileDownloading(false);
  }, []);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-6">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!canUse) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-6 text-center">
        <ShieldAlert className="mb-3 h-8 w-8 text-red-500" />
        <h1 className="text-lg font-semibold text-[var(--foreground)]">
          Acceso restringido
        </h1>
        <p className="mt-2 max-w-md text-sm text-[var(--muted-foreground)]">
          Necesitas el permiso Deudas Internas para usar esta sección.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-3 shadow-sm sm:p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-[var(--foreground)]">
              Deudas Internas
            </h1>
            <span className="rounded bg-[var(--muted)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted-foreground)]">
              BETA
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Administra deudas entre empresas y personas dentro del mismo ownerId.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          <div className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-center">
            <div className="text-sm font-semibold text-[var(--foreground)]">
              {stats.visible}
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)]">
              deudas visibles
            </div>
          </div>
          <div className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-center">
            <div className="text-sm font-semibold text-[var(--foreground)]">
              {stats.involved}
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)]">
              involucradas
            </div>
          </div>
          <div className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-center">
            <div className="text-sm font-semibold text-[var(--foreground)]">
              {stats.payable}
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)]">
              abonos por acreedor
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="col-span-3 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-900/30 hover:bg-blue-500 sm:col-span-1"
          >
            <Plus className="h-4 w-4" />
            Agregar deuda
          </button>
          <button
            type="button"
            onClick={() => setShowPaidDebts(true)}
            className="col-span-3 inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--hover-bg)] sm:col-span-1"
          >
            <Eye className="h-4 w-4" />
            Pagadas ({paidDebts.length})
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-2 rounded-lg border border-[var(--input-border)] bg-[#0b1118] p-3 md:grid-cols-[1fr_190px_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar empresa o persona"
            className="w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
          />
        </label>
        <select
          value={roleFilter}
          onChange={(event) =>
            setRoleFilter(
              event.target.value as
                | "all"
                | "debtor"
                | "creditor"
                | "admin"
                | "user",
            )
          }
          className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
        >
          <option value="all">Deudor / Acreedor</option>
          <option value="debtor">Soy deudor</option>
          <option value="creditor">Soy acreedor</option>
          {isSuperAdmin && <option value="admin">Con admin</option>}
          {isSuperAdmin && <option value="user">Con usuario</option>}
        </select>
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setRoleFilter("all");
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--input-border)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
        >
          <RotateCcw className="h-4 w-4" />
          Limpiar
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {filteredDebts.map((debt) => {
          const displayParty = editPartyKeys.includes(buildPartyKey(debt.debtor))
            ? debt.creditor
            : debt.debtor;
          const cardParty = debt.debtor;
          const Icon = getActorIcon(cardParty.type);
          return (
            <button
              type="button"
              key={debt.id}
              onClick={() => {
                const debtRole = getInternalDebtActorRole(
                  debt,
                  editPartyKeys,
                  isSuperAdmin,
                );
                setMovementForm((prev) => ({
                  ...prev,
                  type: debtRole === "creditor" ? "payment" : "charge",
                }));
                setSelectedDebt(debt);
              }}
              className="group rounded-lg border border-[var(--input-border)] bg-[#0e161d] p-4 text-left transition hover:border-[var(--accent)]/70 hover:bg-[#111d26]"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {formatInternalDebtRoute(debt)}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {isSuperAdmin
                        ? `${debt.debtor.roleLabel || debt.debtor.type} debe a ${
                            debt.creditor.roleLabel || debt.creditor.type
                          }`
                        : displayParty.roleLabel}
                    </div>
                  </div>
                </div>
                {cardParty.type === "empresa" && (
                  <span className="rounded bg-[var(--muted)] px-2 py-1 text-[10px] font-bold uppercase text-[var(--muted-foreground)]">
                    Empresa
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">
                Monto total
              </div>
              <div className="mt-1 text-xl font-bold text-red-400">
                {crcFormatter.format(debt.balance || 0)}
              </div>
              <div className="mt-2 line-clamp-1 text-xs text-[var(--muted-foreground)]">
                Motivo: {debt.reason}
              </div>
              <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                Actualizado: {getDateValue(debt.updatedAt)}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[var(--input-border)] pt-3 text-xs font-semibold text-blue-300">
                <span>Ver detalle</span>
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </button>
          );
        })}
      </div>

      {filteredDebts.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--input-border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
          No hay deudas internas visibles con los filtros actuales.
        </div>
      )}

      {showCreate && (
        <ModalShell
          title="Agregar deuda"
          subtitle="Registra una nueva deuda entre empresas o personas del mismo ownerId."
        >
          <form onSubmit={handleCreateDebt} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <ActorSelect
                label="Deudor"
                value={debtForm.debtorKey}
                actors={debtorActors}
                onChange={(value) =>
                  setDebtForm((prev) => ({ ...prev, debtorKey: value }))
                }
              />
              <ActorSelect
                label="Acreedor"
                value={debtForm.creditorKey}
                actors={creditorActors}
                onChange={(value) =>
                  setDebtForm((prev) => ({ ...prev, creditorKey: value }))
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                  Monto
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatMoneyInput(debtForm.amount)}
                  onChange={(event) =>
                    setDebtForm((prev) => ({
                      ...prev,
                      amount: sanitizeMoneyInput(event.target.value),
                    }))
                  }
                  placeholder="₡0"
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                  Fecha
                </span>
                <input
                  type="date"
                  value={debtForm.date}
                  onChange={(event) =>
                    setDebtForm((prev) => ({ ...prev, date: event.target.value }))
                  }
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                Motivo
              </span>
              <textarea
                value={debtForm.reason}
                onChange={(event) =>
                  setDebtForm((prev) => ({ ...prev, reason: event.target.value }))
                }
                className="min-h-[84px] w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                Referencia interna opcional
              </span>
              <input
                value={debtForm.reference}
                onChange={(event) =>
                  setDebtForm((prev) => ({
                    ...prev,
                    reference: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">
              Solo el deudor puede registrar la deuda. El acreedor registra los
              abonos.
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !canSubmitDebt}
                title={saving ? "Guardando..." : debtSubmitTooltip}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-900/30 hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-900 disabled:text-blue-200 disabled:opacity-60 disabled:hover:bg-blue-900"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar deuda
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {showPaidDebts && (
        <ModalShell
          title="Deudas pagadas"
          subtitle="Solo visualizacion de deudas pagadas en su totalidad."
        >
          <div className="space-y-3">
            {paidDebts.map((debt) => (
              <button
                type="button"
                key={debt.id}
                onClick={() => {
                  setSelectedDebt(debt);
                  setShowPaidDebts(false);
                }}
                className="w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] p-3 text-left hover:border-[var(--accent)]/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">
                      {debt.debtor.name} debe a {debt.creditor.name}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                      Motivo: {debt.reason}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-emerald-300">
                      Pagada
                    </div>
                    <div className="mt-1 text-sm font-bold text-[var(--foreground)]">
                      {crcFormatter.format(debt.amountOriginal || 0)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {paidDebts.length === 0 && (
              <div className="rounded-lg border border-dashed border-[var(--input-border)] p-6 text-center text-sm text-[var(--muted-foreground)]">
                No hay deudas pagadas.
              </div>
            )}
          </div>
        </ModalShell>
      )}

      {selectedDebt && (
        <>
          {selectedPaidDebtReceipt && (
            <div
              className="fixed left-[-10000px] top-0 w-[760px]"
              aria-hidden="true"
            >
              <div
                ref={paidDebtReceiptRef}
                className="w-[760px] bg-white p-8 font-sans text-slate-950"
              >
                <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                      Deudas internas
                    </div>
                    <h1 className="mt-1 text-3xl font-bold text-slate-950">
                      {selectedPaidDebtReceipt.title}
                    </h1>
                    <p className="mt-2 text-base text-slate-600">
                      {selectedPaidDebtReceipt.routeLabel}
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold uppercase text-emerald-700">
                    {selectedPaidDebtReceipt.statusLabel}
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      Deudor
                    </div>
                    <div className="mt-1 text-lg font-bold">
                      {selectedPaidDebtReceipt.debtorName}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      Acreedor
                    </div>
                    <div className="mt-1 text-lg font-bold">
                      {selectedPaidDebtReceipt.creditorName}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      Monto original
                    </div>
                    <div className="mt-1 text-2xl font-bold text-slate-950">
                      {crcFormatter.format(selectedPaidDebtReceipt.amountOriginal)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      Saldo
                    </div>
                    <div className="mt-1 text-2xl font-bold text-emerald-700">
                      {crcFormatter.format(selectedPaidDebtReceipt.balance)}
                    </div>
                  </div>
                </div>

                <div className="mb-6 rounded-lg border border-slate-200 p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="font-semibold text-slate-500">Fecha</div>
                      <div className="mt-1 text-slate-950">
                        {selectedPaidDebtReceipt.debtDate || "Sin fecha"}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-500">
                        Referencia
                      </div>
                      <div className="mt-1 text-slate-950">
                        {selectedPaidDebtReceipt.reference || "Sin referencia"}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="font-semibold text-slate-500">Motivo</div>
                      <div className="mt-1 text-slate-950">
                        {selectedPaidDebtReceipt.reason}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h2 className="mb-3 text-lg font-bold text-slate-950">
                    Movimientos
                  </h2>
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    {selectedPaidDebtReceipt.movements.map((movement) => (
                      <div
                        key={movement.id}
                        className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-200 p-3 last:border-b-0"
                      >
                        <div>
                          <div className="font-semibold text-slate-950">
                            {movement.typeLabel}: {movement.reason}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {movement.date} - {movement.createdByName}
                            {movement.reference
                              ? ` - Ref. ${movement.reference}`
                              : ""}
                          </div>
                        </div>
                        <div className="text-right font-bold text-slate-950">
                          {movement.signedAmountPrefix}
                          {crcFormatter.format(movement.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 text-right text-xs text-slate-500">
                  Exportado:{" "}
                  {new Date(
                    selectedPaidDebtReceipt.exportedAtISO,
                  ).toLocaleString("es-CR")}
                </div>
              </div>
            </div>
          )}

          {showReceiptQrModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-xl border border-[var(--input-border)] bg-[#0b1118] p-5 text-[var(--foreground)] shadow-2xl">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-[var(--accent)]" />
                    <h3 className="text-lg font-semibold">Descarga movil</h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleClosePaidDebtQrModal}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--input-border)] hover:bg-[var(--muted)]/20"
                    aria-label="Cerrar modal QR"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mb-4 text-sm text-[var(--muted-foreground)]">
                  Escanea este codigo QR con tu movil para descargar la imagen.
                </p>
                <div className="mb-4 flex justify-center">
                  <div className="flex h-56 w-56 items-center justify-center rounded-lg bg-white p-4 shadow-md">
                    {receiptQrCodeDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={receiptQrCodeDataUrl}
                        alt="QR Code para descarga"
                        className="h-48 w-48"
                      />
                    ) : (
                      <QrCode className="h-12 w-12 text-slate-400" />
                    )}
                  </div>
                </div>
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={handlePaidDebtDirectDownload}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
                  >
                    <Download className="h-4 w-4" />
                    Descargar directamente
                  </button>
                  <button
                    type="button"
                    onClick={handleClosePaidDebtQrModal}
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--input-border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]/20"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

          <ModalShell
            title="Detalle deuda"
            subtitle={`${selectedDebt.debtor.name} debe a ${selectedDebt.creditor.name}`}
          >
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] p-3">
              <div className="text-xs text-[var(--muted-foreground)]">Deudor</div>
              <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {selectedDebt.debtor.name}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] p-3">
              <div className="text-xs text-[var(--muted-foreground)]">
                Acreedor
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {selectedDebt.creditor.name}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] p-3">
              <div className="text-xs text-[var(--muted-foreground)]">Saldo</div>
              <div
                className={`mt-1 text-lg font-bold ${
                  selectedDebtIsPaid ? "text-emerald-300" : "text-red-400"
                }`}
              >
                {crcFormatter.format(selectedDebt.balance || 0)}
              </div>
            </div>
          </div>

          {selectedDebtIsPaid && (
            <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              Solo visualizacion. Esta deuda ya fue pagada en su totalidad.
            </div>
          )}
          {!selectedDebtIsPaid && !selectedDebtRole && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Solo visualizacion. Puedes ver esta deuda por ownerId, pero solo
              una parte involucrada puede agregar movimientos.
            </div>
          )}

          <div className="mb-4 rounded-lg border border-[var(--input-border)]">
            {(selectedDebt.movements || []).map((movement) => (
              <div
                key={movement.id}
                className="flex items-start justify-between gap-3 border-b border-[var(--input-border)] p-3 last:border-b-0"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                    <CircleDollarSign className="h-4 w-4" />
                    {movement.type === "payment" ? "Abono" : "Cargo"}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {movement.reason}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                    {movement.date} - {movement.createdByName}
                  </div>
                </div>
                <div
                  className={`text-sm font-bold ${
                    movement.type === "payment" ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {movement.type === "payment" ? "-" : "+"}
                  {crcFormatter.format(movement.amount || 0)}
                </div>
              </div>
            ))}
          </div>

          {selectedDebtIsPaid || !selectedDebtRole ? (
            selectedDebtIsPaid ? (
              <div className="space-y-3">
                {receiptDownloadError ? (
                  <div className="text-sm text-red-300">
                    {receiptDownloadError}
                  </div>
                ) : null}
                <div className="flex flex-col justify-end gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handlePaidDebtImageDownload}
                    disabled={receiptDownloading || receiptMobileDownloading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {receiptDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {receiptDownloading ? "Generando..." : "Descargar imagen"}
                  </button>
                  <button
                    type="button"
                    onClick={handlePaidDebtMobileDownload}
                    disabled={receiptDownloading || receiptMobileDownloading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {receiptMobileDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="h-4 w-4" />
                    )}
                    {receiptMobileDownloading ? "Generando..." : "Descarga movil"}
                  </button>
                  <button
                    type="button"
                    onClick={closeSelectedDebt}
                    className="rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={closeSelectedDebt}
                  className="rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
                >
                  Cerrar
                </button>
              </div>
            )
          ) : (
            <form onSubmit={handleAddMovement} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                {canChooseMovementType ? (
                  <select
                    value={movementForm.type}
                    onChange={(event) =>
                      setMovementForm((prev) => ({
                        ...prev,
                        type: event.target.value as InternalDebtMovementType,
                      }))
                    }
                    className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
                  >
                    <option value="charge">Agregar cargo</option>
                    <option value="payment">Registrar abono</option>
                  </select>
                ) : (
                  <div className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm font-semibold text-[var(--foreground)]">
                    {selectedMovementType === "payment"
                      ? "Registrar abono"
                      : "Agregar cargo"}
                  </div>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatMoneyInput(movementForm.amount)}
                  onChange={(event) =>
                    setMovementForm((prev) => ({
                      ...prev,
                      amount: sanitizeMoneyInput(event.target.value),
                    }))
                  }
                  placeholder="₡0"
                  className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)]"
                />
                <input
                  type="date"
                  value={movementForm.date}
                  onChange={(event) =>
                    setMovementForm((prev) => ({
                      ...prev,
                      date: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)]"
                />
              </div>
              <input
                value={movementForm.reason}
                onChange={(event) =>
                  setMovementForm((prev) => ({
                    ...prev,
                    reason: event.target.value,
                  }))
                }
                placeholder="Motivo del movimiento"
                className="w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)]"
              />
              <input
                value={movementForm.reference}
                onChange={(event) =>
                  setMovementForm((prev) => ({
                    ...prev,
                    reference: event.target.value,
                  }))
                }
                placeholder="Referencia opcional"
                className="w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeSelectedDebt}
                  className="rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={saving || !canSubmitMovement}
                  title={saving ? "Guardando..." : movementSubmitTooltip}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-900/30 hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-900 disabled:text-blue-200 disabled:opacity-60 disabled:hover:bg-blue-900"
                >
                  <Eye className="h-4 w-4" />
                  Guardar movimiento
                </button>
              </div>
            </form>
          )}
          </ModalShell>
        </>
      )}
    </div>
  );
}
