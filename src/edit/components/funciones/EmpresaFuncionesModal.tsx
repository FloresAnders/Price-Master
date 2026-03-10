'use client';

import React from 'react';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, X } from 'lucide-react';

import ConfirmModal from '@/components/ui/ConfirmModal';
import {
  DELIFOOD_EMPRESA_ID,
  filterFuncionesGeneralesForEmpresa,
  FuncionesService,
  getFuncionIdLookupKeys,
  isDelifoodEmpresaId,
} from '@/services/funciones';

import type { FuncionListItem } from './RecetasListItems';

type EmpresaFuncionesModalProps = {
  open: boolean;
  empresaId: string;
  empresaNombre: string;
  ownerId: string;
  funcionesGenerales: FuncionListItem[];
  onClose: () => void;
  onSaved?: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
};

const AVAILABLE_ID = 'funciones-available';
const ASSIGNED_ID = 'funciones-assigned';

function DraggableFuncionItem({
  item,
  expanded,
  onToggleExpanded,
  showRemove,
  onRemove,
}: {
  item: FuncionListItem;
  expanded?: boolean;
  onToggleExpanded?: (id: string) => void;
  showRemove?: boolean;
  onRemove?: (item: FuncionListItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    // En mobile, evitamos bloquear scroll normal; al arrastrar, sí deshabilitamos gestos.
    touchAction: isDragging ? 'none' : 'manipulation',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-expanded={expanded ? 'true' : 'false'}
      onClick={() => {
        if (!item?.id) return;
        onToggleExpanded?.(String(item.id));
      }}
      onKeyDown={(e) => {
        if (!item?.id) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleExpanded?.(String(item.id));
        }
      }}
      className={
        'select-none cursor-pointer border border-[var(--input-border)] rounded-md px-3 py-2 bg-[var(--card-bg)] ' +
        (isDragging ? 'opacity-70' : 'opacity-100')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            className={
              'text-sm font-medium text-[var(--foreground)] ' +
              (expanded ? 'whitespace-normal break-words' : 'truncate')
            }
          >
            {item.nombre}
          </div>
          {item.descripcion ? (
            <div
              className={
                'text-[11px] text-[var(--muted-foreground)] ' +
                (expanded ? 'whitespace-pre-wrap break-words' : 'truncate')
              }
            >
              {item.descripcion}
            </div>
          ) : null}
        </div>

        {showRemove ? (
          <button
            type="button"
            className="shrink-0 p-1.5 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            aria-label={`Eliminar ${item.nombre}`}
            onPointerDown={(e) => {
              // Evitar que el click active drag
              e.stopPropagation();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.(item);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DroppableColumn({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-[var(--foreground)]">{title}</div>
      </div>
      <div
        ref={setNodeRef}
        className={
          'min-h-[180px] max-h-[60vh] overflow-auto rounded-lg border border-[var(--input-border)] p-2 bg-[var(--background)] transition-all duration-150 ease-out ' +
          (isOver
            ? 'ring-4 ring-[var(--primary)] bg-[var(--muted)] scale-[1.01]'
            : 'ring-0 scale-100')
        }
      >
        <div className="flex flex-col gap-2">{children}</div>
      </div>
    </div>
  );
}

const normalizeIdsKey = (ids: string[]) => JSON.stringify(Array.from(new Set(ids)).sort());

export default function EmpresaFuncionesModal({
  open,
  empresaId,
  empresaNombre,
  ownerId,
  funcionesGenerales,
  onClose,
  onSaved,
  showToast,
}: EmpresaFuncionesModalProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Long-press para iniciar drag en touch (permite scroll normal sin arrastre accidental)
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [assignedIds, setAssignedIds] = React.useState<string[]>([]);
  const [initialAssignedKey, setInitialAssignedKey] = React.useState<string>('[]');

  const [saveLoading, setSaveLoading] = React.useState(false);

  const [expandedIds, setExpandedIds] = React.useState<string[]>([]);

  const toggleExpanded = React.useCallback((id: string) => {
    const key = String(id || '').trim();
    if (!key) return;
    setExpandedIds((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setExpandedIds([]);
  }, [empresaId, open]);

  const [confirmExit, setConfirmExit] = React.useState(false);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createNombre, setCreateNombre] = React.useState('');
  const [createDescripcion, setCreateDescripcion] = React.useState('');
  const [createHasReminder, setCreateHasReminder] = React.useState(false);
  const [createReminderTimeCr, setCreateReminderTimeCr] = React.useState('');
  const [createLoading, setCreateLoading] = React.useState(false);

  const [localExtras, setLocalExtras] = React.useState<FuncionListItem[]>([]);

  const visibleFuncionesGenerales = React.useMemo(() => {
    const combined = [...(funcionesGenerales || []), ...(localExtras || [])];
    return filterFuncionesGeneralesForEmpresa(combined, {
      ownerId,
      empresaId,
    });
  }, [empresaId, funcionesGenerales, localExtras, ownerId]);

  const funcionesById = React.useMemo(() => {
    const map = new Map<string, FuncionListItem>();
    for (const f of visibleFuncionesGenerales || []) {
      if (!f?.id) continue;
      const baseId = String(f.id).trim();
      for (const key of getFuncionIdLookupKeys(baseId)) {
        if (!map.has(key)) map.set(key, f);
      }
    }
    return map;
  }, [visibleFuncionesGenerales]);

  const assignedItems = React.useMemo(() => {
    return assignedIds
      .map((id) => funcionesById.get(String(id)))
      .filter(Boolean) as FuncionListItem[];
  }, [assignedIds, funcionesById]);

  const availableItems = React.useMemo(() => {
    const assignedSet = new Set([...assignedIds].map(String));
    const items = (visibleFuncionesGenerales || []).filter((f) => f?.id && !assignedSet.has(String(f.id)));
    items.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
    return items;
  }, [assignedIds, visibleFuncionesGenerales]);

  const dirty = React.useMemo(() => {
    const current = normalizeIdsKey(assignedIds);
    return current !== initialAssignedKey;
  }, [assignedIds, initialAssignedKey]);

  const requestClose = React.useCallback(() => {
    if (dirty) {
      setConfirmExit(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, requestClose]);

  React.useEffect(() => {
    if (!open) return;
    if (!empresaId) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const doc = await FuncionesService.getEmpresaFunciones({ empresaId });
        const raw = Array.isArray((doc as any)?.funciones) ? (doc as any).funciones : [];
        const onlyKnown = (raw as unknown[])
          .map((x) => String(x))
          .filter((id) => funcionesById.has(String(id)));

        const unique = Array.from(new Set(onlyKnown));
        if (cancelled) return;
        setAssignedIds(unique);
        setInitialAssignedKey(normalizeIdsKey(unique));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudieron cargar las funciones de la empresa.';
        if (!cancelled) {
          setError(msg);
          setAssignedIds([]);
          setInitialAssignedKey('[]');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [empresaId, funcionesById, open]);

  const onDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const funcionId = String(active.id);
    const overId = String(over.id);

    if (overId === AVAILABLE_ID) {
      setAssignedIds((prev) => prev.filter((x) => String(x) !== funcionId));
      return;
    }

    if (overId === ASSIGNED_ID) {
      setAssignedIds((prev) => {
        if (prev.includes(funcionId)) return prev;
        return [...prev, funcionId];
      });
    }
  }, []);

  const handleSave = React.useCallback(() => {
    if (!empresaId || !ownerId) return;

    const run = async () => {
      setSaveLoading(true);
      try {
        await FuncionesService.upsertEmpresaFunciones({
          ownerId,
          empresaId,
          funciones: assignedIds.filter((id) => funcionesById.has(String(id))),
        });

        setInitialAssignedKey(normalizeIdsKey(assignedIds));
        showToast('Funciones guardadas.', 'success');
        onSaved?.();
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudieron guardar las funciones.';
        showToast(msg, 'error');
      } finally {
        setSaveLoading(false);
      }
    };

    void run();
  }, [assignedIds, empresaId, funcionesById, onClose, onSaved, ownerId, showToast]);

  const handleCreateExclusive = React.useCallback(() => {
    const nombre = String(createNombre || '').trim();
    const descripcion = String(createDescripcion || '').trim();
    if (!nombre) {
      showToast('Nombre requerido.', 'error');
      return;
    }

    const reminderTimeCr = createHasReminder ? String(createReminderTimeCr || '').trim() : '';
    if (createHasReminder) {
      if (!reminderTimeCr) {
        showToast('Selecciona una hora para el recordatorio.', 'error');
        return;
      }
      if (!/^\d{2}:\d{2}$/.test(reminderTimeCr)) {
        showToast('Hora de recordatorio inválida (usa HH:mm).', 'error');
        return;
      }
    }

    if (!ownerId) {
      showToast('ownerId requerido.', 'error');
      return;
    }
    if (!empresaId) {
      showToast('Empresa inválida.', 'error');
      return;
    }

    const run = async () => {
      setCreateLoading(true);
      try {
        const funcionId = await FuncionesService.getNextNumericFuncionId({ ownerId, padLength: 4 });

        const audience = isDelifoodEmpresaId(empresaId) ? 'DELIFOOD' : 'DELIKOR';
        const empresaIds = audience === 'DELIKOR' ? [String(empresaId).trim()] : [];

        const saved = await FuncionesService.upsertFuncionGeneral({
          ownerId,
          funcionId,
          nombre,
          descripcion,
          reminderTimeCr: createHasReminder ? reminderTimeCr : undefined,
          audience,
          empresaIds,
          createdAt: new Date().toISOString(),
        });

        const nextItem: FuncionListItem = {
          id: String(saved.funcionId),
          docId: String(saved.docId),
          ownerId: String(saved.ownerId),
          nombre: String(saved.nombre),
          descripcion: String(saved.descripcion || ''),
          reminderTimeCr: saved.reminderTimeCr ? String(saved.reminderTimeCr) : '',
          createdAt: String(saved.createdAt || ''),
          audience: String(saved.audience || '').toUpperCase() === 'DELIFOOD' ? 'DELIFOOD' : 'DELIKOR',
          empresaIds: Array.isArray(saved.empresaIds) ? saved.empresaIds.map((x) => String(x)) : [],
        };

        // Add locally and persist the assignment immediately for this empresa.
        setLocalExtras((prev) => [nextItem, ...(prev || [])]);

        const nextAssigned = Array.from(new Set([...assignedIds.map(String), nextItem.id]));
        await FuncionesService.upsertEmpresaFunciones({
          ownerId,
          empresaId,
          funciones: nextAssigned,
        });

        setAssignedIds(nextAssigned);
        setInitialAssignedKey(normalizeIdsKey(nextAssigned));
        setCreateNombre('');
        setCreateDescripcion('');
        setCreateHasReminder(false);
        setCreateReminderTimeCr('');
        setCreateOpen(false);
        showToast('Función creada para esta empresa.', 'success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo crear la función.';
        showToast(msg, 'error');
      } finally {
        setCreateLoading(false);
      }
    };

    void run();
  }, [assignedIds, createDescripcion, createHasReminder, createNombre, createReminderTimeCr, empresaId, ownerId, showToast]);

  const [removeConfirm, setRemoveConfirm] = React.useState<{
    open: boolean;
    item?: FuncionListItem;
  }>({ open: false });

  const requestRemoveAssigned = React.useCallback((item: FuncionListItem) => {
    if (!item?.id) return;
    setRemoveConfirm({ open: true, item });
  }, []);

  const confirmRemoveAssigned = React.useCallback(() => {
    const id = String(removeConfirm.item?.id || '').trim();
    if (!id) {
      setRemoveConfirm({ open: false });
      return;
    }

    const removalKeys = new Set(getFuncionIdLookupKeys(id));
    removalKeys.add(id);
    setAssignedIds((prev) => prev.filter((x) => !removalKeys.has(String(x).trim())));
    setRemoveConfirm({ open: false });
  }, [removeConfirm.item?.id]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 p-3"
      role="dialog"
      aria-modal="true"
      aria-label={`Funciones por empresa: ${empresaNombre}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-5xl bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--input-border)]">
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-semibold text-[var(--foreground)] truncate">
              {empresaNombre}
            </div>
            <div className="text-xs text-[var(--muted-foreground)] truncate">
              Asigna funciones a esta empresa
            </div>
          </div>

          <button
            type="button"
            onClick={requestClose}
            className="p-2 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-4">
          {error ? <div className="mb-3 text-sm text-red-500">{error}</div> : null}

          <div className="mb-4 border border-[var(--input-border)] rounded-lg p-3 bg-[var(--background)]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[var(--foreground)]">Función exclusiva</div>
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded border border-[var(--input-border)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                onClick={() => setCreateOpen((v) => !v)}
                disabled={createLoading}
              >
                {createOpen ? 'Cerrar' : 'Agregar'}
              </button>
            </div>

            {createOpen ? (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    className="w-full p-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
                    placeholder="Nombre"
                    value={createNombre}
                    onChange={(e) => setCreateNombre(e.target.value)}
                  />
                  <input
                    className="w-full p-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
                    placeholder="Descripción (opcional)"
                    value={createDescripcion}
                    onChange={(e) => setCreateDescripcion(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleCreateExclusive}
                    className="px-4 py-2 bg-[var(--accent)] text-white rounded disabled:opacity-60"
                    disabled={createLoading}
                  >
                    {createLoading ? 'Creando…' : 'Crear y asignar'}
                  </button>
                </div>

                <label className="flex items-center gap-2 text-sm text-[var(--foreground)] select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={createHasReminder}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setCreateHasReminder(next);
                      if (!next) setCreateReminderTimeCr('');
                    }}
                    disabled={createLoading}
                  />
                  Agregar recordatorio
                </label>

                {createHasReminder ? (
                  <div className="max-w-xs">
                    <label className="block text-xs text-[var(--muted-foreground)] mb-1">Hora (Costa Rica)</label>
                    <input
                      type="time"
                      step={60}
                      className="w-full p-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
                      value={createReminderTimeCr}
                      onChange={(e) => setCreateReminderTimeCr(e.target.value)}
                      disabled={createLoading}
                    />
                  </div>
                ) : null}

                <div className="text-[11px] text-[var(--muted-foreground)]">
                  {isDelifoodEmpresaId(empresaId)
                    ? `Se creará como ${DELIFOOD_EMPRESA_ID}.`
                    : 'Se creará solo para esta empresa.'}
                </div>
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="text-sm text-[var(--muted-foreground)]">Cargando…</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DroppableColumn id={AVAILABLE_ID} title={`Disponibles (${availableItems.length})`}>
                  {availableItems.length === 0 ? (
                    <div className="text-xs text-[var(--muted-foreground)] p-2">No hay funciones disponibles.</div>
                  ) : (
                    availableItems.map((item) => (
                      <DraggableFuncionItem
                        key={item.id}
                        item={item}
                        expanded={expandedIds.includes(String(item.id))}
                        onToggleExpanded={toggleExpanded}
                      />
                    ))
                  )}
                </DroppableColumn>

                <DroppableColumn id={ASSIGNED_ID} title={`Asignadas (${assignedItems.length})`}>
                  {assignedItems.length === 0 ? (
                    <div className="text-xs text-[var(--muted-foreground)] p-2">Arrastra funciones aquí.</div>
                  ) : (
                    assignedItems.map((item) => (
                      <DraggableFuncionItem
                        key={item.id}
                        item={item}
                        expanded={expandedIds.includes(String(item.id))}
                        onToggleExpanded={toggleExpanded}
                        showRemove
                        onRemove={requestRemoveAssigned}
                      />
                    ))
                  )}
                </DroppableColumn>
              </div>
            </DndContext>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--input-border)]">
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded disabled:opacity-60"
            disabled={saveLoading || loading}
          >
            {saveLoading ? 'Guardando…' : 'Guardar y cerrar'}
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmExit}
        title="Salir sin guardar"
        message="Hay cambios sin guardar. ¿Quieres salir sin guardar?"
        confirmText="Salir"
        cancelText="Seguir editando"
        actionType="change"
        loading={false}
        onConfirm={() => {
          setConfirmExit(false);
          onClose();
        }}
        onCancel={() => setConfirmExit(false)}
      />

      <ConfirmModal
        open={removeConfirm.open}
        title="Descartar función"
        message={`¿Quieres quitar la función "${String(removeConfirm.item?.nombre || '')}" de esta empresa?`}
        confirmText="Quitar"
        cancelText="Cancelar"
        actionType="delete"
        loading={false}
        onConfirm={confirmRemoveAssigned}
        onCancel={() => setRemoveConfirm({ open: false })}
      />
    </div>
  );
}
