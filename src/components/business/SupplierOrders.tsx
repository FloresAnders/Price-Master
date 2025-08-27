'use client'

import React, { useState, useEffect } from 'react'
import { Trash2, Plus, Package, Calendar, User, FileText, Edit, Lock as LockIcon } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';

interface Product {
  id: string
  name: string
  quantity: number
  price?: number
  barcode?: string
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
  /* Verificar permisos del usuario */
  const { user } = useAuth();

  // Form states
  const [supplierName, setSupplierName] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  
  // Product form states
  const [productName, setProductName] = useState('')
  const [quantity, setQuantity] = useState<number>(1)
  const [barcode, setBarcode] = useState<string>('')
  const [price, setPrice] = useState<string>('')
  
  // Current order products
  const [products, setProducts] = useState<Product[]>([])
  
  // Orders history
  const [orders, setOrders] = useState<SupplierOrder[]>([])
  const [showOrdersList, setShowOrdersList] = useState(false)
  
  // Edit functionality
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  
  // Recurrent data
  const [recurrentSuppliers, setRecurrentSuppliers] = useState<string[]>([])
  const [recurrentProducts, setRecurrentProducts] = useState<string[]>([])
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [showProductDropdown, setShowProductDropdown] = useState(false)

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
    
    // Load recurrent suppliers
    const savedSuppliers = localStorage.getItem('recurrentSuppliers')
    if (savedSuppliers) {
      try {
        setRecurrentSuppliers(JSON.parse(savedSuppliers))
      } catch (error) {
        console.error('Error loading suppliers from localStorage:', error)
      }
    }
    
    // Load recurrent products
    const savedProducts = localStorage.getItem('recurrentProducts')
    if (savedProducts) {
      try {
        setRecurrentProducts(JSON.parse(savedProducts))
      } catch (error) {
        console.error('Error loading products from localStorage:', error)
      }
    }
  }, [])

  // Save orders to localStorage
  useEffect(() => {
    localStorage.setItem('supplierOrders', JSON.stringify(orders))
  }, [orders])
  
  // Save recurrent suppliers to localStorage
  useEffect(() => {
    localStorage.setItem('recurrentSuppliers', JSON.stringify(recurrentSuppliers))
  }, [recurrentSuppliers])
  
  // Save recurrent products to localStorage
  useEffect(() => {
    localStorage.setItem('recurrentProducts', JSON.stringify(recurrentProducts))
  }, [recurrentProducts])

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
      barcode: barcode.trim() || undefined,
      price: price ? parseFloat(price) : undefined
    }

    setProducts(prev => [...prev, newProduct])
    
    // Add to recurrent products if not already there
    const trimmedName = productName.trim()
    if (!recurrentProducts.includes(trimmedName)) {
      setRecurrentProducts(prev => [...prev, trimmedName])
    }
    
    // Clear form
    setProductName('')
    setQuantity(1)
    setBarcode('')
    setPrice('')
    setShowProductDropdown(false)
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

    if (isEditing && editingOrderId) {
      // Update existing order
      const updatedOrder: SupplierOrder = {
        id: editingOrderId,
        supplierName: supplierName.trim(),
        orderDate,
        expectedDeliveryDate,
        notes: notes.trim(),
        products: [...products],
        total: calculateTotal()
      }

      setOrders(prev => prev.map(order => 
        order.id === editingOrderId ? updatedOrder : order
      ))
      
      alert('Orden actualizada exitosamente!')
      cancelEdit()
    } else {
      // Create new order
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
      
      // Add supplier to recurrent suppliers if not already there
      const trimmedSupplier = supplierName.trim()
      if (!recurrentSuppliers.includes(trimmedSupplier)) {
        setRecurrentSuppliers(prev => [...prev, trimmedSupplier])
      }
      
      clearForm()
      alert('Orden guardada exitosamente!')
    }
  }

  // Start editing an existing order
  const startEdit = (order: SupplierOrder) => {
    setSupplierName(order.supplierName)
    setOrderDate(order.orderDate)
    setExpectedDeliveryDate(order.expectedDeliveryDate)
    setNotes(order.notes)
    setProducts([...order.products])
    setEditingOrderId(order.id)
    setIsEditing(true)
    setShowOrdersList(false) // Switch to form view
  }

  // Cancel editing
  const cancelEdit = () => {
    setIsEditing(false)
    setEditingOrderId(null)
    clearForm()
  }

  // Clear form for new order
  const clearForm = () => {
    if (!isEditing) {
      // Only clear supplier name if not editing
      setSupplierName('')
    }
    setOrderDate(new Date().toISOString().split('T')[0])
    setExpectedDeliveryDate('')
    setNotes('')
    setProducts([])
    setProductName('')
    setQuantity(1)
    setBarcode('')
    setPrice('')
    setShowSupplierDropdown(false)
    setShowProductDropdown(false)
    setIsEditing(false)
    setEditingOrderId(null)
  }

  // Delete saved order
  const deleteOrder = (orderId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta orden?')) {
      setOrders(prev => prev.filter(o => o.id !== orderId))
    }
  }

  const currentTotal = calculateTotal()
  
  // Filter suppliers and products based on input
  const filteredSuppliers = recurrentSuppliers.filter(supplier =>
    supplier.toLowerCase().includes(supplierName.toLowerCase())
  ).slice(0, 5) // Limit to 5 suggestions
  
  const filteredProducts = recurrentProducts.filter(product =>
    product.toLowerCase().includes(productName.toLowerCase())
  ).slice(0, 5) // Limit to 5 suggestions
  
  // Handle supplier selection
  const selectSupplier = (supplier: string) => {
    setSupplierName(supplier)
    setShowSupplierDropdown(false)
  }
  
  // Handle product selection
  const selectProduct = (product: string) => {
    setProductName(product)
    setShowProductDropdown(false)
  }

  // Verificar si el usuario tiene permiso para usar las órdenes de proveedor
  if (!hasPermission(user?.permissions, 'supplierorders')) {
    return (
      <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
        <div className="text-center">
          <LockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Acceso Restringido
          </h3>
          <p className="text-[var(--muted-foreground)]">
            No tienes permisos para acceder a las Órdenes de Proveedor.
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Contacta a un administrador para obtener acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Toggle between new order and orders list */}
      <div className="flex justify-center gap-4 mb-6">
        <button
          onClick={() => {
            if (isEditing) {
              cancelEdit()
            }
            setShowOrdersList(false)
          }}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            !showOrdersList 
              ? 'bg-blue-500 text-white' 
              : 'hover:opacity-80'
          }`}
          style={{
            background: !showOrdersList ? '#3b82f6' : 'var(--button-bg)',
            color: !showOrdersList ? '#ffffff' : 'var(--button-text)',
          }}
        >
          {isEditing ? 'Editando Orden' : 'Nueva Orden'}
        </button>
        <button
          onClick={() => {
            if (isEditing) {
              cancelEdit()
            }
            setShowOrdersList(true)
          }}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            showOrdersList 
              ? 'bg-blue-500 text-white' 
              : 'hover:opacity-80'
          }`}
          style={{
            background: showOrdersList ? '#3b82f6' : 'var(--button-bg)',
            color: showOrdersList ? '#ffffff' : 'var(--button-text)',
          }}
        >
          Órdenes Guardadas ({orders.length})
        </button>
      </div>

      {!showOrdersList ? (
        /* New Order Form */
        <div className="space-y-6">
          {/* Main Order Form */}
          <div className="rounded-lg border p-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              <Package className="w-5 h-5" />
              Información de la Orden
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--foreground)' }}>
                  <User className="w-4 h-4" />
                  Nombre del Proveedor
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => {
                    setSupplierName(e.target.value)
                    setShowSupplierDropdown(e.target.value.length > 0 && filteredSuppliers.length > 0)
                  }}
                  onFocus={() => setShowSupplierDropdown(supplierName.length > 0 && filteredSuppliers.length > 0)}
                  onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    background: 'var(--input-bg)',
                    borderColor: 'var(--input-border)',
                    color: 'var(--foreground)',
                  }}
                  placeholder="Ingresa el nombre del proveedor"
                />
                {showSupplierDropdown && filteredSuppliers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 border rounded-md shadow-lg" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
                    {filteredSuppliers.map((supplier, index) => (
                      <button
                        key={index}
                        onClick={() => selectSupplier(supplier)}
                        className="w-full px-3 py-2 text-left hover:opacity-80 first:rounded-t-md last:rounded-b-md"
                        style={{ color: 'var(--foreground)', background: 'var(--card-bg)' }}
                      >
                        {supplier}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--foreground)' }}>
                  <Calendar className="w-4 h-4" />
                  Fecha de Orden
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    background: 'var(--input-bg)',
                    borderColor: 'var(--input-border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--foreground)' }}>
                  <Calendar className="w-4 h-4" />
                  Fecha Esperada de Entrega
                </label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    background: 'var(--input-bg)',
                    borderColor: 'var(--input-border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--foreground)' }}>
                  <FileText className="w-4 h-4" />
                  Notas
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    background: 'var(--input-bg)',
                    borderColor: 'var(--input-border)',
                    color: 'var(--foreground)',
                  }}
                  placeholder="Notas adicionales..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Add Products Form */}
          <div className="rounded-lg border p-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              <Plus className="w-5 h-5" />
              Agregar Productos
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="relative">
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  Nombre del Producto
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => {
                    setProductName(e.target.value)
                    setShowProductDropdown(e.target.value.length > 0 && filteredProducts.length > 0)
                  }}
                  onFocus={() => setShowProductDropdown(productName.length > 0 && filteredProducts.length > 0)}
                  onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    background: 'var(--input-bg)',
                    borderColor: 'var(--input-border)',
                    color: 'var(--foreground)',
                  }}
                  placeholder="Nombre del producto"
                  onKeyDown={(e) => e.key === 'Enter' && addProduct()}
                />
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 border rounded-md shadow-lg" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
                    {filteredProducts.map((product, index) => (
                      <button
                        key={index}
                        onClick={() => selectProduct(product)}
                        className="w-full px-3 py-2 text-left hover:opacity-80 first:rounded-t-md last:rounded-b-md"
                        style={{ color: 'var(--foreground)', background: 'var(--card-bg)' }}
                      >
                        {product}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    background: 'var(--input-bg)',
                    borderColor: 'var(--input-border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  Código de Barras (opcional)
                </label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    background: 'var(--input-bg)',
                    borderColor: 'var(--input-border)',
                    color: 'var(--foreground)',
                  }}
                  placeholder="Código de barras"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  Precio Unitario (opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    background: 'var(--input-bg)',
                    borderColor: 'var(--input-border)',
                    color: 'var(--foreground)',
                  }}
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
            <div className="rounded-lg border p-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                Productos en la Orden ({products.length})
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--foreground)' }}>Nombre</th>
                      <th className="text-center py-2 px-3 font-medium" style={{ color: 'var(--foreground)' }}>Cantidad</th>
                      <th className="text-center py-2 px-3 font-medium" style={{ color: 'var(--foreground)' }}>Código</th>
                      <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--foreground)' }}>Precio</th>
                      <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--foreground)' }}>Total</th>
                      <th className="text-center py-2 px-3 font-medium" style={{ color: 'var(--foreground)' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="hover:opacity-80" style={{ borderBottom: '1px solid var(--muted)' }}>
                        <td className="py-2 px-3" style={{ color: 'var(--foreground)' }}>{product.name}</td>
                        <td className="py-2 px-3 text-center" style={{ color: 'var(--foreground)' }}>{product.quantity}</td>
                        <td className="py-2 px-3 text-center" style={{ color: 'var(--foreground)' }}>
                          {product.barcode || 'N/A'}
                        </td>
                        <td className="py-2 px-3 text-right" style={{ color: 'var(--foreground)' }}>
                          {product.price ? `₡${product.price.toFixed(2)}` : 'N/A'}
                        </td>
                        <td className="py-2 px-3 text-right font-medium" style={{ color: 'var(--foreground)' }}>
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
                      <tr className="font-bold" style={{ borderTop: '2px solid var(--border)' }}>
                        <td colSpan={4} className="py-2 px-3 text-right" style={{ color: 'var(--foreground)' }}>Total de la Orden:</td>
                        <td className="py-2 px-3 text-right text-lg" style={{ color: 'var(--foreground)' }}>₡{currentTotal.toFixed(2)}</td>
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
              {isEditing ? 'Actualizar Orden' : 'Guardar Orden'}
            </button>
            
            {isEditing && (
              <button
                onClick={cancelEdit}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Cancelar Edición
              </button>
            )}
            
            <button
              onClick={clearForm}
              className="px-6 py-2 rounded-lg hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-gray-500"
              style={{
                background: 'var(--button-bg)',
                color: 'var(--button-text)',
              }}
            >
              Limpiar Formulario
            </button>
          </div>
        </div>
      ) : (
        /* Orders List */
        <div className="space-y-4">
          <h3 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Órdenes Guardadas</h3>
          
          {orders.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--muted-foreground)' }}>
              No hay órdenes guardadas todavía.
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="rounded-lg border p-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-medium" style={{ color: 'var(--foreground)' }}>{order.supplierName}</h4>
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      Orden: {new Date(order.orderDate).toLocaleDateString()}
                      {order.expectedDeliveryDate && (
                        <> • Entrega: {new Date(order.expectedDeliveryDate).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(order)}
                      className="text-blue-500 hover:text-blue-700 p-2"
                      title="Editar orden"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteOrder(order.id)}
                      className="text-red-500 hover:text-red-700 p-2"
                      title="Eliminar orden"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {order.notes && (
                  <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
                    <strong>Notas:</strong> {order.notes}
                  </p>
                )}
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="text-left py-1 px-2" style={{ color: 'var(--foreground)' }}>Producto</th>
                        <th className="text-center py-1 px-2" style={{ color: 'var(--foreground)' }}>Cantidad</th>
                        <th className="text-center py-1 px-2" style={{ color: 'var(--foreground)' }}>Código</th>
                        <th className="text-right py-1 px-2" style={{ color: 'var(--foreground)' }}>Precio</th>
                        <th className="text-right py-1 px-2" style={{ color: 'var(--foreground)' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.products.map((product) => (
                        <tr key={product.id} style={{ borderBottom: '1px solid var(--muted)' }}>
                          <td className="py-1 px-2" style={{ color: 'var(--foreground)' }}>{product.name}</td>
                          <td className="py-1 px-2 text-center" style={{ color: 'var(--foreground)' }}>{product.quantity}</td>
                          <td className="py-1 px-2 text-center" style={{ color: 'var(--foreground)' }}>
                            {product.barcode || 'N/A'}
                          </td>
                          <td className="py-1 px-2 text-right" style={{ color: 'var(--foreground)' }}>
                            {product.price ? `₡${product.price.toFixed(2)}` : 'N/A'}
                          </td>
                          <td className="py-1 px-2 text-right" style={{ color: 'var(--foreground)' }}>
                            {product.price ? `₡${(product.quantity * product.price).toFixed(2)}` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {order.total && order.total > 0 && (
                      <tfoot>
                        <tr className="font-bold" style={{ borderTop: '2px solid var(--border)' }}>
                          <td colSpan={4} className="py-1 px-2 text-right" style={{ color: 'var(--foreground)' }}>Total:</td>
                          <td className="py-1 px-2 text-right" style={{ color: 'var(--foreground)' }}>₡{order.total.toFixed(2)}</td>
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