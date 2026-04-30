#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

/*
 * Script: Normaliza paymentType a "AJUSTE CIERRE" para todos los movimientos de cierre automático
 * Actualiza: paymentType -> "AJUSTE CIERRE"
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");
const readline = require("readline");

// Detectar entorno
const detectEnvironment = () => {
  const env = process.env.FIREBASE_ENV || process.env.NODE_ENV;
  
  if (env === "production" || env === "prod") {
    return "production";
  }
  
  // Si está explícitamente marcado como dev o es 'development'
  if (env === "development" || env === "dev") {
    return "development";
  }
  
  // Por defecto, asumir development
  return "development";
};

// Inicializar Firebase Admin
const serviceAccountPath = path.join(
  __dirname,
  "..",
  "serviceAccountKey.json"
);

if (!fs.existsSync(serviceAccountPath)) {
  console.error(
    `❌ serviceAccountKey.json no encontrado en: ${serviceAccountPath}`
  );
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
const environment = detectEnvironment();
const databaseId = environment === "production" ? "restauracion" : undefined;

console.log(`\n🔧 Configuración:`);
console.log(`   Entorno: ${environment === "production" ? "🔴 PRODUCCIÓN (restauracion)" : "🟢 DESARROLLO (default)"}`);
console.log(`   DatabaseId: ${databaseId ? databaseId : "(default - development)"}\n`);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = databaseId
  ? admin.firestore().database(databaseId)
  : admin.firestore();

const TARGET_TYPE = "AJUSTE CIERRE";
const CLOSING_PATTERNS = ["_CIERRE", "_CIERRE_USD"];

const isClosingMovement = (docId) => {
  return CLOSING_PATTERNS.some((pattern) => docId.endsWith(pattern));
};

// Pedir confirmación al usuario
const promptConfirmation = () => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const message =
      environment === "production"
        ? `\n⚠️  ¡ATENCIÓN! Se actualizarán movimientos en BASE DE DATOS DE PRODUCCIÓN (restauracion)\n`
        : `\n✅ Se actualizarán movimientos en base de datos de DESARROLLO\n`;

    rl.question(
      `${message}¿Deseas continuar? (escribir 'SI' para confirmar): `,
      (answer) => {
        rl.close();
        resolve(answer.toUpperCase() === "SI");
      }
    );
  });
};

async function normalizeClosed() {
  // Pedir confirmación
  const confirmed = await promptConfirmation();
  
  if (!confirmed) {
    console.log("\n❌ Operación cancelada por el usuario\n");
    process.exit(0);
  }

  console.log(
    "\n🔄 Iniciando normalización de paymentType para movimientos de cierre...\n"
  );

  let totalUpdated = 0;
  let totalProcessed = 0;
  let errorCount = 0;

  try {
    // Obtener todas las empresas en /MovimientosFondos
    const movimientosFondosRef = db.collection("MovimientosFondos");
    const companySnapshot = await movimientosFondosRef.get();

    if (companySnapshot.empty) {
      console.log(`📁 No hay empresas en MovimientosFondos\n`);
      console.log("\n" + "=".repeat(60));
      console.log("📊 RESUMEN FINAL");
      console.log("=".repeat(60));
      console.log(`Total procesados: 0`);
      console.log(`Total actualizados: 0`);
      console.log(`Total errores: 0`);
      console.log("=".repeat(60));
      console.log("✅ Sin movimientos para normalizar\n");
      return;
    }

    console.log(
      `📁 Encontradas ${companySnapshot.docs.length} empresas en MovimientosFondos\n`
    );

    for (const companyDoc of companySnapshot.docs) {
      const companyId = companyDoc.id;
      console.log(`📦 Procesando empresa: ${companyId}`);

      const movementsRef = db
        .collection("MovimientosFondos")
        .doc(companyId)
        .collection("movements");

      // Obtener todos los documentos de esta empresa
      const snapshot = await movementsRef.get();

      if (snapshot.empty) {
        console.log(`  ✓ Sin movimientos en ${companyId}\n`);
        continue;
      }

      let companyUpdated = 0;

      for (const doc of snapshot.docs) {
        totalProcessed++;
        const docId = doc.id;
        const data = doc.data();

        // Verificar si es un movimiento de cierre
        if (!isClosingMovement(docId)) {
          continue;
        }

        const currentType = data.paymentType || null;

        // Si ya tiene el tipo correcto, saltar
        if (currentType === TARGET_TYPE) {
          console.log(
            `  ✓ ${docId} ya tiene paymentType='${TARGET_TYPE}'`
          );
          totalUpdated++;
          companyUpdated++;
          continue;
        }

        // Actualizar
        try {
          await movementsRef.doc(docId).update({
            paymentType: TARGET_TYPE,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(
            `  ✏️  ${docId} actualizado: '${currentType || "vacío"}' → '${TARGET_TYPE}'`
          );
          totalUpdated++;
          companyUpdated++;
        } catch (updateErr) {
          errorCount++;
          console.error(`  ❌ Error actualizando ${docId}:`, updateErr.message);
        }
      }

      console.log(`  ✅ Empresa ${companyId}: ${companyUpdated} actualizados\n`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 RESUMEN FINAL");
    console.log("=".repeat(60));
    console.log(`Total procesados: ${totalProcessed}`);
    console.log(`Total actualizados: ${totalUpdated}`);
    console.log(`Total errores: ${errorCount}`);
    console.log("=".repeat(60));

    if (errorCount === 0) {
      console.log("✅ Normalización completada exitosamente\n");
    } else {
      console.log(
        `⚠️  Normalización completada con ${errorCount} errores\n`
      );
    }
  } catch (err) {
    console.error("❌ Error crítico:", err);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

normalizeClosed().then(() => {
  process.exit(0);
});
