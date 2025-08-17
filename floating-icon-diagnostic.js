// Diagnóstico para problemas de FloatingIcon en producción
// Ejecutar este archivo en la consola del navegador

console.log("🔍 DIAGNÓSTICO FLOATING ICON");
console.log("============================");

// 1. Verificar si estamos en el cliente
console.log("1. Cliente:", typeof window !== 'undefined' ? '✅ Sí' : '❌ No');

// 2. Verificar autenticación
const authData = localStorage.getItem('authSession');
console.log("2. Datos de autenticación:", authData ? '✅ Presentes' : '❌ Ausentes');
if (authData) {
  try {
    const parsed = JSON.parse(authData);
    console.log("   - Usuario:", parsed.name || 'No definido');
    console.log("   - Ubicación:", parsed.location || 'No definida');
  } catch (e) {
    console.log("   - Error al parsear:", e.message);
  }
}

// 3. Verificar Socket.IO
console.log("3. Socket.IO disponible:", typeof io !== 'undefined' ? '✅ Sí' : '❌ No');

// 4. Verificar endpoint de Socket.IO
fetch('/api/socketio')
  .then(response => response.json())
  .then(data => {
    console.log("4. Endpoint Socket.IO:", data.success ? '✅ Funcionando' : '❌ Error');
  })
  .catch(error => {
    console.log("4. Endpoint Socket.IO: ❌ Error -", error.message);
  });

// 5. Verificar errores en la consola
console.log("5. Buscar errores en la consola del navegador arriba ⬆️");

// 6. Verificar variables de entorno (solo las públicas)
const envVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
];

console.log("6. Variables de entorno:");
envVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`   - ${varName}:`, value ? '✅ Configurada' : '❌ Faltante');
});

// 7. Verificar si el componente FloatingIcon está renderizado
const floatingIcon = document.querySelector('[class*="fixed bottom-4 right-4"]');
console.log("7. FloatingIcon DOM:", floatingIcon ? '✅ Renderizado' : '❌ No encontrado');

console.log("============================");
console.log("✅ Diagnóstico completado");
