'use client';

import React from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { X } from 'lucide-react';

import ConfirmModal from '@/components/ui/ConfirmModal';
import { FuncionesService } from '@/services/funciones';

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

function DraggableFuncionItem({ item }: { item: FuncionListItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={
        'select-none border border-[var(--input-border)] rounded-md px-3 py-2 bg-[var(--card-bg)] ' +
        (isDragging ? 'opacity-70' : 'opacity-100')
      }
    >
      <div className="text-sm font-medium text-[var(--foreground)] truncate">{item.nombre}</div>
      {item.descripcion ? (
        <div className="text-[11px] text-[var(--muted-foreground)] truncate">{item.descripcion}</div>
      ) : null}
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
          'min-h-[320px] max-h-[60vh] overflow-auto rounded-lg border border-[var(--input-border)] p-2 bg-[var(--background)] ' +
          (isOver ? 'ring-2 ring-[var(--primary)]' : '')
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [assignedIds, setAssignedIds] = React.useState<string[]>([]);
  const [initialAssignedKey, setInitialAssignedKey] = React.useState<string>('[]');

  const [saveLoading, setSaveLoading] = React.useState(false);

  const [confirmExit, setConfirmExit] = React.useState(false);

  const funcionesById = React.useMemo(() => {
    const map = new Map<string, FuncionListItem>();
    for (const f of funcionesGenerales || []) {
      if (f?.id) map.set(String(f.id), f);
    }
    return map;
  }, [funcionesGenerales]);

  const assignedItems = React.useMemo(() => {
    return assignedIds
      .map((id) => funcionesById.get(String(id)))
      .filter(Boolean) as FuncionListItem[];
  }, [assignedIds, funcionesById]);

  const availableItems = React.useMemo(() => {
    const assignedSet = new Set(assignedIds.map(String));
    const items = (funcionesGenerales || []).filter((f) => f?.id && !assignedSet.has(String(f.id)));
    items.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
    return items;
  }, [assignedIds, funcionesGenerales]);

  const dirty = React.useMemo(() => {
    const currentKey = normalizeIdsKey(assignedIds);
    return currentKey !== initialAssignedKey;
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
        const current = Array.isArray(doc?.funciones) ? doc!.funciones.map((x) => String(x)) : [];
        const onlyKnown = current.filter((id) => funcionesById.has(String(id)));
        if (cancelled) return;
        setAssignedIds(onlyKnown);
        setInitialAssignedKey(normalizeIdsKey(onlyKnown));
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

  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const funcionId = String(active.id);
      const overId = String(over.id);

      if (overId === ASSIGNED_ID) {
        setAssignedIds((prev) => {
          if (prev.includes(funcionId)) return prev;
          return [...prev, funcionId];
        });
        return;
      }

      if (overId === AVAILABLE_ID) {
        setAssignedIds((prev) => prev.filter((x) => String(x) !== funcionId));
      }
    },
    []
  );

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

        const nextKey = normalizeIdsKey(assignedIds);
        setInitialAssignedKey(nextKey);
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
              Asigna funciones generales a esta empresa
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

          {loading ? (
            <div className="text-sm text-[var(--muted-foreground)]">Cargando…</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DroppableColumn id={AVAILABLE_ID} title={`Funciones generales (${availableItems.length})`}>
                  {availableItems.length === 0 ? (
                    <div className="text-xs text-[var(--muted-foreground)] p-2">No hay funciones disponibles.</div>
                  ) : (
                    availableItems.map((item) => <DraggableFuncionItem key={item.id} item={item} />)
                  )}
                </DroppableColumn>

                <DroppableColumn id={ASSIGNED_ID} title={`Asignadas a ${empresaNombre} (${assignedItems.length})`}>
                  {assignedItems.length === 0 ? (
                    <div className="text-xs text-[var(--muted-foreground)] p-2">Arrastra funciones aquí.</div>
                  ) : (
                    assignedItems.map((item) => <DraggableFuncionItem key={item.id} item={item} />)
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
    </div>
  );
}
