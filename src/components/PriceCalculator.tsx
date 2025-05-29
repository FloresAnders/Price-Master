'use client';
import { useState, useEffect } from 'react';

export default function PriceCalculator() {
  const [originalPrice, setOriginalPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('13'); // IVA por defecto en Costa Rica
  const [finalPrice, setFinalPrice] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [currency, setCurrency] = useState('CRC');

  // Calcular precio final
  useEffect(() => {
    const price = parseFloat(originalPrice) || 0;
    const discountPercent = parseFloat(discount) || 0;
    const taxPercent = parseFloat(tax) || 0;

    if (price > 0) {
      // Calcular descuento
      const discountValue = (price * discountPercent) / 100;
      const priceAfterDiscount = price - discountValue;
      
      // Calcular impuesto sobre el precio con descuento
      const taxValue = (priceAfterDiscount * taxPercent) / 100;
      const final = priceAfterDiscount + taxValue;

      setDiscountAmount(discountValue);
      setTaxAmount(taxValue);
      setFinalPrice(final);
    } else {
      setDiscountAmount(0);
      setTaxAmount(0);
      setFinalPrice(0);
    }
  }, [originalPrice, discount, tax]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleClear = () => {
    setOriginalPrice('');
    setDiscount('');
    setTax('13');
    setFinalPrice(0);
    setDiscountAmount(0);
    setTaxAmount(0);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Columna de entrada */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Precio Original
            </label>
            <div className="relative">
              <input
                type="number"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full px-3 py-2 pl-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute left-3 top-2.5 text-gray-500 text-sm">
                {currency === 'CRC' ? '₡' : '$'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descuento (%)
            </label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0"
              step="0.1"
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Impuesto (%)
            </label>
            <input
              type="number"
              value={tax}
              onChange={(e) => setTax(e.target.value)}
              placeholder="13"
              step="0.1"
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Moneda
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="CRC">Colones (₡)</option>
              <option value="USD">Dólares ($)</option>
            </select>
          </div>

          <button
            onClick={handleClear}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Limpiar
          </button>
        </div>

        {/* Columna de resultados */}
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-700 mb-3">Cálculo Detallado</h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Precio Original:</span>
                <span className="font-medium">
                  {formatCurrency(parseFloat(originalPrice) || 0)}
                </span>
              </div>
              
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Descuento ({discount}%):</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">
                  {formatCurrency((parseFloat(originalPrice) || 0) - discountAmount)}
                </span>
              </div>
              
              {taxAmount > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>Impuesto ({tax}%):</span>
                  <span>+{formatCurrency(taxAmount)}</span>
                </div>
              )}
              
              <hr className="my-2" />
              
              <div className="flex justify-between text-lg font-bold text-gray-900">
                <span>Total:</span>
                <span>{formatCurrency(finalPrice)}</span>
              </div>
            </div>
          </div>

          {/* Resumen visual */}
          <div className="bg-indigo-50 rounded-lg p-4">
            <h4 className="font-medium text-indigo-800 mb-2">Resumen</h4>
            <div className="text-sm text-indigo-700">
              {originalPrice && (
                <>
                  <p>
                    Ahorro: {formatCurrency(discountAmount)} 
                    {discountAmount > 0 && ` (${discount}%)`}
                  </p>
                  <p>
                    Impuestos: {formatCurrency(taxAmount)}
                    {taxAmount > 0 && ` (${tax}%)`}
                  </p>
                  <p className="font-medium mt-1">
                    Precio final: {formatCurrency(finalPrice)}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Calculadora rápida de porcentajes */}
          <div className="bg-yellow-50 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Descuentos Comunes</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[10, 15, 20, 25, 30, 50].map((percent) => (
                <button
                  key={percent}
                  onClick={() => setDiscount(percent.toString())}
                  className="px-2 py-1 bg-yellow-100 hover:bg-yellow-200 rounded text-yellow-800 transition-colors"
                >
                  {percent}%
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}