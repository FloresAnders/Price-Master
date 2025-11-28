// scripts/cleanup-tokens.js
/**
 * Script para limpiar tokens expirados y revocados
 * Debe ejecutarse periódicamente para mantener el localStorage limpio
 */

const { TokenService } = require('../src/services/tokenService');

function cleanupTokens() {
  //('🧹 Iniciando limpieza de tokens...');

  try {
    // Limpiar tokens expirados y revocados antiguos
    TokenService.cleanupExpiredTokens();
    
    //('✅ Limpieza de tokens completada');
    
    // Mostrar estadísticas
    const tokenInfo = TokenService.getTokenInfo();
    if (tokenInfo.isValid) {
      //(`📊 Token activo válido para usuario: ${tokenInfo.user?.name}`);
      //(`⏰ Tiempo restante: ${TokenService.formatTokenTimeLeft()}`);
    } else {
      //('❌ No hay tokens activos válidos');
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
