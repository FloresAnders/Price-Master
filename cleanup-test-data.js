// Script para limpiar datos de usuarios de prueba del localStorage
// Ejecutar en la consola del navegador si es necesario

console.log('🧹 Limpiando datos de usuarios de prueba...');

// Limpiar datos de usuarios de prueba
if (localStorage.getItem('test_users')) {
  localStorage.removeItem('test_users');
  console.log('✅ Datos de test_users eliminados');
} else {
  console.log('ℹ️ No se encontraron datos de test_users');
}

// Verificar otros datos relacionados
const keysToCheck = ['test_users', 'testUsers', 'demo_users'];
let foundKeys = [];

for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && keysToCheck.some(testKey => key.includes(testKey))) {
    foundKeys.push(key);
  }
}

if (foundKeys.length > 0) {
  console.log('🔍 Encontradas otras claves relacionadas:', foundKeys);
  foundKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log(`✅ Eliminado: ${key}`);
  });
} else {
  console.log('✅ No se encontraron otros datos de prueba');
}

console.log('🎉 Limpieza completada. El sistema ahora usa solo datos de Firestore.');
