"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EyeOff,
  Monitor,
  Play,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
} from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { SeasonalEffectsView } from "@/components/celebraciones/components/SeasonalEffectsHost";
import {
  DEFAULT_SEASONAL_EFFECTS_SETTINGS,
  FESTIVITY_DEFINITIONS,
  MAX_FESTIVITY_MESSAGE_LENGTH,
  MAX_FESTIVITY_OFFSET_DAYS,
  MAX_FESTIVITY_PRIORITY,
  MAX_FESTIVITY_TITLE_LENGTH,
  MIN_FESTIVITY_OFFSET_DAYS,
  MIN_FESTIVITY_PRIORITY,
  validateSeasonalEffectsSettings,
} from "@/components/celebraciones/config/festivities";
import { useSeasonalEffects } from "@/components/celebraciones/SeasonalEffectsContext";
import type {
  FestivityConfig,
  FestivityId,
  SeasonalEffectsSettings,
} from "@/components/celebraciones/types";
import { useAuth } from "@/hooks/useAuth";
import useToast from "@/hooks/useToast";
import SeasonalEffectsCelebrationCard, {
  ToggleSwitch,
} from "./SeasonalEffectsCelebrationCard";

const cloneSettings = (settings: SeasonalEffectsSettings): SeasonalEffectsSettings => ({
  ...settings,
  festivities: settings.festivities.map((item) => ({ ...item })),
});

export default function SeasonalEffectsEditorSection() {
  const { user } = useAuth();
  const {
    settings,
    loading,
    error,
    previewId,
    setPreviewId,
    saveSettings,
  } = useSeasonalEffects();
  const { showToast } = useToast();
  const [draft, setDraft] = useState(() => cloneSettings(settings));
  const [selectedId, setSelectedId] = useState<FestivityId>("new-year");
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setDraft(cloneSettings(settings));
  }, [settings]);

  const selected = draft.festivities.find((item) => item.id === selectedId) as
    | FestivityConfig
    | undefined;
  const selectedDefinition = FESTIVITY_DEFINITIONS.find((item) => item.id === selectedId);
  const validationErrors = useMemo(
    () => validateSeasonalEffectsSettings(draft),
    [draft],
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  if (user?.role !== "superadmin") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-700 dark:text-red-300">
        Solo SuperAdmin puede administrar las celebraciones.
      </div>
    );
  }

  const updateFestivity = (
    id: FestivityId,
    update: Partial<FestivityConfig>,
  ) => {
    setDraft((current) => ({
      ...current,
      festivities: current.festivities.map((item) =>
        item.id === id ? { ...item, ...update } : item,
      ),
    }));
  };

  const persist = async (next: SeasonalEffectsSettings, message: string) => {
    setSaving(true);
    try {
      await saveSettings(next);
      showToast(message, "success");
    } catch (saveError) {
      console.error("No se pudo guardar la configuración de celebraciones", saveError);
      showToast(
        saveError instanceof Error ? saveError.message : "No se pudo guardar",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    const next = cloneSettings(DEFAULT_SEASONAL_EFFECTS_SETTINGS);
    setDraft(next);
    setPreviewId(null);
    setConfirmReset(false);
    void persist(next, "Celebraciones restablecidas");
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h4 className="text-lg font-semibold text-[var(--foreground)]">
              Celebraciones de TimeMaster
            </h4>
          </div>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Fechas calculadas en hora de Costa Rica. Septiembre permanece reservado
            al tema patrio existente.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-right">
            <span className="block font-semibold text-[var(--foreground)]">
              Efectos globales
            </span>
            <span className="block text-xs text-[var(--muted-foreground)]">
              {draft.enabled ? "Activos" : "Apagados"}
            </span>
          </span>
          <ToggleSwitch
            checked={draft.enabled}
            onCheckedChange={(enabled) =>
              setDraft((current) => ({ ...current, enabled }))
            }
            label="Activar efectos globales"
          />
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {FESTIVITY_DEFINITIONS.map((definition) => {
          const config = draft.festivities.find((item) => item.id === definition.id);
          if (!config) return null;
          return (
            <SeasonalEffectsCelebrationCard
              key={definition.id}
              config={config}
              dateLabel={definition.dateLabel}
              selected={definition.id === selectedId}
              onSelect={() => setSelectedId(definition.id)}
              onEnabledChange={(enabled) =>
                updateFestivity(config.id, { enabled })
              }
            />
          );
        })}
      </div>

      {selected ? (
        <article className="rounded-2xl bg-[var(--card-bg)] p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h5 className="font-semibold text-[var(--foreground)]">
                Editar {selected.title}
              </h5>
              <p className="text-xs text-[var(--muted-foreground)]">
                {selectedDefinition?.dateLabel} · {selectedDefinition?.palette}
              </p>
            </div>
            <span className="rounded-full bg-[var(--hover-bg)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)]">
              {selected.enabled ? "Habilitada" : "Deshabilitada"}
            </span>
          </div>

          <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">
                  Título
                  <input
                    value={selected.title}
                    maxLength={MAX_FESTIVITY_TITLE_LENGTH}
                    onChange={(event) =>
                      updateFestivity(selected.id, { title: event.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-3 py-2"
                  />
                </label>
                <label className="text-sm font-medium md:row-span-2">
                  Descripción del banner
                  <textarea
                    value={selected.message}
                    maxLength={MAX_FESTIVITY_MESSAGE_LENGTH}
                    rows={4}
                    onChange={(event) =>
                      updateFestivity(selected.id, { message: event.target.value })
                    }
                    className="mt-1 w-full resize-y rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-3 py-2"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm font-medium">
                  Mostrar banner informativo
                  <ToggleSwitch
                    checked={selected.showBanner}
                    onCheckedChange={(showBanner) =>
                      updateFestivity(selected.id, { showBanner })
                    }
                    label="Mostrar banner informativo"
                  />
                </label>
              </div>

              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Configuración
                </legend>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-sm font-medium">
                    Intensidad
                    <select
                      value={selected.intensity}
                      onChange={(event) =>
                        updateFestivity(selected.id, {
                          intensity: event.target.value as FestivityConfig["intensity"],
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-3 py-2"
                    >
                      <option value="off">Sin animación</option>
                      <option value="subtle">Sutil</option>
                      <option value="normal">Normal</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Prioridad
                    <input
                      type="number"
                      min={MIN_FESTIVITY_PRIORITY}
                      max={MAX_FESTIVITY_PRIORITY}
                      value={selected.priority}
                      onChange={(event) =>
                        updateFestivity(selected.id, {
                          priority: Number(event.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-3 py-2"
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Inicio relativo
                    <input
                      type="number"
                      min={MIN_FESTIVITY_OFFSET_DAYS}
                      max={MAX_FESTIVITY_OFFSET_DAYS}
                      value={selected.startOffsetDays}
                      onChange={(event) =>
                        updateFestivity(selected.id, {
                          startOffsetDays: Number(event.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-3 py-2"
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Fin relativo
                    <input
                      type="number"
                      min={MIN_FESTIVITY_OFFSET_DAYS}
                      max={MAX_FESTIVITY_OFFSET_DAYS}
                      value={selected.endOffsetDays}
                      onChange={(event) =>
                        updateFestivity(selected.id, {
                          endOffsetDays: Number(event.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-3 py-2"
                    />
                  </label>
                </div>
              </fieldset>
            </div>

            <aside className="rounded-xl bg-[var(--background)] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Vista previa
                </p>
                <div className="flex rounded-lg bg-[var(--hover-bg)] p-1">
                  <button
                    type="button"
                    aria-label="Vista previa de escritorio"
                    aria-pressed={previewViewport === "desktop"}
                    onClick={() => setPreviewViewport("desktop")}
                    className={`rounded-md p-1.5 ${
                      previewViewport === "desktop"
                        ? "bg-blue-600 text-white"
                        : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    <Monitor className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Vista previa móvil"
                    aria-pressed={previewViewport === "mobile"}
                    onClick={() => setPreviewViewport("mobile")}
                    className={`rounded-md p-1.5 ${
                      previewViewport === "mobile"
                        ? "bg-blue-600 text-white"
                        : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    <Smartphone className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div
                className={
                  previewViewport === "mobile"
                    ? "mx-auto max-w-[360px] rounded-[22px] border-4 border-slate-700 p-1"
                    : "w-full"
                }
              >
                <SeasonalEffectsView
                  settings={draft}
                  now={new Date()}
                  previewId={selected.id}
                  previewMode
                  animationEnabled={false}
                />
              </div>
            </aside>
          </div>
        </article>
      ) : null}

      {validationErrors.length > 0 ? (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          {validationErrors.join(" ")}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setPreviewId(previewId ? null : selectedId)}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--hover-bg)]"
        >
          {previewId ? <EyeOff className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {previewId ? "Detener prueba" : "Probar ahora"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--hover-bg)] disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" /> Restablecer
        </button>
        <button
          type="button"
          onClick={() => void persist(draft, "Celebraciones guardadas")}
          disabled={saving || loading || !dirty || validationErrors.length > 0}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      <ConfirmModal
        open={confirmReset}
        title="Restablecer celebraciones"
        message="Se restaurarán las 12 celebraciones y el interruptor global quedará apagado."
        confirmText="Sí, restablecer"
        actionType="change"
        loading={saving}
        onCancel={() => setConfirmReset(false)}
        onConfirm={resetDefaults}
      />
    </section>
  );
}
