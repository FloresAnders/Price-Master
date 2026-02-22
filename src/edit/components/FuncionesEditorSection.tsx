'use client';

import React from 'react';
import { EmpresasService } from '../../services/empresas';
import { FuncionesService } from '../../services/funciones';
import { useAuth } from '../../hooks/useAuth';
import { useActorOwnership } from '../../hooks/useActorOwnership';
import useToast from '../../hooks/useToast';
import type { Empresas } from '../../types/firestore';

import { EmpresaSearchAddSection } from '@/components/recetas/component/EmpresaSearchAddSection';
import { Paginacion } from '@/components/recetas/component/Paginacion';
import { RecetasListContent } from './funciones/RecetasListContent';
import type { FuncionListItem } from './funciones/RecetasListItems';
import { RightDrawer } from '@/components/ui/RightDrawer';
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function FuncionesEditorSection() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { ownerIds: actorOwnerIds, primaryOwnerId } = useActorOwnership(currentUser);
  const { showToast } = useToast();

  const [ownerEmpresas, setOwnerEmpresas] = React.useState<Empresas[]>([]);
  const [ownerEmpresasLoading, setOwnerEmpresasLoading] = React.useState(false);
  const [ownerEmpresasError, setOwnerEmpresasError] = React.useState<string | null>(null);

  const isAdminLike = Boolean(currentUser && currentUser.role !== 'user');

  const [selectedEmpresa, setSelectedEmpresa] = React.useState('');
  const [searchValue, setSearchValue] = React.useState('');

  // Lista de funciones generales (UI-only por ahora)
  const [recetasListItems, setRecetasListItems] = React.useState<FuncionListItem[]>([]);
  const [funcionesLoading, setFuncionesLoading] = React.useState(false);
  const [funcionesError, setFuncionesError] = React.useState<string | null>(null);
  const [itemsPerPage, setItemsPerPage] = React.useState<number | 'all'>(10);
  const [currentPage, setCurrentPage] = React.useState(1);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draftNombre, setDraftNombre] = React.useState('');
  const [draftDescripcion, setDraftDescripcion] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);

  const [confirmState, setConfirmState] = React.useState<{ open: boolean; id: string; nombre: string }>({
    open: false,
    id: '',
    nombre: '',
  });

  const debouncedSearch = searchValue.trim().toLowerCase();
  const filteredFunciones = React.useMemo(() => {
    if (!debouncedSearch) return recetasListItems;
    return recetasListItems.filter((item) => {
      const nombre = String(item?.nombre || '').toLowerCase();
      const descripcion = String(item?.descripcion || '').toLowerCase();
      return nombre.includes(debouncedSearch) || descripcion.includes(debouncedSearch);
    });
  }, [debouncedSearch, recetasListItems]);

  const totalPages = React.useMemo(() => {
    if (itemsPerPage === 'all') return 1;
    return Math.max(1, Math.ceil(filteredFunciones.length / itemsPerPage));
  }, [filteredFunciones.length, itemsPerPage]);

  React.useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const paginatedFunciones = React.useMemo(() => {
    if (itemsPerPage === 'all') return filteredFunciones;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredFunciones.slice(start, start + itemsPerPage);
  }, [currentPage, filteredFunciones, itemsPerPage]);

  React.useEffect(() => {
    // Para “funciones generales” no se selecciona empresa explícitamente.
    // Mantenemos el estado por compatibilidad con EmpresaSearchAddSection.
    if (selectedEmpresa) return;
    const fromUser = currentUser?.ownercompanie || '';
    if (fromUser) setSelectedEmpresa(fromUser);
  }, [currentUser?.ownercompanie, selectedEmpresa]);

  React.useEffect(() => {
    if (authLoading) return;
    if (!currentUser) return;

    let cancelled = false;
    const load = async () => {
      setOwnerEmpresasLoading(true);
      setOwnerEmpresasError(null);
      try {
        const all = await EmpresasService.getAllEmpresas();
        const normalized = Array.isArray(all) ? all : [];

        const allowed = new Set((actorOwnerIds || []).map((id) => String(id)));
        let filtered = normalized;
        if (allowed.size > 0) {
          filtered = normalized.filter((e) => e && e.ownerId && allowed.has(String(e.ownerId)));
        } else {
          filtered = normalized.filter((e) => {
            if (!e || !e.ownerId) return false;
            const owner = String(e.ownerId);
            return (
              (currentUser.id && owner === String(currentUser.id)) ||
              (currentUser.ownerId && owner === String(currentUser.ownerId))
            );
          });
        }

        filtered.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'es'));

        if (cancelled) return;
        setOwnerEmpresas(filtered);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'No se pudieron cargar las empresas.';
        setOwnerEmpresasError(msg);
        setOwnerEmpresas([]);
      } finally {
        if (!cancelled) setOwnerEmpresasLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [actorOwnerIds, authLoading, currentUser]);

  const resolvedOwnerId = React.useMemo(() => {
    const primary = primaryOwnerId ? String(primaryOwnerId) : '';
    if (primary) return primary;
    if (currentUser?.ownerId) return String(currentUser.ownerId);
    if (currentUser?.id) return String(currentUser.id);
    return '';
  }, [currentUser?.id, currentUser?.ownerId, primaryOwnerId]);

  // Cargar funciones generales desde Firestore
  React.useEffect(() => {
    if (authLoading) return;
    if (!currentUser) return;
    if (!isAdminLike) return;

    let cancelled = false;
    const load = async () => {
      setFuncionesLoading(true);
      setFuncionesError(null);
      try {
        const docs = await FuncionesService.listFuncionesGeneralesAs({
          ownerIds: (actorOwnerIds || []).map((x) => String(x)),
          role: currentUser.role,
        });

        const items: FuncionListItem[] = docs
          .map((d) => ({
            id: String(d.funcionId || ''),
            docId: String(d.docId || ''),
            nombre: String(d.nombre || ''),
            descripcion: String(d.descripcion || ''),
            createdAt: String(d.createdAt || ''),
          }))
          .filter((x) => x.id && x.docId && x.nombre);

        items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

        if (cancelled) return;
        setRecetasListItems(items);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'No se pudieron cargar las funciones.';
        setFuncionesError(msg);
        setRecetasListItems([]);
      } finally {
        if (!cancelled) setFuncionesLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [actorOwnerIds, authLoading, currentUser, isAdminLike]);

  // Asegurar doc por empresa (docId = empresaId) para asignaciones
  React.useEffect(() => {
    if (!resolvedOwnerId) return;
    if (ownerEmpresas.length === 0) return;

    void Promise.all(
      ownerEmpresas
        .map((e) => String(e?.id || '').trim())
        .filter(Boolean)
        .map((empresaId) => FuncionesService.ensureEmpresaDoc({ ownerId: resolvedOwnerId, empresaId }))
    );
  }, [ownerEmpresas, resolvedOwnerId]);

  const openAddDrawer = React.useCallback(() => {
    if (!isAdminLike) return;
    setFormError(null);
    setEditingId(null);
    setDraftNombre(searchValue.trim());
    setDraftDescripcion('');
    setDrawerOpen(true);
  }, [isAdminLike, searchValue]);

  const openEditDrawer = React.useCallback((item: FuncionListItem) => {
    if (!isAdminLike) return;
    setFormError(null);
    setEditingId(item.id);
    setDraftNombre(String(item.nombre || ''));
    setDraftDescripcion(String(item.descripcion || ''));
    setDrawerOpen(true);
  }, [isAdminLike]);

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false);
    setEditingId(null);
    setDraftNombre('');
    setDraftDescripcion('');
    setFormError(null);
  }, []);

  const handleSaveDrawer = React.useCallback(() => {
    if (!isAdminLike) return;
    setFormError(null);

    const name = draftNombre.trim();
    const descripcion = draftDescripcion.trim();
    if (!name) {
      setFormError('Nombre requerido.');
      return;
    }

    const persist = async () => {
      if (!resolvedOwnerId) {
        setFormError('No se pudo resolver el ownerId.');
        return;
      }

      const existing = editingId ? recetasListItems.find((x) => x.id === editingId) : undefined;

      // If creating new, generate numeric sequential funcionId (0000, 0001, ...)
      const funcionId = editingId
        ? String(editingId)
        : await FuncionesService.getNextNumericFuncionId({ ownerId: resolvedOwnerId, padLength: 4 });

      const createdAtIso = existing?.createdAt ? String(existing.createdAt) : new Date().toISOString();

      const saved = await FuncionesService.upsertFuncionGeneral({
        previousDocId: existing?.docId || null,
        ownerId: resolvedOwnerId,
        funcionId,
        nombre: name,
        descripcion,
        createdAt: createdAtIso,
      });

      const nextItem: FuncionListItem = {
        id: saved.funcionId,
        docId: saved.docId,
        nombre: saved.nombre,
        descripcion: saved.descripcion || '',
        createdAt: saved.createdAt,
      };

      setRecetasListItems((prev) => {
        const without = prev.filter((x) => x.id !== funcionId);
        return [nextItem, ...without].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      });
      setCurrentPage(1);
      setSearchValue('');
      showToast(editingId ? 'Función actualizada.' : 'Función agregada.', 'success');
      closeDrawer();
    };

    void persist().catch((err) => {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar la función.';
      setFormError(msg);
      showToast(msg, 'error');
    });
  }, [closeDrawer, draftDescripcion, draftNombre, editingId, isAdminLike, recetasListItems, resolvedOwnerId, showToast]);

  const openRemoveModal = React.useCallback((id: string, nombreLabel: string) => {
    setConfirmState({ open: true, id, nombre: nombreLabel });
  }, []);

  const closeRemoveModal = React.useCallback(() => {
    setConfirmState({ open: false, id: '', nombre: '' });
  }, []);

  const confirmRemove = React.useCallback(() => {
    const idToRemove = String(confirmState.id || '').trim();
    if (!idToRemove) return;

    const item = recetasListItems.find((x) => x.id === idToRemove);
    if (!item?.docId) {
      setRecetasListItems((prev) => prev.filter((x) => x.id !== idToRemove));
      showToast('Función eliminada.', 'success');
      closeRemoveModal();
      return;
    }

    const run = async () => {
      await FuncionesService.deleteFuncionGeneral(item.docId);

      // Remover id de función de docs por empresa (si estaba asignada)
      if (resolvedOwnerId && ownerEmpresas.length > 0) {
        const empresaIds = ownerEmpresas.map((e) => String(e?.id || '')).filter(Boolean);
        await FuncionesService.removeFuncionFromEmpresas({
          ownerId: resolvedOwnerId,
          empresaIds,
          funcionId: idToRemove,
        });
      }

      setRecetasListItems((prev) => prev.filter((x) => x.id !== idToRemove));
      showToast('Función eliminada.', 'success');
      closeRemoveModal();
    };

    void run().catch((err) => {
      const msg = err instanceof Error ? err.message : 'No se pudo eliminar la función.';
      showToast(msg, 'error');
    });
  }, [closeRemoveModal, confirmState.id, ownerEmpresas, recetasListItems, resolvedOwnerId, showToast]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-1">
        <h4 className="text-base sm:text-lg lg:text-xl font-semibold">Funciones</h4>
        <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
          Administra funciones generales por empresa
        </p>
      </div>

      <div className="border border-[var(--input-border)] rounded-lg p-2.5 sm:p-4 lg:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h5 className="text-sm sm:text-base font-semibold">Empresas donde soy owner</h5>
            <p className="text-[11px] sm:text-xs text-[var(--muted-foreground)] mt-0.5">
              Se muestran las empresas cuyo ownerId coincide con tus ownerIds
            </p>
          </div>
          <div className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
            {ownerEmpresasLoading ? 'Cargando…' : `${ownerEmpresas.length} empresa(s)`}
          </div>
        </div>

        {ownerEmpresasError && (
          <div className="mt-2 text-xs text-red-600">{ownerEmpresasError}</div>
        )}

        {!ownerEmpresasLoading && !ownerEmpresasError && ownerEmpresas.length === 0 && (
          <div className="mt-2 text-xs text-[var(--muted-foreground)]">Sin empresas owner.</div>
        )}

        {!ownerEmpresasLoading && ownerEmpresas.length > 0 && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {ownerEmpresas.map((e) => (
              <div
                key={e.id || `${e.ownerId}-${e.name}`}
                className="border border-[var(--input-border)] rounded-md px-3 py-2 bg-[var(--card)]"
              >
                <div className="text-sm font-medium text-[var(--foreground)] truncate">{e.name}</div>
                <div className="text-[11px] text-[var(--muted-foreground)] truncate">{e.ubicacion || '—'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border border-[var(--input-border)] rounded-lg p-2.5 sm:p-4 lg:p-5">
        <h5 className="text-sm sm:text-base font-semibold mb-2">Agregar funciones generales</h5>

        <div className="space-y-2">
          <EmpresaSearchAddSection
            authLoading={authLoading}
            isAdminLike={isAdminLike}
            userRole={currentUser?.role}
            actorOwnerIds={actorOwnerIds}
            companyFromUser={currentUser?.ownercompanie || ''}
            showEmpresaSelector={false}
            selectedEmpresa={selectedEmpresa}
            setSelectedEmpresa={setSelectedEmpresa}
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            searchPlaceholder="Nombre de la función"
            searchAriaLabel="Buscar función general"
            addButtonText="Agregar función"
            onAddClick={openAddDrawer}
            addDisabled={!isAdminLike || authLoading}
          />
        </div>
      </div>

      <div className="border border-[var(--input-border)] rounded-lg p-2.5 sm:p-4 lg:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 sm:mb-3">
          <h5 className="text-xs sm:text-sm font-semibold text-[var(--foreground)] leading-tight">
            Lista de funciones
            <span className="ml-2 text-xs font-medium text-[var(--muted-foreground)]">({filteredFunciones.length})</span>
          </h5>

          <Paginacion
            totalItems={filteredFunciones.length}
            itemsPerPage={itemsPerPage}
            setItemsPerPage={setItemsPerPage}
            currentPage={currentPage}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
            disabled={false}
          />
        </div>

        {funcionesError && (
          <div className="mb-2 text-sm text-red-500">{funcionesError}</div>
        )}

        <RecetasListContent
          isLoading={funcionesLoading}
          filteredCount={filteredFunciones.length}
          searchTerm={searchValue}
          items={paginatedFunciones}
          onEdit={openEditDrawer}
          onRemove={openRemoveModal}
          disabled={!isAdminLike}
        />
      </div>

      <RightDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editingId ? 'Editar función' : 'Agregar función'}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDrawer}
              className="px-4 py-2 border border-[var(--input-border)] rounded text-[var(--foreground)] hover:bg-[var(--muted)] bg-transparent"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveDrawer}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded disabled:opacity-50"
              disabled={!isAdminLike}
            >
              {editingId ? 'Guardar cambios' : 'Guardar función'}
            </button>
          </div>
        }
      >
        {formError && <div className="mb-4 text-sm text-red-400">{formError}</div>}

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-[var(--muted-foreground)] mb-1">Nombre</label>
            <input
              className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
              placeholder="Ej: Cajero"
              value={draftNombre}
              onChange={(e) => setDraftNombre(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--muted-foreground)] mb-1">Descripción</label>
            <textarea
              className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)] min-h-[90px]"
              placeholder="Describe la función (opcional)"
              value={draftDescripcion}
              onChange={(e) => setDraftDescripcion(e.target.value)}
            />
          </div>
        </div>
      </RightDrawer>

      <ConfirmModal
        open={confirmState.open}
        title="Eliminar función"
        message={`Quieres eliminar la función "${confirmState.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        actionType="delete"
        loading={false}
        onConfirm={confirmRemove}
        onCancel={closeRemoveModal}
      />
    </div>
  );
}
