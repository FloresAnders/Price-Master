// app/edit/page.tsx
'use client'

import React, { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Settings, Lock } from 'lucide-react'
import DataEditor from '@/edit/DataEditor'
import LoginModal from '@/components/LoginModal'
import type { User } from '@/types/firestore'

export default function EditPage() {
  const { user, isAuthenticated, isSuperAdmin, login } = useAuth()
  const [showLoginModal, setShowLoginModal] = useState(false)

  // Si no está autenticado, mostrar el botón para login
  if (!isAuthenticated) {
    return (
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-[var(--card-bg)] rounded-lg shadow p-6">
          <div className="text-center py-8">
            <Settings className="w-16 h-16 mx-auto mb-4 text-red-600" />
            <h3 className="text-2xl font-semibold mb-4">Editor de Datos</h3>
            <p className="text-[var(--tab-text)] mb-6">
              Se requieren permisos de <strong>SuperAdmin</strong> para acceder a esta funcionalidad
            </p>
            <button
              onClick={() => setShowLoginModal(true)}
              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
            >
              <Lock className="w-5 h-5 inline mr-2" />
              Iniciar Sesión como SuperAdmin
            </button>
          </div>

          <LoginModal
            isOpen={showLoginModal}
            onLoginSuccess={(userData: User) => {
              login(userData)
              setShowLoginModal(false)
            }}
            onClose={() => setShowLoginModal(false)}
            title="Editor de Datos (SuperAdmin)"
          />
        </div>
      </main>
    )
  }

  // Si está autenticado pero no es SuperAdmin, denegar acceso
  if (isAuthenticated && !isSuperAdmin()) {
    return (
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-[var(--card-bg)] rounded-lg shadow p-6">
          <div className="text-center py-8">
            <Lock className="w-16 h-16 mx-auto mb-4 text-red-600" />
            <h3 className="text-2xl font-semibold mb-4">Acceso Denegado</h3>
            <p className="text-[var(--tab-text)] mb-4">
              Necesitas permisos de <strong>SuperAdmin</strong> para acceder al Editor de Datos.
            </p>
            <p className="text-[var(--tab-text)] mb-6">
              Usuario actual: <strong>{user?.name}</strong> ({user?.role})
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <p className="font-medium">⚠️ Acceso Restringido</p>
              <p className="text-sm mt-1">
                Solo los usuarios con rol "superadmin" pueden editar los datos del sistema.
              </p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Si es SuperAdmin, mostrar el editor
  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
        <div className="flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          <span className="font-medium">SuperAdmin:</span>
          <span className="ml-2">{user?.name}</span>
        </div>
      </div>
      <DataEditor />
    </main>
  )
}
