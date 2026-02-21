"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";

import { useAuth } from "@/hooks/useAuth";
import { useActorOwnership } from "@/hooks/useActorOwnership";
import { getDefaultPermissions } from "@/utils/permissions";
import useToast from "@/hooks/useToast";
import { useRecetas } from "@/hooks/useRecetas";
import { ProductosService } from "@/services/productos";
import type { ProductEntry, RecetaEntry } from "@/types/firestore";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { EmpresaSearchAddSection } from "@/components/recetas/component/EmpresaSearchAddSection";

type IngredienteDraft = {
  productId: string;
  gramos: string;
};

function sanitizeNumber(value: string): number {
  const trimmed = String(value || "").trim().replace(/,/g, ".");
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

export function RecetasTab() {
  const { user, loading: authLoading } = useAuth();
  const { ownerIds: actorOwnerIds } = useActorOwnership(user || {});
  const permissions = user?.permissions || getDefaultPermissions(user?.role || "user");
  const canUseRecetas = Boolean(permissions.recetas);
  const companyFromUser = String(user?.ownercompanie || "").trim();
  const isAdminLike = user?.role === "admin" || user?.role === "superadmin";

  const [empresaError, setEmpresaError] = React.useState<string | null>(null);
  const [selectedEmpresa, setSelectedEmpresa] = React.useState<string>("");

  const company = isAdminLike ? selectedEmpresa : companyFromUser;

  const { showToast } = useToast();
  const { recetas, loading, error, addReceta, updateReceta, removeReceta } = useRecetas({
    companyOverride: isAdminLike ? selectedEmpresa : undefined,
  });

  const [searchTerm, setSearchTerm] = React.useState("");

  const [nombre, setNombre] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [margen, setMargen] = React.useState("0.35");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editingRecetaId, setEditingRecetaId] = React.useState<string | null>(null);
  const [ingredientes, setIngredientes] = React.useState<IngredienteDraft[]>([
    { productId: "", gramos: "" },
  ]);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const [itemsPerPage, setItemsPerPage] = React.useState<number | "all">(10);
  const [currentPage, setCurrentPage] = React.useState(1);

  const [confirmState, setConfirmState] = React.useState<{
    open: boolean;
    id: string;
    nombre: string;
  }>({ open: false, id: "", nombre: "" });

  // Búsqueda optimizada de productos: solo consulta por prefijo mientras el usuario escribe.
  const [activeIngredientIndex, setActiveIngredientIndex] = React.useState<number | null>(null);
  const [productoSearchTerm, setProductoSearchTerm] = React.useState("");
  const debouncedSearch = useDebouncedValue(productoSearchTerm, 250);
  const [productoResults, setProductoResults] = React.useState<ProductEntry[]>([]);
  const [productoSearching, setProductoSearching] = React.useState(false);
  const [productoSearchError, setProductoSearchError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!company) {
        setProductoResults([]);
        setProductoSearchError(null);
        setProductoSearching(false);
        return;
      }

      const term = String(debouncedSearch || "").trim();
      if (term.length < 2) {
        setProductoResults([]);
        setProductoSearchError(null);
        setProductoSearching(false);
        return;
      }

      setProductoSearching(true);
      setProductoSearchError(null);
      try {
        const found = await ProductosService.searchProductosByNombrePrefix(company, term, 15);
        if (cancelled) return;
        setProductoResults(found);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "No se pudieron buscar productos.";
        setProductoSearchError(message);
        setProductoResults([]);
      } finally {
        if (!cancelled) setProductoSearching(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [company, debouncedSearch]);

  const isLoading = authLoading || loading;
  const resolvedError = formError || error || empresaError;

  const filteredRecetas = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return recetas;
    return recetas.filter((r) => {
      const n = (r.nombre || "").toLowerCase();
      const d = (r.descripcion || "").toLowerCase();
      const i = (r.id || "").toLowerCase();
      return n.includes(term) || d.includes(term) || i.includes(term);
    });
  }, [recetas, searchTerm]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, company]);

  const totalPages = React.useMemo(() => {
    if (itemsPerPage === "all") return 1;
    const total = Math.max(1, Math.ceil(filteredRecetas.length / itemsPerPage));
    return total;
  }, [filteredRecetas.length, itemsPerPage]);

  React.useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const paginatedRecetas = React.useMemo(() => {
    if (itemsPerPage === "all") return filteredRecetas;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecetas.slice(start, start + itemsPerPage);
  }, [currentPage, filteredRecetas, itemsPerPage]);

  const resetForm = () => {
    setNombre("");
    setDescripcion("");
    setMargen("0.35");
    setIngredientes([{ productId: "", gramos: "" }]);
    setFormError(null);
    setActiveIngredientIndex(null);
    setProductoSearchTerm("");
    setProductoResults([]);
    setProductoSearchError(null);
    setEditingRecetaId(null);
  };

  const openAddDrawer = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const openEditDrawer = (receta: RecetaEntry) => {
    setFormError(null);
    setEditingRecetaId(receta.id);
    setNombre(String(receta.nombre || ""));
    setDescripcion(String(receta.descripcion || ""));
    setMargen(String(typeof receta.margen === "number" ? receta.margen : 0));
    const nextIngredientes: IngredienteDraft[] = Array.isArray(receta.productos)
      ? receta.productos.map((p) => ({
          productId: String(p.productId || ""),
          gramos: String(p.gramos ?? ""),
        }))
      : [];
    setIngredientes(nextIngredientes.length > 0 ? nextIngredientes : [{ productId: "", gramos: "" }]);
    setActiveIngredientIndex(null);
    setProductoSearchTerm("");
    setProductoResults([]);
    setProductoSearchError(null);
    setDrawerOpen(true);
  };

  const closeAddDrawer = () => {
    setDrawerOpen(false);
    resetForm();
  };

  const addIngredientRow = () => {
    setIngredientes((prev) => [...prev, { productId: "", gramos: "" }]);
  };

  const removeIngredientRow = (index: number) => {
    setIngredientes((prev) => prev.filter((_, i) => i !== index));
    if (activeIngredientIndex === index) {
      setActiveIngredientIndex(null);
      setProductoSearchTerm("");
      setProductoResults([]);
    }
  };

  const updateIngredient = (index: number, patch: Partial<IngredienteDraft>) => {
    setIngredientes((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSave = async () => {
    if (saving) return;
    setFormError(null);

    if (!company) {
      setFormError("No se pudo determinar la empresa del usuario.");
      return;
    }

    const nombreTrim = nombre.trim();
    if (!nombreTrim) {
      setFormError("Nombre requerido.");
      return;
    }

    let margenValue = sanitizeNumber(margen);
    // Soportar entrada tipo "35" (porcentaje)
    if (margenValue > 1 && margenValue <= 100) {
      margenValue = margenValue / 100;
    }
    if (!(margenValue >= 0 && margenValue <= 1)) {
      setFormError("El margen debe estar entre 0 y 1 (ej: 0.35) o 0-100 (ej: 35)." );
      return;
    }

    const productos = ingredientes
      .map((row) => ({
        productId: String(row.productId || "").trim(),
        gramos: sanitizeNumber(row.gramos),
      }))
      .filter((p) => p.productId && p.gramos > 0);

    if (productos.length === 0) {
      setFormError("Debe agregar al menos un producto con gramos > 0.");
      return;
    }

    try {
      setSaving(true);
      if (editingRecetaId) {
        await updateReceta(editingRecetaId, {
          nombre: nombreTrim,
          descripcion: descripcion.trim() ? descripcion.trim() : null,
          margen: margenValue,
          productos,
        });
        showToast("Receta actualizada.", "success");
      } else {
        await addReceta({
          nombre: nombreTrim,
          descripcion: descripcion.trim() ? descripcion.trim() : undefined,
          margen: margenValue,
          productos,
        });
        showToast("Receta creada.", "success");
      }
      resetForm();
      setDrawerOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la receta.";
      setFormError(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const openRemoveModal = (id: string, nombreLabel: string) => {
    setConfirmState({ open: true, id, nombre: nombreLabel });
  };

  const closeRemoveModal = () => {
    setConfirmState({ open: false, id: "", nombre: "" });
  };

  const confirmRemoveReceta = async () => {
    if (!confirmState.id) return;
    try {
      setDeletingId(confirmState.id);
      await removeReceta(confirmState.id);
      showToast("Receta eliminada.", "success");
      closeRemoveModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar la receta.";
      showToast(message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  if (!canUseRecetas) {
    return (
      <div className="max-w-3xl mx-auto bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">Recetas</h2>
        <p className="text-[var(--muted-foreground)]">No tienes permisos para usar Recetas.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg shadow p-4 sm:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm sm:text-base font-medium text-[var(--muted-foreground)]">Recetas</h2>
          <p className="text-[10px] sm:text-xs text-[var(--muted-foreground)]">a</p>
        </div>

        <EmpresaSearchAddSection
          authLoading={authLoading}
          isAdminLike={isAdminLike}
          userRole={user?.role}
          actorOwnerIds={actorOwnerIds}
          companyFromUser={companyFromUser}
          selectedEmpresa={selectedEmpresa}
          setSelectedEmpresa={setSelectedEmpresa}
          setEmpresaError={setEmpresaError}
          onCompanyChanged={() => {
            setSearchTerm("");
            setCurrentPage(1);
            setDrawerOpen(false);
            resetForm();
          }}
          searchValue={searchTerm}
          onSearchValueChange={setSearchTerm}
          searchPlaceholder={isLoading ? "Cargando..." : "Buscar receta"}
          searchAriaLabel="Buscar receta"
          searchDisabled={isLoading}
          addButtonText="Agregar receta"
          onAddClick={openAddDrawer}
          addDisabled={saving || isLoading || (isAdminLike && !selectedEmpresa)}
        />
      </div>

      {resolvedError && (
        <div className="mb-4 text-sm text-red-500">{resolvedError}</div>
      )}

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeAddDrawer}
        PaperProps={{
          sx: {
            width: { xs: "100vw", sm: 480 },
            maxWidth: "100vw",
            bgcolor: "#1f262a",
            color: "#ffffff",
          },
        }}
      >
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 3,
              py: 2,
            }}
          >
            <Typography variant="h5" component="h3" sx={{ fontWeight: 700 }}>
              {editingRecetaId ? "Editar receta" : "Agregar receta"}
            </Typography>
            <IconButton aria-label="Cerrar" onClick={closeAddDrawer} sx={{ color: "var(--foreground)" }}>
              <X className="w-4 h-4" />
            </IconButton>
          </Box>
          <Divider sx={{ borderColor: "var(--input-border)" }} />

          <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 3 }}>
            {resolvedError && <div className="mb-4 text-sm text-red-400">{resolvedError}</div>}

            <div className="flex flex-col gap-4">
              <div>
                <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                  Información básica
                </div>
                <div className="mt-3 flex flex-col gap-4">
                  <div>
                    <label className="block text-xs text-[var(--muted-foreground)] mb-1">Nombre</label>
                    <input
                      className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
                      placeholder="Ej: Hamburguesa clásica"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      disabled={saving}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--muted-foreground)] mb-1">Descripción (opcional)</label>
                    <textarea
                      className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)] min-h-[90px]"
                      placeholder="Notas o detalles"
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--muted-foreground)] mb-1">Margen</label>
                    <input
                      className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
                      placeholder="0.35 ó 35"
                      value={margen}
                      onChange={(e) => setMargen(e.target.value)}
                      disabled={saving}
                      inputMode="decimal"
                    />
                    <div className="text-xs text-[var(--muted-foreground)] mt-1">0.35 = 35% (también acepta 35)</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Productos</div>
                  <button
                    onClick={addIngredientRow}
                    className="text-sm px-3 py-1.5 rounded-md border border-[var(--input-border)] hover:bg-[var(--muted)] transition-colors"
                    type="button"
                    disabled={saving}
                  >
                    Agregar
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  {ingredientes.map((row, index) => {
                    const datalistId = `receta-productos-${index}`;
                    return (
                      <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        <div className="sm:col-span-7">
                          <label className="block text-xs text-[var(--muted-foreground)] mb-1">Producto (id)</label>
                          <input
                            value={row.productId}
                            onChange={(e) => {
                              const value = e.target.value;
                              updateIngredient(index, { productId: value });
                              setActiveIngredientIndex(index);
                              setProductoSearchTerm(value);
                            }}
                            onFocus={() => {
                              setActiveIngredientIndex(index);
                              setProductoSearchTerm(row.productId);
                            }}
                            list={datalistId}
                            className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
                            placeholder="Busca por nombre (min 2 letras) y elige el id"
                            disabled={saving}
                          />
                          <datalist id={datalistId}>
                            {(activeIngredientIndex === index ? productoResults : []).map((p) => (
                              <option key={p.id} value={p.id}>{p.nombre}</option>
                            ))}
                          </datalist>
                          {activeIngredientIndex === index && productoSearchError && (
                            <div className="text-xs text-red-400 mt-1">{productoSearchError}</div>
                          )}
                          {activeIngredientIndex === index && productoSearching && (
                            <div className="text-xs text-[var(--muted-foreground)] mt-1">Buscando…</div>
                          )}
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-xs text-[var(--muted-foreground)] mb-1">Gramos</label>
                          <input
                            value={row.gramos}
                            onChange={(e) => updateIngredient(index, { gramos: e.target.value })}
                            className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
                            placeholder="Ej: 200"
                            inputMode="decimal"
                            disabled={saving}
                          />
                        </div>

                        <div className="sm:col-span-2 flex sm:justify-end">
                          <button
                            onClick={() => removeIngredientRow(index)}
                            className="px-3 py-2 rounded-md border border-[var(--input-border)] hover:bg-[var(--muted)] transition-colors text-sm"
                            type="button"
                            disabled={saving || ingredientes.length <= 1}
                            title={ingredientes.length <= 1 ? "Debe quedar al menos 1 fila" : "Quitar"}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Box>

          <Divider sx={{ borderColor: "var(--input-border)" }} />
          <Box sx={{ px: 3, py: 2 }}>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAddDrawer}
                className="px-4 py-2 border border-[var(--input-border)] rounded text-[var(--foreground)] hover:bg-[var(--muted)] bg-transparent"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded disabled:opacity-50"
                disabled={saving || isLoading || (isAdminLike && !selectedEmpresa)}
              >
                {saving ? "Guardando..." : editingRecetaId ? "Guardar cambios" : "Guardar receta"}
              </button>
            </div>
          </Box>
        </Box>
      </Drawer>

      <div className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 sm:mb-3">
          <h3 className="text-xs sm:text-sm font-semibold text-[var(--foreground)] leading-tight">
            Lista de recetas
            <span className="ml-2 text-xs font-medium text-[var(--muted-foreground)]">({filteredRecetas.length})</span>
          </h3>

          {filteredRecetas.length > 0 && (
            <div className="flex w-full sm:w-auto flex-wrap items-center justify-end gap-2">
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  const val = e.target.value;
                  setItemsPerPage(val === "all" ? "all" : Number(val));
                }}
                className="w-24 px-2.5 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
                aria-label="Items por página"
                title="Items por página"
                disabled={isLoading}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value="all">Todos</option>
              </select>

              {itemsPerPage !== "all" && (
                <>
                  <button
                    type="button"
                    className="p-2 rounded border border-[var(--input-border)] text-[var(--foreground)] disabled:opacity-50"
                    disabled={currentPage <= 1 || isLoading}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    aria-label="Página anterior"
                    title="Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                    {currentPage} / {totalPages}
                  </div>
                  <button
                    type="button"
                    className="p-2 rounded border border-[var(--input-border)] text-[var(--foreground)] disabled:opacity-50"
                    disabled={currentPage >= totalPages || isLoading}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Página siguiente"
                    title="Siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <ul className="space-y-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <li
                key={idx}
                className="animate-pulse flex flex-col sm:flex-row sm:items-stretch border border-[var(--input-border)] rounded-lg overflow-hidden bg-[var(--input-bg)]"
              >
                <div className="flex-1 p-4 sm:p-5 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="h-4 w-1/2 rounded bg-black/20" />
                      <div className="mt-3 h-3 w-3/4 rounded bg-black/15" />
                    </div>
                    <div className="text-right">
                      <div className="h-4 w-20 rounded bg-black/20 ml-auto" />
                      <div className="mt-2 h-3 w-28 rounded bg-black/15 ml-auto" />
                    </div>
                  </div>
                </div>
                <div className="px-3 py-3 sm:px-3 sm:py-3 border-t sm:border-t-0 sm:border-l border-[var(--input-border)] bg-black/10">
                  <div className="h-8 w-20 rounded bg-black/20" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-1.5 sm:space-y-2">
            {filteredRecetas.length === 0 && (
              <li className="border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)] p-6 text-center">
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  {searchTerm ? "Sin resultados" : "Aún no hay recetas"}
                </div>
                <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {searchTerm
                    ? "Prueba con otro nombre o descripción."
                    : "Agrega tu primera receta para empezar."}
                </div>
              </li>
            )}

            {paginatedRecetas.map((r) => (
              <li
                key={r.id}
                className="group flex flex-col sm:flex-row sm:items-stretch border border-[var(--input-border)] rounded-lg overflow-hidden bg-[var(--input-bg)] transition-colors duration-150 hover:bg-[var(--muted)] focus-within:ring-2 focus-within:ring-[var(--accent)]/40"
              >
                <div className="flex-1 p-4 sm:p-5 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base font-semibold text-[var(--foreground)] truncate">
                        {r.nombre}
                      </div>
                      {r.descripcion && (
                        <div className="mt-2 text-xs text-[var(--muted-foreground)] opacity-70 break-words">
                          {r.descripcion}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm sm:text-base font-semibold text-[var(--foreground)] whitespace-nowrap">
                        {Math.round((Number(r.margen) || 0) * 100)}%
                      </div>
                      <div className="mt-1 text-[10px] sm:text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                        {r.productos?.length || 0} productos
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-2.5 py-2 sm:px-3 sm:py-3 border-t sm:border-t-0 sm:border-l border-[var(--input-border)] bg-black/10 transition-colors duration-150 group-hover:bg-black/20">
                  <button
                    type="button"
                    className="text-[var(--foreground)]/80 hover:text-[var(--foreground)] disabled:opacity-50 p-2.5 rounded-md hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 transition-colors"
                    onClick={() => openEditDrawer(r)}
                    disabled={saving || deletingId !== null}
                    title="Editar receta"
                    aria-label="Editar receta"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="text-red-400 hover:text-red-300 disabled:opacity-50 p-2.5 rounded-md hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 transition-colors"
                    onClick={() => openRemoveModal(r.id, r.nombre || r.id)}
                    disabled={saving || deletingId !== null}
                    title="Eliminar receta"
                    aria-label="Eliminar receta"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmModal
        open={confirmState.open}
        title="Eliminar receta"
        message={`Quieres eliminar la receta "${confirmState.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        actionType="delete"
        loading={deletingId !== null && deletingId === confirmState.id}
        onConfirm={confirmRemoveReceta}
        onCancel={closeRemoveModal}
      />
    </div>
  );
}
