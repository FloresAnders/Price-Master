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

function serializeFirestoreValue(value) {
    if (value === null || value === undefined) return value;

    // firebase-admin Timestamp
    if (value instanceof admin.firestore.Timestamp) {
        return value.toDate().toISOString();
    }

    // Timestamp guardado incorrectamente como map: { _seconds, _nanoseconds }
    // (Esto pasa cuando se importa desde JSON o se guarda desde un objeto serializado.)
    if (typeof value === 'object' && !Array.isArray(value)) {
        const keys = Object.keys(value);
        const allowed = new Set(['_seconds', '_nanoseconds', 'seconds', 'nanoseconds']);
        const onlyAllowedKeys = keys.length > 0 && keys.every((k) => allowed.has(k));
        const seconds = value._seconds ?? value.seconds;
        const nanos = value._nanoseconds ?? value.nanoseconds ?? 0;
        if (onlyAllowedKeys && typeof seconds === 'number' && typeof nanos === 'number') {
            const ms = seconds * 1000 + Math.floor(nanos / 1e6);
            return new Date(ms).toISOString();
        }
    }

    if (Array.isArray(value)) {
        return value.map(serializeFirestoreValue);
    }

    if (typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = serializeFirestoreValue(v);
        }
        return out;
    }

    return value;
}

async function exportarColeccion() {
    const collectionName = 'productos'; // <--- Verifica que se llame exactamente así
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
            const raw = doc.data();
            const serialized = serializeFirestoreValue(raw);
            data.push({ id: doc.id, ...serialized });
        });

        // 3. Escribir el archivo JSON
        fs.writeFileSync('productos.json', JSON.stringify(data, null, 2));
        console.log('✅ ¡Éxito! El archivo productos.json ha sido creado.');

    } catch (error) {
        console.error('❌ Error al exportar:', error);
    } finally {
        process.exit();
    }
}

exportarColeccion();