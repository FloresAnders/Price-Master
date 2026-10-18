#!/usr/bin/env node

/**
 * Script para verificar el estado de las versiones
 * Solo lee y compara, no hace modificaciones
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
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// Función para comparar versiones semánticas
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
}

async function checkVersion() {
  try {
    const adminModule = await import('firebase-admin');
    admin = adminModule.default ?? adminModule;

    const fsModule = await import('node:fs');
    fs = fsModule.default ?? fsModule;

    const pathModule = await import('node:path');
    path = pathModule.default ?? pathModule;

    const { getOperationalFirestore } = await import('./operational-firestore-target.mjs');

    console.log(`\n${colors.bold}${colors.cyan}📊 ESTADO DE VERSIONES${colors.reset}\n`);
    console.log('═'.repeat(50) + '\n');

    // Leer versión del archivo JSON
    const versionPath = path.join(__dirname, '../src/data/version.json');
    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    const localVersion = versionData.version;

    console.log(`${colors.blue}📦 Local (version.json):${colors.reset} ${colors.yellow}${localVersion}${colors.reset}`);

    // Inicializar Firebase Admin
    const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
    
    if (!fs.existsSync(serviceAccountPath)) {
      console.error(`${colors.red}❌ Error: No se encontró el archivo serviceAccountKey.json${colors.reset}`);
      console.log(`${colors.yellow}💡 Descarga las credenciales desde Firebase Console${colors.reset}\n`);
      process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    const { db, databaseLabel } = getOperationalFirestore(admin, process.env);
    console.log(`${colors.blue}Base Firestore:${colors.reset} ${colors.yellow}${databaseLabel}${colors.reset}`);

    // Obtener versión de Firestore
    const versionRef = db.collection('version').doc('current');
    const versionDoc = await versionRef.get();
    
    if (!versionDoc.exists) {
      console.log(`${colors.blue}🗄️  Firestore:${colors.reset} ${colors.red}❌ No existe${colors.reset}\n`);
      console.log('─'.repeat(50));
      console.log(`\n${colors.yellow}💡 Ejecuta "npm run version:update" para crear el documento${colors.reset}\n`);
      await admin.app().delete();
      return;
    }

    const dbData = versionDoc.data();
    const dbVersion = dbData.version;
    console.log(`${colors.blue}🗄️  Firestore:${colors.reset} ${colors.yellow}${dbVersion}${colors.reset}`);
    
    if (dbData.updatedAt) {
      const date = dbData.updatedAt.toDate();
      console.log(`${colors.blue}🕐 Última actualización:${colors.reset} ${date.toLocaleString('es-MX')}`);
    }

    if (dbData.previousVersion) {
      console.log(`${colors.blue}📜 Versión anterior:${colors.reset} ${dbData.previousVersion}`);
    }

    // Comparar versiones
    const comparison = compareVersions(localVersion, dbVersion);
    
    console.log('\n' + '─'.repeat(50));
    console.log(`\n${colors.bold}${colors.cyan}📈 ANÁLISIS:${colors.reset}\n`);
    
    if (comparison > 0) {
      console.log(`${colors.green}✅ version.json es SUPERIOR${colors.reset}`);
      console.log(`${colors.yellow}💡 Ejecuta "npm run version:update" para actualizar Firestore${colors.reset}`);
    } else if (comparison === 0) {
      console.log(`${colors.green}✅ Versiones SINCRONIZADAS${colors.reset}`);
      console.log(`${colors.blue}ℹ️  No se requiere ninguna acción${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️  Firestore es SUPERIOR${colors.reset}`);
      console.log(`${colors.yellow}💡 Considera actualizar version.json a: ${dbVersion}${colors.reset}`);
    }
    
    console.log('\n' + '═'.repeat(50) + '\n');

    await admin.app().delete();

  } catch (error) {
    console.error(`${colors.red}❌ Error:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Ejecutar
checkVersion();
