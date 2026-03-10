'use client';

import React from 'react';
import { EmpresasService } from '../../services/empresas';
import { DELIFOOD_EMPRESA_ID, FuncionesService, getFuncionIdLookupKeys } from '../../services/funciones';
import { useAuth } from '../../hooks/useAuth';
import { useActorOwnership } from '../../hooks/useActorOwnership';
import useToast from '../../hooks/useToast';
import type { Empresas } from '../../types/firestore';

import { EmpresaSearchAddSection } from '@/components/recetas/component/EmpresaSearchAddSection';
import { Paginacion } from '@/components/recetas/component/Paginacion';
import { RecetasListContent } from './funciones/RecetasListContent';
import type { FuncionListItem } from './funciones/RecetasListItems';
import EmpresaFuncionesModal from './funciones/EmpresaFuncionesModal';
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
  const [draftAudience, setDraftAudience] = React.useState<'DELIKOR' | 'DELIFOOD'>('DELIKOR');
  const [draftEmpresaIds, setDraftEmpresaIds] = React.useState<string[]>([]);
  const [draftHasReminder, setDraftHasReminder] = React.useState(false);
  const [draftReminderTimeCr, setDraftReminderTimeCr] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);

  const [confirmState, setConfirmState] = React.useState<{ open: boolean; id: string; nombre: string }>({
    open: false,
    id: '',
    nombre: '',
  });

  const [empresaModalOpen, setEmpresaModalOpen] = React.useState(false);
  const [empresaModalEmpresa, setEmpresaModalEmpresa] = React.useState<Empresas | null>(null);

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

  const empresasScopeOptions = React.useMemo(() => {
    const ownerId = String(resolvedOwnerId || '').trim();
    const list = (ownerEmpresas || [])
      .filter((e) => {
        const id = String(e?.id || '').trim().toUpperCase();
        if (!id) return false;
        if (id === DELIFOOD_EMPRESA_ID) return false;
        return !ownerId || String(e?.ownerId || '').trim() === ownerId;
      })
      .map((e) => ({ id: String(e?.id || '').trim(), name: String(e?.name || e?.id || '').trim() }))
      .filter((e) => e.id);

    list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return list;
  }, [ownerEmpresas, resolvedOwnerId]);

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
          .map((d) => {
            const audience: 'DELIKOR' | 'DELIFOOD' =
              String((d as any).audience || '').toUpperCase() === 'DELIFOOD' ? 'DELIFOOD' : 'DELIKOR';
            const empresaIds: string[] = Array.isArray((d as any).empresaIds)
              ? Array.from(
                  new Set(
                    (d as any).empresaIds
                      .map((x: unknown) => String(x).trim())
                      .filter(Boolean)
                  )
                )
              : [];

            return {
              id: String(d.funcionId || ''),
              docId: String(d.docId || ''),
              ownerId: String((d as any).ownerId || ''),
              nombre: String(d.nombre || ''),
              descripcion: String(d.descripcion || ''),
              reminderTimeCr: d.reminderTimeCr ? String(d.reminderTimeCr) : '',
              createdAt: String(d.createdAt || ''),
              audience,
              empresaIds,
            };
          })
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
    setDraftAudience('DELIKOR');
    setDraftEmpresaIds([]);
    setDraftHasReminder(false);
    setDraftReminderTimeCr('');
    setDrawerOpen(true);
  }, [isAdminLike, searchValue]);

  const openEditDrawer = React.useCallback((item: FuncionListItem) => {
    if (!isAdminLike) return;
    setFormError(null);
    setEditingId(item.id);
    setDraftNombre(String(item.nombre || ''));
    setDraftDescripcion(String(item.descripcion || ''));
    setDraftAudience(String(item.audience || '').toUpperCase() === 'DELIFOOD' ? 'DELIFOOD' : 'DELIKOR');
    setDraftEmpresaIds(Array.isArray(item.empresaIds) ? item.empresaIds.map((x) => String(x).trim()).filter(Boolean) : []);
    const timeCr = String(item.reminderTimeCr || '').trim();
    setDraftHasReminder(Boolean(timeCr));
    setDraftReminderTimeCr(timeCr);
    setDrawerOpen(true);
  }, [isAdminLike]);

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false);
    setEditingId(null);
    setDraftNombre('');
    setDraftDescripcion('');
    setDraftAudience('DELIKOR');
    setDraftEmpresaIds([]);
    setDraftHasReminder(false);
    setDraftReminderTimeCr('');
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

    const reminderTimeCr = draftHasReminder ? draftReminderTimeCr.trim() : '';
    if (draftHasReminder) {
      if (!reminderTimeCr) {
        setFormError('Selecciona una hora para el recordatorio.');
        return;
      }
      if (!/^\d{2}:\d{2}$/.test(reminderTimeCr)) {
        setFormError('Hora de recordatorio inválida (usa HH:mm).');
        return;
      }
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
        reminderTimeCr: draftHasReminder ? reminderTimeCr : undefined,
        audience: draftAudience,
        empresaIds: draftAudience === 'DELIKOR' ? draftEmpresaIds : [],
        createdAt: createdAtIso,
      });

      // Si cambia a DELIFOOD, el cambio debe reflejarse inmediatamente en asignaciones.
      // Regla: DELIFOOD solo puede estar asignada a la empresa DELIFOOD.
      // También, si cambia de DELIFOOD a DELIKOR, se debe quitar de DELIFOOD.
      try {
        const prevAudience: 'DELIKOR' | 'DELIFOOD' =
          String(existing?.audience || '').toUpperCase() === 'DELIFOOD' ? 'DELIFOOD' : 'DELIKOR';
        const nextAudience: 'DELIKOR' | 'DELIFOOD' =
          String(saved.audience || '').toUpperCase() === 'DELIFOOD' ? 'DELIFOOD' : 'DELIKOR';
        const funcionIdStr = String(saved.funcionId || '').trim();

        const removalKeys = new Set(getFuncionIdLookupKeys(funcionIdStr));
        removalKeys.add(funcionIdStr);

        const empresasForOwner = (ownerEmpresas || []).filter(
          (e) => String(e?.ownerId || '').trim() === String(resolvedOwnerId)
        );
        const empresasForOwnerIds = empresasForOwner
          .map((e) => String(e?.id || '').trim())
          .filter(Boolean);

        const hasDelifoodEmpresa = empresasForOwnerIds.includes(String(DELIFOOD_EMPRESA_ID));

        if (funcionIdStr && nextAudience === 'DELIFOOD') {
          const delikorEmpresaIds = empresasForOwnerIds.filter((id) => id && id !== String(DELIFOOD_EMPRESA_ID));

          // Quitar de todas las empresas DELIKOR.
          if (delikorEmpresaIds.length > 0) {
            await FuncionesService.removeFuncionFromEmpresas({
              ownerId: resolvedOwnerId,
              empresaIds: delikorEmpresaIds,
              funcionId: funcionIdStr,
            });
          }

          // Asegurar que esté asignada a DELIFOOD.
          if (hasDelifoodEmpresa) {
            const doc = await FuncionesService.getEmpresaFunciones({ empresaId: String(DELIFOOD_EMPRESA_ID) });
            const current = Array.isArray(doc?.funciones) ? doc!.funciones : [];
            // Normalizar: quitar variantes y dejar solo el canon.
            const currentFiltered = current
              .map((x) => String(x).trim())
              .filter(Boolean)
              .filter((x) => !removalKeys.has(x));
            const next = Array.from(new Set([...currentFiltered, funcionIdStr])).filter(Boolean);
            await FuncionesService.upsertEmpresaFunciones({
              ownerId: resolvedOwnerId,
              empresaId: String(DELIFOOD_EMPRESA_ID),
              funciones: next,
            });
          } else {
            showToast('No se encontró la empresa DELIFOOD en tus empresas; no se pudo auto-asignar.', 'warning');
          }
        }

        // Si pasa a DELIKOR: quitar de DELIFOOD y asegurar asignación en empresas objetivo.
        if (funcionIdStr && nextAudience === 'DELIKOR') {
          if (hasDelifoodEmpresa) {
            await FuncionesService.removeFuncionFromEmpresas({
              ownerId: resolvedOwnerId,
              empresaIds: [String(DELIFOOD_EMPRESA_ID)],
              funcionId: funcionIdStr,
            });
          }

          const nextEmpresaIdsRaw: string[] = Array.isArray(saved.empresaIds)
            ? saved.empresaIds.map((x) => String(x).trim()).filter(Boolean)
            : [];

          const delikorEmpresaIds = empresasForOwnerIds.filter((id) => id && id !== String(DELIFOOD_EMPRESA_ID));
          const ownerEmpresaSet = new Set(delikorEmpresaIds.map((x) => String(x)));

          const targetEmpresaIds = nextEmpresaIdsRaw.length > 0
            ? nextEmpresaIdsRaw.filter((id) => ownerEmpresaSet.has(String(id)))
            : delikorEmpresaIds;

          const targetSet = new Set(targetEmpresaIds.map((x) => String(x)));

          // Para cada empresa DELIKOR: si está en target => asegurar; si no => remover.
          await Promise.all(
            delikorEmpresaIds.map(async (empresaId) => {
              const doc = await FuncionesService.getEmpresaFunciones({ empresaId });
              const current = Array.isArray(doc?.funciones) ? doc!.funciones : [];
              const currentNorm = current.map((x) => String(x).trim()).filter(Boolean);

              const shouldHave = targetSet.has(String(empresaId));
              const filtered = currentNorm.filter((x) => !removalKeys.has(x));
              const next = shouldHave
                ? Array.from(new Set([...filtered, funcionIdStr])).filter(Boolean)
                : filtered;

              if (next.length === currentNorm.length && next.every((v, i) => v === currentNorm[i])) return;

              await FuncionesService.upsertEmpresaFunciones({
                ownerId: resolvedOwnerId,
                empresaId,
                funciones: next,
              });
            })
          );
        }

        // Si solo cambió de DELIKOR a DELIFOOD o viceversa, este bloque lo cubre; el valor prevAudience queda por trazabilidad.
        void prevAudience;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudieron sincronizar asignaciones de la función.';
        showToast(msg, 'warning');
      }

      // Auto-asignar solo cuando se crea una función general nueva.
      if (!editingId) {
        const savedAudience: 'DELIKOR' | 'DELIFOOD' =
          String(saved.audience || '').toUpperCase() === 'DELIFOOD' ? 'DELIFOOD' : 'DELIKOR';
        const savedEmpresaIds: string[] = Array.isArray(saved.empresaIds)
          ? saved.empresaIds.map((x) => String(x).trim()).filter(Boolean)
          : [];

        const empresasForOwner = (ownerEmpresas || []).filter(
          (e) => String(e?.ownerId || '').trim() === String(resolvedOwnerId)
        );
        const ownerEmpresaIdSet = new Set(
          empresasForOwner.map((e) => String(e?.id || '').trim()).filter(Boolean)
        );

        let targetEmpresaIds: string[] = [];
        if (savedAudience === 'DELIFOOD') {
          targetEmpresaIds = [String(DELIFOOD_EMPRESA_ID)];
        } else if (savedEmpresaIds.length > 0) {
          targetEmpresaIds = savedEmpresaIds.filter((id) => ownerEmpresaIdSet.has(String(id)));
        } else {
          targetEmpresaIds = empresasForOwner
            .map((e) => String(e?.id || '').trim())
            .filter((id) => id && id !== String(DELIFOOD_EMPRESA_ID));
        }

        const uniqueTargets = Array.from(new Set(targetEmpresaIds.map((x) => String(x).trim()).filter(Boolean)));

        await Promise.all(
          uniqueTargets.map(async (empresaId) => {
            const doc = await FuncionesService.getEmpresaFunciones({ empresaId });
            const raw = Array.isArray((doc as any)?.funciones) ? (doc as any).funciones : [];
            const current = (raw as unknown[]).map((x) => String(x).trim()).filter(Boolean);
            const next = Array.from(new Set([...current, String(saved.funcionId).trim()])).filter(Boolean);
            await FuncionesService.upsertEmpresaFunciones({
              ownerId: resolvedOwnerId,
              empresaId,
              funciones: next,
            });
          })
        );
      }

      const nextItem: FuncionListItem = {
        id: saved.funcionId,
        docId: saved.docId,
        ownerId: saved.ownerId,
        nombre: saved.nombre,
        descripcion: saved.descripcion || '',
        reminderTimeCr: saved.reminderTimeCr ? String(saved.reminderTimeCr) : '',
        createdAt: saved.createdAt,
        audience: String(saved.audience || '').toUpperCase() === 'DELIFOOD' ? 'DELIFOOD' : 'DELIKOR',
        empresaIds: Array.isArray(saved.empresaIds) ? saved.empresaIds.map((x) => String(x)) : [],
      };

      setRecetasListItems((prev) => {
        const without = prev.filter((x) => x.id !== funcionId);
        return [nextItem, ...without].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      });
      setCurrentPage(1);
      setSearchValue('');
      showToast(editingId ? 'Función actualizada.' : 'Función agregada y asignada automáticamente.', 'success');
      closeDrawer();
    };

    void persist().catch((err) => {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar la función.';
      setFormError(msg);
      showToast(msg, 'error');
    });
  }, [closeDrawer, draftAudience, draftDescripcion, draftEmpresaIds, draftHasReminder, draftNombre, draftReminderTimeCr, editingId, isAdminLike, ownerEmpresas, recetasListItems, resolvedOwnerId, showToast]);

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

  const openEmpresaModal = React.useCallback(
    (empresa: Empresas) => {
      if (!isAdminLike) {
        showToast('No tienes permisos para editar funciones por empresa.', 'error');
        return;
      }
      const empresaId = String(empresa?.id || '').trim();
      if (!empresaId) {
        showToast('Empresa inválida.', 'error');
        return;
      }
      if (!resolvedOwnerId) {
        showToast('No se pudo resolver el ownerId.', 'error');
        return;
      }

      setEmpresaModalEmpresa(empresa);
      setEmpresaModalOpen(true);
    },
    [isAdminLike, resolvedOwnerId, showToast]
  );

  const closeEmpresaModal = React.useCallback(() => {
    setEmpresaModalOpen(false);
    setEmpresaModalEmpresa(null);
  }, []);

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
            <h5 className="text-sm sm:text-base font-semibold">Empresas a mi cargo</h5>
            <p className="text-[11px] sm:text-xs text-[var(--muted-foreground)] mt-0.5">
              Seleccionar una empresa para editar sus funciones asignadas
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
              <button
                key={e.id || `${e.ownerId}-${e.name}`}
                type="button"
                onClick={() => openEmpresaModal(e)}
                className="text-left border border-[var(--input-border)] rounded-md px-3 py-2 bg-[var(--card)] hover:bg-[var(--muted)] transition-colors"
                aria-label={`Editar funciones de ${e.name}`}
              >
                <div className="text-sm font-medium text-[var(--foreground)] truncate">{e.name}</div>
                <div className="text-[11px] text-[var(--muted-foreground)] truncate">{e.ubicacion || '—'}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border border-[var(--input-border)] rounded-lg p-2.5 sm:p-4 lg:p-5">
        <h5 className="text-sm sm:text-base font-semibold mb-2">Funciones generales</h5>

        <p className="text-[11px] sm:text-xs text-[var(--muted-foreground)] mb-2">
          Puedes agregar funciones generales aquí (se asignan automáticamente). Para crear funciones exclusivas, entra a una empresa y usa
          "Función exclusiva".
        </p>

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
            searchPlaceholder="Buscar función"
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

          <div>
            <label className="block text-xs text-[var(--muted-foreground)] mb-1">Grupo</label>
            <select
              className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
              value={draftAudience}
              onChange={(e) => {
                const next = String(e.target.value || '').toUpperCase() === 'DELIFOOD' ? 'DELIFOOD' : 'DELIKOR';
                setDraftAudience(next as 'DELIKOR' | 'DELIFOOD');
                if (next === 'DELIFOOD') setDraftEmpresaIds([]);
              }}
            >
              <option value="DELIKOR">DELIKOR</option>
              <option value="DELIFOOD">DELIFOOD</option>
            </select>
            <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
              {draftAudience === 'DELIFOOD'
                ? 'Las funciones DELIFOOD solo se muestran a la empresa DELIFOOD.'
                : 'Las funciones DELIKOR se muestran a todas las empresas del ownerId (excepto DELIFOOD), a menos que selecciones empresas específicas.'}
            </div>
          </div>

          {draftAudience === 'DELIKOR' ? (
            <div>
              <label className="block text-xs text-[var(--muted-foreground)] mb-1">Empresas específicas (opcional)</label>
              {empresasScopeOptions.length === 0 ? (
                <div className="text-[11px] text-[var(--muted-foreground)]">No hay empresas disponibles para seleccionar.</div>
              ) : (
                <div className="max-h-[220px] overflow-auto rounded border border-[var(--input-border)] bg-[var(--background)] p-2">
                  {empresasScopeOptions.map((e) => {
                    const checked = draftEmpresaIds.map((x) => String(x).trim()).includes(e.id);
                    return (
                      <label
                        key={e.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--muted)] text-sm text-[var(--foreground)] select-none"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          onChange={(ev) => {
                            const nextChecked = ev.target.checked;
                            setDraftEmpresaIds((prev) => {
                              const set = new Set(prev.map((x) => String(x).trim()).filter(Boolean));
                              if (nextChecked) set.add(e.id);
                              else set.delete(e.id);
                              return Array.from(set.values());
                            });
                          }}
                        />
                        <span className="truncate">{e.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                Si no seleccionas ninguna, aplica a todas las empresas (excepto DELIFOOD).
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-[var(--foreground)] select-none">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={draftHasReminder}
                onChange={(e) => {
                  const next = e.target.checked;
                  setDraftHasReminder(next);
                  if (!next) setDraftReminderTimeCr('');
                }}
              />
              Agregar recordatorio
            </label>

            {draftHasReminder ? (
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Hora (Costa Rica)</label>
                <input
                  type="time"
                  step={60}
                  className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
                  value={draftReminderTimeCr}
                  onChange={(e) => setDraftReminderTimeCr(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveDrawer}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded disabled:opacity-50"
              disabled={!isAdminLike}
            >
              {editingId ? 'Guardar cambios' : 'Guardar función'}
            </button>
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

      <EmpresaFuncionesModal
        open={empresaModalOpen}
        empresaId={String(empresaModalEmpresa?.id || '')}
        empresaNombre={String(empresaModalEmpresa?.name || 'Empresa')}
        ownerId={resolvedOwnerId}
        funcionesGenerales={recetasListItems}
        onClose={closeEmpresaModal}
        showToast={showToast}
      />
    </div>
  );
}
