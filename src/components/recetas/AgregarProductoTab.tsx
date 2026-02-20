"use client";

import React, { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import {
    Lock,
    PackagePlus,
    Plus,
    Pencil,
    Trash2,
    X,
    Search,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getDefaultPermissions } from "@/utils/permissions";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useProductos } from "@/hooks/useProductos";
import useToast from "@/hooks/useToast";
import type { ProductEntry } from "@/types/firestore";

const sanitizeNumber = (value: string): number => {
    const trimmed = String(value || "").trim().replace(/,/g, ".");
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value: number, maxDecimals = 4): string => {
    if (!Number.isFinite(value)) return "0";
    return new Intl.NumberFormat("es-CR", {
        maximumFractionDigits: maxDecimals,
    }).format(value);
};

const computePrecioXGramo = (precio: number, pesoengramos: number): number => {
    if (!Number.isFinite(precio) || !Number.isFinite(pesoengramos)) return 0;
    if (pesoengramos <= 0) return 0;
    return precio / pesoengramos;
};

export function AgregarProductoTab() {
    const { user, loading: authLoading } = useAuth();
    const permissions =
        user?.permissions || getDefaultPermissions(user?.role || "user");
    const canAgregarProductos = Boolean(permissions.agregarproductosdeli);

    const { showToast } = useToast();

    const {
        productos,
        loading: productosLoading,
        error,
        addProducto,
        updateProducto,
        removeProducto,
    } = useProductos();

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState<number | "all">(10);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [nombre, setNombre] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [pesoEnGramos, setPesoEnGramos] = useState("");
    const [precio, setPrecio] = useState("");

    const [confirmState, setConfirmState] = useState<{
        open: boolean;
        id: string;
        nombre: string;
    }>({ open: false, id: "", nombre: "" });

    const [saveConfirmState, setSaveConfirmState] = useState<null | {
        mode: "add" | "edit";
        productId?: string;
        input: {
            nombre: string;
            descripcion?: string;
            pesoengramos: number;
            precio: number;
        };
    }>(null);

    const isLoading = authLoading || productosLoading;
    const resolvedError = formError || error;

    const filteredProductos = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return productos;
        return productos.filter((p) => {
            const n = (p.nombre || "").toLowerCase();
            const d = (p.descripcion || "").toLowerCase();
            const i = (p.id || "").toLowerCase();
            return n.includes(term) || d.includes(term) || i.includes(term);
        });
    }, [productos, searchTerm]);

    const totalPages = useMemo(() => {
        if (itemsPerPage === "all") return 1;
        return Math.max(1, Math.ceil(filteredProductos.length / itemsPerPage));
    }, [filteredProductos.length, itemsPerPage]);

    const paginatedProductos = useMemo(() => {
        if (itemsPerPage === "all") return filteredProductos;
        const start = (currentPage - 1) * itemsPerPage;
        return filteredProductos.slice(start, start + itemsPerPage);
    }, [filteredProductos, currentPage, itemsPerPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, itemsPerPage]);

    const resetForm = () => {
        setFormError(null);
        setNombre("");
        setDescripcion("");
        setPesoEnGramos("");
        setPrecio("");
        setEditingProductId(null);
    };

    const openAddDrawer = () => {
        resetForm();
        setDrawerOpen(true);
    };

    const openEditDrawer = (p: ProductEntry) => {
        setFormError(null);
        setEditingProductId(p.id);
        setNombre(p.nombre || "");
        setDescripcion(p.descripcion || "");
        setPesoEnGramos(String(p.pesoengramos ?? ""));
        setPrecio(String(p.precio ?? ""));
        setDrawerOpen(true);
    };

    const openRemoveModal = (p: ProductEntry) => {
        setConfirmState({ open: true, id: p.id, nombre: p.nombre || p.id });
    };

    const closeRemoveModal = () =>
        setConfirmState({ open: false, id: "", nombre: "" });

    const closeSaveConfirmModal = () => setSaveConfirmState(null);

    const confirmRemoveProducto = async () => {
        if (!confirmState.id || deletingId) return;
        try {
            setFormError(null);
            setDeletingId(confirmState.id);
            await removeProducto(confirmState.id);
            showToast("Producto eliminado.", "success");
            closeRemoveModal();
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "No se pudo eliminar el producto.";
            setFormError(message);
            showToast(message, "error");
        } finally {
            setDeletingId(null);
        }
    };

    const requestSaveConfirm = () => {
        const nombreTrim = nombre.trim();
        if (!nombreTrim) {
            setFormError("Nombre requerido.");
            return;
        }
        const pesoVal = sanitizeNumber(pesoEnGramos);
        const precioVal = sanitizeNumber(precio);
        if (pesoVal <= 0) {
            setFormError("El peso en gramos debe ser mayor a 0.");
            return;
        }
        if (precioVal < 0) {
            setFormError("El precio no puede ser negativo.");
            return;
        }
        if (productosLoading) {
            setFormError("Espera a que carguen los productos.");
            return;
        }

        setFormError(null);
        setSaveConfirmState({
            mode: editingProductId ? "edit" : "add",
            productId: editingProductId ?? undefined,
            input: {
                nombre: nombreTrim,
                descripcion: descripcion.trim() || undefined,
                pesoengramos: pesoVal,
                precio: precioVal,
            },
        });
    };

    const confirmSaveProducto = async () => {
        if (!saveConfirmState) return;
        try {
            setSaving(true);
            setFormError(null);

            if (saveConfirmState.mode === "edit" && saveConfirmState.productId) {
                await updateProducto(saveConfirmState.productId, saveConfirmState.input);
                showToast("Producto actualizado.", "success");
            } else {
                await addProducto(saveConfirmState.input);
                showToast("Producto agregado.", "success");
            }

            closeSaveConfirmModal();
            setDrawerOpen(false);
            resetForm();
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "No se pudo guardar el producto.";
            setFormError(message);
            showToast(message, "error");
            // Cerrar el modal para permitir corregir el formulario.
            closeSaveConfirmModal();
        } finally {
            setSaving(false);
        }
    };

    const precioNum = sanitizeNumber(precio);
    const pesoNum = sanitizeNumber(pesoEnGramos);
    const precioXGramo = computePrecioXGramo(precioNum, pesoNum);

    if (authLoading) {
        return (
            <div className="max-w-4xl mx-auto bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg shadow p-6">
                <p className="text-sm text-[var(--muted-foreground)] text-center">
                    Cargando permisos...
                </p>
            </div>
        );
    }

    if (!canAgregarProductos) {
        return (
            <div className="max-w-4xl mx-auto bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg shadow p-6">
                <div className="flex flex-col items-center text-center py-8">
                    <Lock className="w-10 h-10 text-[var(--muted-foreground)] mb-4" />
                    <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                        Acceso restringido
                    </h3>
                    <p className="text-[var(--muted-foreground)]">
                        Tu usuario no tiene permisos para agregar productos.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg shadow p-4 sm:p-6">
            <ConfirmModal
                open={saveConfirmState !== null}
                title={saveConfirmState?.mode === "edit" ? "Confirmar actualización" : "Confirmar guardado"}
                message={
                    saveConfirmState?.mode === "edit"
                        ? `Quieres actualizar el producto "${saveConfirmState?.input.nombre}"?`
                        : `Quieres guardar el producto "${saveConfirmState?.input.nombre}"?`
                }
                confirmText={saveConfirmState?.mode === "edit" ? "Actualizar" : "Guardar"}
                cancelText="Cancelar"
                actionType={saveConfirmState?.mode === "edit" ? "change" : "assign"}
                loading={saving}
                onConfirm={confirmSaveProducto}
                onCancel={closeSaveConfirmModal}
            />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                    <PackagePlus className="w-5 h-5 text-[var(--muted-foreground)]" />
                    <div>
                        <h2 className="text-sm sm:text-base font-medium text-[var(--muted-foreground)]">
                            Productos
                        </h2>
                        <p className="text-[10px] sm:text-xs text-[var(--muted-foreground)]">
                            Administra productos en la colección "productos".
                        </p>
                    </div>
                </div>

                <div className="flex w-full sm:w-auto flex-col sm:flex-row items-stretch sm:items-end gap-2 sm:gap-3">
                    <div className="relative w-full sm:min-w-[260px]">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2.5 pr-10 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                            placeholder={productosLoading ? "Cargando..." : "Buscar producto"}
                            aria-label="Buscar producto"
                        />
                    </div>

                    <select
                        value={itemsPerPage}
                        onChange={(e) => {
                            const val = e.target.value;
                            setItemsPerPage(val === "all" ? "all" : Number(val));
                        }}
                        className="w-full sm:w-auto px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
                        aria-label="Items por página"
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value="all">Todos</option>
                    </select>

                    <button
                        type="button"
                        onClick={openAddDrawer}
                        disabled={saving || productosLoading}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--accent)] text-white rounded-lg shadow-sm ring-1 ring-white/10 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-colors whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Agregar producto</span>
                    </button>
                </div>
            </div>

            {resolvedError && (
                <div className="mb-4 text-sm text-red-500">{resolvedError}</div>
            )}

            <div>
                <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                    <h3 className="text-[10px] sm:text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                        Lista de productos
                    </h3>
                    {itemsPerPage !== "all" && filteredProductos.length > 0 && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="p-2 rounded border border-[var(--input-border)] text-[var(--foreground)] disabled:opacity-50"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                aria-label="Página anterior"
                                title="Anterior"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <div className="text-xs text-[var(--muted-foreground)]">
                                {currentPage} / {totalPages}
                            </div>
                            <button
                                type="button"
                                className="p-2 rounded border border-[var(--input-border)] text-[var(--foreground)] disabled:opacity-50"
                                disabled={currentPage >= totalPages}
                                onClick={() =>
                                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                                }
                                aria-label="Página siguiente"
                                title="Siguiente"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <p className="text-xs sm:text-sm text-[var(--muted-foreground)] py-4 text-center">
                        Cargando productos...
                    </p>
                ) : (
                    <ul className="space-y-1.5 sm:space-y-2">
                        {filteredProductos.length === 0 && (
                            <li className="text-xs sm:text-sm text-[var(--muted-foreground)] py-4 text-center">
                                {searchTerm
                                    ? "No se encontraron productos."
                                    : "Aún no hay productos."}
                            </li>
                        )}

                        {paginatedProductos.map((p) => (
                            <li
                                key={p.nombre}
                                className="flex flex-col sm:flex-row sm:items-stretch border border-[var(--input-border)] rounded-lg overflow-hidden bg-[var(--input-bg)]"
                            >
                                <div className="flex-1 p-3 sm:p-4 min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-semibold text-[var(--foreground)] truncate">
                                                {p.nombre}
                                            </div>
                                            {p.descripcion && (
                                                <div className="mt-2 text-xs text-[var(--muted-foreground)] break-words">
                                                    {p.descripcion}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-[var(--muted-foreground)]">
                                                ₡ {formatNumber(p.precio, 2)}
                                            </div>
                                            <div className="text-[10px] sm:text-xs text-[var(--muted-foreground)]">
                                                {formatNumber(p.pesoengramos, 0)} g · ₡ {formatNumber(p.precioxgramo, 4)}/g
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 px-2.5 py-2 sm:px-3 sm:py-3 border-t sm:border-t-0 sm:border-l border-[var(--input-border)] bg-black/10">
                                    <button
                                        type="button"
                                        className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50 p-2 rounded-md hover:bg-white/5 transition-colors"
                                        onClick={() => openEditDrawer(p)}
                                        disabled={saving || deletingId !== null}
                                        title="Editar producto"
                                        aria-label="Editar producto"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>

                                    <div className="w-px h-7 bg-[var(--input-border)]" />

                                    <button
                                        type="button"
                                        className="text-red-400 hover:text-red-300 disabled:opacity-50 p-2 rounded-md hover:bg-red-500/10 transition-colors"
                                        onClick={() => openRemoveModal(p)}
                                        disabled={saving || deletingId !== null}
                                        title="Eliminar producto"
                                        aria-label="Eliminar producto"
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
                title="Eliminar producto"
                message={`Quieres eliminar el producto "${confirmState.nombre}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                actionType="delete"
                loading={deletingId !== null && deletingId === confirmState.id}
                onConfirm={confirmRemoveProducto}
                onCancel={closeRemoveModal}
            />

            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={() => {
                    setDrawerOpen(false);
                    resetForm();
                }}
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
                        <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                            {editingProductId ? "Editar producto" : "Agregar producto"}
                        </Typography>
                        <IconButton
                            aria-label="Cerrar"
                            onClick={() => {
                                setDrawerOpen(false);
                                resetForm();
                            }}
                            sx={{ color: "var(--foreground)" }}
                        >
                            <X className="w-4 h-4" />
                        </IconButton>
                    </Box>
                    <Divider sx={{ borderColor: "var(--input-border)" }} />

                    <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 3 }}>
                        {resolvedError && (
                            <div className="mb-4 text-sm text-red-400">{resolvedError}</div>
                        )}

                        <div className="flex flex-col gap-3">
                            <input
                                className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
                                placeholder="Nombre del producto"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                disabled={saving || deletingId !== null}
                                autoFocus
                            />
                            <textarea
                                className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)] min-h-[90px]"
                                placeholder="Descripción (opcional)"
                                value={descripcion}
                                onChange={(e) => setDescripcion(e.target.value)}
                                disabled={saving || deletingId !== null}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input
                                    className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
                                    placeholder="Peso en gramos"
                                    inputMode="decimal"
                                    value={pesoEnGramos}
                                    onChange={(e) => setPesoEnGramos(e.target.value)}
                                    disabled={saving || deletingId !== null}
                                />
                                <input
                                    className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
                                    placeholder="Precio"
                                    inputMode="decimal"
                                    value={precio}
                                    onChange={(e) => setPrecio(e.target.value)}
                                    disabled={saving || deletingId !== null}
                                />
                            </div>

                            <div className="rounded border border-[var(--input-border)] p-3 bg-[var(--input-bg)]">
                                <div className="text-xs text-[var(--muted-foreground)]">
                                    Precio por gramo
                                </div>
                                <div className="text-sm font-semibold text-[var(--foreground)]">
                                    ₡ {formatNumber(precioXGramo, 6)} / g
                                </div>
                            </div>
                        </div>
                    </Box>

                    <Divider sx={{ borderColor: "var(--input-border)" }} />
                    <Box sx={{ px: 3, py: 2 }}>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setDrawerOpen(false);
                                    resetForm();
                                }}
                                className="px-4 py-2 border border-[var(--input-border)] rounded text-[var(--foreground)] hover:bg-[var(--muted)]"
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    requestSaveConfirm();
                                }}
                                className="px-4 py-2 bg-[var(--accent)] text-white rounded disabled:opacity-50"
                                disabled={saving || deletingId !== null}
                            >
                                {saving
                                    ? editingProductId
                                        ? "Actualizando..."
                                        : "Guardando..."
                                    : editingProductId
                                        ? "Actualizar"
                                        : "Guardar"}
                            </button>
                        </div>
                    </Box>
                </Box>
            </Drawer>
        </div>
    );
}
