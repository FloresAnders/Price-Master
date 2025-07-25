const { UsersService } = require('./src/services/users.js');

// Usuarios de prueba donde usuario = contraseña
const testUsers = [
  {
    name: 'ALCHACAS',
    password: 'ALCHACAS',
    role: 'admin',
    location: 'San José',
    isActive: true
  },
  {
    name: 'test',
    password: 'test',
    role: 'user',
    location: 'Cartago',
    isActive: true
  },
  {
    name: 'admin',
    password: 'admin',
    role: 'superadmin',
    location: 'Heredia',
    isActive: true
  },
  {
    name: 'demo',
    password: 'demo',
    role: 'user',
    location: 'Alajuela',
    isActive: true
  },
  {
    name: 'user123',
    password: 'user123',
    role: 'user',
    location: 'Puntarenas',
    isActive: true
  },
  // Usuarios que NO cumplen la regla (para testing)
  {
    name: 'usuario1',
    password: '12345',
    role: 'user',
    location: 'Guanacaste',
    isActive: true
  },
  {
    name: 'normal',
    password: 'password123',
    role: 'admin',
    location: 'Limón',
    isActive: true
  }
];

async function createTestUsers() {
  try {
    console.log('🚀 Creando usuarios de prueba...');
    
    // Obtener usuarios existentes para evitar duplicados
    const existingUsers = await UsersService.getAllUsers();
    const existingUsernames = existingUsers.map(user => user.name.toLowerCase());
    
    for (const user of testUsers) {
      if (!existingUsernames.includes(user.name.toLowerCase())) {
        try {
          const userId = await UsersService.addUser(user);
          console.log(`✅ Usuario creado: ${user.name} (ID: ${userId})`);
        } catch (error) {
          console.error(`❌ Error creando usuario ${user.name}:`, error);
        }
      } else {
        console.log(`⚠️ Usuario ya existe: ${user.name}`);
      }
    }
    
    console.log('\n📋 RESUMEN DE USUARIOS PARA LOGIN SIMPLE:');
    console.log('Users que PUEDEN acceder (usuario = contraseña en BD):');
    testUsers
      .filter(user => user.name === user.password)
      .forEach(user => {
        console.log(`  - Usuario: ${user.name} / Contraseña: ${user.password} (${user.role})`);
      });
    
    console.log('\nUsers que NO pueden acceder (usuario ≠ contraseña en BD):');
    testUsers
      .filter(user => user.name !== user.password)
      .forEach(user => {
        console.log(`  - Usuario: ${user.name} / Contraseña: ${user.password} (${user.role}) - BLOQUEADO`);
      });

    console.log('\n🔐 Regla de acceso:');
    console.log('Solo pueden acceder usuarios donde el campo "name" sea igual al campo "password" en la base de datos.');
    
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

createTestUsers();
