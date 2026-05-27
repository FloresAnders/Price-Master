"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Trash2,
  Plus,
  Package,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  User,
  FileText,
  Edit,
  Download,
  Lock as LockIcon,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import useToast from "../../hooks/useToast";
import { hasPermission } from "../../utils/permissions";
import { useProviders } from "../../hooks/useProviders";
import { EmpresasService } from "../../services/empresas";
import {
  SupplierOrdersService,
  SupplierOrderEntry,
  SupplierOrderProduct,
} from "../../services/supplier-orders";

type Product = SupplierOrderProduct;

interface SupplierOrderView extends SupplierOrderEntry {
  documentId?: string;
}

export default function SupplierOrders() {
  /* Verificar permisos del usuario */
  const { user } = useAuth();
  const { showToast } = useToast();
  const canSelectCompany = user?.role === "admin" || user?.role === "superadmin";
  const companyStorageKey = "supplierOrders.selectedCompanyName";

  // Form states
  const [supplierName, setSupplierName] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [companyOptions, setCompanyOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [selectedCompanyName, setSelectedCompanyName] = useState("");

  // Product form states
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState<number>(1);

  const ownerCompany = user?.ownercompanie?.trim() || "";
  const userLoaded = Boolean(user);
  const activeCompanyName = selectedCompanyName.trim() || ownerCompany;
  const { providers: companyProviders } = useProviders(activeCompanyName);
  const inventoryProviders = useMemo(
    () =>
      companyProviders
        .filter((provider) => {
          const normalizedType = String(provider.type || "")
            .trim()
            .toUpperCase();
          return (
            normalizedType === "COMPRA INVENTARIO" ||
            normalizedType === "COMPRA DE INVENTARIO"
          );
        })
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [companyProviders],
  );

  // Current order products
  const [products, setProducts] = useState<Product[]>([]);

  // Orders history
  const [orders, setOrders] = useState<SupplierOrderView[]>([]);
  const [showOrdersList, setShowOrdersList] = useState(false);

  // Edit functionality
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Async state
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recurrent data
  const [recurrentSuppliers, setRecurrentSuppliers] = useState<string[]>([]);
  const [recurrentProducts, setRecurrentProducts] = useState<string[]>([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [exportTarget, setExportTarget] = useState<SupplierOrderView | null>(
    null,
  );

  // Fondo General style calendar helpers (YYYY-MM-DD)
  const dateKeyFromDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  const formatKeyToDisplay = (isoDateKey: string | null) => {
    if (!isoDateKey) return "dd/mm/yyyy";
    const [y, m, d] = isoDateKey.split("-").map(Number);
    const dd = String(d).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    const yyyy = String(y);
    return `${dd}/${mm}/${yyyy}`;
  };
  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);

  // Calendar popovers (order date + expected delivery)
  const [orderCalendarOpen, setOrderCalendarOpen] = useState(false);
  const [deliveryCalendarOpen, setDeliveryCalendarOpen] = useState(false);
  const [orderCalendarMonth, setOrderCalendarMonth] = useState(() => new Date());
  const [deliveryCalendarMonth, setDeliveryCalendarMonth] = useState(
    () => new Date(),
  );
  const orderCalendarRef = React.useRef<HTMLDivElement | null>(null);
  const deliveryCalendarRef = React.useRef<HTMLDivElement | null>(null);
  const orderButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const deliveryButtonRef = React.useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!orderCalendarOpen && !deliveryCalendarOpen) return;
    const handler = (evt: MouseEvent) => {
      const target = evt.target as Node | null;
      if (!target) return;

      if (orderCalendarOpen) {
        const clickedInsideCalendar =
          orderCalendarRef.current?.contains(target) ?? false;
        const clickedButton = orderButtonRef.current?.contains(target) ?? false;
        if (!clickedInsideCalendar && !clickedButton) setOrderCalendarOpen(false);
      }

      if (deliveryCalendarOpen) {
        const clickedInsideCalendar =
          deliveryCalendarRef.current?.contains(target) ?? false;
        const clickedButton =
          deliveryButtonRef.current?.contains(target) ?? false;
        if (!clickedInsideCalendar && !clickedButton)
          setDeliveryCalendarOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [orderCalendarOpen, deliveryCalendarOpen]);

  // Auto-complete order date on component mount
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setOrderDate(today);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCompanies = async () => {
      if (!userLoaded) {
        setCompanyOptions([]);
        setSelectedCompanyName("");
        return;
      }

      if (!canSelectCompany) {
        const fallback = ownerCompany;
        setCompanyOptions(
          fallback ? [{ value: fallback, label: fallback }] : [],
        );
        setSelectedCompanyName(fallback);
        return;
      }

      try {
        const empresas = await EmpresasService.getAllEmpresas();
        const allowedCompanies =
          user?.role === "superadmin"
            ? empresas
            : (empresas || []).filter((empresa) => {
                const empresaOwnerId = String(empresa?.ownerId || "").trim();
                const userId = String(user?.id || "").trim();
                const ownerId = String(user?.ownerId || "").trim();

                return (
                  !!empresaOwnerId &&
                  (empresaOwnerId === userId ||
                    (ownerId && empresaOwnerId === ownerId))
                );
              });

        const mappedCompanies = allowedCompanies
          .map((empresa) => {
            const value = String(
              empresa?.name || empresa?.ubicacion || empresa?.id || "",
            ).trim();
            if (!value) return null;

            return {
              value,
              label: String(
                empresa?.name || empresa?.ubicacion || empresa?.id || "Empresa",
              ).trim(),
            };
          })
          .filter((company): company is { value: string; label: string } => Boolean(company));

        const fallbackCompany = ownerCompany
          ? { value: ownerCompany, label: ownerCompany }
          : null;

        const nextOptions =
          mappedCompanies.length > 0
            ? mappedCompanies
            : fallbackCompany
              ? [fallbackCompany]
              : [];

        if (cancelled) return;

        setCompanyOptions(nextOptions);
        setSelectedCompanyName((current) => {
          const storedCompany =
            typeof window !== "undefined"
              ? window.localStorage.getItem(companyStorageKey) || ""
              : "";
          const trimmedCurrent = current.trim();
          const trimmedStored = storedCompany.trim();
          if (
            trimmedStored &&
            nextOptions.some((company) => company.value === trimmedStored)
          ) {
            return trimmedStored;
          }
          if (
            trimmedCurrent &&
            nextOptions.some((company) => company.value === trimmedCurrent)
          ) {
            return trimmedCurrent;
          }

          return nextOptions[0]?.value || "";
        });
      } catch (err) {
        console.error("Error loading company options:", err);
        if (cancelled) return;

        const fallback = ownerCompany;
        setCompanyOptions(
          fallback ? [{ value: fallback, label: fallback }] : [],
        );
        setSelectedCompanyName(fallback);
      }
    };

    void loadCompanies();

    return () => {
      cancelled = true;
    };
  }, [
    canSelectCompany,
    companyStorageKey,
    ownerCompany,
    user?.id,
    user?.ownerId,
    user?.role,
    userLoaded,
  ]);

  useEffect(() => {
    if (!canSelectCompany || !selectedCompanyName) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(companyStorageKey, selectedCompanyName);
  }, [canSelectCompany, companyStorageKey, selectedCompanyName]);

  const loadOrders = useCallback(async (companyName: string) => {
    if (!companyName) {
      setOrders([]);
      setRecurrentSuppliers([]);
      setRecurrentProducts([]);
      setError(
        userLoaded
          ? canSelectCompany
            ? "No se encontraron empresas disponibles para este usuario."
            : "No se encontró una empresa asociada al usuario. Contacta al administrador."
          : null,
      );
      return;
    }

    setLoadingOrders(true);
    setError(null);

    try {
      const documents =
        await SupplierOrdersService.fetchOrdersForCompany(companyName);
      const flattened: SupplierOrderView[] = [];
      const supplierSet = new Set<string>();
      const productSet = new Set<string>();

      documents.forEach((doc) => {
        const docSupplier = doc.supplierName || "";
        doc.orders.forEach((order) => {
          const supplier = order.supplierName || docSupplier;
          flattened.push({
            ...order,
            supplierName: supplier,
            companyName: order.companyName || doc.companyName || companyName,
            documentId: doc.id,
          });

          if (supplier) {
            supplierSet.add(supplier);
          }

          order.products.forEach((product) => {
            if (product.name) {
              productSet.add(product.name);
            }
          });
        });
      });

      flattened.sort((a, b) => {
        const aDate = a.orderDate ? new Date(a.orderDate).getTime() : 0;
        const bDate = b.orderDate ? new Date(b.orderDate).getTime() : 0;
        return bDate - aDate;
      });

      setOrders(flattened);
      setRecurrentSuppliers(Array.from(supplierSet));
      setRecurrentProducts(Array.from(productSet));
    } catch (err) {
      console.error("Error loading supplier orders:", err);
      setError("No se pudieron cargar las órdenes. Intenta nuevamente.");
    } finally {
      setLoadingOrders(false);
    }
  }, [canSelectCompany, userLoaded]);

  useEffect(() => {
    loadOrders(activeCompanyName);
  }, [activeCompanyName, loadOrders]);

  // Calculate total for current products
  const calculateTotal = (): number => {
    return products.reduce((total, product) => {
      if (typeof product.price === "number") {
        return total + product.quantity * product.price;
      }
      return total;
    }, 0);
  };

  // Add product to current order
  const addProduct = () => {
    if (!productName.trim()) return;

    const newProduct: Product = {
      id: Date.now().toString(),
      name: productName.trim(),
      quantity: quantity,
    };

    setProducts((prev) => [...prev, newProduct]);

    // Add to recurrent products if not already there
    const trimmedName = productName.trim();
    if (!recurrentProducts.includes(trimmedName)) {
      setRecurrentProducts((prev) => [...prev, trimmedName]);
    }

    // Clear form
    setProductName("");
    setQuantity(1);
    setShowProductDropdown(false);
  };

  // Remove product from current order
  const removeProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  // Save current order
  const saveOrder = async () => {
    if (!supplierName.trim() || products.length === 0) {
      showToast(
        "Por favor completa el nombre del proveedor y agrega al menos un producto.",
        "error",
      );
      return;
    }

    if (!activeCompanyName) {
      showToast(
        canSelectCompany
          ? "No se encontraron empresas disponibles para guardar la orden."
          : "No se encontró una empresa asociada al usuario. Contacta al administrador.",
        "error",
      );
      return;
    }

    const trimmedSupplier = supplierName.trim();
    const total = calculateTotal();
    const existingOrder = editingOrderId
      ? orders.find((order) => order.id === editingOrderId)
      : undefined;
    const now = new Date().toISOString();

    const orderPayload: SupplierOrderEntry = {
      id: editingOrderId || Date.now().toString(),
      supplierName: trimmedSupplier,
      companyName: activeCompanyName,
      orderDate,
      expectedDeliveryDate,
      notes: notes.trim(),
      products: [...products],
      total: total > 0 ? total : undefined,
      createdAt: existingOrder?.createdAt || now,
      updatedAt: now,
      createdBy: existingOrder?.createdBy || user?.id,
      updatedBy: user?.id,
    };

    setIsSaving(true);

    try {
      const previousDocId = isEditing ? editingDocId : null;
      await SupplierOrdersService.saveOrder({
        companyName: activeCompanyName,
        supplierName: trimmedSupplier,
        order: orderPayload,
        userId: user?.id,
        previousDocumentId: previousDocId,
      });

      await loadOrders(activeCompanyName);

      if (!recurrentSuppliers.includes(trimmedSupplier)) {
        setRecurrentSuppliers((prev) => [...prev, trimmedSupplier]);
      }

      if (isEditing) {
        showToast("Orden actualizada exitosamente!", "success");
        cancelEdit();
      } else {
        clearForm();
        showToast("Orden guardada exitosamente!", "success");
      }
    } catch (err) {
      console.error("Error saving supplier order:", err);
      showToast("No se pudo guardar la orden. Intenta nuevamente.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Start editing an existing order
  const startEdit = (order: SupplierOrderView) => {
    setSupplierName(order.supplierName);
    setOrderDate(order.orderDate);
    setExpectedDeliveryDate(order.expectedDeliveryDate || "");
    setNotes(order.notes || "");
    setProducts([...order.products]);
    setEditingOrderId(order.id);
    setEditingDocId(order.documentId || null);
    setIsEditing(true);
    setShowOrdersList(false); // Switch to form view
  };

  // Cancel editing
  const cancelEdit = () => {
    setIsEditing(false);
    setEditingOrderId(null);
    setEditingDocId(null);
    clearForm();
  };

  // Clear form for new order
  const clearForm = () => {
    if (!isEditing) {
      // Only clear supplier name if not editing
      setSupplierName("");
    }
    setOrderDate(new Date().toISOString().split("T")[0]);
    setExpectedDeliveryDate("");
    setNotes("");
    setProducts([]);
    setProductName("");
    setQuantity(1);
    setShowSupplierDropdown(false);
    setShowProductDropdown(false);
    setIsEditing(false);
    setEditingOrderId(null);
    setEditingDocId(null);
  };

  // Delete saved order
  const deleteOrder = async (orderId: string, documentId?: string | null) => {
    if (!documentId) {
      showToast("No se pudo identificar la orden a eliminar.", "error");
      return;
    }

    if (!confirm("¿Estás seguro de que quieres eliminar esta orden?")) {
      return;
    }

    try {
      await SupplierOrdersService.removeOrder({ documentId, orderId });
      if (editingOrderId === orderId) {
        cancelEdit();
      }
      await loadOrders(activeCompanyName);
      showToast("Orden eliminada exitosamente!", "success");
    } catch (err) {
      console.error("Error deleting supplier order:", err);
      showToast("No se pudo eliminar la orden. Intenta nuevamente.", "error");
    }
  };

  // Filter suppliers and products based on input
  const filteredInventoryProviders = inventoryProviders
    .filter((provider) => {
      const query = supplierName.trim().toLowerCase();
      if (!query) return true;

      return (
        provider.name.toLowerCase().includes(query) ||
        provider.code.toLowerCase().includes(query)
      );
    })
    .slice(0, 8);

  const filteredProducts = recurrentProducts
    .filter((product) =>
      product.toLowerCase().includes(productName.toLowerCase()),
    )
    .slice(0, 5); // Limit to 5 suggestions

  const buildSafeFileName = useCallback(
    (supplier: string, extension: "json" | "txt") => {
      const cleaned = (supplier || "orden")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-_]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");

      const baseName = cleaned || "orden";
      return `${baseName}.${extension}`;
    },
    [],
  );

  const exportOrder = useCallback(
    (order: SupplierOrderView, format: "json" | "txt") => {
      if (!order.products || order.products.length === 0) {
        showToast("Esta orden no contiene productos para exportar.", "info");
        return;
      }

      const productData = order.products.map((product) => ({
        nombre: product.name,
        cantidad: product.quantity,
      }));

      let content: string;
      let mimeType: string;

      if (format === "json") {
        const payload = {
          proveedor: order.supplierName,
          fechaOrden: order.orderDate,
          productos: productData,
        };
        content = JSON.stringify(payload, null, 2);
        mimeType = "application/json";
      } else {
        const headerLines = [
          `Proveedor: ${order.supplierName}`,
          "Nombre — Cantidad",
        ];
        const body = productData
          .map((item) => `${item.nombre} — ${item.cantidad}`)
          .join("\n");
        content = `${headerLines.join("\n")}\n${body}`.trim();
        mimeType = "text/plain";
      }

      try {
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = buildSafeFileName(order.supplierName, format);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Error exporting supplier order:", err);
        showToast("No se pudo exportar la orden. Intenta nuevamente.", "error");
      }
    },
    [buildSafeFileName, showToast],
  );

  const closeExportModal = useCallback(() => {
    setExportTarget(null);
  }, []);

  const handleExportSelection = useCallback(
    (format: "json" | "txt") => {
      if (!exportTarget) return;
      exportOrder(exportTarget, format);
      setExportTarget(null);
    },
    [exportOrder, exportTarget],
  );

  const openExportModal = useCallback((order: SupplierOrderView) => {
    setExportTarget(order);
  }, []);

  // Handle supplier selection
  const selectSupplier = (supplier: string) => {
    setSupplierName(supplier);
    setShowSupplierDropdown(false);
  };

  const clearSupplierSelection = () => {
    setSupplierName("");
    setShowSupplierDropdown(false);
  };

  const selectCompany = (companyName: string) => {
    setSelectedCompanyName(companyName);
    if (isEditing) {
      cancelEdit();
    }
    clearForm();
  };

  // Handle product selection
  const selectProduct = (product: string) => {
    setProductName(product);
    setShowProductDropdown(false);
  };

  // Verificar si el usuario tiene permiso para usar las órdenes de proveedor
  if (!hasPermission(user?.permissions, "supplierorders")) {
    return (
      <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
        <div className="text-center">
          <LockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Acceso Restringido
          </h3>
          <p className="text-[var(--muted-foreground)]">
            No tienes permisos para acceder a las Órdenes de Proveedor.
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Contacta a un administrador para obtener acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {exportTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={closeExportModal}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-6 text-[var(--foreground)] shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Exportar orden</h3>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--muted-foreground)" }}
            >
              Selecciona el formato para descargar la orden de{" "}
              {exportTarget.supplierName}.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleExportSelection("json")}
                className="w-full h-11 rounded-lg bg-[var(--button-bg)] px-4 text-[var(--button-text)] hover:bg-[var(--button-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
              >
                Descargar JSON
              </button>
              <button
                onClick={() => handleExportSelection("txt")}
                className="w-full h-11 rounded-lg bg-[var(--button-bg)] px-4 text-[var(--button-text)] hover:bg-[var(--button-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
              >
                Descargar TXT
              </button>
              <button
                onClick={closeExportModal}
                className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-4 text-[var(--foreground)] hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Toggle between new order and orders list */}
      <div className="flex justify-center gap-4 mb-6">
        <button
          onClick={() => {
            if (isEditing) {
              cancelEdit();
            }
            setShowOrdersList(false);
          }}
          className={`px-6 py-2 rounded-lg font-medium transition-colors border-2 ${
            !showOrdersList
              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
              : "bg-[var(--card-bg)] text-[var(--foreground)] border-[var(--input-border)] hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20"
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40`}
        >
          {isEditing ? "Editando Orden" : "Nueva Orden"}
        </button>
        <button
          onClick={() => {
            if (isEditing) {
              cancelEdit();
            }
            setShowOrdersList(true);
          }}
          className={`px-6 py-2 rounded-lg font-medium transition-colors border-2 ${
            showOrdersList
              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
              : "bg-[var(--card-bg)] text-[var(--foreground)] border-[var(--input-border)] hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20"
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40`}
        >
          Órdenes Guardadas ({orders.length})
        </button>
      </div>

      {!showOrdersList ? (
        /* New Order Form */
        <div className="space-y-6">
          {/* Main Order Form */}
          <div
            className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-6"
          >
            <h3
              className="text-lg font-semibold mb-4 flex items-center gap-2"
              style={{ color: "var(--foreground)" }}
            >
              <Package className="w-5 h-5" />
              Información de la Orden
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {canSelectCompany && (
                <div className="md:col-span-2">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                    Empresa
                  </label>
                  <select
                    value={activeCompanyName}
                    onChange={(e) => selectCompany(e.target.value)}
                    className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] outline-none transition-colors hover:border-[var(--accent)]/60 focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                  >
                    {companyOptions.length === 0 ? (
                      <option value="">No hay empresas disponibles</option>
                    ) : (
                      companyOptions.map((company) => (
                        <option key={company.value} value={company.value}>
                          {company.label}
                        </option>
                      ))
                    )}
                  </select>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {user?.role === "superadmin"
                      ? "Como superadministrador puedes usar cualquier empresa registrada."
                      : "Se muestran solo las empresas que tienes a cargo."}
                  </p>
                </div>
              )}

              <div className="relative">
                <label
                  className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
                >
                  <User className="w-4 h-4" />
                  Proveedor de inventario
                </label>
                <div className="relative group">
                  {supplierName && (
                    <button
                      type="button"
                      aria-label="Limpiar proveedor seleccionado"
                      title="Limpiar proveedor seleccionado"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        clearSupplierSelection();
                      }}
                      className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-red-400 transition-colors hover:text-red-300"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                  <input
                    value={supplierName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSupplierName(value);
                      setShowSupplierDropdown(true);

                      if (value.trim() === "") {
                        clearSupplierSelection();
                      }
                    }}
                    onFocus={() => setShowSupplierDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => setShowSupplierDropdown(false), 200);
                    }}
                    className={`${canSelectCompany ? "" : ""} w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] hover:border-[var(--accent)]/60 focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 ${supplierName ? "pl-10 pr-10" : "pr-10"}`}
                    placeholder={
                      inventoryProviders.length === 0
                        ? "No hay proveedores de compra inventario"
                        : "Buscar proveedor"
                    }
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-[var(--muted-foreground)]">
                    {showSupplierDropdown ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </span>
                  {showSupplierDropdown && filteredInventoryProviders.length > 0 && (
                    <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] shadow-lg">
                      {filteredInventoryProviders.map((provider) => (
                        <button
                          key={provider.code}
                          type="button"
                          className="w-full border-b border-[var(--input-border)] px-3 py-2 text-left text-sm text-[var(--foreground)] transition-colors last:border-b-0 hover:bg-[var(--muted)]/20"
                          onMouseDown={() => {
                            selectSupplier(provider.name);
                            setShowSupplierDropdown(false);
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate font-medium">
                              {provider.name}
                            </span>
                            <span className="shrink-0 rounded bg-[var(--muted)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                              {provider.code}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Solo se muestran proveedores con tipo COMPRA INVENTARIO.
                </p>
              </div>

              <div>
                <label
                  className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
                >
                  <Calendar className="w-4 h-4" />
                  Fecha de Orden
                </label>
                <div className="relative">
                  <button
                    type="button"
                    ref={orderButtonRef}
                    onClick={() => {
                      const base = orderDate ? new Date(`${orderDate}T00:00:00`) : new Date();
                      if (!Number.isNaN(base.getTime())) setOrderCalendarMonth(base);
                      setOrderCalendarOpen((prev) => !prev);
                      setDeliveryCalendarOpen(false);
                    }}
                    className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                    title="Seleccionar fecha de orden"
                    aria-label="Seleccionar fecha de orden"
                  >
                    <span className="truncate text-sm font-medium">
                      {orderDate ? formatKeyToDisplay(orderDate) : "dd/mm/yyyy"}
                    </span>
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border border-[var(--input-border)] bg-[var(--muted)]/20 text-[var(--muted-foreground)]">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                  </button>

                  {orderCalendarOpen && (
                    <div
                      ref={orderCalendarRef}
                      className="absolute left-0 top-full z-50 mt-2 w-full min-w-[280px] sm:w-72"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-3 text-[var(--foreground)] shadow-lg">
                        <div className="mb-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              const m = new Date(orderCalendarMonth);
                              m.setMonth(m.getMonth() - 1);
                              setOrderCalendarMonth(new Date(m));
                            }}
                            className="p-1 rounded hover:bg-[var(--muted)]"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <div className="text-sm font-semibold capitalize">
                            {orderCalendarMonth.toLocaleString("es-CR", {
                              month: "long",
                              year: "numeric",
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const m = new Date(orderCalendarMonth);
                              m.setMonth(m.getMonth() + 1);
                              setOrderCalendarMonth(new Date(m));
                            }}
                            className="p-1 rounded hover:bg-[var(--muted)]"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--muted-foreground)]">
                          {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
                            <div key={`${d}-${i}`} className="py-1">
                              {d}
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 grid grid-cols-7 gap-1 text-sm">
                          {(() => {
                            const cells: React.ReactNode[] = [];
                            const year = orderCalendarMonth.getFullYear();
                            const month = orderCalendarMonth.getMonth();
                            const first = new Date(year, month, 1);
                            const start = first.getDay();
                            const daysInMonth = new Date(year, month + 1, 0).getDate();

                            for (let i = 0; i < start; i++) cells.push(<div key={`pad-o-${i}`} />);

                            for (let day = 1; day <= daysInMonth; day++) {
                              const d = new Date(year, month, day);
                              const key = dateKeyFromDate(d);
                              const isSelected = orderDate === key;
                              cells.push(
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => {
                                    setOrderDate(key);
                                    setOrderCalendarOpen(false);
                                  }}
                                  className={`py-1 rounded ${
                                    isSelected
                                      ? "bg-[var(--accent)] text-white"
                                      : "hover:bg-[var(--muted)]"
                                  }`}
                                >
                                  {day}
                                </button>,
                              );
                            }
                            return cells;
                          })()}
                        </div>

                        <div className="mt-3 flex justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              setOrderDate(todayKey);
                              setOrderCalendarOpen(false);
                            }}
                            className="px-2 py-1 rounded border border-[var(--input-border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                          >
                            Hoy
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderCalendarOpen(false)}
                            className="px-2 py-1 rounded border border-[var(--input-border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                          >
                            Cerrar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label
                  className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
                >
                  <Calendar className="w-4 h-4" />
                  Fecha Esperada de Entrega
                </label>
                <div className="relative">
                  <button
                    type="button"
                    ref={deliveryButtonRef}
                    onClick={() => {
                      const base = expectedDeliveryDate
                        ? new Date(`${expectedDeliveryDate}T00:00:00`)
                        : new Date();
                      if (!Number.isNaN(base.getTime())) setDeliveryCalendarMonth(base);
                      setDeliveryCalendarOpen((prev) => !prev);
                      setOrderCalendarOpen(false);
                    }}
                    className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                    title="Seleccionar fecha esperada"
                    aria-label="Seleccionar fecha esperada"
                  >
                    <span className="truncate text-sm font-medium">
                      {expectedDeliveryDate
                        ? formatKeyToDisplay(expectedDeliveryDate)
                        : "dd/mm/yyyy"}
                    </span>
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border border-[var(--input-border)] bg-[var(--muted)]/20 text-[var(--muted-foreground)]">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                  </button>

                  {deliveryCalendarOpen && (
                    <div
                      ref={deliveryCalendarRef}
                      className="absolute left-0 top-full z-50 mt-2 w-full min-w-[280px] sm:w-72"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-3 text-[var(--foreground)] shadow-lg">
                        <div className="mb-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              const m = new Date(deliveryCalendarMonth);
                              m.setMonth(m.getMonth() - 1);
                              setDeliveryCalendarMonth(new Date(m));
                            }}
                            className="p-1 rounded hover:bg-[var(--muted)]"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <div className="text-sm font-semibold capitalize">
                            {deliveryCalendarMonth.toLocaleString("es-CR", {
                              month: "long",
                              year: "numeric",
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const m = new Date(deliveryCalendarMonth);
                              m.setMonth(m.getMonth() + 1);
                              setDeliveryCalendarMonth(new Date(m));
                            }}
                            className="p-1 rounded hover:bg-[var(--muted)]"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--muted-foreground)]">
                          {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
                            <div key={`${d}-${i}`} className="py-1">
                              {d}
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 grid grid-cols-7 gap-1 text-sm">
                          {(() => {
                            const cells: React.ReactNode[] = [];
                            const year = deliveryCalendarMonth.getFullYear();
                            const month = deliveryCalendarMonth.getMonth();
                            const first = new Date(year, month, 1);
                            const start = first.getDay();
                            const daysInMonth = new Date(year, month + 1, 0).getDate();

                            for (let i = 0; i < start; i++) cells.push(<div key={`pad-d-${i}`} />);

                            for (let day = 1; day <= daysInMonth; day++) {
                              const d = new Date(year, month, day);
                              const key = dateKeyFromDate(d);
                              const isSelected = expectedDeliveryDate === key;
                              cells.push(
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => {
                                    setExpectedDeliveryDate(key);
                                    setDeliveryCalendarOpen(false);
                                  }}
                                  className={`py-1 rounded ${
                                    isSelected
                                      ? "bg-[var(--accent)] text-white"
                                      : "hover:bg-[var(--muted)]"
                                  }`}
                                >
                                  {day}
                                </button>,
                              );
                            }
                            return cells;
                          })()}
                        </div>

                        <div className="mt-3 flex justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              setExpectedDeliveryDate("");
                              setDeliveryCalendarOpen(false);
                            }}
                            className="px-2 py-1 rounded border border-[var(--input-border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                          >
                            Limpiar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeliveryCalendarOpen(false)}
                            className="px-2 py-1 rounded border border-[var(--input-border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                          >
                            Cerrar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label
                  className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
                >
                  <FileText className="w-4 h-4" />
                  Notas
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] hover:border-[var(--accent)]/60 focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                  placeholder="Notas adicionales..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Add Products Form */}
          <div
            className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-6"
          >
            <h3
              className="text-lg font-semibold mb-4 flex items-center gap-2"
              style={{ color: "var(--foreground)" }}
            >
              <Plus className="w-5 h-5" />
              Agregar Productos
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="relative">
                <label
                  className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
                >
                  Nombre del Producto
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => {
                    setProductName(e.target.value);
                    setShowProductDropdown(
                      e.target.value.length > 0 && filteredProducts.length > 0,
                    );
                  }}
                  onFocus={() =>
                    setShowProductDropdown(
                      productName.length > 0 && filteredProducts.length > 0,
                    )
                  }
                  onBlur={() =>
                    setTimeout(() => setShowProductDropdown(false), 200)
                  }
                  className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] hover:border-[var(--accent)]/60 focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                  placeholder="Nombre del producto"
                  onKeyDown={(e) => e.key === "Enter" && addProduct()}
                />
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div
                    className="absolute z-10 w-full mt-2 overflow-hidden rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] shadow-lg"
                  >
                    {filteredProducts.map((product, index) => (
                      <button
                        key={index}
                        onClick={() => selectProduct(product)}
                        className="w-full px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)]/20"
                      >
                        {product}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label
                  className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
                >
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addProduct();
                    }
                  }}
                  className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] outline-none transition-colors hover:border-[var(--accent)]/60 focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                />
              </div>

              <button
                onClick={addProduct}
                disabled={!productName.trim()}
                className="h-11 px-4 rounded-lg bg-[var(--button-bg)] text-[var(--button-text)] hover:bg-[var(--button-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
              >
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            </div>
          </div>

          {/* Products List */}
          {products.length > 0 && (
            <div
              className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-6"
            >
              <h3
                className="text-lg font-semibold mb-4"
                style={{ color: "var(--foreground)" }}
              >
                Productos en la Orden ({products.length})
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th
                        className="text-left py-2 px-3 font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        Nombre
                      </th>
                      <th
                        className="text-center py-2 px-3 font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        Cantidad
                      </th>
                      <th
                        className="text-center py-2 px-3 font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr
                        key={product.id}
                        className="hover:opacity-80"
                        style={{ borderBottom: "1px solid var(--muted)" }}
                      >
                        <td
                          className="py-2 px-3"
                          style={{ color: "var(--foreground)" }}
                        >
                          {product.name}
                        </td>
                        <td
                          className="py-2 px-3 text-center"
                          style={{ color: "var(--foreground)" }}
                        >
                          {product.quantity}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => removeProduct(product.id)}
                            className="p-1 rounded text-red-500 hover:text-red-600 hover:bg-[var(--muted)]/20 transition-colors"
                            title="Eliminar producto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-center gap-4">
            <button
              onClick={saveOrder}
              disabled={
                isSaving || !supplierName.trim() || products.length === 0
              }
              className="h-11 px-6 rounded-lg bg-[var(--button-bg)] text-[var(--button-text)] hover:bg-[var(--button-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            >
              {isSaving
                ? isEditing
                  ? "Actualizando..."
                  : "Guardando..."
                : isEditing
                  ? "Actualizar Orden"
                  : "Guardar Orden"}
            </button>

            {isEditing && (
              <button
                onClick={cancelEdit}
                disabled={isSaving}
                className="h-11 px-6 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
              >
                Cancelar Edición
              </button>
            )}

            <button
              onClick={clearForm}
              disabled={isSaving}
              className="h-11 px-6 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            >
              Limpiar Formulario
            </button>
          </div>
        </div>
      ) : (
        /* Orders List */
        <div className="space-y-4">
          <h3
            className="text-xl font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            Órdenes Guardadas
          </h3>

          {loadingOrders ? (
            <div
              className="text-center py-8"
              style={{ color: "var(--muted-foreground)" }}
            >
              Cargando órdenes...
            </div>
          ) : orders.length === 0 ? (
            <div
              className="text-center py-8"
              style={{ color: "var(--muted-foreground)" }}
            >
              No hay órdenes guardadas todavía.
            </div>
          ) : (
            orders.map((order) => {
              const orderDateLabel = order.orderDate
                ? new Date(order.orderDate).toLocaleDateString()
                : "Sin fecha";
              const expectedDateLabel = order.expectedDeliveryDate
                ? new Date(order.expectedDeliveryDate).toLocaleDateString()
                : null;
              const orderKey = order.documentId
                ? `${order.documentId}-${order.id}`
                : order.id;

              return (
                <div
                  key={orderKey}
                  className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4
                        className="text-lg font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {order.supplierName}
                      </h4>
                      <p
                        className="text-sm"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        Orden: {orderDateLabel}
                        {expectedDateLabel && (
                          <> • Entrega: {expectedDateLabel}</>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(order)}
                        className="p-2 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 transition-colors"
                        title="Editar orden"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openExportModal(order)}
                        className="p-2 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 transition-colors"
                        title="Exportar orden"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteOrder(order.id, order.documentId)}
                        className="p-2 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-red-500 hover:text-red-600 hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 transition-colors"
                        title="Eliminar orden"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {order.notes && (
                    <p
                      className="text-sm mb-4"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <strong>Notas:</strong> {order.notes}
                    </p>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                          <th
                            className="text-left py-1 px-2"
                            style={{ color: "var(--foreground)" }}
                          >
                            Producto
                          </th>
                          <th
                            className="text-center py-1 px-2"
                            style={{ color: "var(--foreground)" }}
                          >
                            Cantidad
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.products.map((product: Product) => (
                          <tr
                            key={product.id}
                            style={{ borderBottom: "1px solid var(--muted)" }}
                          >
                            <td
                              className="py-1 px-2"
                              style={{ color: "var(--foreground)" }}
                            >
                              {product.name}
                            </td>
                            <td
                              className="py-1 px-2 text-center"
                              style={{ color: "var(--foreground)" }}
                            >
                              {product.quantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {order.total && order.total > 0 && (
                        <tfoot>
                          <tr
                            className="font-bold"
                            style={{ borderTop: "2px solid var(--border)" }}
                          >
                            <td
                              colSpan={2}
                              className="py-1 px-2 text-right"
                              style={{ color: "var(--foreground)" }}
                            >
                              Total:
                            </td>
                            <td
                              className="py-1 px-2 text-right"
                              style={{ color: "var(--foreground)" }}
                            >
                              ₡{order.total.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
