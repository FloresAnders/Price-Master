// src/examples/employee-summary-example.tsx
'use client';

import React, { useState } from 'react';
import EmployeeSummaryCalculator, {
  calculateEmployeeSummaryFromDB,
  useEmployeeInfo,
  EmployeeSummary
} from '../components/business/EmployeeSummaryCalculator';

/**
 * Ejemplo de uso del EmployeeSummaryCalculator actualizado
 * que obtiene datos directamente desde la base de datos
 */
export default function EmployeeSummaryExample() {
  const [selectedEmployee, setSelectedEmployee] = useState('Juan Pérez');
  const [selectedLocation, setSelectedLocation] = useState('sucursal-centro');
  const [summary, setSummary] = useState<EmployeeSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Ejemplo de uso del hook para obtener información del empleado
  const { employee, loading: employeeLoading, error: employeeError } = useEmployeeInfo(
    selectedEmployee,
    selectedLocation
  );

  // Función para calcular manualmente usando la utilidad
  const handleCalculateManually = async () => {
    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const daysToShow = Array.from({ length: 31 }, (_, i) => i + 1);

      const calculatedSummary = await calculateEmployeeSummaryFromDB(
        selectedEmployee,
        selectedLocation,
        currentYear,
        currentMonth,
        daysToShow,
        employee || undefined
      );

      setSummary(calculatedSummary);
    } catch (error) {
      console.error('Error calculating summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const daysToShow = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6">Ejemplo: Calculadora de Resumen de Empleado</h1>

        {/* Controles de selección */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">Empleado:</label>
            <input
              type="text"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700"
              placeholder="Nombre del empleado"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Ubicación:</label>
            <input
              type="text"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700"
              placeholder="Valor de la ubicación"
            />
          </div>
        </div>

        {/* Información del empleado */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-3">Información del Empleado desde BD:</h3>
          {employeeLoading && <p className="text-sm">Cargando información del empleado...</p>}
          {employeeError && <p className="text-sm text-red-600">Error: {employeeError}</p>}
          {employee && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Nombre:</span> {employee.name}
              </div>
              <div>
                <span className="font-medium">Tipo CCSS:</span>
                <span className={`ml-1 font-medium ${employee.ccssType === 'TC' ? 'text-blue-600' : 'text-green-600'}`}>
                  {employee.ccssType === 'TC' ? 'Tiempo Completo' : 'Medio Tiempo'}
                </span>
              </div>
              <div>
                <span className="font-medium">Horas por turno:</span> {employee.hoursPerShift || 8}
              </div>
              <div>
                <span className="font-medium">Monto extra:</span> ₡{employee.extraAmount || 0}
              </div>
            </div>
          )}
          {!employee && !employeeLoading && !employeeError && (
            <p className="text-sm text-gray-600">Empleado no encontrado en la ubicación especificada</p>
          )}
        </div>

        {/* Componente principal */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-3">Resumen Automático (Componente):</h3>
          <EmployeeSummaryCalculator
            employeeName={selectedEmployee}
            locationValue={selectedLocation}
            year={currentYear}
            month={currentMonth}
            daysToShow={daysToShow}
            showFullDetails={true}
          />
        </div>

        {/* Cálculo manual */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Cálculo Manual (Utilidad):</h3>
            <button
              onClick={handleCalculateManually}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Calculando...' : 'Calcular'}
            </button>
          </div>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="text-center">
                <div className="font-medium text-blue-600">{summary.workedDays}</div>
                <div className="text-xs text-gray-600">Días trabajados</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-green-600">{summary.hours}h</div>
                <div className="text-xs text-gray-600">Horas totales</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-yellow-600">₡{summary.colones.toFixed(0)}</div>
                <div className="text-xs text-gray-600">Salario bruto</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-red-600">₡{summary.ccss.toFixed(0)}</div>
                <div className="text-xs text-gray-600">CCSS</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-emerald-600">₡{summary.neto.toFixed(0)}</div>
                <div className="text-xs text-gray-600">Salario neto</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Documentación de uso */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4">Cómo usar el componente actualizado</h2>

        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-2">1. Uso básico del componente:</h4>
            <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto">
              {`<EmployeeSummaryCalculator
  employeeName="Juan Pérez"
  locationValue="sucursal-centro"
  year={2024}
  month={6}
  daysToShow={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
  showFullDetails={true}
/>`}
            </pre>
          </div>

          <div>
            <h4 className="font-semibold mb-2">2. Hook para obtener información del empleado:</h4>
            <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto">
              {`const { employee, loading, error } = useEmployeeInfo("Juan Pérez", "sucursal-centro");`}
            </pre>
          </div>

          <div>
            <h4 className="font-semibold mb-2">3. Función utilitaria para cálculo directo:</h4>
            <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto">
              {`const summary = await calculateEmployeeSummaryFromDB(
  "Juan Pérez",
  "sucursal-centro", 
  2024,
  6,
  [1, 2, 3, 4, 5],
  employee
);`}
            </pre>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Datos obtenidos automáticamente:</h4>
            <ul className="list-disc list-inside space-y-1 text-xs ml-4">
              <li><strong>Horarios:</strong> Se obtienen desde la colección &lsquo;schedules&rsquo; filtrados por empleado, ubicación, año y mes</li>
              <li><strong>Configuración CCSS:</strong> Se obtiene desde la colección &lsquo;ccss-config&rsquo; con valores MT y TC actualizados</li>
              <li><strong>Información del empleado:</strong> Se obtiene desde la colección &lsquo;locations&rsquo; incluyendo tipo CCSS, horas por turno y monto extra</li>
              <li><strong>Cálculos:</strong> Se realizan automáticamente basados en los datos reales de la base de datos</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
