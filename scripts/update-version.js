#!/usr/bin/env node

/**
 * Script para actualizar la versión en Firestore automáticamente
 * Lee la versión del archivo version.json y la actualiza en la base de datos
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

async function updateVersion() {
  try {
    console.log(`${colors.blue}🔄 Iniciando actualización de versión...${colors.reset}\n`);

    // Leer version.json
    const versionPath = path.join(__dirname, '../src/data/version.json');
    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    const newVersion = versionData.version;

    console.log(`${colors.blue}📦 Nueva versión detectada: ${colors.yellow}${newVersion}${colors.reset}`);

    // Inicializar Firebase Admin
    const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
    
    if (!fs.existsSync(serviceAccountPath)) {
      console.error(`${colors.red}❌ Error: No se encontró el archivo serviceAccountKey.json${colors.reset}`);
      console.log(`${colors.yellow}💡 Descarga las credenciales desde Firebase Console > Project Settings > Service Accounts${colors.reset}`);
      process.exit(1);
    }

    const serviceAccount = require(serviceAccountPath);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    const db = admin.firestore();

    // Verificar versión actual en Firestore
    const versionRef = db.collection('version').doc('current');
    const versionDoc = await versionRef.get();

    if (versionDoc.exists) {
      const currentVersion = versionDoc.data().version;
      console.log(`${colors.blue}📋 Versión actual en Firestore: ${colors.yellow}${currentVersion}${colors.reset}`);
      
      if (currentVersion === newVersion) {
        console.log(`${colors.yellow}⚠️  La versión ${newVersion} ya está actualizada en Firestore${colors.reset}`);
        console.log(`${colors.blue}✓ No se requieren cambios${colors.reset}\n`);
        process.exit(0);
      }
    }

    // Actualizar versión en Firestore
    await versionRef.set({
      version: newVersion,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      description: 'Versión actual de la aplicación',
      deployedBy: 'auto-script',
      previousVersion: versionDoc.exists ? versionDoc.data().version : null
    });

    console.log(`${colors.green}✅ Versión actualizada exitosamente en Firestore!${colors.reset}`);
    console.log(`${colors.green}   ${versionDoc.exists ? versionDoc.data().version : 'N/A'} → ${newVersion}${colors.reset}\n`);

  } catch (error) {
    console.error(`${colors.red}❌ Error actualizando versión:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Ejecutar
updateVersion();
