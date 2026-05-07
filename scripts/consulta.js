// search-firestore.js

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// Prioriza credenciales locales para evitar depender de ADC/GOOGLE_APPLICATION_CREDENTIALS.
const serviceAccountPath = path.resolve(__dirname, "../serviceAccountKey.json");

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
} else {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function searchByInvoiceNumber(invoiceNumber) {
  try {
    const snapshot = await db
      .collection("MovimientosFondos")
      .doc("movements_ALCHACAS")
      .collection("movements")
      .where("invoiceNumber", "==", invoiceNumber)
      .get();

    if (snapshot.empty) {
      console.log("No se encontraron documentos.");
      return;
    }

    snapshot.forEach((doc) => {
      console.log("=================================");
      console.log("Document ID:", doc.id);
      console.log("Path:", doc.ref.path);
      console.log("Data:", doc.data());
    });
  } catch (error) {
    console.error("Error realizando consulta:", error);
  }
}

// Cambia aquí el invoiceNumber a buscar o pásalo por CLI: node scripts/consulta.js 0000
const invoiceNumber = process.argv[2] || "0202";
searchByInvoiceNumber(invoiceNumber);