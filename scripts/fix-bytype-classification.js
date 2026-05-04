/**
 * Migration script: Fix byType classification in reportes_movimientos
 * Moves amounts to the correct column (ingreso/gasto/egreso) based on payment type category
 * Run with: node scripts/fix-bytype-classification.js
 */

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestoreDatabaseId = (process.env.FIRESTORE_DATABASE_ID || "").trim();
const db = firestoreDatabaseId
  ? admin.app().firestore(firestoreDatabaseId)
  : admin.firestore();

const PAYMENT_TYPE_CATEGORIES = {
  // INGRESOS
  VENTAS: "ingreso",
  "OTROS INGRESOS": "ingreso",
  // GASTOS
  SALARIOS: "gasto",
  TELEFONOS: "gasto",
  "CARGAS SOCIALES": "gasto",
  AGUINALDOS: "gasto",
  VACACIONES: "gasto",
  "POLIZA RIESGOS DE TRABAJO": "gasto",
  "PAGO TIMBRE Y EDUCACION": "gasto",
  "PAGO IMPUESTOS A SOCIEDADES": "gasto",
  "PATENTES MUNICIPALES": "gasto",
  "ALQUILER LOCAL": "gasto",
  ELECTRICIDAD: "gasto",
  AGUA: "gasto",
  INTERNET: "gasto",
  "MANTENIMIENTO INSTALACIONES": "gasto",
  "PAPELERIA Y UTILES": "gasto",
  "ASEO Y LIMPIEZA": "gasto",
  "REDES SOCIALES": "gasto",
  "MATERIALES DE EMPAQUE": "gasto",
  "CONTROL PLAGAS": "gasto",
  "MONITOREO DE ALARMAS": "gasto",
  "FACTURA ELECTRONICA": "gasto",
  "GASTOS VARIOS": "gasto",
  TRANSPORTE: "gasto",
  "SERVICIOS PROFECIONALES": "gasto",
  "MANTENIMIENTO MOBILIARIO Y EQUIPO": "gasto",
  // EGRESOS
  "EGRESOS VARIOS": "egreso",
  "PAGO TIEMPOS": "egreso",
  "PAGO BANCA": "egreso",
  "COMPRA INVENTARIO": "egreso",
  "COMPRA ACTIVOS": "egreso",
  "PAGO IMPUESTO RENTA": "egreso",
  "PAGO IMPUESTO IVA": "egreso",
  "RETIRO EFECTIVO": "egreso",
  INFORMATIVO: "ingreso", // fallback
};

function fixByTypeForDocument(docData) {
  if (!docData.byType || typeof docData.byType !== "object") {
    return null; // No changes needed
  }

  const byType = JSON.parse(JSON.stringify(docData.byType)); // Deep copy
  let hasChanges = false;

  Object.entries(byType).forEach(([paymentType, byCurrency]) => {
    if (!byCurrency || typeof byCurrency !== "object") return;

    const expectedCategory = PAYMENT_TYPE_CATEGORIES[paymentType];
    if (!expectedCategory) {
      console.warn(`  Warning: Unknown payment type: ${paymentType}`);
      return;
    }

    Object.entries(byCurrency).forEach(([currency, bucket]) => {
      if (!bucket || typeof bucket !== "object") return;

      const ingreso = Math.trunc(Number(bucket.ingreso ?? 0)) || 0;
      const gasto = Math.trunc(Number(bucket.gasto ?? 0)) || 0;
      const egreso = Math.trunc(Number(bucket.egreso ?? 0)) || 0;

      // If the bucket already has values in the correct column, skip
      const correctValue =
        expectedCategory === "ingreso"
          ? ingreso
          : expectedCategory === "gasto"
            ? gasto
            : egreso;

      // If we have a value in a wrong column, move it
      let newBucket = { ...bucket };
      let changed = false;

      if (expectedCategory === "ingreso") {
        if (gasto > 0 || egreso > 0) {
          const total = gasto + egreso;
          if (total > 0) {
            newBucket = { ...bucket, ingreso: total, gasto: 0, egreso: 0 };
            changed = true;
          }
        }
      } else if (expectedCategory === "gasto") {
        if (ingreso > 0 || egreso > 0) {
          const total = ingreso + egreso;
          if (total > 0) {
            newBucket = { ...bucket, gasto: total, ingreso: 0, egreso: 0 };
            changed = true;
          }
        }
      } else if (expectedCategory === "egreso") {
        if (ingreso > 0 || gasto > 0) {
          const total = ingreso + gasto;
          if (total > 0) {
            newBucket = { ...bucket, egreso: total, ingreso: 0, gasto: 0 };
            changed = true;
          }
        }
      }

      if (changed) {
        byType[paymentType][currency] = newBucket;
        hasChanges = true;
      }
    });
  });

  return hasChanges ? byType : null;
}

async function migrateByTypeClassifications() {
  try {
    console.log("Starting byType classification migration...\n");
    console.log(
      `Using Firestore database: ${firestoreDatabaseId || "(default)"}`,
    );

    const companiesSnapshot = await db.collection("reportes_movimientos").get();
    let totalDocsProcessed = 0;
    let totalDocsFixed = 0;

    for (const companyDoc of companiesSnapshot.docs) {
      const companyData = companyDoc.data();
      console.log(`Processing ${companyDoc.id}...`);

      const fixedByType = fixByTypeForDocument(companyData);

      if (fixedByType) {
        await companyDoc.ref.update({ byType: fixedByType });
        totalDocsFixed++;
        console.log(`  ✓ Fixed byType classifications`);
      }

      totalDocsProcessed++;
    }

    console.log(`\n=== Migration Complete ===`);
    console.log(`Documents processed: ${totalDocsProcessed}`);
    console.log(`Documents fixed: ${totalDocsFixed}`);

    process.exit(0);
  } catch (error) {
    console.error("Error during migration:", error);
    process.exit(1);
  }
}

migrateByTypeClassifications();
