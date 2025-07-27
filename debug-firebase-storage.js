// Script para validar la configuración de Firebase Storage
// Ejecuta este script en la consola del navegador en tu página de pruebas

console.log('🔧 Iniciando validación de Firebase Storage...');

// 1. Verificar configuración de Firebase
console.log('📋 Variables de entorno:');
console.log('API Key:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ Configurada' : '❌ Faltante');
console.log('Auth Domain:', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✅ Configurada' : '❌ Faltante');
console.log('Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✅ Configurada' : '❌ Faltante');
console.log('Storage Bucket:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? '✅ Configurada' : '❌ Faltante');
console.log('App ID:', process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? '✅ Configurada' : '❌ Faltante');

// 2. Verificar inicialización de Firebase
try {
    const { storage } = await import('/src/config/firebase.ts');
    console.log('🔥 Firebase Storage:', storage ? '✅ Inicializado' : '❌ Error');
} catch (error) {
    console.error('❌ Error al importar Firebase:', error);
}

// 3. Test de conexión básica
async function testFirebaseConnection() {
    try {
        const { storage } = await import('/src/config/firebase.ts');
        const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
        
        console.log('🧪 Probando conexión...');
        
        // Crear una referencia de prueba
        const testRef = ref(storage, 'exports/test-connection.txt');
        const testData = new Blob(['Test de conexión Firebase'], { type: 'text/plain' });
        
        console.log('📤 Intentando subir archivo de prueba...');
        const uploadTask = uploadBytesResumable(testRef, testData);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`📊 Progreso: ${Math.round(progress)}%`);
            },
            (error) => {
                console.error('❌ Error en la subida:', error.code, error.message);
                
                // Diagnóstico específico
                switch (error.code) {
                    case 'storage/unauthorized':
                        console.log('💡 Solución: Actualiza las reglas de Firebase Storage');
                        break;
                    case 'storage/unauthenticated':
                        console.log('💡 Solución: Verifica la autenticación de Firebase');
                        break;
                    case 'storage/project-not-found':
                        console.log('💡 Solución: Verifica el PROJECT_ID en las variables de entorno');
                        break;
                    case 'storage/bucket-not-found':
                        console.log('💡 Solución: Verifica el STORAGE_BUCKET en las variables de entorno');
                        break;
                    default:
                        console.log('💡 Revisa la configuración de Firebase y las reglas de Storage');
                }
            },
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    console.log('✅ ¡Conexión exitosa!');
                    console.log('📎 URL de prueba:', downloadURL);
                } catch (urlError) {
                    console.error('⚠️ Subida exitosa pero error al obtener URL:', urlError);
                }
            }
        );
        
    } catch (error) {
        console.error('❌ Error en test de conexión:', error);
    }
}

// Ejecutar el test
testFirebaseConnection();

console.log('🎯 Validación completada. Revisa los resultados arriba.');
