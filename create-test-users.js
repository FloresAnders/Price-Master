// Script para crear usuarios de prueba en Firebase
// Ejecutar este archivo en el navegador en la página de test de Firebase

import { UsersService } from '../src/services/users.js';

// Usuarios de prueba
const testUsers = [
  {
    name: 'admin',
    password: 'admin123',
    role: 'admin',
    location: 'puntarenas', // Puede cambiar cualquier ubicación
    isActive: true
  },
  {
    name: 'usuario1',
    password: 'user123',
    role: 'user', 
    location: 'puntarenas', // Ubicación fija para usuarios normales
    isActive: true
  },
  {
    name: 'usuario2',
    password: 'user456',
    role: 'user',
    location: 'cartago', // Otra ubicación fija
    isActive: true
  },
  {
    name: 'manager1',
    password: 'manager123',
    role: 'manager',
    location: 'san-jose',
    isActive: true
  }
];

// Función para crear los usuarios
async function createTestUsers() {
  console.log('Creando usuarios de prueba...');
  
  try {
    for (const user of testUsers) {
      try {
        const userId = await UsersService.addUser(user);
        console.log(`✅ Usuario '${user.name}' creado con ID: ${userId}`);
      } catch (error) {
        console.error(`❌ Error creando usuario '${user.name}':`, error);
      }
    }
    
    console.log('🎉 Proceso completado!');
    console.log('Credenciales de prueba:');
    testUsers.forEach(user => {
      console.log(`- ${user.name} / ${user.password} (${user.role})`);
    });
    
  } catch (error) {
    console.error('Error general:', error);
  }
}

// Ejecutar la función si este script se carga directamente
if (typeof window !== 'undefined') {
  // En el navegador
  window.createTestUsers = createTestUsers;
  console.log('Para crear usuarios de prueba, ejecuta: createTestUsers()');
} else {
  // En Node.js (no se puede usar directamente por Firebase Web SDK)
  console.log('Este script debe ejecutarse en el navegador');
}

export { createTestUsers, testUsers };
