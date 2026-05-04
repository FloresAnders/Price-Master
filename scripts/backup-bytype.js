/**
 * Backup script: Export current byType data before migration
 * Run with: node scripts/backup-bytype.js
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestoreDatabaseId = (process.env.FIRESTORE_DATABASE_ID || "").trim();
const db = firestoreDatabaseId
  ? admin.app().firestore(firestoreDatabaseId)
  : admin.firestore();

async function backupByType() {
  try {
    console.log("Creating backup of byType data...\n");
    console.log(
      `Using Firestore database: ${firestoreDatabaseId || "(default)"}`,
    );

    const backupDir = path.join(__dirname, "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(backupDir, `bytype-backup-${timestamp}.json`);

    const companiesSnapshot = await db.collection("reportes_movimientos").get();
    const backup = {};

    for (const companyDoc of companiesSnapshot.docs) {
      const companyData = companyDoc.data();
      backup[companyDoc.id] = {
        byType: companyData.byType || {},
        date: companyData.date,
        accountId: companyData.accountId,
      };
    }

    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

    console.log(`✓ Backup created: ${backupFile}`);
    console.log(`  Documents backed up: ${Object.keys(backup).length}`);

    process.exit(0);
  } catch (error) {
    console.error("Error during backup:", error);
    process.exit(1);
  }
}

backupByType();
