'use client'

import React, { useState, useEffect } from 'react'
import { Trash2, Plus, Package, Calendar, User, FileText } from 'lucide-react'

interface Product {
  id: string
  name: string
  quantity: number
  price?: number
}

interface SupplierOrder {
  id: string
  supplierName: string
  orderDate: string
  expectedDeliveryDate: string
  notes: string
  products: Product[]
  total?: number
}

export default function SupplierOrders() {
  // Form states
  const [supplierName, setSupplierName] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  
  // Product form states
  const [productName, setProductName] = useState('')
  const [quantity, setQuantity] = useState<number>(1)
  const [price, setPrice] = useState<string>('')
  
  // Current order products
  const [products, setProducts] = useState<Product[]>([])
  
  // Orders history
  const [orders, setOrders] = useState<SupplierOrder[]>([])
  const [showOrdersList, setShowOrdersList] = useState(false)

  // Auto-complete order date on component mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setOrderDate(today)
  }, [])

  // Load orders from localStorage
  useEffect(() => {
    const savedOrders = localStorage.getItem('supplierOrders')
    if (savedOrders) {
      try {
        setOrders(JSON.parse(savedOrders))
      } catch (error) {
        console.error('Error loading orders from localStorage:', error)
      }
    }
  }, [])

  // Save orders to localStorage
  useEffect(() => {
    localStorage.setItem('supplierOrders', JSON.stringify(orders))
  }, [orders])

  // Calculate total for current products
  const calculateTotal = (): number => {
    return products.reduce((total, product) => {
      if (product.price) {
        return total + (product.quantity * product.price)
      }
      return total
    }, 0)
  }

  // Add product to current order
  const addProduct = () => {
    if (!productName.trim()) return

    const newProduct: Product = {
      id: Date.now().toString(),
      name: productName.trim(),
      quantity: quantity,
      price: price ? parseFloat(price) : undefined
    }

    setProducts(prev => [...prev, newProduct])
    
    // Clear form
    setProductName('')
    setQuantity(1)
    setPrice('')
  }

  // Remove product from current order
  const removeProduct = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId))
  }

  // Save current order
  const saveOrder = () => {
    if (!supplierName.trim() || products.length === 0) {
      alert('Por favor completa el nombre del proveedor y agrega al menos un producto.')
      return
    }

    const newOrder: SupplierOrder = {
      id: Date.now().toString(),
      supplierName: supplierName.trim(),
      orderDate,
      expectedDeliveryDate,
      notes: notes.trim(),
      products: [...products],
      total: calculateTotal()
    }

    setOrders(prev => [newOrder, ...prev])
    clearForm()
    alert('Orden guardada exitosamente!')
  }

  // Clear form for new order
  const clearForm = () => {
    setSupplierName('')
    setOrderDate(new Date().toISOString().split('T')[0])
    setExpectedDeliveryDate('')
    setNotes('')
    setProducts([])
    setProductName('')
    setQuantity(1)
    setPrice('')
  }

  // Delete saved order
  const deleteOrder = (orderId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta orden?')) {
      setOrders(prev => prev.filter(o => o.id !== orderId))
    }
  }

  const currentTotal = calculateTotal()

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Toggle between new order and orders list */}
      <div className="flex justify-center gap-4 mb-6">
        <button
          onClick={() => setShowOrdersList(false)}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            !showOrdersList 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Nueva Orden
        </button>
        <button
          onClick={() => setShowOrdersList(true)}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            showOrdersList 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Órdenes Guardadas ({orders.length})
        </button>
      </div>

      {!showOrdersList ? (
        /* New Order Form */
        <div className="space-y-6">
          {/* Main Order Form */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Información de la Orden
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <User className="w-4 h-4" />
                  Nombre del Proveedor
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ingresa el nombre del proveedor"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Fecha de Orden
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Fecha Esperada de Entrega
                </label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  Notas
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Notas adicionales..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Add Products Form */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Agregar Productos
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Producto
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre del producto"
                  onKeyDown={(e) => e.key === 'Enter' && addProduct()}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio Unitario (opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              
              <button
                onClick={addProduct}
                disabled={!productName.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            </div>
          </div>

          {/* Products List */}
          {products.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Productos en la Orden ({products.length})
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Nombre</th>
                      <th className="text-center py-2 px-3 font-medium text-gray-700">Cantidad</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-700">Precio</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-700">Total</th>
                      <th className="text-center py-2 px-3 font-medium text-gray-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3">{product.name}</td>
                        <td className="py-2 px-3 text-center">{product.quantity}</td>
                        <td className="py-2 px-3 text-right">
                          {product.price ? `₡${product.price.toFixed(2)}` : 'N/A'}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          {product.price ? `₡${(product.quantity * product.price).toFixed(2)}` : 'N/A'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => removeProduct(product.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Eliminar producto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {currentTotal > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 font-bold">
                        <td colSpan={3} className="py-2 px-3 text-right">Total de la Orden:</td>
                        <td className="py-2 px-3 text-right text-lg">₡{currentTotal.toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-center gap-4">
            <button
              onClick={saveOrder}
              disabled={!supplierName.trim() || products.length === 0}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Guardar Orden
            </button>
            <button
              onClick={clearForm}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Limpiar Formulario
            </button>
          </div>
        </div>
      ) : (
        /* Orders List */
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">Órdenes Guardadas</h3>
          
          {orders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay órdenes guardadas todavía.
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">{order.supplierName}</h4>
                    <p className="text-sm text-gray-600">
                      Orden: {new Date(order.orderDate).toLocaleDateString()}
                      {order.expectedDeliveryDate && (
                        <> • Entrega: {new Date(order.expectedDeliveryDate).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteOrder(order.id)}
                    className="text-red-500 hover:text-red-700 p-2"
                    title="Eliminar orden"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                
                {order.notes && (
                  <p className="text-sm text-gray-600 mb-4">
                    <strong>Notas:</strong> {order.notes}
                  </p>
                )}
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-1 px-2">Producto</th>
                        <th className="text-center py-1 px-2">Cantidad</th>
                        <th className="text-right py-1 px-2">Precio</th>
                        <th className="text-right py-1 px-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.products.map((product) => (
                        <tr key={product.id} className="border-b border-gray-100">
                          <td className="py-1 px-2">{product.name}</td>
                          <td className="py-1 px-2 text-center">{product.quantity}</td>
                          <td className="py-1 px-2 text-right">
                            {product.price ? `₡${product.price.toFixed(2)}` : 'N/A'}
                          </td>
                          <td className="py-1 px-2 text-right">
                            {product.price ? `₡${(product.quantity * product.price).toFixed(2)}` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {order.total && order.total > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-gray-300 font-bold">
                          <td colSpan={3} className="py-1 px-2 text-right">Total:</td>
                          <td className="py-1 px-2 text-right">₡{order.total.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}