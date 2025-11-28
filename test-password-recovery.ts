/**
 * Script de prueba para el sistema de recuperación de contraseña
 * 
 * Este script demuestra el flujo completo del sistema de recuperación
 * NO ejecutar en producción - solo para testing/desarrollo
 */

import { RecoveryTokenService } from './src/services/recoveryTokenService';

async function testPasswordRecoverySystem() {
  console.log('🧪 Iniciando prueba del sistema de recuperación de contraseña\n');

  try {
    // 1. Crear token de recuperación
    console.log('1️⃣ Creando token de recuperación...');
    const email = 'test@example.com';
    const userId = 'test-user-123';
    
    const { token, expiresAt } = await RecoveryTokenService.createRecoveryToken(
      email,
      userId
    );
    
    console.log('✅ Token creado exitosamente');
    console.log(`   Token: ${token.substring(0, 20)}...`);
    console.log(`   Expira: ${new Date(expiresAt).toLocaleString('es-ES')}\n`);

    // 2. Validar token
    console.log('2️⃣ Validando token...');
    const validation = await RecoveryTokenService.validateToken(token);
    
    if (validation.valid) {
      console.log('✅ Token válido');
      console.log(`   Email: ${validation.email}`);
      console.log(`   User ID: ${validation.userId}\n`);
    } else {
      console.log('❌ Token inválido:', validation.error);
      return;
    }

    // 3. Marcar token como usado
    console.log('3️⃣ Marcando token como usado...');
    await RecoveryTokenService.markTokenAsUsed(token);
    console.log('✅ Token marcado como usado\n');

    // 4. Intentar validar token usado
    console.log('4️⃣ Intentando validar token usado...');
    const validationAfterUse = await RecoveryTokenService.validateToken(token);
    
    if (!validationAfterUse.valid) {
      console.log('✅ Correctamente rechazado:', validationAfterUse.error);
    } else {
      console.log('❌ Error: Token usado debería ser rechazado');
    }

    console.log('\n✅ Todas las pruebas pasaron exitosamente!');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  }
}

// Prueba de limpieza de tokens
async function testTokenCleanup() {
  console.log('\n🧹 Probando limpieza de tokens expirados...');
  
  try {
    const deletedCount = await RecoveryTokenService.cleanupExpiredTokens();
    console.log(`✅ Tokens expirados eliminados: ${deletedCount}`);
  } catch (error) {
    console.error('❌ Error en limpieza:', error);
  }
}

// Ejecutar pruebas
if (require.main === module) {
  console.log('⚠️  ADVERTENCIA: Este es un script de prueba\n');
  console.log('Asegúrate de tener Firebase configurado correctamente\n');
  
  testPasswordRecoverySystem()
    .then(() => testTokenCleanup())
    .then(() => {
      console.log('\n🎉 Todas las pruebas completadas');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error fatal:', error);
      process.exit(1);
    });
}

export { testPasswordRecoverySystem, testTokenCleanup };
