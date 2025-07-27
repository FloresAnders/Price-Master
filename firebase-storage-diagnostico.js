/**
 * Script de diagnóstico para Firebase Storage
 * Coloca este código en la consola del navegador en localhost:3001/backdoor
 */

console.log('🔥 Iniciando diagnóstico de Firebase Storage...');

// Función de diagnóstico
async function diagnosticarFirebaseStorage() {
    try {
        console.log('📋 Paso 1: Verificando variables de entorno...');
        
        // Verificar variables de entorno (en el navegador estas deberían estar disponibles)
        const config = {
            apiKey: 'AIzaSyAKj8Cz21p7VNPDNhQ1Z7See9f0c_ulIyU',
            authDomain: 'pricemaster-4a611.firebaseapp.com',
            projectId: 'pricemaster-4a611',
            storageBucket: 'pricemaster-4a611.firebasestorage.app',
            appId: '1:341709709017:web:b6916b1e85464a249ce8c8'
        };
        
        console.log('✅ Configuración cargada:', config);
        
        console.log('📋 Paso 2: Importando Firebase modules...');
        
        // Importar Firebase
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const { getStorage, ref, uploadBytesResumable, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
        
        console.log('✅ Módulos importados correctamente');
        
        console.log('📋 Paso 3: Inicializando Firebase...');
        const app = initializeApp(config);
        const storage = getStorage(app);
        
        console.log('✅ Firebase inicializado:', { app, storage });
        
        console.log('📋 Paso 4: Probando subida de archivo...');
        
        // Crear archivo de prueba
        const testData = new Blob(['Prueba de Firebase Storage desde diagnóstico'], { 
            type: 'text/plain' 
        });
        
        const timestamp = Date.now();
        const testRef = ref(storage, `exports/diagnostico-${timestamp}.txt`);
        
        console.log('📁 Referencia creada:', testRef.fullPath);
        
        const uploadTask = uploadBytesResumable(testRef, testData);
        
        // Manejar el progreso y resultado
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`📊 Progreso: ${Math.round(progress)}%`);
            },
            (error) => {
                console.error('❌ ERROR EN LA SUBIDA:');
                console.error('Código:', error.code);
                console.error('Mensaje:', error.message);
                console.error('Detalles completos:', error);
                
                // Diagnósticos específicos
                if (error.code === 'storage/unauthorized') {
                    console.log('💡 SOLUCIÓN: Las reglas de Firebase Storage no permiten esta operación.');
                    console.log('   Ve a Firebase Console > Storage > Rules y aplica estas reglas:');
                    console.log(`   
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /exports/{allPaths=**} {
      allow read, write: if true;
    }
    match /{allPaths=**} {
      allow read, write: if request.time < timestamp.date(2026, 7, 25);
    }
  }
}
                    `);
                } else if (error.code === 'storage/project-not-found') {
                    console.log('💡 SOLUCIÓN: El proyecto Firebase no existe o el PROJECT_ID es incorrecto.');
                } else if (error.code === 'storage/bucket-not-found') {
                    console.log('💡 SOLUCIÓN: El bucket de Storage no existe o el STORAGE_BUCKET es incorrecto.');
                }
            },
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    console.log('🎉 ¡ÉXITO! Archivo subido correctamente');
                    console.log('📎 URL del archivo:', downloadURL);
                    console.log('📁 Ruta:', uploadTask.snapshot.ref.fullPath);
                } catch (urlError) {
                    console.error('⚠️ Archivo subido pero error al obtener URL:', urlError);
                }
            }
        );
        
    } catch (error) {
        console.error('💥 Error crítico en el diagnóstico:', error);
    }
}

// Ejecutar el diagnóstico
diagnosticarFirebaseStorage();

console.log(`
🔧 INSTRUCCIONES:
1. Ejecuta este script en la consola del navegador
2. Revisa los mensajes de error detallados
3. Si ves "storage/unauthorized", actualiza las reglas de Firebase Storage
4. Ve a https://console.firebase.google.com/project/pricemaster-4a611/storage/rules
5. Aplica las reglas mostradas en el mensaje de error
`);
