"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Check,
  Circle,
  GripVertical,
  Minus,
  MoreVertical,
  NotebookPen,
  Eye,
  EyeOff,
  Lock,
  Pin,
  PinOff,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/shared/hooks/useAuth";
import { useActorOwnership } from "@/shared/hooks/useActorOwnership";
import useToast from "@/shared/hooks/useToast";
import { EmpresasService } from "@/entities/empresa";
import {
  AnotacionesService,
  type AnotacionInput,
} from "@/shared/services/anotaciones";
import type {
  Anotacion,
  AnotacionPriority,
  AnotacionStatus,
  Empresas,
} from "@/shared/types/firestore";
import { getDefaultPermissions } from "@/shared/utils/permissions";
import {
  deleteAnotacionLayout,
  getAnotacionesLayoutMap,
  saveAnotacionLayout,
  type AnotacionLayout,
} from "./anotacionesLayoutDb";

const STATUS_OPTIONS: Array<{ value: "all" | AnotacionStatus; label: string }> =
  [
    { value: "all", label: "Todas" },
    { value: "pending", label: "Pendientes" },
    { value: "done", label: "Realizadas" },
    { value: "archived", label: "Archivadas" },
  ];

const PRIORITY_OPTIONS: Array<{
  value: "all" | AnotacionPriority;
  label: string;
}> = [
  { value: "all", label: "Prioridad" },
  { value: "urgent", label: "Urgente" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
];

const COLOR_OPTIONS = ["#2563eb", "#16a34a", "#9333ea", "#e11d48", "#d97706", "#0891b2"];

const DEFAULT_LAYOUT: AnotacionLayout = {
  x: 48,
  y: 48,
  width: 260,
  height: 172,
  z: 1,
  pinned: false,
};

const BOARD_MIN_HEIGHT = 1800;
const CARD_GAP = 1;
const QUICK_NOTE_TITLE = "Nueva nota";
const QUICK_EDIT_MIN_WIDTH = 330;
const QUICK_EDIT_MIN_HEIGHT = 250;
const MIN_BOARD_ZOOM = 0.3;
const MAX_BOARD_ZOOM = 2.0;
const BOARD_ZOOM_STEP = 0.1;

const PRIORITY_META: Record<
  AnotacionPriority,
  { label: string; dot: string; className: string }
> = {
  urgent: {
    label: "Urgente",
    dot: "#ef4444",
    className: "border-red-400/45 bg-red-500/15 text-red-100",
  },
  high: {
    label: "Alta",
    dot: "#f97316",
    className: "border-orange-400/45 bg-orange-500/15 text-orange-100",
  },
  medium: {
    label: "Media",
    dot: "#facc15",
    className: "border-yellow-300/45 bg-yellow-400/15 text-yellow-50",
  },
  low: {
    label: "Baja",
    dot: "#38bdf8",
    className: "border-sky-300/45 bg-sky-400/15 text-sky-100",
  },
};

const COLOR_META: Array<{ value: string; label: string }> = [
  { value: "#2563eb", label: "Azul" },
  { value: "#16a34a", label: "Verde" },
  { value: "#9333ea", label: "Morado" },
  { value: "#e11d48", label: "Rojo" },
  { value: "#d97706", label: "Ambar" },
  { value: "#0891b2", label: "Cian" },
];

const EMPTY_CLASSIC_DRAFT = {
  title: "",
  description: "",
  category: "General",
  priority: "medium" as AnotacionPriority,
  color: COLOR_OPTIONS[0],
  reminderAt: "",
};

type DeleteConfirmState = {
  open: boolean;
  note: Anotacion | null;
  password: string;
  showPassword: boolean;
  submitting: boolean;
  error: string;
};

type LayoutMap = Record<string, AnotacionLayout>;

type DragState =
  | {
      type: "move";
      noteId: string;
      startX: number;
      startY: number;
      origin: AnotacionLayout;
      moved: boolean;
    }
  | {
      type: "resize";
      noteId: string;
      startX: number;
      startY: number;
      origin: AnotacionLayout;
      moved: boolean;
    };

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const formatDate = (iso?: string) => {
  if (!iso) return "Sin fecha";
  try {
    return new Intl.DateTimeFormat("es-CR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const statusLabel = (status: AnotacionStatus) => {
  if (status === "done") return "Realizada";
  if (status === "archived") return "Archivada";
  return "Pendiente";
};

const priorityLabel = (priority: AnotacionPriority) => {
  return PRIORITY_META[priority]?.label || "Media";
};

const toDatetimeLocalValue = (iso?: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const fromDatetimeLocalValue = (value: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const contrastText = (hex: string) => {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#08111f" : "#f8fafc";
};

const getEmpresaValue = (empresa: Empresas) =>
  String(empresa.name || empresa.ubicacion || empresa.id || "").trim();

const layoutsOverlap = (a: AnotacionLayout, b: AnotacionLayout) =>
  a.x < b.x + b.width + CARD_GAP &&
  a.x + a.width + CARD_GAP > b.x &&
  a.y < b.y + b.height + CARD_GAP &&
  a.y + a.height + CARD_GAP > b.y;

const hasLayoutCollision = (
  noteId: string,
  candidate: AnotacionLayout,
  layouts: LayoutMap,
) =>
  Object.entries(layouts).some(
    ([id, layout]) => id !== noteId && layoutsOverlap(candidate, layout),
  );

const findAvailableLayout = (
  noteId: string,
  candidate: AnotacionLayout,
  layouts: LayoutMap,
  bounds?: { width: number; height: number },
) => {
  const maxX = Math.max(0, (bounds?.width || 1400) - candidate.width - CARD_GAP);
  const maxY = Math.max(
    0,
    Math.max(bounds?.height || 720, BOARD_MIN_HEIGHT) - candidate.height - CARD_GAP,
  );
  const normalized = {
    ...candidate,
    x: clamp(candidate.x, 0, maxX),
    y: clamp(candidate.y, 0, maxY),
  };
  if (!hasLayoutCollision(noteId, normalized, layouts)) return normalized;

  for (let y = 44; y <= maxY; y += candidate.height + CARD_GAP) {
    for (let x = 44; x <= maxX; x += candidate.width + CARD_GAP) {
      const next = { ...normalized, x, y };
      if (!hasLayoutCollision(noteId, next, layouts)) return next;
    }
  }

  const lastBottom = Object.entries(layouts).reduce((bottom, [id, layout]) => {
    if (id === noteId) return bottom;
    return Math.max(bottom, layout.y + layout.height);
  }, 44);

  return {
    ...normalized,
    x: 44,
    y: lastBottom + CARD_GAP,
  };
};

const resolveMoveCollision = (
  noteId: string,
  origin: AnotacionLayout,
  candidate: AnotacionLayout,
  layouts: LayoutMap,
  bounds?: { width: number; height: number },
) => {
  if (!hasLayoutCollision(noteId, candidate, layouts)) return candidate;

  const dx = candidate.x - origin.x;
  const dy = candidate.y - origin.y;
  const maxX = Math.max(0, (bounds?.width || 1400) - candidate.width - CARD_GAP);
  const maxY = Math.max(
    0,
    Math.max(bounds?.height || 720, BOARD_MIN_HEIGHT) - candidate.height - CARD_GAP,
  );
  const next = { ...candidate };

  Object.entries(layouts).forEach(([id, layout]) => {
    if (id === noteId || !layoutsOverlap(next, layout)) return;
    if (Math.abs(dx) >= Math.abs(dy)) {
      next.x =
        dx >= 0
          ? layout.x - next.width - CARD_GAP
          : layout.x + layout.width + CARD_GAP;
    } else {
      next.y =
        dy >= 0
          ? layout.y - next.height - CARD_GAP
          : layout.y + layout.height + CARD_GAP;
    }
    next.x = clamp(next.x, 0, maxX);
    next.y = clamp(next.y, 0, maxY);
  });

  return hasLayoutCollision(noteId, next, layouts)
    ? layouts[noteId] || origin
    : next;
};

export default function AnotacionesPage() {
  const { user } = useAuth();
  const { ownerIds, primaryOwnerId } = useActorOwnership(user || {});
  const { showToast } = useToast();
  const permissions = user
    ? user.permissions || getDefaultPermissions(user.role || "user")
    : null;
  const canUse = Boolean(permissions?.anotaciones);
  const canSelectCompany = user?.role === "admin" || user?.role === "superadmin";
  const userKey = String(user?.id || user?.email || "anonymous");

  const [empresas, setEmpresas] = useState<Empresas[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [notes, setNotes] = useState<Anotacion[]>([]);
  const [layouts, setLayouts] = useState<LayoutMap>({});
  const [loading, setLoading] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AnotacionStatus>(
    "all",
  );
  const [priorityFilter, setPriorityFilter] = useState<
    "all" | AnotacionPriority
  >("all");
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [menuNoteId, setMenuNoteId] = useState<string | null>(null);
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [classicNoteOpen, setClassicNoteOpen] = useState(false);
  const [classicDraft, setClassicDraft] = useState(EMPTY_CLASSIC_DRAFT);
  const [classicEditNoteId, setClassicEditNoteId] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [boardZoom, setBoardZoom] = useState(1);
  const [donePulseId, setDonePulseId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    open: false,
    note: null,
    password: "",
    showPassword: false,
    submitting: false,
    error: "",
  });
  const dragStateRef = useRef<DragState | null>(null);
  const layoutsRef = useRef<LayoutMap>({});
  const suppressNextClickRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const boardZoomRef = useRef(1);

  const selectedEmpresaMeta = useMemo(
    () =>
      empresas.find(
        (empresa) =>
          getEmpresaValue(empresa) === selectedCompany ||
          empresa.name === selectedCompany ||
          empresa.ubicacion === selectedCompany,
      ),
    [empresas, selectedCompany],
  );

  const empresaId = useMemo(
    () => AnotacionesService.buildEmpresaDocId(selectedCompany),
    [selectedCompany],
  );

  const ownerSet = useMemo(
    () => new Set(ownerIds.map((id) => String(id || "").trim()).filter(Boolean)),
    [ownerIds],
  );

  const visibleNotes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return notes.filter((note) => {
      if (statusFilter !== "all" && note.status !== statusFilter) return false;
      if (priorityFilter !== "all" && note.priority !== priorityFilter)
        return false;
      if (!needle) return true;
      return `${note.title} ${note.description} ${note.category} ${note.creatorName}`
        .toLowerCase()
        .includes(needle);
    });
  }, [notes, priorityFilter, search, statusFilter]);

  useEffect(() => {
    layoutsRef.current = layouts;
  }, [layouts]);

  useEffect(() => {
    boardZoomRef.current = boardZoom;
  }, [boardZoom]);

  const getBoardBounds = useCallback(() => {
    const canvas = canvasRef.current;
    const zoom = boardZoomRef.current || 1;
    const viewportWidth = canvas?.clientWidth || 1400;
    return {
      width: viewportWidth * Math.max(1, zoom) / zoom,
      height: Math.max(
        ((canvas?.scrollHeight || BOARD_MIN_HEIGHT) / zoom) || BOARD_MIN_HEIGHT,
        BOARD_MIN_HEIGHT,
      ),
    };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(notes.map((note) => note.category))).slice(0, 8),
    [notes],
  );

  const getLayout = useCallback(
    (note: Anotacion, index = 0): AnotacionLayout => {
      if (layouts[note.id]) return layouts[note.id];
      const fallback = {
        ...DEFAULT_LAYOUT,
        x: 44 + (index % 4) * 292,
        y: 44 + Math.floor(index / 4) * 214,
        z: index + 1,
      };
      return findAvailableLayout(note.id, fallback, layouts, {
        width: getBoardBounds().width,
        height: getBoardBounds().height,
      });
    },
    [getBoardBounds, layouts],
  );

  const persistLayout = useCallback(
    async (noteId: string, layout: AnotacionLayout) => {
      if (!selectedCompany) return;
      try {
        await saveAnotacionLayout(userKey, empresaId, noteId, layout);
      } catch (err) {
        console.error("Error saving anotacion layout:", err);
      }
    },
    [empresaId, selectedCompany, userKey],
  );

  const mergeLayout = useCallback(
    (
      noteId: string,
      patch: Partial<AnotacionLayout>,
      persist = false,
      baseLayout?: AnotacionLayout,
    ) => {
      let nextLayout: AnotacionLayout = DEFAULT_LAYOUT;
      setLayouts((prev) => {
        nextLayout = {
          ...(prev[noteId] || baseLayout || DEFAULT_LAYOUT),
          ...patch,
        };
        return { ...prev, [noteId]: nextLayout };
      });
      if (persist) void persistLayout(noteId, nextLayout);
    },
    [persistLayout],
  );

  const loadNotes = useCallback(async () => {
    if (!selectedCompany || !canUse) return;
    setLoading(true);
    setError("");
    try {
      const nextNotes = await AnotacionesService.listByEmpresa(
        selectedCompany,
        {
          limit: 1000,
          scope: {
            role: user?.role,
            ownerId: selectedEmpresaMeta?.ownerId || primaryOwnerId,
            ownercompanie: user?.ownercompanie,
          },
        },
      );
      const nextLayouts = await getAnotacionesLayoutMap(userKey, empresaId).catch(
        (layoutErr) => {
          console.error("Error loading anotaciones layout:", layoutErr);
          return {};
        },
      );
      setNotes(nextNotes);
      setLayouts(nextLayouts);
    } catch (err) {
      console.error("Error loading anotaciones:", err);
      setError("No se pudieron cargar las anotaciones.");
    } finally {
      setLoading(false);
    }
  }, [
    canUse,
    empresaId,
    primaryOwnerId,
    selectedCompany,
    selectedEmpresaMeta?.ownerId,
    user?.ownercompanie,
    user?.role,
    userKey,
  ]);

  useEffect(() => {
    if (!canUse || !user) return;
    setCompanyLoading(true);
    EmpresasService.getAllEmpresas()
      .then((list) => {
        const assigned = String(user.ownercompanie || "").trim();
        const visible =
          user.role === "superadmin"
            ? list
            : user.role === "admin"
              ? list.filter((empresa) => {
                  const ownerId = String(empresa.ownerId || "").trim();
                  return (
                    (ownerId && ownerSet.has(ownerId)) ||
                    empresa.name === assigned ||
                    empresa.ubicacion === assigned
                  );
                })
              : list.filter(
                  (empresa) =>
                    empresa.name === assigned ||
                    empresa.ubicacion === assigned ||
                    empresa.id === assigned,
                );
        setEmpresas(visible);
        const preferred =
          visible.find(
            (empresa) =>
              empresa.name === assigned ||
              empresa.ubicacion === assigned ||
              empresa.id === assigned,
          ) || visible[0];
        setSelectedCompany((prev) =>
          prev || (!canSelectCompany && assigned
            ? assigned
            : preferred
              ? getEmpresaValue(preferred)
              : ""),
        );
      })
      .catch((err) => {
        console.error("Error loading empresas for anotaciones:", err);
        setError("No se pudieron cargar las empresas.");
      })
      .finally(() => setCompanyLoading(false));
  }, [canSelectCompany, canUse, ownerSet, user]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const adjustBoardZoom = useCallback((direction: "in" | "out") => {
    setBoardZoom((current) => {
      const next =
        current + (direction === "in" ? BOARD_ZOOM_STEP : -BOARD_ZOOM_STEP);
      return clamp(Number(next.toFixed(2)), MIN_BOARD_ZOOM, MAX_BOARD_ZOOM);
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey || dragStateRef.current || event.deltaY === 0) return;

      const rect = canvas.getBoundingClientRect();
      const isInside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!isInside) return;

      event.preventDefault();
      adjustBoardZoom(event.deltaY < 0 ? "in" : "out");
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  });

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;
      const zoom = boardZoomRef.current || 1;
      const dx = (event.clientX - state.startX) / zoom;
      const dy = (event.clientY - state.startY) / zoom;
      const moved = Math.abs(dx) > 2 || Math.abs(dy) > 2;
      const bounds = getBoardBounds();

      if (state.type === "move") {
        const maxX = Math.max(
          0,
          bounds.width - state.origin.width - CARD_GAP,
        );
        const maxY = Math.max(
          0,
          bounds.height - state.origin.height - CARD_GAP,
        );
        const candidate = {
          ...state.origin,
          x: clamp(state.origin.x + dx, 0, maxX),
          y: clamp(state.origin.y + dy, 0, maxY),
        };
        const next = resolveMoveCollision(
          state.noteId,
          state.origin,
          candidate,
          layoutsRef.current,
          {
            width: bounds.width,
            height: bounds.height,
          },
        );
        dragStateRef.current = { ...state, moved };
        setLayouts((prev) => ({ ...prev, [state.noteId]: next }));
        return;
      }

      const candidate = {
        ...state.origin,
        width: clamp(state.origin.width + dx, 200, 520),
        height: clamp(state.origin.height + dy, 132, 360),
      };
      const next = hasLayoutCollision(
        state.noteId,
        candidate,
        layoutsRef.current,
      )
        ? state.origin
        : candidate;
      dragStateRef.current = { ...state, moved };
      setLayouts((prev) => ({ ...prev, [state.noteId]: next }));
    };

    const onPointerUp = () => {
      const state = dragStateRef.current;
      if (!state) return;
      dragStateRef.current = null;
      if (state.moved) {
        suppressNextClickRef.current = true;
        window.setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 0);
      }
      const layout = layoutsRef.current[state.noteId];
      if (!layout) return;
      void persistLayout(state.noteId, layout);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [getBoardBounds, persistLayout]);

  const bringToFront = useCallback(
    (noteId: string, baseLayout?: AnotacionLayout) => {
      const nextZ =
        Math.max(0, ...Object.values(layouts).map((layout) => layout.z)) + 1;
      mergeLayout(noteId, { z: nextZ }, true, baseLayout);
    },
    [layouts, mergeLayout],
  );

  const startMove = (event: React.PointerEvent, note: Anotacion, index: number) => {
    if ((event.target as HTMLElement).closest("[data-note-action]")) return;
    const layout = getLayout(note, index);
    if (layout.pinned) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextZ =
      Math.max(0, ...Object.values(layouts).map((item) => item.z)) + 1;
    mergeLayout(note.id, { z: nextZ }, true, layout);
    dragStateRef.current = {
      type: "move",
      noteId: note.id,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...layout, z: nextZ },
      moved: false,
    };
  };

  const startResize = (
    event: React.PointerEvent,
    note: Anotacion,
    index: number,
  ) => {
    const layout = getLayout(note, index);
    if (layout.pinned) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    bringToFront(note.id, layout);
    dragStateRef.current = {
      type: "resize",
      noteId: note.id,
      startX: event.clientX,
      startY: event.clientY,
      origin: layout,
      moved: false,
    };
  };

  const openQuickEdit = (note: Anotacion, index = 0) => {
    const layout = getLayout(note, index);
    const nextZ =
      Math.max(0, ...Object.values(layouts).map((item) => item.z)) + 1;
    mergeLayout(
      note.id,
      {
        width: Math.max(layout.width, QUICK_EDIT_MIN_WIDTH),
        height: Math.max(layout.height, QUICK_EDIT_MIN_HEIGHT),
        z: nextZ,
      },
      true,
      layout,
    );
    setQuickEditId(note.id);
    setMenuNoteId(null);
  };

  const buildCreateInput = (overrides?: Partial<AnotacionInput>): AnotacionInput => ({
    empresa: selectedCompany,
    ownerId: selectedEmpresaMeta?.ownerId || primaryOwnerId,
    title: overrides?.title || QUICK_NOTE_TITLE,
    description: overrides?.description || "",
    category: overrides?.category || "General",
    color: overrides?.color || COLOR_OPTIONS[0],
    priority: overrides?.priority || "medium",
    creatorId: String(user?.id || user?.email || "usuario"),
    creatorName: String(user?.name || user?.email || "Usuario"),
    reminderAt: overrides?.reminderAt,
    status: "pending",
  });

  const placeNewNote = async (note: Anotacion) => {
    const base = {
      ...DEFAULT_LAYOUT,
      x: 56 + (notes.length % 4) * 286,
      y: 56 + Math.floor(notes.length / 4) * 208,
      z: Math.max(1, ...Object.values(layouts).map((l) => l.z)) + 1,
    };
    const layout = findAvailableLayout(note.id, base, layouts, {
      width: canvasRef.current?.clientWidth || 1400,
      height: canvasRef.current?.scrollHeight || BOARD_MIN_HEIGHT,
    });
    setLayouts((prev) => ({ ...prev, [note.id]: layout }));
    await persistLayout(note.id, layout);
    return layout;
  };

  const handleCreateQuick = async () => {
    if (!selectedCompany || !user) return;
    setSaving(true);
    try {
      const note = await AnotacionesService.create(buildCreateInput());
      setNotes((prev) => [note, ...prev]);
      const createdLayout = await placeNewNote(note);
      const layout = {
        ...createdLayout,
        width: QUICK_EDIT_MIN_WIDTH,
        height: QUICK_EDIT_MIN_HEIGHT,
        z: Math.max(1, ...Object.values(layouts).map((l) => l.z)) + 2,
      };
      mergeLayout(note.id, layout, true, createdLayout);
      setQuickEditId(note.id);
      setNewNoteOpen(false);
    } catch (err) {
      console.error("Error creating anotacion:", err);
      showToast("No se pudo crear la anotacion.", "error", 4000);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateClassic = async () => {
    if (!selectedCompany || !user || !classicDraft.title.trim()) return;
    setSaving(true);
    try {
      const note = await AnotacionesService.create(
        buildCreateInput({
          title: classicDraft.title.trim(),
          description: classicDraft.description.trim(),
          category: classicDraft.category.trim() || "General",
          color: classicDraft.color,
          priority: classicDraft.priority,
          reminderAt: fromDatetimeLocalValue(classicDraft.reminderAt),
        }),
      );
      setNotes((prev) => [note, ...prev]);
      await placeNewNote(note);
      setNewNoteOpen(false);
      setClassicNoteOpen(false);
      setClassicEditNoteId(null);
      setClassicDraft(EMPTY_CLASSIC_DRAFT);
    } catch (err) {
      console.error("Error creating anotacion:", err);
      showToast("No se pudo crear la anotacion.", "error", 4000);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenClassicEdit = (note: Anotacion) => {
    setClassicDraft({
      title: note.title === QUICK_NOTE_TITLE ? "" : note.title,
      description: note.description,
      category: note.category,
      color: note.color,
      priority: note.priority,
      reminderAt: toDatetimeLocalValue(note.reminderAt),
    });
    setClassicEditNoteId(note.id);
    setClassicNoteOpen(true);
    setNewNoteOpen(true);
    setMenuNoteId(null);
  };

  const handleSaveClassicEdit = async () => {
    if (!classicEditNoteId || !classicDraft.title.trim()) return;
    await handleUpdate(classicEditNoteId, {
      title: classicDraft.title.trim(),
      description: classicDraft.description.trim(),
      category: classicDraft.category.trim() || "General",
      color: classicDraft.color,
      priority: classicDraft.priority,
      reminderAt: fromDatetimeLocalValue(classicDraft.reminderAt) || "",
    });
    setNewNoteOpen(false);
    setClassicNoteOpen(false);
    setClassicEditNoteId(null);
    setClassicDraft(EMPTY_CLASSIC_DRAFT);
  };

  const closeClassicModal = () => {
    setNewNoteOpen(false);
    setClassicNoteOpen(false);
    setClassicEditNoteId(null);
    setClassicDraft(EMPTY_CLASSIC_DRAFT);
  };

  const handleUpdate = async (noteId: string, updates: Partial<Anotacion>) => {
    if (!selectedCompany) return;
    const before = notes;
    setNotes((prev) =>
      prev.map((note) =>
        note.id === noteId
          ? { ...note, ...updates, updatedAt: new Date().toISOString() }
          : note,
      ),
    );
    try {
      await AnotacionesService.update(selectedCompany, noteId, updates);
    } catch (err) {
      setNotes(before);
      console.error("Error updating anotacion:", err);
      showToast("No se pudo guardar la anotacion.", "error", 4000);
    }
  };

  const handleMarkDone = async (note: Anotacion) => {
    const doneAt = new Date().toISOString();
    setDonePulseId(note.id);
    setTimeout(() => setDonePulseId(null), 650);
    await handleUpdate(note.id, { status: "done", doneAt });
  };

  const handleToggleDone = async (note: Anotacion, checked: boolean) => {
    if (checked) {
      await handleMarkDone(note);
      return;
    }
    await handleUpdate(note.id, {
      status: "pending",
      doneAt: "",
      archivedAt: "",
    });
  };

  const handleArchive = async (note: Anotacion) => {
    await handleUpdate(note.id, {
      status: "archived",
      archivedAt: new Date().toISOString(),
    });
    setMenuNoteId(null);
  };

  const handleDelete = async (note: Anotacion) => {
    if (!selectedCompany) return;
    setMenuNoteId(null);
    setDeleteConfirm({
      open: true,
      note,
      password: "",
      showPassword: false,
      submitting: false,
      error: "",
    });
  };

  const closeDeleteConfirm = () => {
    if (deleteConfirm.submitting) return;
    setDeleteConfirm({
      open: false,
      note: null,
      password: "",
      showPassword: false,
      submitting: false,
      error: "",
    });
  };

  const confirmDeleteWithPassword = async () => {
    const note = deleteConfirm.note;
    const password = deleteConfirm.password;
    if (!note || !selectedCompany || deleteConfirm.submitting) return;

    setDeleteConfirm((prev) => ({ ...prev, submitting: true, error: "" }));
    try {
      try {
        await deleteNotePermanently(note, password);
      } catch {
        setDeleteConfirm((prev) => ({
          ...prev,
          submitting: false,
          error: "Contrasena incorrecta o sin permiso para eliminar.",
        }));
        return;
      }
      setDeleteConfirm({
        open: false,
        note: null,
        password: "",
        showPassword: false,
        submitting: false,
        error: "",
      });
    } catch (err) {
      console.error("Error confirming anotacion deletion:", err);
      setDeleteConfirm((prev) => ({
        ...prev,
        submitting: false,
        error: "Error al validar la contrasena",
      }));
    }
  };

  const deleteNotePermanently = async (
    note: Anotacion,
    password: string,
  ) => {
    if (!selectedCompany) return;
    const before = notes;
    setNotes((prev) => prev.filter((item) => item.id !== note.id));
    try {
      const response = await fetch("/api/anotaciones/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          empresa: selectedCompany,
          noteId: note.id,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
      };
      if (!response.ok || result.ok !== true) {
        throw new Error("Delete rejected");
      }
      deleteAnotacionLayout(userKey, empresaId, note.id).catch((err) => {
        console.warn("Error deleting anotacion layout:", err);
      });
      showToast("Anotacion eliminada.", "success", 3000);
    } catch (err) {
      setNotes(before);
      console.error("Error deleting anotacion:", err);
      showToast("No se pudo eliminar la anotacion.", "error", 4000);
      throw err;
    }
  };

  const handleQuickSave = async (note: Anotacion, title: string, description: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    setQuickEditId(null);
    await handleUpdate(note.id, {
      title: cleanTitle,
      description: description.trim(),
    });
  };

  if (!canUse) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-8 text-center">
        <NotebookPen className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Sin permisos
        </h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          No tienes permisos para acceder a Anotaciones.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-140px)] overflow-hidden rounded-lg border border-[var(--input-border)] bg-[#070b14] text-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-black/25 px-4 py-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-white/15 bg-black/35 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar notas..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
        </div>

        <select
          value={selectedCompany}
          onChange={(event) => setSelectedCompany(event.target.value)}
          className="h-10 rounded-md border border-white/15 bg-black/35 px-3 text-sm text-white outline-none"
          disabled={companyLoading || !canSelectCompany}
        >
          {empresas.length === 0 ? (
            <option value="">Sin empresas</option>
          ) : (
            empresas.map((empresa) => (
              <option
                key={empresa.id || empresa.name || empresa.ubicacion}
                value={
                  canSelectCompany
                    ? getEmpresaValue(empresa)
                    : selectedCompany || getEmpresaValue(empresa)
                }
              >
                {empresa.name || empresa.ubicacion}
              </option>
            ))
          )}
        </select>

        <div className="flex items-center gap-2 overflow-x-auto">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatusFilter(option.value)}
              className={`h-9 rounded-md border px-3 text-sm transition ${
                statusFilter === option.value
                  ? "border-indigo-400 bg-indigo-500/35 text-white"
                  : "border-white/15 bg-black/25 text-slate-300 hover:bg-white/10"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-md border border-white/15 bg-black/25 p-1">
          {PRIORITY_OPTIONS.map((option) => {
            const selected = priorityFilter === option.value;
            const meta =
              option.value === "all" ? null : PRIORITY_META[option.value];
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPriorityFilter(option.value)}
                className={`flex h-8 items-center gap-1.5 rounded px-2.5 text-xs transition ${
                  selected
                    ? "bg-white/15 text-white"
                    : "text-slate-300 hover:bg-white/10"
                }`}
              >
                {meta ? (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: meta.dot }}
                  />
                ) : null}
                {option.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setNewNoteOpen(true)}
          className="ml-auto flex h-10 items-center gap-2 rounded-md bg-indigo-500 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-400 disabled:opacity-60"
          disabled={saving || !selectedCompany}
        >
          <Plus className="h-4 w-4" />
          Nueva nota
        </button>
      </div>

      <div className="flex items-center gap-3 border-b border-white/10 bg-black/20 px-4 py-2 text-xs text-slate-400">
        <SlidersHorizontal className="h-4 w-4" />
        <span>{visibleNotes.length} visibles</span>
        <span>{notes.filter((note) => note.status === "pending").length} pendientes</span>
        <span>{categories.length > 0 ? categories.join(" · ") : "Sin categorias"}</span>
      </div>

      <div
        ref={canvasRef}
        className="relative h-[680px] overflow-auto overscroll-contain bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_0)] [background-size:18px_18px]"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-950/35 via-transparent to-purple-700/35" />

        <div
          data-note-action
          className="pointer-events-none absolute right-3 top-3 z-30 flex items-center overflow-hidden rounded-md border border-white/15 bg-slate-950/90 text-xs font-semibold text-white shadow-xl backdrop-blur"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => adjustBoardZoom("out")}
            disabled={boardZoom <= MIN_BOARD_ZOOM}
            className="pointer-events-auto flex h-8 w-8 items-center justify-center hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Alejar anotaciones"
            title="Alejar"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-12 border-x border-white/10 px-2 text-center">
            {Math.round(boardZoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => adjustBoardZoom("in")}
            disabled={boardZoom >= MAX_BOARD_ZOOM}
            className="pointer-events-auto flex h-8 w-8 items-center justify-center hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Acercar anotaciones"
            title="Acercar"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {loading && (
          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/15 bg-black/45 px-5 py-3 text-sm text-slate-200">
            Cargando anotaciones...
          </div>
        )}

        {error && (
          <div className="absolute left-6 top-6 z-10 rounded-lg border border-red-400/40 bg-red-950/50 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {!loading && visibleNotes.length === 0 && (
          <div className="absolute left-1/2 top-1/2 z-10 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/15 bg-black/45 p-8 text-center">
            <NotebookPen className="mx-auto mb-4 h-12 w-12 text-indigo-200" />
            <h2 className="text-xl font-semibold">Sin anotaciones</h2>
            <p className="mt-2 text-sm text-slate-300">
              Crea una nota para esta empresa.
            </p>
          </div>
        )}

        <div
          className="relative z-[1]"
          style={{
            width: boardZoom >= 1 ? `${boardZoom * 100}%` : "100%",
            height: BOARD_MIN_HEIGHT * boardZoom,
          }}
        >
          <div
            className="relative"
            style={{
              width: `${100 / boardZoom}%`,
              height: BOARD_MIN_HEIGHT,
              transform: `scale(${boardZoom})`,
              transformOrigin: "top left",
            }}
          >
            {visibleNotes.map((note, index) => {
              const layout = getLayout(note, index);
              const isQuickEdit = quickEditId === note.id;
              const textColor = contrastText(note.color);
              return (
                <article
                  key={note.id}
                  onPointerDown={() => bringToFront(note.id, layout)}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("[data-note-action]"))
                      return;
                    if (suppressNextClickRef.current) return;
                    setMenuNoteId(null);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    openQuickEdit(note, index);
                  }}
                  className={`absolute rounded-lg border p-0 shadow-2xl transition-opacity ${
                    note.status === "done" ? "opacity-60" : "opacity-100"
                  } ${donePulseId === note.id ? "scale-[1.03]" : "scale-100"}`}
                  style={{
                    left: layout.x,
                    top: layout.y,
                    width: layout.width,
                    height: layout.height,
                    zIndex: layout.z,
                    borderColor: `${note.color}99`,
                    background: `linear-gradient(145deg, ${note.color}33, rgba(15,23,42,0.92))`,
                    boxShadow: `0 18px 48px ${note.color}33`,
                  }}
                >
              <div
                onPointerDown={(event) => startMove(event, note, index)}
                className="flex cursor-grab items-center gap-2 rounded-t-lg border-b border-white/10 px-3 py-2 active:cursor-grabbing"
                style={{ color: textColor }}
              >
                <GripVertical className="h-4 w-4 opacity-70" />
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${note.color}55` }}
                >
                  <NotebookPen className="h-4 w-4" />
                </div>
                <label
                  data-note-action
                  className="flex shrink-0 cursor-pointer items-center"
                  title={
                    note.status === "done"
                      ? "Marcar pendiente"
                      : "Marcar realizada"
                  }
                >
                  <input
                    type="checkbox"
                    checked={note.status === "done"}
                    onChange={(event) =>
                      void handleToggleDone(note, event.target.checked)
                    }
                    className="peer sr-only"
                  />
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/25 bg-black/30 text-white transition peer-checked:border-emerald-300 peer-checked:bg-emerald-500">
                    {note.status === "done" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 opacity-65" />
                    )}
                  </span>
                </label>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-white">
                    {note.title}
                  </div>
                </div>
                {layout.pinned ? <Pin className="h-4 w-4" /> : null}
                <button
                  type="button"
                  data-note-action
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenuNoteId((current) =>
                      current === note.id ? null : note.id,
                    );
                  }}
                  className="rounded p-1 text-white/80 hover:bg-white/10"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>

              <div className="h-[calc(100%-49px)] overflow-hidden px-4 py-3">
                {isQuickEdit ? (
                  <QuickEditForm note={note} onSave={handleQuickSave} />
                ) : (
                  <>
                    <p className="line-clamp-3 text-sm text-slate-100">
                      {note.description || "Sin descripcion."}
                    </p>
                    <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                      <span
                        className="rounded-full px-2 py-0.5 text-white"
                        style={{ backgroundColor: `${note.color}80` }}
                      >
                        {note.category}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 ${PRIORITY_META[note.priority].className}`}
                      >
                        {priorityLabel(note.priority)}
                      </span>
                      <span>
                        {note.reminderAt
                          ? `Recordatorio ${formatDate(note.reminderAt)}`
                          : formatDate(note.createdAt)}
                      </span>
                      <span>{statusLabel(note.status)}</span>
                    </div>
                  </>
                )}
              </div>

              {menuNoteId === note.id && (
                <div
                  data-note-action
                  className="absolute right-2 top-11 z-20 w-44 overflow-hidden rounded-md border border-white/15 bg-slate-950 text-sm shadow-xl"
                >
                  <button
                    type="button"
                    onClick={() => handleOpenClassicEdit(note)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  >
                    <NotebookPen className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      mergeLayout(
                        note.id,
                        { pinned: !layout.pinned },
                        true,
                        layout,
                      )
                    }
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  >
                    {layout.pinned ? (
                      <PinOff className="h-4 w-4" />
                    ) : (
                      <Pin className="h-4 w-4" />
                    )}
                    {layout.pinned ? "Quitar fijo" : "Fijar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMarkDone(note)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  >
                    <Check className="h-4 w-4" />
                    Realizada
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleArchive(note)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                  >
                    <Archive className="h-4 w-4" />
                    Archivar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(note)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-200 hover:bg-red-500/15"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </button>
                </div>
              )}

              {!layout.pinned && (
                <button
                  type="button"
                  data-note-action
                  onPointerDown={(event) => startResize(event, note, index)}
                  className="absolute bottom-1 right-1 h-6 w-6 cursor-nwse-resize rounded-br-md border-b-2 border-r-2 border-white/55"
                  aria-label="Redimensionar"
                />
              )}
            </article>
              );
            })}
          </div>
        </div>
      </div>

      {newNoteOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
          <div className="relative z-[10001] w-full max-w-lg rounded-lg border border-white/15 bg-slate-950 p-5 text-white shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {classicEditNoteId ? "Editar nota" : "Nueva nota"}
              </h3>
              <button
                type="button"
                onClick={closeClassicModal}
                className="rounded p-1 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {!classicNoteOpen ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void handleCreateQuick()}
                  className="rounded-md border border-indigo-300/40 bg-indigo-500/20 p-4 text-left transition hover:bg-indigo-500/30"
                  disabled={saving}
                >
                  <Plus className="mb-3 h-5 w-5 text-indigo-200" />
                  <span className="block font-semibold">Nota rapida</span>
                  <span className="mt-1 block text-sm text-slate-300">
                    Crea tarjeta y abre edicion rapida.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setClassicNoteOpen(true)}
                  className="rounded-md border border-white/15 bg-white/5 p-4 text-left transition hover:bg-white/10"
                  disabled={saving}
                >
                  <NotebookPen className="mb-3 h-5 w-5 text-slate-200" />
                  <span className="block font-semibold">Nota clasica</span>
                  <span className="mt-1 block text-sm text-slate-300">
                    Titulo, descripcion, prioridad, color y recordatorio.
                  </span>
                </button>
              </div>
            ) : (
              <ClassicNoteForm
                draft={classicDraft}
                saving={saving}
                onChange={setClassicDraft}
                onBack={
                  classicEditNoteId
                    ? closeClassicModal
                    : () => setClassicNoteOpen(false)
                }
                onSubmit={
                  classicEditNoteId ? handleSaveClassicEdit : handleCreateClassic
                }
                submitLabel={classicEditNoteId ? "Guardar cambios" : "Crear nota"}
              />
            )}
          </div>
        </div>
      )}

      {deleteConfirm.open && deleteConfirm.note && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className="relative z-[10001] w-full max-w-sm rounded-lg border border-white/15 bg-slate-950 p-5 text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <Lock className="h-5 w-5 text-red-200" />
              <h3 className="text-lg font-semibold">Confirmar eliminacion</h3>
            </div>
            <p className="mb-3 text-sm text-slate-300">
              Ingresa tu contrasena para eliminar {deleteConfirm.note.title}.
            </p>
            <div className="relative mb-3">
              <input
                type={deleteConfirm.showPassword ? "text" : "password"}
                value={deleteConfirm.password}
                onChange={(event) =>
                  setDeleteConfirm((prev) => ({
                    ...prev,
                    password: event.target.value,
                    error: "",
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void confirmDeleteWithPassword();
                  }
                }}
                placeholder="Contrasena"
                className="w-full rounded-md border border-white/15 bg-black/35 px-3 py-2 pr-10 text-sm text-white outline-none focus:border-red-300"
                autoFocus
                disabled={deleteConfirm.submitting}
              />
              <button
                type="button"
                onClick={() =>
                  setDeleteConfirm((prev) => ({
                    ...prev,
                    showPassword: !prev.showPassword,
                  }))
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white"
                disabled={deleteConfirm.submitting}
                aria-label={
                  deleteConfirm.showPassword
                    ? "Ocultar contrasena"
                    : "Mostrar contrasena"
                }
              >
                {deleteConfirm.showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {deleteConfirm.error ? (
              <p className="mb-3 text-sm text-red-300">{deleteConfirm.error}</p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => void confirmDeleteWithPassword()}
                disabled={
                  deleteConfirm.submitting ||
                  deleteConfirm.password.trim().length === 0
                }
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
              >
                {deleteConfirm.submitting ? "Eliminando..." : "Eliminar"}
              </button>
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={deleteConfirm.submitting}
                className="rounded-md border border-white/15 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10 disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickEditForm({
  note,
  onSave,
}: {
  note: Anotacion;
  onSave: (note: Anotacion, title: string, description: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(
    note.title === QUICK_NOTE_TITLE ? "" : note.title,
  );
  const [description, setDescription] = useState(note.description);
  const saveQuickNote = () => {
    void onSave(note, title, description);
  };

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        saveQuickNote();
      }}
    >
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            saveQuickNote();
          }
        }}
        placeholder="Titulo de la anotacion"
        className="w-full rounded border border-white/15 bg-black/35 px-2 py-1 text-sm font-semibold text-white outline-none"
        autoFocus
      />
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            saveQuickNote();
          }
        }}
        placeholder="Descripcion rapida..."
        className="h-16 w-full resize-none rounded border border-white/15 bg-black/35 px-2 py-1 text-sm text-white outline-none"
      />
      <button
        type="submit"
        className="rounded bg-indigo-500 px-3 py-1 text-xs font-semibold text-white"
      >
        Guardar
      </button>
    </form>
  );
}

function PrioritySelector({
  value,
  onChange,
}: {
  value: AnotacionPriority;
  onChange: (value: AnotacionPriority) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(Object.keys(PRIORITY_META) as AnotacionPriority[]).map((priority) => {
        const meta = PRIORITY_META[priority];
        return (
          <button
            key={priority}
            type="button"
            onClick={() => onChange(priority)}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
              value === priority
                ? meta.className
                : "border-white/15 bg-black/25 text-slate-300 hover:bg-white/10"
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: meta.dot }}
            />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

function ColorSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {COLOR_META.map((color) => (
          <button
            key={color.value}
            type="button"
            onClick={() => onChange(color.value)}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
              value === color.value
                ? "border-white bg-white/10 text-white"
                : "border-white/15 bg-black/25 text-slate-300 hover:bg-white/10"
            }`}
          >
            <span
              className="h-5 w-5 rounded"
              style={{ backgroundColor: color.value }}
            />
            {color.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-300">
        Personal
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : COLOR_OPTIONS[0]}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-white/15 bg-black/35 p-1"
        />
        <span className="font-mono">{value}</span>
      </label>
    </div>
  );
}

function ClassicNoteForm({
  draft,
  saving,
  onChange,
  onBack,
  onSubmit,
  submitLabel,
}: {
  draft: typeof EMPTY_CLASSIC_DRAFT;
  saving: boolean;
  onChange: (draft: typeof EMPTY_CLASSIC_DRAFT) => void;
  onBack: () => void;
  onSubmit: () => Promise<void>;
  submitLabel: string;
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <div className="rounded-lg border border-white/15 bg-white/[0.08] p-3 shadow-inner">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-white">Prioridad</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs ${PRIORITY_META[draft.priority].className}`}
          >
            {priorityLabel(draft.priority)}
          </span>
        </div>
        <PrioritySelector
          value={draft.priority}
          onChange={(priority) => onChange({ ...draft, priority })}
        />
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-300">Titulo</span>
        <input
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          placeholder="Titulo de la anotacion"
          className="w-full rounded-md border border-white/15 bg-black/35 px-3 py-2 text-white outline-none placeholder:text-slate-500"
          autoFocus
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-300">Descripcion</span>
        <textarea
          value={draft.description}
          onChange={(event) =>
            onChange({ ...draft, description: event.target.value })
          }
          placeholder="Detalles de la nota..."
          className="h-24 w-full resize-none rounded-md border border-white/15 bg-black/35 px-3 py-2 text-white outline-none placeholder:text-slate-500"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Categoria</span>
          <input
            value={draft.category}
            onChange={(event) =>
              onChange({ ...draft, category: event.target.value })
            }
            className="w-full rounded-md border border-white/15 bg-black/35 px-3 py-2 text-white outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Recordatorio</span>
          <input
            type="datetime-local"
            value={draft.reminderAt}
            onChange={(event) =>
              onChange({ ...draft, reminderAt: event.target.value })
            }
            className="w-full rounded-md border border-white/15 bg-black/35 px-3 py-2 text-white outline-none"
          />
        </label>
      </div>
      <div>
        <span className="mb-2 block text-sm text-slate-300">Color</span>
        <ColorSelector
          value={draft.color}
          onChange={(color) => onChange({ ...draft, color })}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-white/15 px-4 py-2 text-sm hover:bg-white/10"
        >
          Volver
        </button>
        <button
          type="submit"
          disabled={saving || !draft.title.trim()}
          className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold hover:bg-indigo-400 disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function EditDrawer({
  note,
  onClose,
  onUpdate,
  onArchive,
  onDelete,
}: {
  note: Anotacion;
  onClose: () => void;
  onUpdate: (noteId: string, updates: Partial<Anotacion>) => Promise<void>;
  onArchive: (note: Anotacion) => Promise<void>;
  onDelete: (note: Anotacion) => Promise<void>;
}) {
  const [draft, setDraft] = useState(note);

  useEffect(() => {
    setDraft(note);
  }, [note]);

  return (
    <aside className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-md overflow-y-auto border-l border-white/15 bg-slate-950 p-5 text-white shadow-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Anotacion</h2>
          <p className="text-xs text-slate-400">
            Creada por {note.creatorName} · {formatDate(note.createdAt)}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded p-2 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Titulo</span>
          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            className="w-full rounded-md border border-white/15 bg-black/35 px-3 py-2 text-white outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Descripcion</span>
          <textarea
            value={draft.description}
            onChange={(event) =>
              setDraft({ ...draft, description: event.target.value })
            }
            className="h-28 w-full resize-none rounded-md border border-white/15 bg-black/35 px-3 py-2 text-white outline-none"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">Categoria</span>
            <input
              value={draft.category}
              onChange={(event) =>
                setDraft({ ...draft, category: event.target.value })
              }
              className="w-full rounded-md border border-white/15 bg-black/35 px-3 py-2 text-white outline-none"
            />
          </label>
          <div className="block text-sm">
            <span className="mb-1 block text-slate-300">Prioridad</span>
            <PrioritySelector
              value={draft.priority}
              onChange={(priority) => setDraft({ ...draft, priority })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">Estado</span>
            <select
              value={draft.status}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  status: event.target.value as AnotacionStatus,
                })
              }
              className="w-full rounded-md border border-white/15 bg-black/35 px-3 py-2 text-white outline-none"
            >
              {STATUS_OPTIONS.filter((option) => option.value !== "all").map(
                (option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">Recordatorio</span>
            <input
              type="datetime-local"
              value={toDatetimeLocalValue(draft.reminderAt)}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  reminderAt: fromDatetimeLocalValue(event.target.value) || "",
                })
              }
              className="w-full rounded-md border border-white/15 bg-black/35 px-3 py-2 text-white outline-none"
            />
          </label>
        </div>
        <div>
          <span className="mb-2 block text-sm text-slate-300">Color</span>
          <ColorSelector
            value={draft.color}
            onChange={(color) => setDraft({ ...draft, color })}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            const now = new Date().toISOString();
            const updates: Partial<Anotacion> = {
              ...draft,
              reminderAt: draft.reminderAt || "",
              doneAt:
                draft.status === "done"
                  ? draft.doneAt || note.doneAt || now
                  : "",
              archivedAt:
                draft.status === "archived"
                  ? draft.archivedAt || note.archivedAt || now
                  : "",
            };
            void onUpdate(note.id, updates);
          }}
          className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold hover:bg-indigo-400"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={() => void onArchive(note)}
          className="flex items-center gap-2 rounded-md border border-white/15 px-4 py-2 text-sm hover:bg-white/10"
        >
          <Archive className="h-4 w-4" />
          Archivar
        </button>
        <button
          type="button"
          onClick={() => void onDelete(note)}
          className="flex items-center gap-2 rounded-md border border-red-400/30 px-4 py-2 text-sm text-red-200 hover:bg-red-500/15"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar
        </button>
      </div>
    </aside>
  );
}
