"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, Edit3, Loader2, Megaphone, Plus, Power, Trash2 } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import AnnouncementBanner from "@/components/announcements/AnnouncementBanner";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useAuth } from "@/hooks/useAuth";
import useToast from "@/hooks/useToast";
import {
  announcementToDraft,
  draftToTimestamps,
  formatCostaRicaDateTime,
  getNextAnnouncementBoundary,
  validateAnnouncementDraft,
  type AnnouncementDraft,
  type PublishedSystemAnnouncement,
  type SystemAnnouncement,
} from "@/lib/system-announcements";
import {
  deleteSystemAnnouncement,
  saveSystemAnnouncement,
  subscribeToSystemAnnouncements,
} from "@/services/system-announcements";

const TYPE_LABELS: Record<AnnouncementDraft["type"], string> = {
  info: "Información",
  maintenance: "Mantenimiento",
  warning: "Advertencia",
  new_feature: "Nueva función",
};

function statusFor(announcement: SystemAnnouncement, now: Date) {
  if (announcement.archived) return { label: "Archivado", style: "bg-slate-500/15 text-slate-500" };
  if (!announcement.active) return { label: "Desactivado", style: "bg-slate-500/15 text-slate-500" };
  if (announcement.startsAt && announcement.startsAt.toMillis() > now.getTime()) {
    return { label: "Programado", style: "bg-blue-500/15 text-blue-600 dark:text-blue-300" };
  }
  if (announcement.endsAt && announcement.endsAt.toMillis() <= now.getTime()) {
    return { label: "Vencido", style: "bg-amber-500/15 text-amber-700 dark:text-amber-300" };
  }
  return { label: "Vigente", style: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" };
}

export default function AnnouncementsEditorSection() {
  const { user, firebaseAuthReady } = useAuth();
  const { showToast } = useToast();
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<SystemAnnouncement | null>(null);
  const [draft, setDraft] = useState<AnnouncementDraft | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateAnnouncementDraft>>({});
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SystemAnnouncement | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (user?.role !== "superadmin") {
      setLoading(false);
      return;
    }
    if (!firebaseAuthReady) return;
    return subscribeToSystemAnnouncements(
      (items) => {
        setAnnouncements(items);
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.error("No se pudieron sincronizar los anuncios", snapshotError);
        setError("No se pudieron sincronizar los anuncios.");
        setLoading(false);
      },
    );
  }, [firebaseAuthReady, user?.role]);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    const boundary = getNextAnnouncementBoundary(announcements, new Date(now));
    const timer = boundary === null
      ? null
      : window.setTimeout(refresh, Math.min(2_147_000_000, Math.max(0, boundary - Date.now() + 25)));
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [announcements, now]);

  const sortedAnnouncements = useMemo(
    () =>
      [...announcements].sort((left, right) => {
        if (left.archived !== right.archived) return left.archived ? 1 : -1;
        if (left.priority !== right.priority) return right.priority - left.priority;
        const rightUpdatedAt = right.updatedAt?.toMillis?.() ?? 0;
        const leftUpdatedAt = left.updatedAt?.toMillis?.() ?? 0;
        return rightUpdatedAt - leftUpdatedAt;
      }),
    [announcements],
  );

  if (user?.role !== "superadmin") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-700 dark:text-red-300">
        Solo Superadmin puede administrar anuncios.
      </div>
    );
  }

  const openEditor = (announcement?: SystemAnnouncement) => {
    setEditing(announcement || null);
    setDraft(announcementToDraft(announcement));
    setErrors({});
  };

  const closeEditor = () => {
    if (saving) return;
    setEditing(null);
    setDraft(null);
    setErrors({});
  };

  const saveDraft = async () => {
    if (!draft) return;
    const nextErrors = validateAnnouncementDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const actorUid = String(user.id || "").trim();
    if (!actorUid) {
      showToast("No se pudo identificar la sesión de Superadmin", "error");
      return;
    }
    setSaving(true);
    try {
      await saveSystemAnnouncement({ draft, actorUid, existing: editing });
      showToast(editing ? "Anuncio actualizado" : "Anuncio creado", "success");
      closeEditor();
    } catch (saveError) {
      console.error("No se pudo guardar el anuncio", saveError);
      showToast(
        saveError instanceof Error ? saveError.message : "No se pudo guardar el anuncio",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateAnnouncementState = async (
    announcement: SystemAnnouncement,
    changes: Partial<AnnouncementDraft>,
    successMessage: string,
  ) => {
    const actorUid = String(user.id || "").trim();
    if (!actorUid) return;
    setSaving(true);
    try {
      await saveSystemAnnouncement({
        existing: announcement,
        actorUid,
        draft: { ...announcementToDraft(announcement), ...changes },
      });
      showToast(successMessage, "success");
    } catch (stateError) {
      console.error("No se pudo cambiar el estado del anuncio", stateError);
      showToast("No se pudo cambiar el estado del anuncio", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await deleteSystemAnnouncement(pendingDelete.id);
      showToast("Anuncio eliminado", "success");
      setPendingDelete(null);
    } catch (deleteError) {
      console.error("No se pudo eliminar el anuncio", deleteError);
      showToast("No se pudo eliminar el anuncio", "error");
    } finally {
      setSaving(false);
    }
  };

  const preview: PublishedSystemAnnouncement | null = draft
    ? {
        id: editing?.id || "preview",
        title: draft.title.trim() || "Título del anuncio",
        detail: draft.detail.trim() || "Detalle del anuncio",
        type: draft.type,
        ...draftToTimestamps(draft),
        allowDismiss: draft.allowDismiss,
        priority: draft.priority,
        scope: "global",
        version: editing?.version || 1,
        publishedAt: Timestamp.now(),
      }
    : null;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-[var(--foreground)]">Anuncios del sistema</h4>
          <p className="text-sm text-[var(--muted-foreground)]">
            Publica mensajes globales en el encabezado sin desplegar código.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openEditor()}
          disabled={!firebaseAuthReady}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Nuevo anuncio
        </button>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          {error} El resto de TimeMaster sigue disponible.
        </div>
      ) : null}

      {draft && preview ? (
        <div className="rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] p-5">
          <div className="mb-5 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-blue-500" />
            <h5 className="font-semibold text-[var(--foreground)]">
              {editing ? "Editar anuncio" : "Nuevo anuncio"}
            </h5>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-medium text-[var(--foreground)]">
              Título
              <input
                value={draft.title}
                maxLength={100}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                className="mt-1 w-full rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-3 py-2"
              />
              {errors.title ? <span className="mt-1 block text-xs text-red-500">{errors.title}</span> : null}
            </label>
            <label className="text-sm font-medium text-[var(--foreground)]">
              Tipo
              <select
                value={draft.type}
                onChange={(event) => setDraft({ ...draft, type: event.target.value as AnnouncementDraft["type"] })}
                className="mt-1 w-full rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-3 py-2"
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-[var(--foreground)] lg:col-span-2">
              Detalle
              <textarea
                value={draft.detail}
                maxLength={300}
                rows={3}
                onChange={(event) => setDraft({ ...draft, detail: event.target.value })}
                className="mt-1 w-full resize-y rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-3 py-2"
              />
              {errors.detail ? <span className="mt-1 block text-xs text-red-500">{errors.detail}</span> : null}
            </label>
            <label className="text-sm font-medium text-[var(--foreground)]">
              Publicar desde (hora Costa Rica)
              <input
                type="datetime-local"
                value={draft.startsAtLocal}
                onChange={(event) => setDraft({ ...draft, startsAtLocal: event.target.value })}
                className="mt-1 w-full rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-3 py-2"
              />
              {errors.startsAtLocal ? <span className="mt-1 block text-xs text-red-500">{errors.startsAtLocal}</span> : null}
            </label>
            <label className="text-sm font-medium text-[var(--foreground)]">
              Finaliza (hora Costa Rica)
              <input
                type="datetime-local"
                value={draft.endsAtLocal}
                onChange={(event) => setDraft({ ...draft, endsAtLocal: event.target.value })}
                className="mt-1 w-full rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-3 py-2"
              />
              {errors.endsAtLocal ? <span className="mt-1 block text-xs text-red-500">{errors.endsAtLocal}</span> : null}
            </label>
            <label className="text-sm font-medium text-[var(--foreground)]">
              Prioridad
              <input
                type="number"
                min={-1000}
                max={1000}
                step={1}
                value={draft.priority}
                onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })}
                className="mt-1 w-full rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-3 py-2"
              />
              {errors.priority ? <span className="mt-1 block text-xs text-red-500">{errors.priority}</span> : null}
            </label>
            <div className="flex flex-wrap items-end gap-5 pb-2 text-sm text-[var(--foreground)]">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
                Activo
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.allowDismiss} onChange={(event) => setDraft({ ...draft, allowDismiss: event.target.checked })} />
                Permitir cerrar
              </label>
            </div>
          </div>

          <div className="mt-5 space-y-3 rounded-xl border border-[var(--input-border)] bg-[var(--background)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Vista previa</p>
            <div>
              <span className="mb-1 block text-xs text-[var(--muted-foreground)]">Escritorio</span>
              <AnnouncementBanner announcement={preview} preview />
            </div>
            <div className="max-w-[360px]">
              <span className="mb-1 block text-xs text-[var(--muted-foreground)]">Móvil</span>
              <AnnouncementBanner announcement={preview} preview />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={closeEditor} disabled={saving} className="rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--hover-bg)] disabled:opacity-50">
              Cancelar
            </button>
            <button type="button" onClick={() => void saveDraft()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Guardar
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--input-border)] p-8 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando anuncios…
        </div>
      ) : sortedAnnouncements.length === 0 ? (
        <div className="rounded-2xl border border-[var(--input-border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
          No hay anuncios creados.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedAnnouncements.map((announcement) => {
            const status = statusFor(announcement, new Date(now));
            return (
              <article key={announcement.id} className="rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="font-semibold text-[var(--foreground)]">{announcement.title}</h5>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.style}`}>{status.label}</span>
                      <span className="rounded-full bg-[var(--hover-bg)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">Prioridad {announcement.priority}</span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">{announcement.detail}</p>
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                      {formatCostaRicaDateTime(announcement.startsAt)} → {formatCostaRicaDateTime(announcement.endsAt)} · {TYPE_LABELS[announcement.type]}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => openEditor(announcement)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--input-border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)]">
                      <Edit3 className="h-4 w-4" /> Editar
                    </button>
                    {!announcement.archived ? (
                      <button type="button" disabled={saving} onClick={() => void updateAnnouncementState(announcement, { active: !announcement.active }, announcement.active ? "Anuncio desactivado" : "Anuncio activado")} className="inline-flex items-center gap-2 rounded-lg border border-[var(--input-border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)] disabled:opacity-50">
                        <Power className="h-4 w-4" /> {announcement.active ? "Desactivar" : "Activar"}
                      </button>
                    ) : null}
                    {!announcement.archived ? (
                      <button type="button" disabled={saving} onClick={() => void updateAnnouncementState(announcement, { active: false, archived: true }, "Anuncio archivado")} className="inline-flex items-center gap-2 rounded-lg border border-[var(--input-border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)] disabled:opacity-50">
                        <Archive className="h-4 w-4" /> Archivar
                      </button>
                    ) : null}
                    <button type="button" disabled={saving} onClick={() => setPendingDelete(announcement)} className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-50">
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={pendingDelete !== null}
        title="Eliminar anuncio"
        message={`Se eliminará permanentemente “${pendingDelete?.title || "este anuncio"}”.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        loading={saving}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
        actionType="delete"
      />
    </section>
  );
}
