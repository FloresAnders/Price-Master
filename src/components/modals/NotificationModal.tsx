"use client"

import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { SolicitudesService } from '@/services/solicitudes'

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
        setSolicitudes(rows || []);
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
      <div className="bg-[var(--background)] rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-auto">
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
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="font-semibold text-[var(--foreground)]">{s.productName || s.name || 'Sin nombre'}</div>
                      <div className="text-sm text-[var(--muted-foreground)]">Empresa: {s.empresa}</div>
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">{formatDate(s.createdAt)}</div>
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
    </div>
  )
}
