/* eslint-disable no-console */
const admin = require("firebase-admin");
const path = require("path");

function parseArgs(argv) {
  const args = {
    database: "restauracion",
    ledgerCollection: "MovimientosFondos",
    serviceAccount: "../serviceAccountKey.json",
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--database") {
      args.database = String(argv[i + 1] || "").trim();
      i++;
    }
    if (token === "--ledger-collection") {
      args.ledgerCollection = String(argv[i + 1] || "").trim() || args.ledgerCollection;
      i++;
    }
    if (token === "--service-account") {
      args.serviceAccount = String(argv[i + 1] || "").trim() || args.serviceAccount;
      i++;
    }
  }

  return args;
}

function getDb(databaseId) {
  if (!databaseId) return admin.firestore();
  return admin.app().firestore(databaseId);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const serviceAccountPath = path.resolve(__dirname, args.serviceAccount);
  const serviceAccount = require(serviceAccountPath);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const db = getDb(args.database);

  console.log("Verificando cantidad de movimientos en:", args.database || "(default)");
  console.log("Ledger collection:", args.ledgerCollection);
  console.log("---");

  let totalLedgers = 0;
  let totalMovements = 0;
  const ledgerStats = [];

  const ledgersSnap = await db.collection(args.ledgerCollection).get();
  
  console.log(`Total de ledgers: ${ledgersSnap.size}`);
  
  for (const ledgerDoc of ledgersSnap.docs) {
    totalLedgers++;
    const ledgerId = ledgerDoc.id;
    const movementsSnap = await ledgerDoc.ref.collection("movements").get();
    const count = movementsSnap.size;
    totalMovements += count;
    ledgerStats.push({ ledgerId, count });
    console.log(`  ${ledgerId}: ${count} movimientos`);
  }

  console.log("---");
  console.log("Resumen:");
  console.log({
    totalLedgers,
    totalMovements,
  });
}

main().catch((err) => {
  console.error("Error en verificacion:", err);
  process.exit(1);
});
