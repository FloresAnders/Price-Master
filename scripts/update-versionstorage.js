#!/usr/bin/env node

/**
 * Script para sincronizar versionstorage entre version.json y Firestore
 * Prioridad: version.json superior actualiza Firestore, si son iguales usa Firestore
 *
 * NOTA: Este script NO toca el campo `version` existente.
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

async function syncVersionStorage() {
  try {
    const adminModule = await import('firebase-admin');
    admin = adminModule.default ?? adminModule;

    const fsModule = await import('node:fs');
    fs = fsModule.default ?? fsModule;

    const pathModule = await import('node:path');
    path = pathModule.default ?? pathModule;

    const { getOperationalFirestore } = await import('./operational-firestore-target.mjs');

    console.log(`${colors.blue}🔄 Iniciando sincronización de versionstorage...${colors.reset}\n`);

    // Leer version.json
    const versionPath = path.join(__dirname, '../src/data/version.json');
    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    const localVersionStorage = String(versionData.versionstorage || '').trim();

    if (!localVersionStorage) {
      console.error(`${colors.red}❌ Error: versionstorage no está definido en src/data/version.json${colors.reset}`);
      console.log(`${colors.yellow}💡 Agrega "versionstorage": "x.y.z" y vuelve a ejecutar.${colors.reset}`);
      process.exit(1);
    }

    console.log(`${colors.blue}📦 versionstorage local (version.json): ${colors.yellow}${localVersionStorage}${colors.reset}`);

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

    const { db, databaseLabel } = getOperationalFirestore(admin, process.env);
    console.log(`${colors.blue}Base Firestore: ${colors.yellow}${databaseLabel}${colors.reset}`);

    // Leer doc actual
    const versionRef = db.collection('version').doc('current');
    const versionDoc = await versionRef.get();

    if (!versionDoc.exists) {
      // Crear doc si no existe (sin borrar nada más)
      await versionRef.set(
        {
          versionstorage: localVersionStorage,
          storageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          storageDescription: 'Versión de storage (invalidación de sesiones)',
          storageSource: 'version.json'
        },
        { merge: true }
      );

      console.log(`${colors.green}✅ Documento creado/actualizado en Firestore con versionstorage: ${localVersionStorage}${colors.reset}\n`);
      await admin.app().delete();
      process.exit(0);
    }

    const dbData = versionDoc.data() || {};
    const dbVersionStorage = String(dbData.versionstorage || '').trim();

    if (!dbVersionStorage) {
      await versionRef.set(
        {
          versionstorage: localVersionStorage,
          storageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          storageDescription: 'Versión de storage (invalidación de sesiones)',
          storageSource: 'version.json'
        },
        { merge: true }
      );

      console.log(`${colors.green}✅ Firestore no tenía versionstorage. Se guardó: ${localVersionStorage}${colors.reset}\n`);
      await admin.app().delete();
      process.exit(0);
    }

    console.log(`${colors.blue}🗄️  versionstorage en Firestore: ${colors.yellow}${dbVersionStorage}${colors.reset}\n`);

    const comparison = compareVersions(localVersionStorage, dbVersionStorage);

    if (comparison > 0) {
      await versionRef.set(
        {
          versionstorage: localVersionStorage,
          storageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          storageDescription: 'Versión de storage (invalidación de sesiones)',
          storageSource: 'version.json',
          previousVersionstorage: dbVersionStorage
        },
        { merge: true }
      );

      console.log(`${colors.green}⬆️  versionstorage local superior - Firestore actualizado: ${localVersionStorage}${colors.reset}`);
      console.log(`${colors.green}   ${dbVersionStorage} → ${localVersionStorage}${colors.reset}\n`);
    } else if (comparison === 0) {
      console.log(`${colors.green}✅ versionstorage sincronizado - Usando valor de Firestore: ${dbVersionStorage}${colors.reset}`);
      console.log(`${colors.blue}ℹ️  No se requieren cambios${colors.reset}\n`);
    } else {
      console.log(`${colors.yellow}⚠️  ADVERTENCIA: versionstorage en Firestore es superior${colors.reset}`);
      console.log(`${colors.yellow}   Firestore: ${dbVersionStorage}${colors.reset}`);
      console.log(`${colors.yellow}   Local: ${localVersionStorage}${colors.reset}`);
      console.log(`${colors.blue}ℹ️  No se actualizó Firestore. Considera actualizar versionstorage en version.json${colors.reset}\n`);
    }

    await admin.app().delete();
  } catch (error) {
    console.error(`${colors.red}❌ Error al sincronizar versionstorage:${colors.reset}`, error?.message || error);
    process.exit(1);
  }
}

syncVersionStorage();
