'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { EmpresasService } from '../../services/empresas';
import type { User } from '../../types/firestore';

type Props = {
  empresasData: any[];
  setEmpresasData: React.Dispatch<React.SetStateAction<any[]>>;
  currentUser: User | null;
  openConfirmModal: (title: string, message: string, onConfirm: () => void, opts?: { singleButton?: boolean; singleButtonText?: string }) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
  resolveOwnerIdForActor: (provided?: string) => string | undefined;
  loadData: () => Promise<void>;
};

export default function EmpresasEditorSection({
  empresasData,
  setEmpresasData,
  currentUser,
  openConfirmModal,
  showToast,
  resolveOwnerIdForActor,
  loadData,
}: Props) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div>
          <h4 className="text-base sm:text-lg lg:text-xl font-semibold">Configuración de Empresas</h4>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-0.5 sm:mt-1">
            Gestiona las empresas y sus configuraciones
          </p>
        </div>
        <button
          onClick={() =>
            setEmpresasData(prev => [
              ...prev,
              {
                ownerId: currentUser && currentUser.eliminate === false ? currentUser.id : '',
                name: '',
                ubicacion: '',
                empleados: [
                  {
                    Empleado: '',
                    hoursPerShift: 8,
                    extraAmount: 0,
                    ccssType: 'TC',
                    calculoprecios: false,
                    amboshorarios: false,
                  },
                ],
              },
            ])
          }
          className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs sm:text-sm w-full sm:w-auto flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Agregar Empresa</span>
        </button>
      </div>

      {empresasData.map((empresa, idx) => (
        <div key={empresa.id || idx} className="border border-[var(--input-border)] rounded-lg p-2.5 sm:p-4 lg:p-5 relative">
          <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Nombre de la empresa:</label>
              <input
                type="text"
                value={empresa.name || ''}
                onChange={(e) => {
                  const copy = [...empresasData];
                  copy[idx] = { ...copy[idx], name: e.target.value };
                  setEmpresasData(copy);
                }}
                className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Ubicación:</label>
              <input
                type="text"
                value={empresa.ubicacion || ''}
                onChange={(e) => {
                  const copy = [...empresasData];
                  copy[idx] = { ...copy[idx], ubicacion: e.target.value };
                  setEmpresasData(copy);
                }}
                className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
              />
            </div>
          </div>

          <div className="mt-4 sm:mt-5">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
              <label className="block text-xs sm:text-sm font-medium">Empleados:</label>
              <button
                onClick={() => {
                  const copy = [...empresasData];
                  if (!copy[idx].empleados) copy[idx].empleados = [];
                  copy[idx].empleados.push({
                    Empleado: '',
                    hoursPerShift: 8,
                    extraAmount: 0,
                    ccssType: 'TC',
                    calculoprecios: false,
                    amboshorarios: false,
                  });
                  setEmpresasData(copy);
                }}
                className="text-xs sm:text-sm bg-green-600 text-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md hover:bg-green-700 transition-colors w-full sm:w-auto flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Agregar Empleado</span>
              </button>
            </div>

            <div className="space-y-2 sm:space-y-3">
              {empresa.empleados?.map((emp: any, eIdx: number) => (
                <div key={eIdx} className="p-2 sm:p-3 border border-[var(--input-border)] rounded-lg bg-[var(--card-bg)]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] sm:text-xs font-medium mb-1">Empleado</label>
                      <input
                        type="text"
                        value={emp.Empleado}
                        onChange={(ev) => {
                          const copy = [...empresasData];
                          copy[idx].empleados[eIdx].Empleado = ev.target.value;
                          setEmpresasData(copy);
                        }}
                        className="w-full px-2 sm:px-2.5 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                        placeholder="Nombre"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium mb-1">Horas/turno</label>
                      <input
                        type="number"
                        value={emp.hoursPerShift ?? 8}
                        onChange={(ev) => {
                          const copy = [...empresasData];
                          copy[idx].empleados[eIdx].hoursPerShift = parseInt(ev.target.value) || 0;
                          setEmpresasData(copy);
                        }}
                        className="w-full px-2 sm:px-2.5 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                        min="0"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium mb-1">Monto extra</label>
                      <input
                        type="number"
                        value={emp.extraAmount ?? 0}
                        onChange={(ev) => {
                          const copy = [...empresasData];
                          copy[idx].empleados[eIdx].extraAmount = parseFloat(ev.target.value) || 0;
                          setEmpresasData(copy);
                        }}
                        className="w-full px-2 sm:px-2.5 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] sm:text-xs font-medium mb-1">Tipo CCSS</label>
                      <select
                        value={emp.ccssType || 'TC'}
                        onChange={(ev) => {
                          const copy = [...empresasData];
                          copy[idx].empleados[eIdx].ccssType = ev.target.value;
                          setEmpresasData(copy);
                        }}
                        className="w-full px-2 sm:px-2.5 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                      >
                        <option value="TC">Tiempo Completo</option>
                        <option value="MT">Medio Tiempo</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] sm:text-xs font-medium mb-1">Horarios</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 text-xs sm:text-sm">
                          <input
                            type="checkbox"
                            checked={Boolean(emp.amboshorarios)}
                            onChange={(ev) => {
                              const copy = [...empresasData];
                              copy[idx].empleados[eIdx].amboshorarios = ev.target.checked;
                              setEmpresasData(copy);
                            }}
                          />
                          Ambos horarios
                        </label>

                        <label className="flex items-center gap-2 text-xs sm:text-sm">
                          <input
                            type="checkbox"
                            checked={Boolean(emp.calculoprecios)}
                            onChange={(ev) => {
                              const copy = [...empresasData];
                              copy[idx].empleados[eIdx].calculoprecios = ev.target.checked;
                              setEmpresasData(copy);
                            }}
                          />
                          Cálculo precios
                        </label>
                      </div>
                      <p className="text-[10px] sm:text-xs text-[var(--muted-foreground)] mt-1">
                        Si “Ambos horarios” está activo, tiene prioridad.
                      </p>
                    </div>
                    <div className="sm:col-span-2 flex justify-end mt-2 pt-2 border-t border-[var(--input-border)]">
                      <button
                        onClick={() => {
                          openConfirmModal(
                            'Eliminar Empleado',
                            `¿Desea eliminar al empleado ${emp.Empleado || `N°${eIdx + 1}`}?`,
                            () => {
                              const copy = [...empresasData];
                              copy[idx].empleados = copy[idx].empleados.filter((_: unknown, i: number) => i !== eIdx);
                              setEmpresasData(copy);
                            }
                          );
                        }}
                        className="text-xs sm:text-sm px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Eliminar</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 mt-2">
            <button
              onClick={async () => {
                // Save single empresa
                try {
                  const e = empresasData[idx];
                  if (e.id) {
                    await EmpresasService.updateEmpresa(e.id, e);
                    showToast('Empresa actualizada', 'success');
                  } else {
                    const ownerIdToUse = resolveOwnerIdForActor(e.ownerId);
                    const idToUse = e.name && e.name.trim() !== '' ? e.name.trim() : undefined;
                    if (!idToUse) {
                      showToast('El nombre (name) es requerido para crear la empresa con id igual a name', 'error');
                    } else {
                      try {
                        await EmpresasService.addEmpresa({
                          id: idToUse,
                          ownerId: ownerIdToUse,
                          name: e.name || '',
                          ubicacion: e.ubicacion || '',
                          empleados: e.empleados || [],
                        });
                        await loadData();
                        showToast('Empresa creada', 'success');
                      } catch (err) {
                        const message = err && (err as Error).message ? (err as Error).message : 'Error al guardar empresa';
                        if (message.includes('maximum allowed companies') || message.toLowerCase().includes('max')) {
                          openConfirmModal('Límite de empresas', message, () => { /* sólo cerrar */ }, { singleButton: true, singleButtonText: 'Cerrar' });
                        } else {
                          showToast('Error al guardar empresa', 'error');
                        }
                      }
                    }
                  }
                } catch (err) {
                  console.error('Error saving empresa:', err);
                  showToast('Error al guardar empresa', 'error');
                }
              }}
              className="px-3 py-2 sm:px-4 rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors text-sm sm:text-base"
            >
              Guardar Empresa
            </button>
            <button
              onClick={() =>
                openConfirmModal('Eliminar Empresa', '¿Desea eliminar esta empresa?', async () => {
                  try {
                    const e = empresasData[idx];
                    if (e.id) await EmpresasService.deleteEmpresa(e.id);
                    setEmpresasData(prev => prev.filter((_, i) => i !== idx));
                    showToast('Empresa eliminada', 'success');
                  } catch (err) {
                    console.error('Error deleting empresa:', err);
                    showToast('Error al eliminar empresa', 'error');
                  }
                })
              }
              className="px-3 py-2 sm:px-4 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm sm:text-base"
            >
              Eliminar Empresa
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
