const admin = require('firebase-admin');
const fs = require('fs');

// 1. Cargar tus credenciales (asegúrate que el nombre sea exacto)
const serviceAccount = require("./serviceAccountKey.json");

// 2. Inicializar Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function exportarColeccion() {
    const collectionName = 'MovimientosFondos'; // <--- Verifica que se llame exactamente así
    console.log(`Leyendo la colección "${collectionName}"...`);

    try {
        const snapshot = await db.collection(collectionName).get();
        
        if (snapshot.empty) {
            console.log('No se encontraron documentos en esa colección.');
            return;
        }

        const data = [];
        snapshot.forEach(doc => {
            // Guardamos el ID del documento y sus datos
            data.push({ id: doc.id, ...doc.data() });
        });

        // 3. Escribir el archivo JSON
        fs.writeFileSync('MovimientosFondos.json', JSON.stringify(data, null, 2));
        console.log('✅ ¡Éxito! El archivo MovimientosFondos.json ha sido creado.');

    } catch (error) {
        console.error('❌ Error al exportar:', error);
    } finally {
        process.exit();
    }
}

exportarColeccion();