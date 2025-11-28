/**
 * Script de prueba para el sistema de recuperación de contraseña
 * 
 * Este script demuestra el flujo completo del sistema de recuperación
 * NO ejecutar en producción - solo para testing/desarrollo
 */

import { RecoveryTokenService } from './src/services/recoveryTokenService';

async function testPasswordRecoverySystem() {

  try {
    // 1. Crear token de recuperación
    const email = 'test@example.com';
    const userId = 'test-user-123';
    
    const { token, expiresAt } = await RecoveryTokenService.createRecoveryToken(
      email,
      userId
    );
    
    //('✅ Token creado exitosamente');
    //(`   Token: ${token.substring(0, 20)}...`);
    //(`   Expira: ${new Date(expiresAt).toLocaleString('es-ES')}\n`);

    // 2. Validar token
    //('2️⃣ Validando token...');
    const validation = await RecoveryTokenService.validateToken(token);
    
    if (validation.valid) {
      //('✅ Token válido');
      //(`   Email: ${validation.email}`);
      //(`   User ID: ${validation.userId}\n`);
    } else {
      //('❌ Token inválido:', validation.error);
      return;
    }

    // 3. Marcar token como usado
    //('3️⃣ Marcando token como usado...');
    await RecoveryTokenService.markTokenAsUsed(token);
    //('✅ Token marcado como usado\n');

    // 4. Intentar validar token usado
    //('4️⃣ Intentando validar token usado...');
    const validationAfterUse = await RecoveryTokenService.validateToken(token);
    
    if (!validationAfterUse.valid) {
      //('✅ Correctamente rechazado:', validationAfterUse.error);
    } else {
      //('❌ Error: Token usado debería ser rechazado');
    }

    //('\n✅ Todas las pruebas pasaron exitosamente!');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  }
}

// Prueba de limpieza de tokens
async function testTokenCleanup() {
  //('\n🧹 Probando limpieza de tokens expirados...');
  
  try {
    const deletedCount = await RecoveryTokenService.cleanupExpiredTokens();
    //(`✅ Tokens expirados eliminados: ${deletedCount}`);
  } catch (error) {
    console.error('❌ Error en limpieza:', error);
  }
}

// Ejecutar pruebas
if (require.main === module) {
  //('⚠️  ADVERTENCIA: Este es un script de prueba\n');
  //('Asegúrate de tener Firebase configurado correctamente\n');
  
  testPasswordRecoverySystem()
    .then(() => testTokenCleanup())
    .then(() => {
      //('\n🎉 Todas las pruebas completadas');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error fatal:', error);
      process.exit(1);
    });
}

export { testPasswordRecoverySystem, testTokenCleanup };
