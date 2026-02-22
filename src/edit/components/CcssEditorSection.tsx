'use client';

import React from 'react';
import { Building, Check, Clock, DollarSign, Info, Plus, Trash2, Save } from 'lucide-react';

import { CcssConfigService } from '../../services/ccss-config';
import type { User } from '../../types/firestore';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type FlattenedItem = {
  configIndex: number;
  companyIndex: number;
  config: any;
  company: any;
};

type Props = {
  currentUser: User | null;
  empresasData: any[];
  actorOwnerIdSet: Set<string>;

  ccssConfigsData: any[];
  hasChanges: boolean;
  isSaving: boolean;

  addCcssConfig: () => void;
  getFlattenedCcssData: () => FlattenedItem[];
  updateCcssConfig: (configIndex: number, companyIndex: number, field: string, value: string | number) => void;
  removeCcssConfig: (configIndex: number, companyIndex: number) => void;
  saveData: () => void;

  loadData: () => Promise<void>;
  showToast: (message: string, type?: ToastType, duration?: number) => void;
};

export default function CcssEditorSection({
  currentUser,
  empresasData,
  actorOwnerIdSet,
  ccssConfigsData,
  hasChanges,
  isSaving,
  addCcssConfig,
  getFlattenedCcssData,
  updateCcssConfig,
  removeCcssConfig,
  saveData,
  loadData,
  showToast,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <div>
          <h4 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            Configuración de Pago CCSS
          </h4>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Configurar los montos de pago CCSS específicos para cada empresa
          </p>
        </div>
        <button
          onClick={addCcssConfig}
          className="px-4 py-2 sm:px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold w-full sm:w-auto"
        >
          <span className="hidden sm:inline">Agregar Configuración</span>
          <span className="sm:hidden">+ Config</span>
        </button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          </div>
          <div>
            <h5 className="font-medium text-blue-900 dark:text-blue-300">Configuración por Empresa</h5>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              Cada empresa puede tener configuraciones CCSS específicas. Los valores se aplicarán automáticamente según la empresa seleccionada en los cálculos de nómina.
            </p>
          </div>
        </div>
      </div>

      {getFlattenedCcssData().length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg">
            <DollarSign className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">No hay configuraciones CCSS</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">
            Comienza creando tu primera configuración CCSS para gestionar los pagos de tus empresas de manera eficiente
          </p>
          <button
            onClick={addCcssConfig}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold text-lg flex items-center gap-3 mx-auto"
          >
            <Plus className="w-5 h-5" />
            Crear Primera Configuración
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {getFlattenedCcssData().map((item, flatIndex) => (
            <div
              key={`${item.config.id || item.configIndex}-${item.companyIndex}`}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 relative"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start mb-4 sm:mb-6 gap-3 sm:gap-0">
                <div className="min-w-0 flex-1">
                  <h5 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2 truncate">
                    Configuración CCSS #{flatIndex + 1}
                  </h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {item.company.ownerCompanie || 'Nueva empresa'}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                  <button
                    onClick={async () => {
                      try {
                        const updatedConfig = {
                          ...item.config,
                          companie: item.config.companie.map((comp: any, idx: number) =>
                            idx === item.companyIndex ? item.company : comp
                          ),
                        };
                        await CcssConfigService.updateCcssConfig(updatedConfig);
                        showToast(`Configuración para ${item.company.ownerCompanie || 'empresa'} guardada exitosamente`, 'success');
                        await loadData();
                      } catch (error) {
                        console.error('Error saving CCSS config:', error);
                        showToast('Error al guardar la configuración', 'error');
                      }
                    }}
                    className="px-3 py-2 sm:px-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium text-sm flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Check className="w-4 h-4" />
                    <span className="hidden sm:inline">Guardar</span>
                    <span className="sm:hidden">Save</span>
                  </button>
                  <button
                    onClick={() => removeCcssConfig(item.configIndex, item.companyIndex)}
                    className="px-3 py-2 sm:px-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium text-sm flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Eliminar</span>
                    <span className="sm:hidden">Delete</span>
                  </button>
                </div>
              </div>

              <div className="mb-8">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
                  <label className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2">
                    <Building className="w-5 h-5" />
                    Empresa:
                  </label>
                  <select
                    value={item.company.ownerCompanie || ''}
                    onChange={(e) => updateCcssConfig(item.configIndex, item.companyIndex, 'ownerCompanie', e.target.value)}
                    className="w-full px-4 py-3 border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm"
                  >
                    <option value="">Seleccionar empresa...</option>
                    {(() => {
                      if (!currentUser || currentUser.role === 'superadmin') {
                        return (empresasData || []).map((empresa, idx) => (
                          <option key={empresa.id || idx} value={empresa.name}>
                            {empresa.name}
                          </option>
                        ));
                      }

                      return (empresasData || [])
                        .filter((empresa) => {
                          if (!empresa || !empresa.ownerId) return false;
                          if (actorOwnerIdSet.size > 0) {
                            return actorOwnerIdSet.has(String(empresa.ownerId));
                          }
                          return (
                            (currentUser.id && String(empresa.ownerId) === String(currentUser.id)) ||
                            (currentUser.ownerId && String(empresa.ownerId) === String(currentUser.ownerId))
                          );
                        })
                        .map((empresa, idx) => (
                          <option key={empresa.id || idx} value={empresa.name}>
                            {empresa.name}
                          </option>
                        ));
                    })()}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h6 className="font-bold text-green-900 dark:text-green-200">Tiempo Completo</h6>
                      <p className="text-xs text-green-700 dark:text-green-400">(TC)</p>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-green-600 dark:text-green-400 font-bold text-lg">₡</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.company.tc || 0}
                      onChange={(e) => updateCcssConfig(item.configIndex, item.companyIndex, 'tc', parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-green-300 dark:border-green-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                      placeholder="11017.39"
                    />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h6 className="font-bold text-orange-900 dark:text-orange-200">Medio Tiempo</h6>
                      <p className="text-xs text-orange-700 dark:text-orange-400">(MT)</p>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-orange-600 dark:text-orange-400 font-bold text-lg">₡</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.company.mt || 0}
                      onChange={(e) => updateCcssConfig(item.configIndex, item.companyIndex, 'mt', parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-orange-300 dark:border-orange-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                      placeholder="3672.46"
                    />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h6 className="font-bold text-blue-900 dark:text-blue-200">Valor por Hora</h6>
                      <p className="text-xs text-blue-700 dark:text-blue-400">Tarifa horaria</p>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-blue-600 dark:text-blue-400 font-bold text-lg">₡</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.company.valorhora || 0}
                      onChange={(e) => updateCcssConfig(item.configIndex, item.companyIndex, 'valorhora', parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                      placeholder="1441"
                    />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h6 className="font-bold text-purple-900 dark:text-purple-200">Hora Bruta</h6>
                      <p className="text-xs text-purple-700 dark:text-purple-400">Tarifa bruta</p>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-600 dark:text-purple-400 font-bold text-lg">₡</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.company.horabruta || 0}
                      onChange={(e) => updateCcssConfig(item.configIndex, item.companyIndex, 'horabruta', parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                      placeholder="1529.62"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {ccssConfigsData.length > 0 && (
        <div className="flex justify-center pt-8">
          <button
            onClick={saveData}
            disabled={!hasChanges || isSaving}
            className={`px-8 py-4 rounded-xl flex items-center gap-3 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold text-lg ${
              hasChanges && !isSaving
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-6 h-6" />
            {isSaving ? 'Guardando...' : 'Guardar Todas las Configuraciones'}
          </button>
        </div>
      )}
    </div>
  );
}
