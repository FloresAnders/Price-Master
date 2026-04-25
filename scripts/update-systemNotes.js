#!/usr/bin/env node

/**
 * Script para sincronizar notasDeSistemas entre version.json y Firestore
 * Prioridad: version.json superior actualiza Firestore, si son iguales usa Firestore
 *
 * NOTA: Este script NO toca otros campos existentes.
 */

let admin;
let fs;
let path;

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

// Función para comparar versiones semánticas (x.y.z)
function compareVersions(v1, v2) {
  const a = String(v1 || '').split('.').map(Number);
  const b = String(v2 || '').split('.').map(Number);

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const pa = a[i] || 0;
    const pb = b[i] || 0;

    if (pa > pb) return 1;
    if (pa < pb) return -1;
  }

  return 0;
}

async function syncSystemNotes() {
  try {
    const adminModule = await import('firebase-admin');
    admin = adminModule.default ?? adminModule;

    const fsModule = await import('node:fs');
    fs = fsModule.default ?? fsModule;

    const pathModule = await import('node:path');
    path = pathModule.default ?? pathModule;

    console.log(`${colors.blue}🔄 Iniciando sincronización de notasDeSistemas...${colors.reset}\n`);

    // Leer version.json
    const versionPath = path.join(__dirname, '../src/data/version.json');
    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    const localNotasDeSistemas = String(versionData.notasDeSistemas || '').trim();
    const localSystemNotes = Array.isArray(versionData.systemNotes) ? versionData.systemNotes : [];

    if (!localNotasDeSistemas) {
      console.error(`${colors.red}❌ Error: notasDeSistemas no está definido en src/data/version.json${colors.reset}`);
      console.log(`${colors.yellow}💡 Agrega "notasDeSistemas": "x.y.z" y vuelve a ejecutar.${colors.reset}`);
      process.exit(1);
    }

    console.log(`${colors.blue}📦 notasDeSistemas local (version.json): ${colors.yellow}${localNotasDeSistemas}${colors.reset}`);
    console.log(`${colors.blue}📝 Total de notas locales: ${colors.yellow}${localSystemNotes.length}${colors.reset}\n`);

    // Inicializar Firebase Admin
    const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

    if (!fs.existsSync(serviceAccountPath)) {
      console.error(`${colors.red}❌ Error: No se encontró el archivo serviceAccountKey.json${colors.reset}`);
      console.log(`${colors.yellow}💡 Descarga las credenciales desde Firebase Console > Project Settings > Service Accounts${colors.reset}`);
      process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    const db = admin.firestore();
    db.settings({ databaseId: 'restauracion' });

    // Leer doc actual
    const versionRef = db.collection('version').doc('current');
    const versionDoc = await versionRef.get();

    if (!versionDoc.exists) {
      // Crear doc si no existe (sin borrar nada más)
      await versionRef.set(
        {
          notasDeSistemas: localNotasDeSistemas,
          systemNotes: localSystemNotes,
          systemNotesUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          systemNotesDescription: 'Versión de notas del sistema',
          systemNotesSource: 'version.json'
        },
        { merge: true }
      );

      console.log(`${colors.green}✅ Documento creado/actualizado en Firestore con notasDeSistemas: ${localNotasDeSistemas}${colors.reset}\n`);
      await admin.app().delete();
      process.exit(0);
    }

    const dbData = versionDoc.data() || {};
    const dbNotasDeSistemas = String(dbData.notasDeSistemas || '').trim();

    if (!dbNotasDeSistemas) {
      await versionRef.set(
        {
          notasDeSistemas: localNotasDeSistemas,
          systemNotes: localSystemNotes,
          systemNotesUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          systemNotesDescription: 'Versión de notas del sistema',
          systemNotesSource: 'version.json'
        },
        { merge: true }
      );

      console.log(`${colors.green}✅ Firestore no tenía notasDeSistemas. Se guardó: ${localNotasDeSistemas}${colors.reset}\n`);
      await admin.app().delete();
      process.exit(0);
    }

    console.log(`${colors.blue}🗄️  notasDeSistemas en Firestore: ${colors.yellow}${dbNotasDeSistemas}${colors.reset}\n`);

    const comparison = compareVersions(localNotasDeSistemas, dbNotasDeSistemas);

    if (comparison > 0) {
      await versionRef.set(
        {
          notasDeSistemas: localNotasDeSistemas,
          systemNotes: localSystemNotes,
          systemNotesUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          systemNotesDescription: 'Versión de notas del sistema',
          systemNotesSource: 'version.json',
          previousNotasDeSistemas: dbNotasDeSistemas
        },
        { merge: true }
      );

      console.log(`${colors.green}⬆️  notasDeSistemas local superior - Firestore actualizado: ${localNotasDeSistemas}${colors.reset}`);
      console.log(`${colors.green}   ${dbNotasDeSistemas} → ${localNotasDeSistemas}${colors.reset}\n`);
    } else if (comparison === 0) {
      console.log(`${colors.green}✅ notasDeSistemas sincronizado - Usando valor de Firestore: ${dbNotasDeSistemas}${colors.reset}`);
      console.log(`${colors.blue}ℹ️  No se requieren cambios${colors.reset}\n`);
    } else {
      console.log(`${colors.yellow}⚠️  ADVERTENCIA: notasDeSistemas en Firestore es superior${colors.reset}`);
      console.log(`${colors.yellow}   Firestore: ${dbNotasDeSistemas}${colors.reset}`);
      console.log(`${colors.yellow}   Local: ${localNotasDeSistemas}${colors.reset}`);
      console.log(`${colors.blue}ℹ️  No se actualizó Firestore. Considera actualizar notasDeSistemas en version.json${colors.reset}\n`);
    }

    await admin.app().delete();
  } catch (error) {
    console.error(`${colors.red}❌ Error al sincronizar notasDeSistemas:${colors.reset}`, error?.message || error);
    process.exit(1);
  }
}

syncSystemNotes();
