'use client';

import React, { useState, useEffect } from 'react';
import { User } from '../../types/firestore';
import { UserPermissionsManager } from '../../components/auth';
import { Settings, Users, Key, Shield } from 'lucide-react';

export default function MantenimientoPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeSection, setActiveSection] = useState<string>('permissions');

  useEffect(() => {
    // Get current user from localStorage or session
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        
        // Check if user has maintenance permissions
        if (!user.permissions?.mantenimiento && user.role !== 'superadmin') {
          // Redirect to home if no maintenance permissions
          window.location.hash = '#';
        }
      } catch (error) {
        console.error('Error parsing saved user:', error);
        window.location.hash = '#';
      }
    } else {
      // Redirect to home if no user logged in
      window.location.hash = '#';
    }
  }, []);

  const maintenanceSections = [
    {
      id: 'permissions',
      name: 'Gestión de Permisos',
      description: 'Administrar permisos de usuario por sección',
      icon: Users,
      component: UserPermissionsManager
    },
    {
      id: 'security',
      name: 'Configuración de Seguridad',
      description: 'Configurar opciones de seguridad del sistema',
      icon: Shield,
      component: () => (
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4">Configuración de Seguridad</h3>
          <p className="text-gray-600">Esta sección estará disponible en futuras actualizaciones.</p>
        </div>
      )
    },
    {
      id: 'system',
      name: 'Configuración del Sistema',
      description: 'Configurar parámetros generales del sistema',
      icon: Settings,
      component: () => (
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4">Configuración del Sistema</h3>
          <p className="text-gray-600">Esta sección estará disponible en futuras actualizaciones.</p>
        </div>
      )
    },
    {
      id: 'backup',
      name: 'Respaldo y Restauración',
      description: 'Gestionar respaldos del sistema',
      icon: Key,
      component: () => (
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4">Respaldo y Restauración</h3>
          <p className="text-gray-600">Esta sección estará disponible en futuras actualizaciones.</p>
        </div>
      )
    }
  ];

  const activeComponent = maintenanceSections.find(section => section.id === activeSection);

  // Show loading while checking permissions
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Settings className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Panel de Mantenimiento</h1>
                <p className="text-sm text-gray-600">
                  Usuario: {currentUser.name} ({currentUser.role})
                </p>
              </div>
            </div>
            <button
              onClick={() => window.location.hash = '#'}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              ← Volver al Inicio
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-900">Secciones</h2>
              </div>
              <nav className="p-2">
                {maintenanceSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left p-3 rounded-md transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <section.icon className="w-5 h-5 mr-3" />
                      <div>
                        <div className="font-medium">{section.name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {section.description}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm border">
              {activeComponent && (
                <activeComponent.component />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
