// scripts/create-superadmin-db.js
// Script de migración para crear SuperAdmin directamente en la base de datos

const admin = require('firebase-admin');

// Inicializar Firebase Admin (configurar las credenciales según tu entorno)
if (!admin.apps.length) {
  // Para desarrollo local, usar el emulador o credenciales de servicio
  admin.initializeApp({
    projectId: 'price-master-cc9cd',
    // Agregar credenciales de servicio aquí para producción
  });
}

const db = admin.firestore();

async function createSuperAdminFromDB() {
  console.log('🔥 Creando SuperAdmin desde la base de datos...');
  
  try {
    // Verificar si ya existe un SuperAdmin
    const existingSuperAdmin = await db.collection('users')
      .where('role', '==', 'superadmin')
      .get();

    if (!existingSuperAdmin.empty) {
      console.log('⚠️ Ya existe un usuario SuperAdmin:');
      existingSuperAdmin.forEach(doc => {
        const user = doc.data();
        console.log(`   👤 ID: ${doc.id}`);
        console.log(`   📝 Nombre: ${user.name}`);
        console.log(`   🏢 Ubicación: ${user.location || 'Sin ubicación'}`);
        console.log(`   📅 Creado: ${user.createdAt?.toDate?.() || user.createdAt}`);
      });
      return;
    }

    // Crear SuperAdmin en la base de datos
    const superAdminData = {
      name: 'superadmin',
      password: 'super123', // En producción, usar hash
      role: 'superadmin',
      location: 'san-jose',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      // Metadatos adicionales para auditoría
      createdBy: 'system',
      creationMethod: 'database_migration',
      permissions: {
        editData: true,
        manageUsers: true,
        systemAdmin: true
      }
    };

    const docRef = await db.collection('users').add(superAdminData);
    
    console.log('✅ SuperAdmin creado exitosamente desde la base de datos!');
    console.log(`📋 Document ID: ${docRef.id}`);
    console.log('🔐 Credenciales configuradas:');
    console.log('   👤 Usuario: superadmin');
    console.log('   🔑 Contraseña: super123');
    console.log('   🎯 Rol: superadmin');
    console.log('   🏢 Ubicación: san-jose');
    console.log('   ✅ Estado: Activo');
    console.log('');
    console.log('🎉 El SuperAdmin puede ahora acceder a /edit');
    
  } catch (error) {
    console.error('❌ Error creando SuperAdmin:', error);
    throw error;
  }
}

// Función para verificar SuperAdmins existentes
async function listSuperAdmins() {
  console.log('🔍 Consultando SuperAdmins en la base de datos...');
  
  try {
    const superAdmins = await db.collection('users')
      .where('role', '==', 'superadmin')
      .get();

    if (superAdmins.empty) {
      console.log('📝 No hay SuperAdmins en la base de datos');
      return [];
    }

    console.log(`📋 Encontrados ${superAdmins.size} SuperAdmin(s):`);
    const admins = [];
    
    superAdmins.forEach(doc => {
      const user = doc.data();
      const admin = { id: doc.id, ...user };
      admins.push(admin);
      
      const status = user.isActive ? '🟢' : '🔴';
      console.log(`   ${status} ${user.name} (ID: ${doc.id})`);
      console.log(`      📍 Ubicación: ${user.location || 'Sin ubicación'}`);
      console.log(`      📅 Creado: ${user.createdAt?.toDate?.() || user.createdAt}`);
      console.log(`      🔧 Método: ${user.creationMethod || 'No especificado'}`);
    });
    
    return admins;
    
  } catch (error) {
    console.error('❌ Error consultando SuperAdmins:', error);
    throw error;
  }
}

// Función para desactivar SuperAdmin (no eliminar por seguridad)
async function deactivateSuperAdmin(adminId) {
  console.log(`🔒 Desactivando SuperAdmin: ${adminId}`);
  
  try {
    await db.collection('users').doc(adminId).update({
      isActive: false,
      deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
      deactivatedBy: 'system'
    });
    
    console.log('✅ SuperAdmin desactivado exitosamente');
    
  } catch (error) {
    console.error('❌ Error desactivando SuperAdmin:', error);
    throw error;
  }
}

// Exportar funciones para uso en otros scripts
module.exports = {
  createSuperAdminFromDB,
  listSuperAdmins,
  deactivateSuperAdmin
};

// Ejecutar si es llamado directamente
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'create':
      createSuperAdminFromDB()
        .then(() => process.exit(0))
        .catch(err => {
          console.error('Error:', err);
          process.exit(1);
        });
      break;
      
    case 'list':
      listSuperAdmins()
        .then(() => process.exit(0))
        .catch(err => {
          console.error('Error:', err);
          process.exit(1);
        });
      break;
      
    case 'deactivate':
      const adminId = process.argv[3];
      if (!adminId) {
        console.error('❌ Se requiere el ID del SuperAdmin');
        process.exit(1);
      }
      deactivateSuperAdmin(adminId)
        .then(() => process.exit(0))
        .catch(err => {
          console.error('Error:', err);
          process.exit(1);
        });
      break;
      
    default:
      console.log('📋 Uso del script:');
      console.log('  node scripts/create-superadmin-db.js create    # Crear SuperAdmin');
      console.log('  node scripts/create-superadmin-db.js list      # Listar SuperAdmins');
      console.log('  node scripts/create-superadmin-db.js deactivate <id>  # Desactivar SuperAdmin');
      process.exit(0);
  }
}
