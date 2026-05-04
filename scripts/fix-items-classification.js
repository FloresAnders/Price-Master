/**
 * Migration script: Fix classification field in individual movement items
 * Ensures each item has the correct classification based on its payment type
 * Run with: node scripts/fix-items-classification.js
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
  INFORMATIVO: "ingreso",
};

const normalizeClassification = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizePaymentType = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

async function fixItemsClassification() {
  try {
    console.log("Fixing classification in individual movement items...\n");
    console.log(
      `Using Firestore database: ${firestoreDatabaseId || "(default)"}`,
    );

    const detailReportsSnapshot = await db.collection("reportes_detalle").get();
    let totalItemsProcessed = 0;
    let totalItemsFixed = 0;
    const issuesFound = [];

    for (const reportDoc of detailReportsSnapshot.docs) {
      const itemsSnapshot = await reportDoc.ref.collection("items").get();

      console.log(
        `Processing ${itemsSnapshot.size} items from ${reportDoc.id}...`
      );

      const batch = db.batch();
      let batchSize = 0;

      for (const itemDoc of itemsSnapshot.docs) {
        const data = itemDoc.data();
        const paymentType = normalizePaymentType(data.paymentType);
        const currentClassification = normalizeClassification(data.classification);
        const expectedClassification =
          PAYMENT_TYPE_CATEGORIES[paymentType] || "ingreso";

        totalItemsProcessed++;

        if (currentClassification !== expectedClassification) {
          batch.update(itemDoc.ref, { classification: expectedClassification });
          batchSize++;
          totalItemsFixed++;

          issuesFound.push({
            id: itemDoc.id,
            paymentType,
            from: currentClassification,
            to: expectedClassification,
            report: reportDoc.id,
          });
        }
      }

      if (batchSize > 0) {
        await batch.commit();
        console.log(`  ✓ Fixed ${batchSize} items`);
      }
    }

    console.log(`\n=== Migration Complete ===`);
    console.log(`Items processed: ${totalItemsProcessed}`);
    console.log(`Items fixed: ${totalItemsFixed}`);

    if (issuesFound.length > 0) {
      console.log(`\nFixed classifications:`);
      const grouped = {};
      issuesFound.forEach((issue) => {
        const key = `${issue.paymentType}: ${issue.from} → ${issue.to}`;
        if (!grouped[key]) grouped[key] = 0;
        grouped[key]++;
      });
      Object.entries(grouped).forEach(([key, count]) => {
        console.log(`  • ${key} (${count} items)`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error("Error during migration:", error);
    process.exit(1);
  }
}

fixItemsClassification();
