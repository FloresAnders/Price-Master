// scripts/cleanup-tokens.js
/**
 * Script para limpiar tokens expirados y revocados
 * Debe ejecutarse periódicamente para mantener el localStorage limpio
 */

const { TokenService } = require('../src/services/tokenService');

function cleanupTokens() {
  console.log('🧹 Iniciando limpieza de tokens...');

  try {
    // Limpiar tokens expirados y revocados antiguos
    TokenService.cleanupExpiredTokens();
    
    console.log('✅ Limpieza de tokens completada');
    
    // Mostrar estadísticas
    const tokenInfo = TokenService.getTokenInfo();
    if (tokenInfo.isValid) {
      console.log(`📊 Token activo válido para usuario: ${tokenInfo.user?.name}`);
      console.log(`⏰ Tiempo restante: ${TokenService.formatTokenTimeLeft()}`);
    } else {
      console.log('❌ No hay tokens activos válidos');
    }
    
  } catch (error) {
    console.error('❌ Error durante la limpieza de tokens:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  cleanupTokens();
}

module.exports = { cleanupTokens };
