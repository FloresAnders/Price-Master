'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import type { Empleado } from '../../types/firestore';

type ExtraQA = { pregunta: string; respuesta: string };

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  minRows?: number;
}

function AutoResizeTextarea({ value, minRows = 1, className, ...props }: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      className={`${className || ''} overflow-hidden`}
      onInput={adjustHeight}
      {...props}
    />
  );
}

interface EmpleadoDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  empleado: Empleado | null;
  readOnly?: boolean;
  onSave?: (patch: Partial<Empleado>) => Promise<void> | void;
}

function asNumberOrUndefined(raw: string): number | undefined {
  const t = String(raw ?? '').trim();
  if (!t) return undefined;
  const n = Number(t);
  if (Number.isNaN(n)) return undefined;
  return n;
}

function boolLabel(v: boolean | undefined) {
  if (v === true) return 'Sí';
  if (v === false) return 'No';
  return '—';
}

function strLabel(v: string | undefined) {
  const s = String(v || '').trim();
  return s || '—';
}

function normalizeYesNo(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const low = s.toLowerCase();
  if (low === 'si' || low === 'sí') return 'Sí';
  if (low === 'no') return 'No';
  return s;
}

export default function EmpleadoDetailsModal({
  isOpen,
  onClose,
  empleado,
  readOnly = false,
  onSave,
}: EmpleadoDetailsModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');

  const [pagoHoraBruta, setPagoHoraBruta] = useState<string>('');
  const [diaContratacion, setDiaContratacion] = useState<string>('');
  const [paganAguinaldo, setPaganAguinaldo] = useState<string>('');
  const [cantidadHorasTrabaja, setCantidadHorasTrabaja] = useState<string>('');
  const [danReciboPago, setDanReciboPago] = useState<string>('');
  const [contratoFisico, setContratoFisico] = useState<string>('');
  const [espacioComida, setEspacioComida] = useState<string>('');
  const [brindanVacaciones, setBrindanVacaciones] = useState<string>('');
  const [incluidoCCSS, setIncluidoCCSS] = useState<boolean>(false);
  const [incluidoINS, setIncluidoINS] = useState<boolean>(false);
  const [preguntasExtra, setPreguntasExtra] = useState<ExtraQA[]>([]);

  const title = useMemo(() => {
    const name = String(empleado?.Empleado || '').trim() || 'Empleado';
    return readOnly ? `Información: ${name}` : `Editar: ${name}`;
  }, [empleado?.Empleado, readOnly]);

  useEffect(() => {
    if (!isOpen) return;
    setError('');

    setPagoHoraBruta(empleado?.pagoHoraBruta !== undefined ? String(empleado.pagoHoraBruta) : '');
    setDiaContratacion(String(empleado?.diaContratacion || ''));
    setPaganAguinaldo(normalizeYesNo(String(empleado?.paganAguinaldo || '')));
    setCantidadHorasTrabaja(empleado?.cantidadHorasTrabaja !== undefined ? String(empleado.cantidadHorasTrabaja) : '');
    setDanReciboPago(normalizeYesNo(String(empleado?.danReciboPago || '')));
    setContratoFisico(normalizeYesNo(String(empleado?.contratoFisico || '')));
    setEspacioComida(normalizeYesNo(String(empleado?.espacioComida || '')));
    setBrindanVacaciones(normalizeYesNo(String(empleado?.brindanVacaciones || '')));
    setIncluidoCCSS(Boolean(empleado?.incluidoCCSS));
    setIncluidoINS(Boolean(empleado?.incluidoINS));
    setPreguntasExtra(Array.isArray(empleado?.preguntasExtra) ? empleado!.preguntasExtra!.map(x => ({ pregunta: String(x.pregunta || ''), respuesta: String(x.respuesta || '') })) : []);
  }, [empleado, isOpen]);

  const canSave = !readOnly && typeof onSave === 'function';

  const validate = (): { ok: boolean; msg?: string } => {
    const pago = asNumberOrUndefined(pagoHoraBruta);
    if (pago === undefined) return { ok: false, msg: 'Pago de hora en bruto es obligatorio.' };
    if (pago < 0) return { ok: false, msg: 'Pago de hora en bruto no puede ser negativo.' };

    if (!diaContratacion) return { ok: false, msg: 'Día de contratación es obligatorio.' };

    if (!String(paganAguinaldo || '').trim()) return { ok: false, msg: 'Pagan aguinaldo es obligatorio.' };

    const horas = asNumberOrUndefined(cantidadHorasTrabaja);
    if (horas === undefined) return { ok: false, msg: 'Cantidad de horas que trabaja es obligatorio.' };
    if (horas < 0) return { ok: false, msg: 'Cantidad de horas no puede ser negativo.' };

    if (!String(danReciboPago || '').trim()) return { ok: false, msg: 'Le dan recibo de pago es obligatorio.' };
    if (!String(contratoFisico || '').trim()) return { ok: false, msg: 'Contrato físico es obligatorio.' };
    if (!String(espacioComida || '').trim()) return { ok: false, msg: 'Se cuenta con espacio de comida es obligatorio.' };
    if (!String(brindanVacaciones || '').trim()) return { ok: false, msg: 'Se brindan vacaciones es obligatorio.' };

    for (const [idx, qa] of preguntasExtra.entries()) {
      const q = String(qa.pregunta || '').trim();
      const a = String(qa.respuesta || '').trim();
      if (!q && !a) continue; // row unused
      if (!q) return { ok: false, msg: `Pregunta extra #${idx + 1}: la pregunta es obligatoria.` };
      if (!a) return { ok: false, msg: `Pregunta extra #${idx + 1}: la respuesta es obligatoria.` };
    }

    return { ok: true };
  };

  const handleSave = async () => {
    if (!canSave) return;
    const v = validate();
    if (!v.ok) {
      setError(v.msg || 'Formulario inválido');
      return;
    }

    const patch: Partial<Empleado> = {
      pagoHoraBruta: asNumberOrUndefined(pagoHoraBruta),
      diaContratacion: diaContratacion,
      paganAguinaldo: normalizeYesNo(paganAguinaldo),
      cantidadHorasTrabaja: asNumberOrUndefined(cantidadHorasTrabaja),
      danReciboPago: normalizeYesNo(danReciboPago),
      contratoFisico: normalizeYesNo(contratoFisico),
      espacioComida: normalizeYesNo(espacioComida),
      brindanVacaciones: normalizeYesNo(brindanVacaciones),
      incluidoCCSS,
      incluidoINS,
      preguntasExtra: preguntasExtra
        .map((x) => ({ pregunta: String(x.pregunta || '').trim(), respuesta: String(x.respuesta || '').trim() }))
        .filter((x) => x.pregunta || x.respuesta),
    };

    try {
      setSaving(true);
      setError('');
      await onSave(patch);
      onClose();
    } catch (e) {
      console.error('Error saving empleado details:', e);
      setError('Error al guardar el empleado');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
  };

  if (!isOpen || !empleado) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4" onKeyDown={handleKeyDown}>
      <div className="bg-[var(--background)] rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[var(--input-border)]">
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-2 mb-4 sm:mb-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-semibold text-[var(--foreground)] truncate">{title}</h2>
              <div className="text-xs text-[var(--muted-foreground)] mt-1 break-words">
                {readOnly ? 'Solo lectura' : 'Campos obligatorios'} · Empresa ID: {String(empleado.empresaId || '')}
              </div>
            </div>
            <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Required questions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Pago de hora en bruto *</label>
              <input
                type="number"
                step="0.01"
                value={pagoHoraBruta}
                onChange={(e) => setPagoHoraBruta(e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 rounded-md bg-[var(--card-bg)] border border-[var(--input-border)] text-[var(--foreground)]"
                placeholder="Ej: 2500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Día de contratación *</label>
              <input
                type="date"
                value={diaContratacion}
                onChange={(e) => setDiaContratacion(e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 rounded-md bg-[var(--card-bg)] border border-[var(--input-border)] text-[var(--foreground)]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Cantidad de horas que trabaja a la semana? *</label>
              <input
                type="number"
                step="0.25"
                value={cantidadHorasTrabaja}
                onChange={(e) => setCantidadHorasTrabaja(e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 rounded-md bg-[var(--card-bg)] border border-[var(--input-border)] text-[var(--foreground)]"
                placeholder="Ej: 48"
              />
            </div>

            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-md px-3 py-2">
                <label className="block text-sm text-[var(--foreground)] mb-1">Pagan aguinaldo? *</label>
                {readOnly ? (
                  <span className="text-sm text-[var(--muted-foreground)]">{strLabel(empleado.paganAguinaldo)}</span>
                ) : (
                  <AutoResizeTextarea
                    value={paganAguinaldo}
                    onChange={(e) => setPaganAguinaldo(e.target.value)}
                    minRows={1}
                    className="w-full bg-[var(--background)] border border-[var(--input-border)] rounded-md px-2 py-1 text-[var(--foreground)] text-sm resize-none"
                  />
                )}
              </div>

              <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-md px-3 py-2">
                <label className="block text-sm text-[var(--foreground)] mb-1">Se da recibo de pago? *</label>
                {readOnly ? (
                  <span className="text-sm text-[var(--muted-foreground)]">{strLabel(empleado.danReciboPago)}</span>
                ) : (
                  <AutoResizeTextarea
                    value={danReciboPago}
                    onChange={(e) => setDanReciboPago(e.target.value)}
                    minRows={1}
                    className="w-full bg-[var(--background)] border border-[var(--input-border)] rounded-md px-2 py-1 text-[var(--foreground)] text-sm resize-none"
                  />
                )}
              </div>

              <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-md px-3 py-2">
                <label className="block text-sm text-[var(--foreground)] mb-1">Se cuenta con contrato físico? *</label>
                {readOnly ? (
                  <span className="text-sm text-[var(--muted-foreground)]">{strLabel(empleado.contratoFisico)}</span>
                ) : (
                  <AutoResizeTextarea
                    value={contratoFisico}
                    onChange={(e) => setContratoFisico(e.target.value)}
                    minRows={1}
                    className="w-full bg-[var(--background)] border border-[var(--input-border)] rounded-md px-2 py-1 text-[var(--foreground)] text-sm resize-none"
                  />
                )}
              </div>

              <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-md px-3 py-2">
                <label className="block text-sm text-[var(--foreground)] mb-1">Espacio comida? *</label>
                {readOnly ? (
                  <span className="text-sm text-[var(--muted-foreground)]">{strLabel(empleado.espacioComida)}</span>
                ) : (
                  <AutoResizeTextarea
                    value={espacioComida}
                    onChange={(e) => setEspacioComida(e.target.value)}
                    minRows={1}
                    className="w-full bg-[var(--background)] border border-[var(--input-border)] rounded-md px-2 py-1 text-[var(--foreground)] text-sm resize-none"
                  />
                )}
              </div>

              <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-md px-3 py-2">
                <label className="block text-sm text-[var(--foreground)] mb-1">Incluido CCSS *</label>
                {readOnly ? (
                  <span className="text-sm text-[var(--muted-foreground)]">{boolLabel(empleado.incluidoCCSS)}</span>
                ) : (
                  <input type="checkbox" checked={incluidoCCSS} onChange={(e) => setIncluidoCCSS(e.target.checked)} className="w-5 h-5" />
                )}
              </div>

              <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-md px-3 py-2">
                <label className="block text-sm text-[var(--foreground)] mb-1">Incluido INS *</label>
                {readOnly ? (
                  <span className="text-sm text-[var(--muted-foreground)]">{boolLabel(empleado.incluidoINS)}</span>
                ) : (
                  <input type="checkbox" checked={incluidoINS} onChange={(e) => setIncluidoINS(e.target.checked)} className="w-5 h-5" />
                )}
              </div>
            </div>
          </div>

          {/* Extra questions */}
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base sm:text-lg font-medium text-[var(--foreground)]">Preguntas adicionales</h3>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setPreguntasExtra((prev) => [...prev, { pregunta: '', respuesta: '' }])}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 rounded bg-[var(--button-bg)] text-[var(--button-text)] hover:bg-[var(--button-hover)] flex items-center gap-1 sm:gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden xs:inline">Agregar</span>
                </button>
              )}
            </div>

            {preguntasExtra.length === 0 ? (
              <div className="text-sm text-[var(--muted-foreground)] mt-2">No hay preguntas adicionales.</div>
            ) : (
              <div className="mt-3 space-y-3">
                {preguntasExtra.map((qa, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-3 bg-[var(--card-bg)] border border-[var(--input-border)] rounded-md p-3">
                    <div>
                      <label className="block text-xs text-[var(--muted-foreground)] mb-1">Pregunta</label>
                      <AutoResizeTextarea
                        value={qa.pregunta}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPreguntasExtra((prev) => prev.map((x, i) => (i === idx ? { ...x, pregunta: v } : x)));
                        }}
                        disabled={readOnly}
                        minRows={2}
                        className="w-full px-3 py-2 rounded-md bg-[var(--background)] border border-[var(--input-border)] text-[var(--foreground)] text-sm resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--muted-foreground)] mb-1">Respuesta</label>
                      <AutoResizeTextarea
                        value={qa.respuesta}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPreguntasExtra((prev) => prev.map((x, i) => (i === idx ? { ...x, respuesta: v } : x)));
                        }}
                        disabled={readOnly}
                        minRows={2}
                        className="w-full px-3 py-2 rounded-md bg-[var(--background)] border border-[var(--input-border)] text-[var(--foreground)] text-sm resize-none"
                      />
                    </div>

                    {!readOnly && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setPreguntasExtra((prev) => prev.filter((_, i) => i !== idx))}
                          className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                          Quitar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-600 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="mt-4 sm:mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-full sm:w-auto px-4 py-2 rounded bg-[var(--hover-bg)] text-[var(--foreground)] border border-[var(--input-border)] hover:opacity-90 disabled:opacity-60 text-sm sm:text-base"
            >
              Cerrar
            </button>
            {canSave && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            )}
          </div>

          {readOnly && (
            <div className="mt-3 text-xs text-[var(--muted-foreground)]">Tip: los admins pueden editar con el ícono de lápiz.</div>
          )}

          <datalist id="yesno-options">
            <option value="Sí" />
            <option value="No" />
          </datalist>
        </div>
      </div>
    </div>
  );
}
