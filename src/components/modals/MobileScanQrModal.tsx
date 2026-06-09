"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { X, QrCode } from "lucide-react";

interface MobileScanQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MOBILE_SCAN_URL =
  "https://price-master-peach.vercel.app/mobile-scan?rpn=t";

export default function MobileScanQrModal({
  isOpen,
  onClose,
}: MobileScanQrModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setQrDataUrl("");
      setError("");
      setIsGenerating(false);
      return;
    }

    const generateQr = async () => {
      try {
        setIsGenerating(true);
        setError("");

        const dataUrl = await QRCode.toDataURL(MOBILE_SCAN_URL, {
          width: 200,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });

        setQrDataUrl(dataUrl);
      } catch (e) {
        console.error("Error generating QR:", e);
        setError("No se pudo generar el código QR.");
      } finally {
        setIsGenerating(false);
      }
    };

    generateQr();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Cerrar modal"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <h3 className="text-lg font-semibold text-center mb-4 text-gray-900 dark:text-gray-100">
          Escanear con móvil
        </h3>

        <div className="flex justify-center">
          <div className="w-[200px] h-[200px] flex items-center justify-center rounded-lg bg-white">
            {isGenerating && (
              <QrCode className="w-12 h-12 text-gray-400 animate-pulse" />
            )}

            {!isGenerating && error && (
              <p className="px-4 text-center text-sm text-red-500">{error}</p>
            )}

            {!isGenerating && !error && qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="QR para escanear móvil"
                width={200}
                height={200}
                className="rounded-lg"
              />
            )}
          </div>
        </div>

        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-4">
          Escanea este código con tu dispositivo móvil
        </p>
      </div>
    </div>
  );
}
