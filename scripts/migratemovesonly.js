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
const BATCH_SIZE = 200;
const REPORT_COLLECTIONS = 'reportes_movimientos';
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

const safeDocIdPart = (value) => String(value || '').trim();

// Acumula en memoria los reportes antes de escribir a Firestore
// para evitar doble conteo si el mismo reporteId aparece en múltiples movimientos
const reporteAccumulator = new Map();

const accumulateReporte = (reporteId, fields) => {
  if (!reporteAccumulator.has(reporteId)) {
    reporteAccumulator.set(reporteId, {
      accountId: fields.accountId,
      empresa: fields.empresa,
      date: fields.date,
      year: fields.year,
      month: fields.month,
      currency: fields.currency,
      lastMovementAt: fields.lastMovementAt,
      totalIngreso: 0,
      totalEgreso: 0,
      totalGasto: 0,
      count: 0,
      byType: {},
    });
  }

  const r = reporteAccumulator.get(reporteId);

  r.totalIngreso += fields.amountIngreso;
  r.totalEgreso += fields.amountEgreso;
  r.count += 1;

  // Actualiza lastMovementAt con el más reciente
  if (fields.lastMovementAt > r.lastMovementAt) {
    r.lastMovementAt = fields.lastMovementAt;
  }

  // byType
  const pt = fields.paymentType;
  const cur = fields.currency;
  if (!r.byType[pt]) r.byType[pt] = {};
  if (!r.byType[pt][cur]) {
    r.byType[pt][cur] = { count: 0, ingreso: 0, egreso: 0, gasto: 0 };
  }
  r.byType[pt][cur].count += 1;
  r.byType[pt][cur].ingreso += fields.amountIngreso;
  r.byType[pt][cur].egreso += fields.amountEgreso;
};

const migrateReportes = async () => {
  const db = getFirestore(FIRESTORE_DATABASE_ID);

  console.log(`[MIGRATION START] Database: ${FIRESTORE_DATABASE_ID}`);
  console.log(`[MIGRATION] Fetching movement type cache...`);

  const typeCache = await getMovementTypeCache(db);
  console.log(`[MIGRATION] Loaded ${typeCache.size} movement types`);

  const fondosSnap = await db.collection('MovimientosFondos').get();
  const fondoIds = fondosSnap.docs.map((d) => d.id);
  console.log(`[MIGRATION] Found ${fondoIds.length} MovimientosFondos documents`);

  // PASO 1: Leer todos los movimientos y acumular en memoria
  for (const docId of fondoIds) {
    const movementsSnap = await db
      .collection('MovimientosFondos')
      .doc(docId)
      .collection('movements')
      .get();

    console.log(`[MIGRATION] Reading ${docId}: ${movementsSnap.size} movements`);

    if (movementsSnap.empty) {
      stats.skipped++;
      continue;
    }

    for (const movDoc of movementsSnap.docs) {
      try {
        const movementId = movDoc.id;
        const movementData = movDoc.data();

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

        resolveCategory(paymentType, amountIngreso, amountEgreso, typeCache);

        const reporteId = `${date}_${empresa}_${accountId}`;

        accumulateReporte(reporteId, {
          accountId,
          empresa,
          date,
          year,
          month,
          currency,
          paymentType,
          amountIngreso,
          amountEgreso,
          lastMovementAt: createdAt || new Date().toISOString(),
        });

        stats.processed++;
      } catch (err) {
        console.error(`[ERROR] docId=${docId}, movementId=${movDoc.id}:`, err.message);
        stats.errors++;
      }
    }
  }

  console.log(`\n[MIGRATION] Accumulated ${reporteAccumulator.size} unique reportes`);
  console.log(`[MIGRATION] Writing to ${REPORT_COLLECTIONS}...`);

  // PASO 2: Escribir los reportes acumulados en batches
  const entries = Array.from(reporteAccumulator.entries());
  let batch = db.batch();
  let batchCount = 0;
  let written = 0;

  for (const [reporteId, data] of entries) {
    const ref = db.collection(REPORT_COLLECTIONS).doc(reporteId);
    batch.set(ref, {
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: false }); // merge: false para reemplazar limpio

    batchCount++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      written += batchCount;
      console.log(`[MIGRATION] Batch committed (${batchCount}), total written: ${written}`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    written += batchCount;
    console.log(`[MIGRATION] Final batch committed (${batchCount}), total written: ${written}`);
  }

  const elapsedMs = Date.now() - stats.startTime;
  stats.created = written;

  console.log('\n=== MIGRATION COMPLETE ===');
  console.log(`Movements read:       ${stats.processed}`);
  console.log(`Reportes written:     ${stats.created}`);
  console.log(`Errors:               ${stats.errors}`);
  console.log(`Time:                 ${(elapsedMs / 1000).toFixed(2)}s`);

  const reportPath = `migration-reportes-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({ stats, reporteIds: Array.from(reporteAccumulator.keys()) }, null, 2));
  console.log(`\nReport saved to: ${reportPath}`);

  process.exit(stats.errors > 0 ? 1 : 0);
};

migrateReportes().catch((err) => {
  console.error('[MIGRATION FATAL ERROR]:', err);
  process.exit(1);
});