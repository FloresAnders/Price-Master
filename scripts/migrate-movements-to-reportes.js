//**  Script: Migra movimientos desde /MovimientosFondos/*/movements/{docId}
//  hacia reportes_movimientos y reportes_detalle en DB 'restauracion'
 // 
 // USO:
 //   FIRESTORE_DATABASE_ID=restauracion FUNCTIONS_EMULATOR=false node //scripts/migrate-movements-to-reportes.js
 //

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import serviceAccount from '../serviceAccountKey.json' with { type: 'json' };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'restauracion';
const BATCH_SIZE = 500; // Firestore max batch writes
const REPORT_COLLECTIONS = 'reportes_movimientos';
const REPORT_DETAIL_COLLECTION = 'reportes_detalle';
const MOVEMENT_TYPES_COLLECTION = 'fondoMovementTypes';

let stats = {
  processed: 0,
  created: 0,
  skipped: 0,
  errors: 0,
  startTime: Date.now(),
};

const normalizeCurrency = (value) => (value === 'USD' ? 'USD' : 'CRC');

const parseLocalDateFromMovementId = (movementId, createdAtFallback) => {
  const raw = String(movementId || '');
  const head = raw.split('-')[0] || '';
  const parts = head.split('_');
  if (parts.length === 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      const date = `${String(y)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { date, year: y, month: m };
    }
  }

  const dt = createdAtFallback ? new Date(createdAtFallback) : new Date();
  const safe = Number.isNaN(dt.getTime()) ? new Date() : dt;
  const date = safe.toISOString().split('T')[0];
  return { date, year: safe.getFullYear(), month: safe.getMonth() + 1 };
};

const resolveEmpresa = async (docId, db) => {
  if (!docId) return '';
  try {
    const snap = await db.collection('MovimientosFondos').doc(String(docId)).get();
    const company = String(snap.get('company') || '').trim();
    return company || String(docId);
  } catch (err) {
    console.warn(`[resolveEmpresa] Error for ${docId}:`, err.message);
    return String(docId);
  }
};

const getMovementTypeCache = async (db) => {
  const map = new Map();
  try {
    const snap = await db.collection(MOVEMENT_TYPES_COLLECTION).get();
    snap.forEach((doc) => {
      const id = String(doc.id || '').trim();
      const cat = String(doc.get('category') || '').toUpperCase().trim();
      if (id && (cat === 'INGRESO' || cat === 'GASTO' || cat === 'EGRESO')) {
        map.set(id, cat);
      }
    });
  } catch (err) {
    console.warn('[getMovementTypeCache] Error loading fondoMovementTypes:', err.message);
  }
  return map;
};

const resolveCategory = (paymentType, amountIngreso, amountEgreso, typeCache) => {
  const key = String(paymentType || '').trim();
  const cached = key ? typeCache.get(key) : null;
  if (cached) return cached;

  const ingreso = Math.trunc(Number(amountIngreso ?? 0)) || 0;
  const egreso = Math.trunc(Number(amountEgreso ?? 0)) || 0;
  if (ingreso > 0) return 'INGRESO';
  if (egreso > 0) return 'EGRESO';
  return 'EGRESO';
};

const categoryToClassification = (category) => {
  if (category === 'INGRESO') return 'ingreso';
  if (category === 'GASTO') return 'gasto';
  return 'egreso';
};

const safeDocIdPart = (value) => String(value || '').trim();

const processMovement = async (
  db,
  docId,
  movementId,
  movementData,
  typeCache
) => {
  const createdAt = String(movementData?.createdAt || '').trim();
  const { date, year, month } = parseLocalDateFromMovementId(movementId, createdAt);

  const accountId = safeDocIdPart(movementData?.accountId) || 'FondoGeneral';
  const currency = normalizeCurrency(movementData?.currency);
  const paymentType = safeDocIdPart(movementData?.paymentType) || '(Sin tipo)';

  let empresa = safeDocIdPart(movementData?.empresa);
  if (!empresa) {
    empresa = await resolveEmpresa(docId, db);
  }

  const amountIngreso = Math.trunc(Number(movementData?.amountIngreso ?? 0)) || 0;
  const amountEgreso = Math.trunc(Number(movementData?.amountEgreso ?? 0)) || 0;

  const category = resolveCategory(paymentType, amountIngreso, amountEgreso, typeCache);
  const classification = categoryToClassification(category);

  const reporteId = `${date}_${empresa}_${accountId}`;

  return {
    reporteId,
    detailRef: db
      .collection(REPORT_DETAIL_COLLECTION)
      .doc(reporteId)
      .collection('items')
      .doc(movementId),
    detailData: {
      movementId,
      empresa,
      createdAt: createdAt || '',
      accountId,
      manager: String(movementData?.manager || ''),
      paymentType: paymentType,
      classification: classification || 'egreso',
      amountIngreso: amountIngreso,
      amountEgreso: amountEgreso,
      currency: currency,
      invoiceNumber: String(movementData?.invoiceNumber || ''),
      providerCode: String(movementData?.providerCode || ''),
      notes: String(movementData?.notes || ''),
    },
  };
};

const migrateMovements = async () => {
  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const db = getFirestore(FIRESTORE_DATABASE_ID);

  console.log(`[MIGRATION START] Database: ${FIRESTORE_DATABASE_ID}`);
  console.log(`[MIGRATION] Fetching movement type cache...`);

  const typeCache = await getMovementTypeCache(db);
  console.log(`[MIGRATION] Loaded ${typeCache.size} movement types`);

  console.log(`[MIGRATION] Reading /MovimientosFondos collections...`);

  const fondosSnap = await db.collection('MovimientosFondos').get();
  const fondoIds = fondosSnap.docs.map((d) => d.id);

  console.log(`[MIGRATION] Found ${fondoIds.length} MovimientosFondos documents`);

  let totalMovements = 0;

  for (const docId of fondoIds) {
    const movementsSnap = await db
      .collection('MovimientosFondos')
      .doc(docId)
      .collection('movements')
      .get();

    console.log(
      `[MIGRATION] Processing ${docId}: ${movementsSnap.size} movements`
    );

    if (movementsSnap.empty) {
      stats.skipped += movementsSnap.size;
      continue;
    }

    let batch = db.batch();
    let batchCount = 0;

    for (const movDoc of movementsSnap.docs) {
      try {
        const movementId = movDoc.id;
        const movementData = movDoc.data();

        const processed = await processMovement(
          db,
          docId,
          movementId,
          movementData,
          typeCache
        );

        batch.set(processed.detailRef, processed.detailData, { merge: true });
        batchCount++;
        stats.processed++;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          console.log(
            `[MIGRATION] Batch committed (${batchCount} items), total: ${stats.processed}`
          );
          batchCount = 0;
        }
      } catch (err) {
        console.error(
          `[MIGRATION ERROR] docId=${docId}, movementId=${movDoc.id}:`,
          err.message
        );
        stats.errors++;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      batch = db.batch();
      console.log(
        `[MIGRATION] Final batch committed (${batchCount} items), total: ${stats.processed}`
      );
    }

    totalMovements += movementsSnap.size;
  }

  const elapsedMs = Date.now() - stats.startTime;
  stats.created = stats.processed - stats.errors;

  console.log('\n=== MIGRATION COMPLETE ===');
  console.log(`Total movements processed: ${stats.processed}`);
  console.log(`Successfully migrated: ${stats.created}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Time: ${(elapsedMs / 1000).toFixed(2)}s`);

  // Guardar reporte
  const reportPath = `migration-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));
  console.log(`\nReport saved to: ${reportPath}`);

  process.exit(stats.errors > 0 ? 1 : 0);
};

migrateMovements().catch((err) => {
  console.error('[MIGRATION FATAL ERROR]:', err);
  process.exit(1);
});