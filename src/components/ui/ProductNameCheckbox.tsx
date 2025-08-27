import React from 'react';

interface ProductNameCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function ProductNameCheckbox({ checked, onChange, disabled = false }: ProductNameCheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <div className="space-y-3">
      {/* Checkbox principal con estilos inline para evitar conflictos */}
      <div>
        <h3 className="text-white font-medium mb-3">Configuración de Productos</h3>

        <div
          className="flex items-start gap-3 cursor-pointer"
          onClick={() => !disabled && onChange(!checked)}
        >
          <div className="flex-shrink-0 mt-1">
            <input
              type="checkbox"
              id="productNameCheckbox"
              checked={checked}
              onChange={handleChange}
              disabled={disabled}
              style={{
                width: '20px',
                height: '20px',
                accentColor: '#3b82f6',
                cursor: disabled ? 'not-allowed' : 'pointer'
              }}
              className="rounded border-2 border-gray-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex-1">
            <label
              htmlFor="productNameCheckbox"
              className="text-white font-medium cursor-pointer block"
            >
              Solicitar nombre del producto
            </label>
            <p className="text-gray-400 text-sm mt-1 leading-relaxed">
              Cuando esté marcado, se solicitará un nombre opcional para cada código escaneado.
              Esto te permite asociar un nombre personalizado a cada producto.
            </p>
          </div>
        </div>
      </div>      {/* Indicador visual del estado */}
      <div className={`p-3 rounded-md border-l-4 ${checked
          ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-800 dark:text-green-200'
          : 'bg-gray-100 dark:bg-gray-700/50 border-gray-400 dark:border-gray-500 text-gray-700 dark:text-gray-300'
        }`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {checked ? '✅' : '⭕'}
          </span>
          <span className="font-medium">
            {checked
              ? 'Se solicitará nombre del producto al escanear'
              : 'No se solicitará nombre del producto'
            }
          </span>
        </div>
      </div>
    </div>
  );
}
