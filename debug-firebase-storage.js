// Script para validar la configuración de Firebase Storage
// Ejecuta este script en la consola del navegador en tu página de pruebas

//('🔧 Iniciando validación de Firebase Storage...');

// 1. Verificar configuración de Firebase
//('📋 Variables de entorno:');
//('API Key:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ Configurada' : '❌ Faltante');
//('Auth Domain:', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✅ Configurada' : '❌ Faltante');
//('Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✅ Configurada' : '❌ Faltante');
//('Storage Bucket:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? '✅ Configurada' : '❌ Faltante');
//('App ID:', process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? '✅ Configurada' : '❌ Faltante');

// 2. Verificar inicialización de Firebase
try {
    const { storage } = await import('/src/config/firebase.ts');
    //('🔥 Firebase Storage:', storage ? '✅ Inicializado' : '❌ Error');
} catch (error) {
    console.error('❌ Error al importar Firebase:', error);
}

// 3. Test de conexión básica
async function testFirebaseConnection() {
    try {
        const { storage } = await import('/src/config/firebase.ts');
        const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
        
        //('🧪 Probando conexión...');
        
        // Crear una referencia de prueba
        const testRef = ref(storage, 'exports/test-connection.txt');
        const testData = new Blob(['Test de conexión Firebase'], { type: 'text/plain' });
        
        //('📤 Intentando subir archivo de prueba...');
        const uploadTask = uploadBytesResumable(testRef, testData);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                //(`📊 Progreso: ${Math.round(progress)}%`);
            },
            (error) => {
                console.error('❌ Error en la subida:', error.code, error.message);
                
                // Diagnóstico específico
                switch (error.code) {
                    case 'storage/unauthorized':
                        //('💡 Solución: Actualiza las reglas de Firebase Storage');
                        break;
                    case 'storage/unauthenticated':
                        //('💡 Solución: Verifica la autenticación de Firebase');
                        break;
                    case 'storage/project-not-found':
                        //('💡 Solución: Verifica el PROJECT_ID en las variables de entorno');
                        break;
                    case 'storage/bucket-not-found':
                        //('💡 Solución: Verifica el STORAGE_BUCKET en las variables de entorno');
                        break;
                    default:
                        //('💡 Revisa la configuración de Firebase y las reglas de Storage');
                }
            },
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    //('✅ ¡Conexión exitosa!');
                    //('📎 URL de prueba:', downloadURL);
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

//('🎯 Validación completada. Revisa los resultados arriba.');
