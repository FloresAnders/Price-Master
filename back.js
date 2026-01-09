// Importación corregida para versiones actuales
const { initializeFirebaseApp, backups } = require('firestore-export-import');
const fs = require('fs');

// Carga tus credenciales
const serviceAccount = require('./serviceAccountKey.json');
// LOG PARA VERIFICAR EN CONSOLA
console.log("Conectando al proyecto:", serviceAccount.project_id);

// 1. Inicializa la conexión
// Nota: Algunos proyectos requieren la URL de la base de datos como segundo parámetro
const firestore = initializeFirebaseApp(serviceAccount);

console.log('Iniciando exportación completa...');

// 2. Obtener todas las colecciones (backups sin parámetros trae todo)
backups(firestore)
  .then((data) => {
    fs.writeFileSync('copia_local.json', JSON.stringify(data, null, 2));
    console.log('✅ Exportación completada con éxito en copia_local.json');
  })
  .catch((error) => {
    console.error('❌ Error durante la exportación:', error);
  });
