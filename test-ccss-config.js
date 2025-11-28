// Test script para validar la funcionalidad CCSS
// Ejecutar en el navegador: http://localhost:3000/edit
// Abrir Developer Tools y ejecutar este código en la consola

async function testCcssConfig() {
  //('🧪 Iniciando test de configuración CCSS...');
  
  try {
    // Importar el servicio (solo funciona si está disponible globalmente)
    const { CcssConfigService } = await import('../src/services/ccss-config');
    
    //('✅ Servicio CcssConfigService importado correctamente');
    
    // Test 1: Obtener configuración actual
    //('📥 Test 1: Obteniendo configuración actual...');
    const currentConfig = await CcssConfigService.getCcssConfig();
    //('Configuración actual:', currentConfig);
    
    // Test 2: Actualizar configuración
    //('📤 Test 2: Actualizando configuración...');
    await CcssConfigService.updateCcssConfig({
      mt: 3700.00,
      tc: 11100.00
    });
    //('✅ Configuración actualizada');
    
    // Test 3: Verificar actualización
    //('🔍 Test 3: Verificando actualización...');
    const updatedConfig = await CcssConfigService.getCcssConfig();
    //('Configuración actualizada:', updatedConfig);
    
    // Test 4: Restaurar valores por defecto
    //('🔄 Test 4: Restaurando valores por defecto...');
    await CcssConfigService.updateCcssConfig({
      mt: 3672.46,
      tc: 11017.39
    });
    //('✅ Valores por defecto restaurados');
    
    //('🎉 ¡Todos los tests pasaron exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  }
}

// Instrucciones para ejecutar
//(`
🧪 Test de Configuración CCSS - Time Master

Para ejecutar los tests:
1. Asegúrate de estar en la página /edit
2. Ejecuta: testCcssConfig()

O simplemente copia y pega este código en la consola del navegador.
`);

// Auto-ejecutar si estamos en el entorno correcto
if (typeof window !== 'undefined' && window.location.pathname === '/edit') {
  testCcssConfig();
}
