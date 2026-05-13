// ...existing code...

"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import {
  History,
  Copy,
  Search,
  Eye,
  Calendar,
  CalendarDays,
  MapPin,
  RefreshCw,
  Image as ImageIcon,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Lock as LockIcon,
  Smartphone,
  QrCode,
} from "lucide-react";
import { useScanHistory, useScanImages } from "@/hooks/useScanHistory";
import { useAuth } from "@/hooks/useAuth";
import useToast from "@/hooks/useToast";
import { EmpresasService } from "../../services/empresas";
import { hasPermission } from "../../utils/permissions";
import { generateShortMobileUrl } from "../../utils/shortEncoder";

export default function ScanHistoryTable() {
  /* Verificar permisos del usuario */
  // Hook de autenticación para obtener el usuario actual
  const { user } = useAuth();

  // Usar hooks optimizados
  const {
    scanHistory,
    loading,
    refreshHistory,
    deleteScan: deleteScanService,
    clearHistory: clearHistoryService,
  } = useScanHistory();

  const {
    codeImages,
    loadingImages,
    imageLoadError,
    loadImagesForCode,
    clearImages,
    codeBU,
  } = useScanImages();

  // Load locations from DB
  const [empresas, setEmpresas] = useState<any[]>([]);

  useEffect(() => {
    const loadEmpresas = async () => {
      try {
        const data = await EmpresasService.getAllEmpresas();
        setEmpresas(data);
      } catch (error) {
        console.error("Error loading empresas:", error);
      }
    };
    loadEmpresas();
  }, []);

  // Local state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const { showToast } = useToast();
  const notify = useCallback(
    (message: string, color: string = "green") => {
      const type =
        color === "green" ? "success" : color === "red" ? "error" : "info";
      showToast(message, type);
    },
    [showToast],
  );
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showProcessModal, setShowProcessModal] = useState<{
    code: string;
    open: boolean;
  } | null>(null);
  const [confirmProcess, setConfirmProcess] = useState<{
    id: string;
    code: string;
  } | null>(null);

  // Auto-close the "Código procesado" modal 2 seconds after it opens
  useEffect(() => {
    if (!showProcessModal?.open) return;
    const t = window.setTimeout(() => {
      setShowProcessModal(null);
    }, 2000);
    return () => window.clearTimeout(t);
  }, [showProcessModal?.open]);

  // Ref for the confirm button so we can focus it when modal opens
  const confirmProcessButtonRef = useRef<HTMLButtonElement | null>(null);
  // Ref for the "Código procesado" modal close button so Enter can close it
  const showProcessCloseRef = useRef<HTMLButtonElement | null>(null);
  // Ref to hold the current deleteScan function so effects can call it before it's declared
  const deleteScanRef = useRef<
    ((scanId: string, code: string) => Promise<void>) | null
  >(null);

  // When confirmProcess modal opens, focus the Procesar button
  useEffect(() => {
    if (confirmProcess) {
      // small timeout to ensure element is mounted
      setTimeout(() => {
        confirmProcessButtonRef.current?.focus();
      }, 0);
    }
  }, [confirmProcess]);

  // Focus the close button and allow Enter/Escape to close the "Código procesado" modal
  useEffect(() => {
    if (!showProcessModal?.open) return;

    // focus the close button after mount
    setTimeout(() => showProcessCloseRef.current?.focus(), 0);

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        setShowProcessModal(null);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showProcessModal?.open]);

  // Keyboard handler: Enter to confirm processing, Escape to cancel
  useEffect(() => {
    if (!confirmProcess) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // call the current deleteScan via ref without awaiting to keep UI responsive
        try {
          void deleteScanRef.current?.(confirmProcess.id, confirmProcess.code);
        } catch (err) {
          console.error("Error processing scan via Enter key:", err);
        }
        setConfirmProcess(null);
      }
      if (e.key === "Escape") {
        setConfirmProcess(null);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [confirmProcess]);

  // Date filter states
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Calendar popovers (same UX/style as Fondo General)
  const [calendarFromOpen, setCalendarFromOpen] = useState(false);
  const [calendarToOpen, setCalendarToOpen] = useState(false);
  const [calendarFromMonth, setCalendarFromMonth] = useState(() => {
    const m = new Date();
    m.setDate(1);
    m.setHours(0, 0, 0, 0);
    return m;
  });
  const [calendarToMonth, setCalendarToMonth] = useState(() => {
    const m = new Date();
    m.setDate(1);
    m.setHours(0, 0, 0, 0);
    return m;
  });

  const fromCalendarRef = useRef<HTMLDivElement | null>(null);
  const toCalendarRef = useRef<HTMLDivElement | null>(null);
  const fromButtonRef = useRef<HTMLButtonElement | null>(null);
  const toButtonRef = useRef<HTMLButtonElement | null>(null);

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const dateKeyFromDate = (d: Date) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const todayKey = dateKeyFromDate(new Date());
  const formatKeyToDisplay = (key: string) => {
    const [y, m, d] = key.split("-");
    if (!y || !m || !d) return key;
    return `${d}/${m}/${y}`;
  };

  useEffect(() => {
    if (!calendarFromOpen && !calendarToOpen) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      const clickedFrom =
        (fromButtonRef.current && fromButtonRef.current.contains(target)) ||
        (fromCalendarRef.current && fromCalendarRef.current.contains(target));
      const clickedTo =
        (toButtonRef.current && toButtonRef.current.contains(target)) ||
        (toCalendarRef.current && toCalendarRef.current.contains(target));

      if (clickedFrom || clickedTo) return;

      setCalendarFromOpen(false);
      setCalendarToOpen(false);
    };

    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [calendarFromOpen, calendarToOpen]);

  // Image modal states
  const [showImagesModal, setShowImagesModal] = useState(false);
  const [currentImageCode, setCurrentImageCode] = useState("");
  const [thumbnailLoadingStates, setThumbnailLoadingStates] = useState<{
    [key: number]: boolean;
  }>({});

  // Individual image modal states
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  // Mobile scanner modal state
  const [showMobileScannerModal, setShowMobileScannerModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [requestProductNameModal, setRequestProductNameModal] =
    useState<boolean>(true);

  // Function to generate QR Code for mobile scanner
  const generateQRCode = useCallback(
    async (sessionId: string, requestProductName: boolean) => {
      try {
        const baseUrl =
          typeof window !== "undefined" ? window.location.origin : "";

        // Use short URL format only
        const mobileScanUrl = generateShortMobileUrl(
          baseUrl,
          sessionId,
          requestProductName,
        );

        const qrCodeDataUrl = await QRCode.toDataURL(mobileScanUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
        setQrCodeDataUrl(qrCodeDataUrl);
      } catch (error) {
        console.error("Error generating QR code:", error);
      }
    },
    [],
  );

  // notifications handled by ToastProvider via notify()

  // Quick date filter functions
  const setDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);

    setCalendarFromOpen(false);
    setCalendarToOpen(false);
  };

  const setThisWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek);

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(today.toISOString().split("T")[0]);

    setCalendarFromOpen(false);
    setCalendarToOpen(false);
  };

  const setThisMonth = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(today.toISOString().split("T")[0]);

    setCalendarFromOpen(false);
    setCalendarToOpen(false);
  };

  // Handle copy
  const handleCopy = async (code: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = code;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      notify("¡Código copiado!", "green");
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      notify("Error al copiar código", "red");
    }
  };

  // Clear all history
  const clearHistory = async () => {
    if (
      window.confirm(
        "¿Estás seguro de que deseas eliminar todo el historial? Esta acción no se puede deshacer.",
      )
    ) {
      try {
        await clearHistoryService();
        notify("Historial eliminado", "red");
      } catch (error) {
        console.error("Error clearing history:", error);
        notify("Error al eliminar el historial", "red");
      }
    }
  };

  // Delete individual scan (stable reference)
  const deleteScan = useCallback(
    async (scanId: string, code: string) => {
      setProcessingId(scanId);
      setTimeout(async () => {
        try {
          await deleteScanService(scanId);
          setShowProcessModal({ code, open: true });
          notify("Código procesado y eliminado", "green");
        } catch (error) {
          console.error("Error deleting scan:", error);
          notify("Error al eliminar el código", "red");
        } finally {
          setProcessingId(null);
        }
      }, 1200); // Simula procesamiento
    },
    [deleteScanService, notify],
  );

  // Keep ref updated with the latest deleteScan so effects can call it safely
  useEffect(() => {
    deleteScanRef.current = deleteScan;
    return () => {
      deleteScanRef.current = null;
    };
  }, [deleteScan]);

  // Refresh history
  const handleRefreshHistory = async () => {
    try {
      const result = await refreshHistory();
      if (result.newCount > 0) {
        notify(
          `Historial actualizado - ${result.newCount} código${result.newCount > 1 ? "s" : ""} nuevo${result.newCount > 1 ? "s" : ""}`,
          "green",
        );
      } else {
        notify("Historial actualizado - Sin cambios", "green");
      }
    } catch (error) {
      console.error("Error refreshing history:", error);
      notify("Error al actualizar el historial", "red");
    }
  };

  // Function to open images modal
  const handleShowImages = useCallback(
    async (barcodeCode: string) => {
      setCurrentImageCode(barcodeCode);
      setShowImagesModal(true);
      setThumbnailLoadingStates({});
      clearImages(); // Clear previous images
      await loadImagesForCode(barcodeCode);
    },
    [loadImagesForCode, clearImages],
  );

  // Handle thumbnail load states
  const handleThumbnailLoad = (index: number) => {
    setThumbnailLoadingStates((prev) => ({ ...prev, [index]: false }));
  };

  const handleThumbnailLoadStart = (index: number) => {
    setThumbnailLoadingStates((prev) => ({ ...prev, [index]: true }));
  };

  // Download individual image
  const downloadImage = async (imageUrl: string, index: number) => {
    try {
      // Use a direct link approach instead of fetch to avoid CORS issues
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `${currentImageCode}_imagen_${index + 1}.jpg`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      // Add crossorigin attribute to handle CORS
      link.setAttribute("crossorigin", "anonymous");

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      notify("Descarga iniciada", "green");
    } catch (error) {
      console.error("Error downloading image:", error);
      notify("Error al descargar la imagen", "red");
    }
  };

  // Download all images
  const downloadAllImages = async () => {
    if (codeImages.length === 0) return;

    try {
      // Download each image with a small delay to avoid overwhelming the browser
      for (let i = 0; i < codeImages.length; i++) {
        const imageUrl = codeImages[i];

        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = `${currentImageCode}_imagen_${i + 1}.jpg`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("crossorigin", "anonymous");

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Small delay between downloads to avoid overwhelming the browser
        if (i < codeImages.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      notify(`${codeImages.length} descargas iniciadas`, "green");
    } catch (error) {
      console.error("Error downloading images:", error);
      notify("Error al descargar las imágenes", "red");
    }
  };

  // Functions for individual image modal
  const handleOpenImageModal = useCallback(
    (imageUrl: string, index: number) => {
      setSelectedImageUrl(imageUrl);
      setSelectedImageIndex(index);
      setShowImageModal(true);
    },
    [],
  );

  const handleCloseImageModal = useCallback(() => {
    setShowImageModal(false);
    setSelectedImageUrl("");
    setSelectedImageIndex(0);
  }, []);

  const handleNextImage = useCallback(() => {
    if (codeImages.length > 1) {
      const nextIndex = (selectedImageIndex + 1) % codeImages.length;
      setSelectedImageIndex(nextIndex);
      setSelectedImageUrl(codeImages[nextIndex]);
    }
  }, [codeImages, selectedImageIndex]);

  const handlePreviousImage = useCallback(() => {
    if (codeImages.length > 1) {
      const prevIndex =
        selectedImageIndex === 0
          ? codeImages.length - 1
          : selectedImageIndex - 1;
      setSelectedImageIndex(prevIndex);
      setSelectedImageUrl(codeImages[prevIndex]);
    }
  }, [codeImages, selectedImageIndex]);

  // Keyboard navigation for image modal and mobile scanner modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showImageModal) {
        // Disable body scroll when individual image modal is open
        document.body.style.overflow = "hidden";

        switch (event.key) {
          case "Escape":
            event.preventDefault();
            handleCloseImageModal();
            break;
          case "ArrowLeft":
            event.preventDefault();
            handlePreviousImage();
            break;
          case "ArrowRight":
            event.preventDefault();
            handleNextImage();
            break;
        }
      } else if (showImagesModal) {
        switch (event.key) {
          case "Escape":
            event.preventDefault();
            setShowImagesModal(false);
            break;
        }
      } else if (showMobileScannerModal) {
        switch (event.key) {
          case "Escape":
            event.preventDefault();
            setShowMobileScannerModal(false);
            break;
        }
      }
    };

    if (showImagesModal || showImageModal || showMobileScannerModal) {
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        // Re-enable body scroll when modal is closed
        if (showImageModal) {
          document.body.style.overflow = "unset";
        }
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [
    showImagesModal,
    showImageModal,
    showMobileScannerModal,
    handleCloseImageModal,
    handlePreviousImage,
    handleNextImage,
  ]);

  // Generate QR code when modal opens
  useEffect(() => {
    if (showMobileScannerModal && typeof window !== "undefined") {
      // sessionId no longer needed, pass empty string
      generateQRCode("", requestProductNameModal);
    }
  }, [showMobileScannerModal, generateQRCode, requestProductNameModal]);

  // Regenerate QR code when requestProductNameModal changes
  useEffect(() => {
    if (showMobileScannerModal && typeof window !== "undefined") {
      // sessionId no longer needed, pass empty string
      generateQRCode("", requestProductNameModal);
    }
  }, [requestProductNameModal, showMobileScannerModal, generateQRCode]);

  // Filter history based on search term, location, dates, and user permissions
  const filteredHistory = scanHistory.filter((entry) => {
    const matchesSearch =
      entry.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.productName &&
        entry.productName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.userName &&
        entry.userName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesLocation =
      selectedLocation === "all" || entry.ownercompanie === selectedLocation;

    // Date filtering
    let matchesDateRange = true;
    if (startDate || endDate) {
      const entryDate = new Date(entry.timestamp);
      const startDateTime = startDate
        ? new Date(startDate + "T00:00:00")
        : null;
      const endDateTime = endDate ? new Date(endDate + "T23:59:59") : null;

      if (startDateTime && entryDate < startDateTime) {
        matchesDateRange = false;
      }
      if (endDateTime && entryDate > endDateTime) {
        matchesDateRange = false;
      }
    }

    // Filtrar por empresas permitidas para el usuario
    let matchesUserLocations = true;
    if (
      user?.permissions?.scanhistory &&
      user.permissions.scanhistoryEmpresas
    ) {
      // Si el usuario tiene empresas específicas configuradas, filtrar por ellas
      if (user.permissions.scanhistoryEmpresas.length > 0) {
        matchesUserLocations = entry.ownercompanie
          ? user.permissions.scanhistoryEmpresas.includes(entry.ownercompanie)
          : false;
      }
      // Si no tiene empresas específicas configuradas pero tiene permiso de scanhistory, puede ver todas
    } else if (!user?.permissions?.scanhistory) {
      // Si el usuario no tiene permiso de scanhistory, no puede ver nada
      matchesUserLocations = false;
    }

    return (
      matchesSearch &&
      matchesLocation &&
      matchesDateRange &&
      matchesUserLocations
    );
  });

  // Filtrar las ubicaciones disponibles en el selector basado en los permisos del usuario
  // Map companies to availableLocations-like array for selector; filter by user's empresa permissions
  const availableLocations = empresas
    .map((empresa) => ({
      value: empresa.name,
      label: `${empresa.name} - ${empresa.ubicacion}`,
    }))
    .filter((location) => {
      if (!user?.permissions?.scanhistory) return false;
      // If user has no specific empresas set, allow all locations
      if (
        !user.permissions.scanhistoryEmpresas ||
        user.permissions.scanhistoryEmpresas.length === 0
      ) {
        return true;
      }
      // Otherwise allow locations whose value (which corresponds to empresa name) is included in scanhistoryEmpresas
      return user.permissions.scanhistoryEmpresas.includes(location.value);
    });

  // Verificar si el usuario tiene permiso para ver el historial de escaneos
  if (!hasPermission(user?.permissions, "scanhistory")) {
    return (
      <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border-2 border-[var(--input-border)]">
        <div className="text-center">
          <LockIcon className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Acceso Restringido
          </h3>
          <p className="text-[var(--muted-foreground)]">
            No tienes permisos para acceder al Historial de Escaneos.
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Contacta a un administrador para obtener acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-3 sm:p-4 md:p-6 barcode-mobile border-2 border-[var(--input-border)]">
      {/* notifications are rendered globally by ToastProvider */}

      {/* Verificar permisos del usuario */}
      {!user?.permissions?.scanhistory ? (
        <div className="text-center py-12">
          <History className="w-16 h-16 text-[var(--muted-foreground)] mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
            Sin permisos para ver el historial
          </h3>
          <p className="text-[var(--muted-foreground)]">
            No tienes permisos para acceder al historial de escaneos. Contacta a
            tu administrador para obtener acceso.
          </p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 flex-wrap">
              <History className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--primary)]" />
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">
                Historial de Escaneos
              </h2>
              {user.permissions.scanhistoryEmpresas &&
                user.permissions.scanhistoryEmpresas.length > 0 && (
                  <span className="text-xs sm:text-sm bg-[var(--muted)] text-[var(--foreground)] px-2 py-1 rounded border-2 border-[var(--input-border)]">
                    Limitado a:{" "}
                    {user.permissions.scanhistoryEmpresas.join(", ")}
                  </span>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowMobileScannerModal(true)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-[var(--success)] text-white rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 text-sm sm:text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                title="Abrir Escáner Móvil"
              >
                <Smartphone className="w-4 h-4" />
                <span className="hidden sm:inline">Escáner Móvil</span>
                <span className="sm:hidden">Escáner</span>
              </button>
              <button
                onClick={handleRefreshHistory}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-[var(--button-bg)] text-[var(--button-text)] rounded-lg hover:bg-[var(--button-hover)] transition-all flex items-center justify-center gap-2 text-sm sm:text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">Actualizar</span>
              </button>
              {scanHistory.length > 0 && (
                <>
                  <button
                    onClick={clearHistory}
                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-[var(--error)] text-white rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 text-sm sm:text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                  >
                    <span className="hidden sm:inline">Limpiar Todo</span>
                    <span className="sm:hidden">Limpiar</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-b-[var(--primary)] mx-auto"></div>
              <p className="text-[var(--muted-foreground)] mt-2">
                Cargando historial...
              </p>
            </div>
          )}

          {!loading && (
            <>
              {/* Filters */}
              {scanHistory.length > 0 && (
                <div className="mb-6 space-y-4">
                  {/* Search bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)]" />
                    <input
                      type="text"
                      placeholder="Buscar en el historial..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Filters row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Location filter */}
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)]" />
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                      >
                        <option value="all">
                          Todas las empresas permitidas
                        </option>
                        {availableLocations
                          .filter(
                            (location) => location.value !== "DELIFOOD_TEST",
                          )
                          .map((location) => (
                            <option key={location.value} value={location.value}>
                              {location.label}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Start date filter (Fondo General calendar style) */}
                    <div className="relative min-w-0">
                      <button
                        type="button"
                        ref={fromButtonRef}
                        onClick={() => {
                          setCalendarFromOpen((prev) => {
                            const next = !prev;
                            if (next) {
                              const base = startDate
                                ? new Date(`${startDate}T00:00:00`)
                                : new Date();
                              const m = new Date(base);
                              m.setDate(1);
                              m.setHours(0, 0, 0, 0);
                              setCalendarFromMonth(new Date(m));
                            }
                            return next;
                          });
                          setCalendarToOpen(false);
                        }}
                        className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                        title="Seleccionar fecha desde"
                        aria-label="Seleccionar fecha desde"
                      >
                        <span className="truncate text-sm font-medium">
                          {startDate ? formatKeyToDisplay(startDate) : "dd/mm/yyyy"}
                        </span>
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border border-[var(--input-border)] bg-[var(--muted)]/20 text-[var(--muted-foreground)]">
                          <CalendarDays className="h-4 w-4" />
                        </span>
                      </button>

                      {calendarFromOpen && (
                        <div
                          ref={fromCalendarRef}
                          className="absolute left-0 top-full mt-1 sm:mt-2 z-50 w-full min-w-[280px] sm:w-72"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-2 sm:p-3 text-[var(--foreground)] shadow-lg">
                            <div className="mb-2 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => {
                                  const m = new Date(calendarFromMonth);
                                  m.setMonth(m.getMonth() - 1);
                                  setCalendarFromMonth(new Date(m));
                                }}
                                className="p-1 rounded hover:bg-[var(--muted)]"
                                title="Mes anterior"
                                aria-label="Mes anterior"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <div className="text-sm font-semibold capitalize">
                                {calendarFromMonth.toLocaleString("es-CR", {
                                  month: "long",
                                  year: "numeric",
                                })}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const m = new Date(calendarFromMonth);
                                  m.setMonth(m.getMonth() + 1);
                                  setCalendarFromMonth(new Date(m));
                                }}
                                className="p-1 rounded hover:bg-[var(--muted)]"
                                title="Mes siguiente"
                                aria-label="Mes siguiente"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--muted-foreground)]">
                              {["D", "L", "M", "M", "J", "V", "S"].map(
                                (d, i) => (
                                  <div key={`${d}-${i}`} className="py-1">
                                    {d}
                                  </div>
                                ),
                              )}
                            </div>

                            <div className="mt-2 grid grid-cols-7 gap-1 text-sm">
                              {(() => {
                                const cells: React.ReactNode[] = [];
                                const year = calendarFromMonth.getFullYear();
                                const month = calendarFromMonth.getMonth();
                                const first = new Date(year, month, 1);
                                const start = first.getDay();
                                const daysInMonth = new Date(
                                  year,
                                  month + 1,
                                  0,
                                ).getDate();

                                for (let i = 0; i < start; i++) {
                                  cells.push(<div key={`pad-f-${i}`} />);
                                }

                                for (let day = 1; day <= daysInMonth; day++) {
                                  const d = new Date(year, month, day);
                                  const key = dateKeyFromDate(d);
                                  const enabled = key <= todayKey;
                                  const isSelected = startDate === key;

                                  if (enabled) {
                                    cells.push(
                                      <button
                                        key={key}
                                        type="button"
                                        onClick={() => {
                                          setStartDate(key);
                                          if (endDate && key > endDate) {
                                            setEndDate(key);
                                          }
                                          setCalendarFromOpen(false);
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
                                  } else {
                                    cells.push(
                                      <div
                                        key={key}
                                        className="py-1 text-[var(--muted-foreground)] opacity-60"
                                      >
                                        {day}
                                      </div>,
                                    );
                                  }
                                }

                                return cells;
                              })()}
                            </div>

                            <div className="mt-3 flex justify-between">
                              <button
                                type="button"
                                onClick={() => {
                                  setStartDate("");
                                  setCalendarFromOpen(false);
                                }}
                                className="px-2 py-1 rounded border border-[var(--input-border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                              >
                                Limpiar
                              </button>
                              <button
                                type="button"
                                onClick={() => setCalendarFromOpen(false)}
                                className="px-2 py-1 rounded border border-[var(--input-border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                              >
                                Cerrar
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* End date filter (Fondo General calendar style) */}
                    <div className="relative min-w-0">
                      <button
                        type="button"
                        ref={toButtonRef}
                        onClick={() => {
                          setCalendarToOpen((prev) => {
                            const next = !prev;
                            if (next) {
                              const base = endDate
                                ? new Date(`${endDate}T00:00:00`)
                                : new Date();
                              const m = new Date(base);
                              m.setDate(1);
                              m.setHours(0, 0, 0, 0);
                              setCalendarToMonth(new Date(m));
                            }
                            return next;
                          });
                          setCalendarFromOpen(false);
                        }}
                        className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                        title="Seleccionar fecha hasta"
                        aria-label="Seleccionar fecha hasta"
                      >
                        <span className="truncate text-sm font-medium">
                          {endDate ? formatKeyToDisplay(endDate) : "dd/mm/yyyy"}
                        </span>
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border border-[var(--input-border)] bg-[var(--muted)]/20 text-[var(--muted-foreground)]">
                          <CalendarDays className="h-4 w-4" />
                        </span>
                      </button>

                      {calendarToOpen && (
                        <div
                          ref={toCalendarRef}
                          className="absolute left-0 top-full mt-1 sm:mt-2 z-50 w-full min-w-[280px] sm:w-72"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-2 sm:p-3 text-[var(--foreground)] shadow-lg">
                            <div className="mb-2 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => {
                                  const m = new Date(calendarToMonth);
                                  m.setMonth(m.getMonth() - 1);
                                  setCalendarToMonth(new Date(m));
                                }}
                                className="p-1 rounded hover:bg-[var(--muted)]"
                                title="Mes anterior"
                                aria-label="Mes anterior"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <div className="text-sm font-semibold capitalize">
                                {calendarToMonth.toLocaleString("es-CR", {
                                  month: "long",
                                  year: "numeric",
                                })}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const m = new Date(calendarToMonth);
                                  m.setMonth(m.getMonth() + 1);
                                  setCalendarToMonth(new Date(m));
                                }}
                                className="p-1 rounded hover:bg-[var(--muted)]"
                                title="Mes siguiente"
                                aria-label="Mes siguiente"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--muted-foreground)]">
                              {["D", "L", "M", "M", "J", "V", "S"].map(
                                (d, i) => (
                                  <div key={`${d}-${i}`} className="py-1">
                                    {d}
                                  </div>
                                ),
                              )}
                            </div>

                            <div className="mt-2 grid grid-cols-7 gap-1 text-sm">
                              {(() => {
                                const cells: React.ReactNode[] = [];
                                const year = calendarToMonth.getFullYear();
                                const month = calendarToMonth.getMonth();
                                const first = new Date(year, month, 1);
                                const start = first.getDay();
                                const daysInMonth = new Date(
                                  year,
                                  month + 1,
                                  0,
                                ).getDate();

                                for (let i = 0; i < start; i++) {
                                  cells.push(<div key={`pad-t-${i}`} />);
                                }

                                for (let day = 1; day <= daysInMonth; day++) {
                                  const d = new Date(year, month, day);
                                  const key = dateKeyFromDate(d);
                                  const enabled = key <= todayKey;
                                  const isSelected = endDate === key;

                                  if (enabled) {
                                    cells.push(
                                      <button
                                        key={key}
                                        type="button"
                                        onClick={() => {
                                          setEndDate(key);
                                          if (startDate && key < startDate) {
                                            setStartDate(key);
                                          }
                                          setCalendarToOpen(false);
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
                                  } else {
                                    cells.push(
                                      <div
                                        key={key}
                                        className="py-1 text-[var(--muted-foreground)] opacity-60"
                                      >
                                        {day}
                                      </div>,
                                    );
                                  }
                                }

                                return cells;
                              })()}
                            </div>

                            <div className="mt-3 flex justify-between">
                              <button
                                type="button"
                                onClick={() => {
                                  setEndDate("");
                                  setCalendarToOpen(false);
                                }}
                                className="px-2 py-1 rounded border border-[var(--input-border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                              >
                                Limpiar
                              </button>
                              <button
                                type="button"
                                onClick={() => setCalendarToOpen(false)}
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

                  {/* Quick date filters */}
                  <div className="space-y-2">
                    <span className="text-xs sm:text-sm text-[var(--muted-foreground)] block">
                      Filtros rápidos:
                    </span>
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                      <button
                        onClick={() => setDateRange(0)}
                        className="px-3 py-1.5 sm:py-1 text-xs rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] transition-all hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20"
                      >
                        Hoy
                      </button>
                      <button
                        onClick={() => setDateRange(1)}
                        className="px-3 py-1.5 sm:py-1 text-xs rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] transition-all hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20"
                      >
                        Ayer
                      </button>
                      <button
                        onClick={() => setDateRange(7)}
                        className="px-3 py-1.5 sm:py-1 text-xs rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] transition-all hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20"
                      >
                        Últimos 7 días
                      </button>
                      <button
                        onClick={() => setThisWeek()}
                        className="px-3 py-1.5 sm:py-1 text-xs rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] transition-all hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20"
                      >
                        Esta semana
                      </button>
                      <button
                        onClick={() => setDateRange(30)}
                        className="px-3 py-1.5 sm:py-1 text-xs rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] transition-all hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20"
                      >
                        Últimos 30 días
                      </button>
                      <button
                        onClick={() => setThisMonth()}
                        className="px-3 py-1.5 sm:py-1 text-xs rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] transition-all hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20"
                      >
                        Este mes
                      </button>
                    </div>
                  </div>

                  {/* Clear filters button */}
                  {(searchTerm ||
                    selectedLocation !== "all" ||
                    startDate ||
                    endDate) && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          setSearchTerm("");
                          setSelectedLocation("all");
                          setStartDate("");
                          setEndDate("");
                        }}
                        className="px-4 py-2 text-sm rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] transition-all flex items-center gap-2 hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20"
                      >
                        <X className="w-4 h-4" />
                        Limpiar filtros
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Stats */}
              {scanHistory.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
                  <div className="bg-[var(--card-bg)] border-2 border-[var(--input-border)] rounded-lg p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--primary)]" />
                      <span className="text-xs sm:text-sm font-medium text-[var(--foreground)]">
                        Total Escaneos
                      </span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-[var(--foreground)] mt-1">
                      {scanHistory.length}
                    </p>
                  </div>

                  <div className="bg-[var(--card-bg)] border-2 border-[var(--input-border)] rounded-lg p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--primary)]" />
                      <span className="text-xs sm:text-sm font-medium text-[var(--foreground)]">
                        Con Nombre
                      </span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-[var(--foreground)] mt-1">
                      {scanHistory.filter((entry) => entry.productName).length}
                    </p>
                  </div>

                  <div className="bg-[var(--card-bg)] border-2 border-[var(--input-border)] rounded-lg p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--primary)]" />
                      <span className="text-xs sm:text-sm font-medium text-[var(--foreground)]">
                        Con Imágenes
                      </span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-[var(--foreground)] mt-1">
                      {scanHistory.filter((entry) => entry.hasImages).length}
                    </p>
                  </div>

                  <div className="bg-[var(--card-bg)] border-2 border-[var(--input-border)] rounded-lg p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <Search className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--primary)]" />
                      <span className="text-xs sm:text-sm font-medium text-[var(--foreground)]">
                        Filtrados
                      </span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-[var(--foreground)] mt-1">
                      {filteredHistory.length}
                    </p>
                  </div>

                  <div className="bg-[var(--card-bg)] border-2 border-[var(--input-border)] rounded-lg p-3 sm:p-4 col-span-2 sm:col-span-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--primary)]" />
                      <span className="text-xs sm:text-sm font-medium text-[var(--foreground)]">
                        Con Ubicación
                      </span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-[var(--foreground)] mt-1">
                      {
                        scanHistory.filter((entry) => entry.ownercompanie)
                          .length
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* History list */}
              {filteredHistory.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-16 h-16 text-[var(--muted-foreground)] mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
                    {scanHistory.length === 0
                      ? "No hay escaneos en el historial"
                      : "No se encontraron resultados"}
                  </h3>
                  <p className="text-[var(--muted-foreground)]">
                    {scanHistory.length === 0
                      ? "Los códigos escaneados aparecerán aquí automáticamente"
                      : "Intenta con un término de búsqueda diferente o selecciona otra ubicación"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredHistory.map((entry, index) => (
                    <div
                      key={`${entry.code}-${entry.id || index}`}
                      className="scan-history-row flex flex-col p-3 sm:p-4 bg-[var(--card-bg)] hover:bg-[var(--muted)] rounded-lg border-2 border-[var(--input-border)] hover:border-[var(--accent)]/60 transition-all duration-150 space-y-3"
                    >
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex flex-col gap-2 mb-2 w-full">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-base sm:text-lg font-semibold text-[var(--foreground)] break-all px-2 py-1 rounded-md border border-[var(--input-border)] bg-[var(--muted)]/20">
                              {entry.code}
                            </span>
                            <button
                              onClick={() => handleCopy(entry.code)}
                              className="p-2 rounded-md border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--primary)] hover:border-cyan-500 hover:bg-[var(--muted)] transition-all flex-shrink-0"
                              title="Copiar código"
                            >
                              <Copy className="w-4 h-4" />
                            </button>

                            {/* Nombre del producto - junto al botón copiar */}
                            {entry.productName && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    (entry.productName || "").toUpperCase(),
                                  );
                                  notify("¡Nombre copiado!", "blue");
                                }}
                                className="text-sm sm:text-base text-[var(--foreground)] font-medium px-3 py-2 rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] hover:border-cyan-500 hover:bg-[var(--muted)] transition-all cursor-pointer uppercase text-left break-words whitespace-normal leading-relaxed"
                                title="Clic para copiar nombre"
                              >
                                {entry.productName.toUpperCase()}
                              </button>
                            )}

                            {/* Ubicación - en la misma línea */}
                            {entry.ownercompanie && (
                              <span className="text-sm sm:text-base text-[var(--foreground)] px-3 py-2 rounded-lg border border-[var(--input-border)] bg-[var(--muted)]/10 flex items-center gap-2 flex-shrink-0">
                                <MapPin className="w-4 h-4 flex-shrink-0" />
                                <span className="font-medium whitespace-nowrap">
                                  {entry.ownercompanie}
                                </span>
                              </span>
                            )}
                            <div className="flex items-center gap-2">
                              {entry.hasImages && (
                                <button
                                  onClick={() => handleShowImages(entry.code)}
                                  className="p-2 rounded-md border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--primary)] hover:border-cyan-500 hover:bg-[var(--muted)] transition-all"
                                  title="Ver imágenes"
                                >
                                  <ImageIcon className="w-4 h-4" />
                                </button>
                              )}
                              {entry.id && (
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={processingId === entry.id}
                                    disabled={processingId === entry.id}
                                    onChange={() => {
                                      // Mostrar confirmación antes de procesar
                                      setConfirmProcess({
                                        id: entry.id!,
                                        code: entry.code,
                                      });
                                    }}
                                    style={{ accentColor: "var(--success)" }}
                                    className="w-5 h-5 rounded border-2 border-[var(--input-border)] bg-[var(--card-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                                    title="Procesar y eliminar código"
                                  />
                                  <span className="text-xs text-[var(--muted-foreground)]">
                                    Procesar
                                  </span>
                                </label>
                              )}
                            </div>
                            {confirmProcess && (
                              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-2 sm:px-0">
                                <div className="bg-[var(--card-bg)] border-2 border-[var(--input-border)] rounded-lg shadow-lg w-full max-w-sm flex flex-col items-center p-4 sm:p-8 gap-4 mx-2 sm:mx-auto">
                                  <div className="mb-2 sm:mb-4 w-full flex justify-center">
                                    <span className="inline-block bg-[var(--muted)] text-[var(--foreground)] border-2 border-[var(--input-border)] rounded-full px-3 py-1 text-sm font-semibold">
                                      Confirmar procesamiento
                                    </span>
                                  </div>
                                  <div className="text-center mb-4 sm:mb-6 break-words w-full">
                                    <p className="text-base sm:text-lg font-medium text-[var(--foreground)] mb-2">
                                      ¿Procesar el código{" "}
                                      <span className="font-mono text-[var(--success)] break-all">
                                        {confirmProcess.code}
                                      </span>
                                      ?
                                    </p>
                                    <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                                      Esta acción eliminará el código y sus
                                      imágenes asociadas.
                                    </p>
                                  </div>
                                  <div className="flex flex-col sm:flex-row gap-2 w-full">
                                    <button
                                      type="button"
                                      ref={confirmProcessButtonRef}
                                      onClick={() => {
                                        deleteScan(
                                          confirmProcess.id,
                                          confirmProcess.code,
                                        );
                                        setConfirmProcess(null);
                                      }}
                                      className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-[var(--success)] hover:opacity-90 text-white rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                                    >
                                      Procesar
                                    </button>
                                    <button
                                      onClick={() => setConfirmProcess(null)}
                                      className="w-full sm:w-auto px-4 sm:px-6 py-2 rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-cyan-500 hover:bg-[var(--muted)] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="actions flex flex-row flex-wrap items-center gap-2 pt-2 border-t border-[var(--input-border)]">
                          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[var(--muted-foreground)] w-full">
                            <span className="text-xs">
                              {entry.timestamp.toLocaleDateString()}{" "}
                              {entry.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer info */}
              <div className="mt-6 pt-4 border-t border-[var(--input-border)]">
                <p className="text-sm text-[var(--muted-foreground)] text-center">
                  Mostrando escaneos • Filtrados por ubicación:{" "}
                  {selectedLocation === "all"
                    ? user?.permissions?.scanhistoryEmpresas &&
                      user.permissions.scanhistoryEmpresas.length > 0
                      ? `Empresas permitidas (${user.permissions.scanhistoryEmpresas.join(", ")})`
                      : "Todas las ubicaciones"
                    : availableLocations.find(
                        (loc) => loc.value === selectedLocation,
                      )?.label || selectedLocation}
                  {(startDate || endDate) && (
                    <>
                      {" • "}
                      Rango de fechas:{" "}
                      {startDate && endDate
                        ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
                        : startDate
                          ? `Desde ${new Date(startDate).toLocaleDateString()}`
                          : `Hasta ${new Date(endDate).toLocaleDateString()}`}
                    </>
                  )}
                </p>
              </div>
            </>
          )}

          {/* Images Modal */}
          {showImagesModal && (
            <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex flex-col">
              {/* Header */}
              <div className="bg-black bg-opacity-50 p-4 flex items-center justify-between">
                <div className="text-white">
                  <h3 className="text-lg font-semibold">
                    Imágenes del código: {currentImageCode}
                  </h3>
                  {codeImages.length > 0 && (
                    <p className="text-sm text-gray-300 mt-1">
                      {codeImages.length} imagen
                      {codeImages.length > 1 ? "es" : ""} encontrada
                      {codeImages.length > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowImagesModal(false)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 p-8 overflow-y-auto">
                {loadingImages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-white">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                      <p>Cargando imágenes...</p>
                    </div>
                  </div>
                ) : imageLoadError ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-white">
                      <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">
                        No se encontraron imágenes
                      </h3>
                      <p className="text-gray-300">{imageLoadError}</p>
                    </div>
                  </div>
                ) : codeImages.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {codeImages.map((imageUrl, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-square overflow-hidden rounded-lg bg-black bg-opacity-30">
                          {thumbnailLoadingStates[index] && (
                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                            </div>
                          )}
                          <Image
                            src={imageUrl}
                            alt={`Imagen ${index + 1} del código ${currentImageCode}`}
                            width={400}
                            height={400}
                            className="w-full h-full object-cover cursor-pointer transition-transform duration-200 group-hover:scale-105"
                            loading="lazy"
                            onLoadStart={() => handleThumbnailLoadStart(index)}
                            onLoad={() => handleThumbnailLoad(index)}
                            onError={() => handleThumbnailLoad(index)}
                            onClick={() => {
                              // Abrir imagen en modal de pantalla completa
                              handleOpenImageModal(imageUrl, index);
                            }}
                          />
                        </div>
                        <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-sm px-2 py-1 rounded">
                          {index + 1}
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadImage(imageUrl, index);
                            }}
                            className="p-1 bg-black bg-opacity-70 text-white rounded-full hover:bg-opacity-90 transition-colors"
                            title="Descargar imagen"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-white">
                      <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">
                        No se encontraron imágenes
                      </h3>
                      <p className="text-gray-300">
                        Este código no tiene imágenes asociadas
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-black bg-opacity-50 p-4 flex items-center justify-between">
                <div className="text-white text-sm opacity-70">
                  Click en imagen para ver completa • ESC para cerrar
                </div>
                <div className="flex items-center gap-3">
                  {/* Show detected codeBU if available */}
                  {codeImages.length > 0 && codeBU && (
                    <span className="text-xs bg-white bg-opacity-10 text-white px-3 py-1 rounded-full border border-white/20">
                      codeBU: <span className="font-mono">{codeBU}</span>
                    </span>
                  )}
                  {codeImages.length > 0 && (
                    <button
                      onClick={() => downloadAllImages()}
                      className="flex items-center gap-2 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Descargar todas
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Individual Image Modal - 90% Screen */}
          {showImageModal && (
            <div
              className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-4 z-[9999]"
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                isolation: "isolate",
              }}
            >
              <div className="relative w-[90%] h-[90%] flex items-center justify-center">
                {/* Close Button */}
                <button
                  onClick={handleCloseImageModal}
                  className="absolute top-4 right-4 z-10 p-3 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 transition-all duration-200"
                >
                  <X className="w-6 h-6 text-white" />
                </button>

                {/* Image Counter */}
                {codeImages.length > 1 && (
                  <div className="absolute top-4 left-4 z-10 px-4 py-2 rounded-full bg-black bg-opacity-70 text-white text-sm font-medium">
                    {selectedImageIndex + 1} de {codeImages.length}
                  </div>
                )}

                {/* Previous Button */}
                {codeImages.length > 1 && (
                  <button
                    onClick={handlePreviousImage}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 transition-all duration-200"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                )}

                {/* Next Button */}
                {codeImages.length > 1 && (
                  <button
                    onClick={handleNextImage}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 transition-all duration-200"
                  >
                    <ChevronRight className="w-6 h-6 text-white" />
                  </button>
                )}

                {/* Main Image */}
                <Image
                  src={selectedImageUrl}
                  alt={`Imagen ${selectedImageIndex + 1} del código ${currentImageCode}`}
                  width={1200}
                  height={800}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  onError={(e) => {
                    console.error(`Error loading selected image:`, e);
                  }}
                />

                {/* Image Info */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-black bg-opacity-70 text-white text-sm">
                  Código: {currentImageCode} • Imagen {selectedImageIndex + 1}{" "}
                  de {codeImages.length}
                </div>

                {/* Download Button */}
                <button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = selectedImageUrl;
                    link.download = `${currentImageCode}_imagen_${selectedImageIndex + 1}.jpg`;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.setAttribute("crossorigin", "anonymous");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="absolute bottom-4 right-4 z-10 p-3 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 transition-all duration-200 flex items-center gap-2"
                >
                  <Download className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          )}

          {/* Mobile Scanner Modal */}
          {showMobileScannerModal && (
            <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-4 z-50">
              <div className="bg-[var(--card-bg)] rounded-lg w-full max-w-lg mx-auto max-h-[90vh] overflow-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b-2 border-[var(--input-border)]">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-6 h-6 text-[var(--success)]" />
                    <h3 className="text-xl font-semibold text-[var(--foreground)]">
                      Escáner Móvil
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowMobileScannerModal(false);
                      setQrCodeDataUrl("");
                      setRequestProductNameModal(true);
                    }}
                    className="p-2 rounded-md hover:bg-[var(--muted)] transition-colors"
                  >
                    <X className="w-6 h-6 text-[var(--muted-foreground)]" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-6">
                  <div className="text-center space-y-4">
                    {/* Configuración desde PC para móvil */}
                    <div className="bg-[var(--muted)] rounded-xl p-4 border-2 border-[var(--input-border)] max-w-md mx-auto space-y-4">
                      <h4 className="text-base font-semibold text-[var(--foreground)] mb-3">
                        Configuración para Móvil
                      </h4>

                      {/* Checkbox para nombres de productos */}
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={requestProductNameModal}
                          onChange={(e) =>
                            setRequestProductNameModal(e.target.checked)
                          }
                          style={{ accentColor: "var(--primary)" }}
                          className="w-5 h-5 rounded border-2 border-[var(--input-border)] bg-[var(--input-bg)] focus:ring-2 focus:ring-cyan-500 mt-0.5"
                        />
                        <div className="text-left">
                          <div className="text-sm font-medium text-[var(--foreground)] mb-1">
                            Solicitar nombres de productos en móvil
                          </div>
                          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                            {requestProductNameModal
                              ? "El móvil pedirá ingresar nombres opcionales para cada código escaneado"
                              : "El móvil solo enviará códigos de barras sin solicitar nombres"}
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* QR Code o Link */}
                    <div className="bg-[var(--muted)] border-2 border-[var(--input-border)] rounded-lg p-6 mb-6">
                      <p className="text-sm text-[var(--muted-foreground)] mb-4">
                        Escanea este código QR con tu teléfono o haz clic en el
                        botón para abrir el escáner móvil:
                      </p>

                      {/* Generate Mobile Scanner URL */}
                      {(() => {
                        const baseUrl =
                          typeof window !== "undefined"
                            ? window.location.origin
                            : "";

                        // Use short URL format only (no session parameter)
                        const mobileScanUrl = generateShortMobileUrl(
                          baseUrl,
                          "",
                          requestProductNameModal,
                        );

                        return (
                          <div className="space-y-4">
                            {/* QR Code */}
                            <div className="w-48 h-48 mx-auto bg-white rounded-lg flex items-center justify-center border">
                              {qrCodeDataUrl ? (
                                <Image
                                  src={qrCodeDataUrl}
                                  alt="Código QR del Escáner Móvil"
                                  width={192}
                                  height={192}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div className="text-center">
                                  <QrCode className="w-12 h-12 text-gray-400 mx-auto mb-2 animate-pulse" />
                                  <p className="text-xs text-gray-500">
                                    Generando QR...
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* URL Manual */}
                            <div className="text-left">
                              <p className="text-xs text-[var(--muted-foreground)] mb-2">
                                O ingresa manualmente esta URL en tu móvil:
                              </p>
                              <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg p-2">
                                <code className="text-xs text-[var(--foreground)] break-all">
                                  {mobileScanUrl}
                                </code>
                              </div>
                            </div>

                            {/* Buttons */}
                            <div className="space-y-2">
                              {/* Mobile Link Button */}
                              <button
                                onClick={() => {
                                  window.open(mobileScanUrl, "_blank");
                                }}
                                className="w-full px-4 py-3 bg-[var(--success)] text-white rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                              >
                                <Smartphone className="w-5 h-5" />
                                Abrir Escáner en Nueva Pestaña
                              </button>

                              {/* Copy Link */}
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(mobileScanUrl);
                                  notify(
                                    "¡Enlace copiado al portapapeles!",
                                    "green",
                                  );
                                }}
                                className="w-full px-4 py-2 rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-cyan-500 hover:bg-[var(--muted)] transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                              >
                                <Copy className="w-4 h-4" />
                                Copiar Enlace
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Instructions */}
                    <div className="text-left space-y-2 text-sm text-[var(--muted-foreground)]">
                      <h5 className="font-semibold text-[var(--foreground)]">
                        Instrucciones:
                      </h5>
                      <ul className="list-disc list-inside space-y-1">
                        <li>
                          Asegúrate de que tu teléfono y computadora estén en la
                          misma red
                        </li>
                        <li>Abre el enlace en tu teléfono móvil</li>
                        <li>
                          Permite el acceso a la cámara cuando se solicite
                        </li>
                        <li>
                          Escanea códigos de barras con la cámara de tu teléfono
                        </li>
                        <li>
                          Los códigos aparecerán automáticamente en este
                          historial
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t-2 border-[var(--input-border)]">
                  <button
                    onClick={() => {
                      setShowMobileScannerModal(false);
                      setQrCodeDataUrl("");
                      setRequestProductNameModal(true);
                    }}
                    className="w-full bg-[var(--button-bg)] hover:bg-[var(--button-hover)] px-6 py-3 rounded-lg text-[var(--button-text)] font-medium text-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
