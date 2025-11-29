"use client"

import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { SolicitudesService } from '@/services/solicitudes'
import CameraScanner from '../scanner/CameraScanner'
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner'
import { ScanningService } from '@/services/scanning'

interface NotificationModalProps {
  isOpen: boolean
  onClose: () => void
  // keep onSave optional for API compatibility, but unused here
  onSave?: (payload: { title: string; description: string }) => Promise<void> | void
}

export default function NotificationModal({ isOpen, onClose }: NotificationModalProps) {
  const { user } = useAuth();
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState<any>(null);
  const [scannedCode, setScannedCode] = useState<string>('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  const { code: detectedCode, error: scannerError, cameraActive, liveStreamRef, toggleCamera, handleClear: clearScanner, handleCopyCode, detectionMethod } = useBarcodeScanner((foundCode) => {
    setScannedCode(foundCode);
    setShowScanner(false);
    setShowVerificationModal(true);
  });

  useEffect(() => {
    if (!isOpen) return;

    const load = async () => {
      setLoading(true);
      try {
        const company = (user as any)?.ownercompanie || (user as any)?.ownerCompanie || '';
        if (!company) {
          setSolicitudes([]);
          return;
        }
        const rows = await SolicitudesService.getSolicitudesByEmpresa(company);
        // Only show solicitudes that are not marked 'listo'
        const visible = (rows || []).filter((r: any) => !r?.listo);
        setSolicitudes(visible);
      } catch (err) {
        console.error('Error loading solicitudes for notification modal:', err);
        setSolicitudes([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isOpen, user]);

  if (!isOpen) return null

  const formatDate = (v: any) => {
    try {
      if (!v) return '';
      const d = v.seconds ? new Date(v.seconds * 1000) : new Date(v);
      return d.toLocaleString();
    } catch {
      return '';
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      {showScanner ? (
        <div className="bg-[var(--background)] rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Escanear Código para {selectedSolicitud?.productName || 'Producto'}</h2>
              <button onClick={() => setShowScanner(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <CameraScanner
              code={detectedCode}
              error={scannerError}
              detectionMethod={detectionMethod}
              cameraActive={cameraActive}
              liveStreamRef={liveStreamRef}
              toggleCamera={toggleCamera}
              handleClear={clearScanner}
              handleCopyCode={handleCopyCode}
              onRemoveLeadingZero={() => {}}
            />
          </div>
        </div>
      ) : showVerificationModal ? (
        <div className="bg-[var(--background)] rounded-lg shadow-xl w-full sm:max-w-md">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">Verificar Código Escaneado</h2>
            <div className="mb-4">
              <p className="text-[var(--foreground)]"><strong>Producto:</strong> {selectedSolicitud?.productName || 'Sin nombre'}</p>
              <p className="text-[var(--foreground)]"><strong>Código:</strong> {scannedCode}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowVerificationModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await ScanningService.addScan({
                      code: scannedCode,
                      productName: selectedSolicitud?.productName || '',
                      source: 'web',
                      userName: user?.name || 'Usuario',
                      processed: false,
                      ownercompanie: user?.ownercompanie
                    });
                    setShowVerificationModal(false);
                    // Optionally reload solicitudes or mark as listo
                  } catch (err) {
                    console.error('Error enviando código:', err);
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--background)] rounded-lg shadow-xl w-full sm:max-w-md md:max-w-lg max-h-[80vh] overflow-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Solicitudes de tu empresa</h2>
              <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loading ? (
              <div className="text-[var(--muted-foreground)]">Cargando solicitudes...</div>
            ) : !user ? (
              <div className="text-[var(--muted-foreground)]">Inicia sesión para ver las solicitudes.</div>
            ) : solicitudes.length === 0 ? (
              <div className="p-4 bg-[var(--card-bg)] border border-[var(--input-border)] rounded">No hay solicitudes para {user.ownercompanie || 'tu empresa'}.</div>
            ) : (
              <div className="space-y-3">
                {solicitudes.map((s) => (
                  <div key={s.id} className="p-3 border border-[var(--input-border)] rounded bg-[var(--card-bg)]">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                        <label className="inline-flex items-center gap-2 mr-2">
                          <input
                            type="checkbox"
                            className="form-checkbox h-4 w-4"
                            checked={Boolean(s.listo)}
                            onChange={async (e) => {
                              const checked = e.target.checked;
                              try {
                                // optimistic: remove from list if marked listo
                                if (checked) setSolicitudes(prev => prev.filter(p => p.id !== s.id));
                                await SolicitudesService.setListo(s.id, checked);
                              } catch (err) {
                                console.error('Error updating listo from modal:', err);
                                // revert optimistic if needed by reloading
                                const rows2 = await SolicitudesService.getSolicitudesByEmpresa((user as any)?.ownercompanie || (user as any)?.ownerCompanie || '');
                                setSolicitudes((rows2 || []).filter((r: any) => !r?.listo));
                              }
                            }}
                          />
                          <span className="text-sm text-[var(--muted-foreground)]">Listo</span>
                        </label>

                        <div className="font-semibold text-[var(--foreground)] break-words">{s.productName || s.name || 'Sin nombre'}</div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="text-xs text-[var(--muted-foreground)]">{formatDate(s.createdAt)}</div>
                        <button
                          onClick={() => {
                            setSelectedSolicitud(s);
                            setShowScanner(true);
                          }}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                        >
                          Abrir Escáner
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-[var(--hover-bg)] text-[var(--foreground)] rounded hover:bg-[var(--muted)]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
