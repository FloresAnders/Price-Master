import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import {
  admin,
  getDb,
  getDbByDatabaseId,
  FIRESTORE_DATABASE_ID,
} from './firebase.js';

const REPORTS_COLLECTION = 'reportes_movimientos';
const REPORTS_DETAIL_COLLECTION = 'reportes_detalle';
const MOVEMENT_TYPES_COLLECTION = 'fondoMovementTypes';
const CATEGORY_TTL_MS = 10 * 60 * 1000;

const movementTypeCategoryCacheByDatabase = new Map();

const normalizeCurrency = (value) => (value === 'USD' ? 'USD' : 'CRC');
const safeDocIdPart = (value) => String(value || '').trim();

const parseLocalDateFromMovementId = (movementId, createdAtFallback) => {
  const head = String(movementId || '').split('-')[0] || '';
  const parts = head.split('_');
  if (parts.length === 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return {
        date: `${String(y)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        year: y,
        month: m,
      };
    }
  }

  const parsed = createdAtFallback ? new Date(createdAtFallback) : new Date();
  const safe = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return {
    date: safe.toISOString().split('T')[0],
    year: safe.getFullYear(),
    month: safe.getMonth() + 1,
  };
};

const resolveEmpresaFromLedger = async (docId, db) => {
  if (!docId) return '';
  const snap = await db.collection('MovimientosFondos').doc(String(docId)).get();
  const company = String(snap.get('company') || '').trim();
  return company || String(docId);
};

const ensureMovementTypeCategoryCache = async (databaseId, db) => {
  const cached = movementTypeCategoryCacheByDatabase.get(databaseId);
  const now = Date.now();
  if (cached?.map.size > 0 && now - cached.loadedAtMs < CATEGORY_TTL_MS) {
    return cached.map;
  }

  try {
    const snap = await db.collection(MOVEMENT_TYPES_COLLECTION).get();
    const map = new Map();
    snap.forEach((doc) => {
      const id = String(doc.id || '').trim();
      const category = String(doc.get('category') || '').toUpperCase().trim();
      if (id && ['INGRESO', 'GASTO', 'EGRESO'].includes(category)) {
        map.set(id, category);
      }
    });
    movementTypeCategoryCacheByDatabase.set(databaseId, { loadedAtMs: now, map });
    return map;
  } catch (error) {
    console.error('[onMovementWrite] Error loading fondoMovementTypes cache:', error);
    const map = new Map();
    movementTypeCategoryCacheByDatabase.set(databaseId, { loadedAtMs: now, map });
    return map;
  }
};

const resolveCategory = (categoryMap, paymentType, amountIngreso, amountEgreso) => {
  const cached = categoryMap.get(String(paymentType || '').trim());
  if (cached === 'INGRESO' || cached === 'GASTO' || cached === 'EGRESO') return cached;

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

const deltaFromCategory = (category, amountIngreso, amountEgreso) => {
  if (category === 'INGRESO') return { ingreso: amountIngreso, gasto: 0, egreso: 0 };
  if (category === 'GASTO') return { ingreso: 0, gasto: amountEgreso, egreso: 0 };
  return { ingreso: 0, gasto: 0, egreso: amountEgreso };
};

const handleMovementWrite = async (event) => {
  const docId = safeDocIdPart(event.params.docId);
  const movementId = safeDocIdPart(event.params.movementId);
  const eventDatabase = safeDocIdPart(event.database) || '(default)';
  const db = getDbByDatabaseId(eventDatabase);

  console.log('[onMovementWrite] Event received', {
    database: event.database,
    document: event.document,
    docId,
    movementId,
  });

  const before = event.data?.before?.data() ?? null;
  const after = event.data?.after?.data() ?? null;
  if (!before && !after) {
    console.warn('[onMovementWrite] Ignored event without before/after data', {
      docId,
      movementId,
    });
    return;
  }

  const categoryMap = await ensureMovementTypeCategoryCache(eventDatabase, db);
  const refData = after ?? before;
  const createdAt = String(refData?.createdAt || '').trim();
  const { date, year, month } = parseLocalDateFromMovementId(movementId, createdAt);
  const accountId = safeDocIdPart(refData?.accountId) || 'FondoGeneral';
  const currency = normalizeCurrency(refData?.currency);
  const paymentType = safeDocIdPart(refData?.paymentType) || '(Sin tipo)';

  let empresa = safeDocIdPart(refData?.empresa);
  if (!empresa) {
    try {
      empresa = await resolveEmpresaFromLedger(docId, db);
    } catch (error) {
      console.error('[onMovementWrite] Error resolving empresa from ledger:', error);
      empresa = docId;
    }
  }

  const reporteId = `${date}_${empresa}_${accountId}`;
  const aggRef = db.collection(REPORTS_COLLECTION).doc(reporteId);
  const detailRef = db
    .collection(REPORTS_DETAIL_COLLECTION)
    .doc(reporteId)
    .collection('items')
    .doc(movementId);

  const amountIngresoAfter = Math.trunc(Number(after?.amountIngreso ?? 0)) || 0;
  const amountEgresoAfter = Math.trunc(Number(after?.amountEgreso ?? 0)) || 0;
  const amountIngresoBefore = Math.trunc(Number(before?.amountIngreso ?? 0)) || 0;
  const amountEgresoBefore = Math.trunc(Number(before?.amountEgreso ?? 0)) || 0;
  const catAfter = after
    ? resolveCategory(categoryMap, paymentType, amountIngresoAfter, amountEgresoAfter)
    : null;
  const catBefore = before
    ? resolveCategory(categoryMap, before?.paymentType, amountIngresoBefore, amountEgresoBefore)
    : null;

  const inc = admin.firestore.FieldValue.increment;
  const update = {
    date,
    year,
    month,
    empresa,
    accountId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const setByTypeDelta = (target, type, cur, count, ingreso, gasto, egreso) => {
    target[new admin.firestore.FieldPath('byType', type, cur, 'count')] = inc(count);
    target[new admin.firestore.FieldPath('byType', type, cur, 'ingreso')] = inc(ingreso);
    target[new admin.firestore.FieldPath('byType', type, cur, 'gasto')] = inc(gasto);
    target[new admin.firestore.FieldPath('byType', type, cur, 'egreso')] = inc(egreso);
  };

  const applyTotalsDelta = (target, ingreso, gasto, egreso) => {
    target.totalIngreso = inc(ingreso);
    target.totalGasto = inc(gasto);
    target.totalEgreso = inc(egreso);
  };

  if (!after && before) {
    const curBefore = normalizeCurrency(before?.currency);
    const typeBefore = safeDocIdPart(before?.paymentType) || '(Sin tipo)';
    const delta = deltaFromCategory(catBefore, amountIngresoBefore, amountEgresoBefore);

    update.count = inc(-1);
    applyTotalsDelta(update, -delta.ingreso, -delta.gasto, -delta.egreso);
    setByTypeDelta(
      update,
      typeBefore,
      curBefore,
      -1,
      -delta.ingreso,
      -delta.gasto,
      -delta.egreso,
    );

    await Promise.all([
      aggRef.set(update, { merge: true }),
      detailRef.delete().catch(() => null),
    ]);
    return;
  }

  if (!after) return;

  const isCreate = !before;
  if (isCreate) {
    update.count = inc(1);
    if (createdAt) update.lastMovementAt = createdAt;
  }

  const deltaAfter = deltaFromCategory(catAfter, amountIngresoAfter, amountEgresoAfter);
  const deltaBefore = before
    ? deltaFromCategory(catBefore, amountIngresoBefore, amountEgresoBefore)
    : { ingreso: 0, gasto: 0, egreso: 0 };
  const deltaIngreso = deltaAfter.ingreso - deltaBefore.ingreso;
  const deltaGasto = deltaAfter.gasto - deltaBefore.gasto;
  const deltaEgreso = deltaAfter.egreso - deltaBefore.egreso;

  applyTotalsDelta(update, deltaIngreso, deltaGasto, deltaEgreso);

  if (isCreate) {
    setByTypeDelta(
      update,
      paymentType,
      currency,
      1,
      deltaAfter.ingreso,
      deltaAfter.gasto,
      deltaAfter.egreso,
    );
  } else {
    const typeBefore = safeDocIdPart(before?.paymentType) || '(Sin tipo)';
    const curBefore = normalizeCurrency(before?.currency);
    if (typeBefore !== paymentType || curBefore !== currency) {
      setByTypeDelta(
        update,
        typeBefore,
        curBefore,
        -1,
        -deltaBefore.ingreso,
        -deltaBefore.gasto,
        -deltaBefore.egreso,
      );
      setByTypeDelta(
        update,
        paymentType,
        currency,
        1,
        deltaAfter.ingreso,
        deltaAfter.gasto,
        deltaAfter.egreso,
      );
    } else {
      setByTypeDelta(update, paymentType, currency, 0, deltaIngreso, deltaGasto, deltaEgreso);
    }
  }

  await Promise.all([
    aggRef.set(update, { merge: true }),
    detailRef.set(
      {
        movementId,
        empresa,
        createdAt: createdAt || '',
        accountId,
        manager: String(after?.manager || ''),
        paymentType,
        classification: categoryToClassification(catAfter),
        amountIngreso: amountIngresoAfter,
        amountEgreso: amountEgresoAfter,
        currency,
        invoiceNumber: String(after?.invoiceNumber || ''),
        providerCode: String(after?.providerCode || ''),
        notes: String(after?.notes || ''),
      },
      { merge: true },
    ),
  ]);
};

const movementTrigger = (document, database) =>
  onDocumentWritten({ document, database }, handleMovementWrite);

const MOVEMENTS_PATH = 'MovimientosFondos/{docId}/movements/{movementId}';
const LEGACY_MOVEMENTS_PATH = 'MovimientosFondos/{docId}/Movements/{movementId}';
const TUCAN_PATH = 'MovimientosFondos/{docId}/tucan/{movementId}';
const TIEMPOS_PATH = 'MovimientosFondos/{docId}/tiempos/{movementId}';

export const onMovementWrite = movementTrigger(MOVEMENTS_PATH, '(default)');
export const onMovementWriteRestauracion = movementTrigger(MOVEMENTS_PATH, 'restauracion');
export const onMovementWriteLegacyPath = movementTrigger(LEGACY_MOVEMENTS_PATH, '(default)');
export const onMovementWriteLegacyPathRestauracion = movementTrigger(
  LEGACY_MOVEMENTS_PATH,
  'restauracion',
);
export const onTucanMovementWrite = movementTrigger(TUCAN_PATH, '(default)');
export const onTucanMovementWriteRestauracion = movementTrigger(TUCAN_PATH, 'restauracion');
export const onTiemposMovementWrite = movementTrigger(TIEMPOS_PATH, '(default)');
export const onTiemposMovementWriteRestauracion = movementTrigger(TIEMPOS_PATH, 'restauracion');

export const checkMovementsConfig = onRequest(async (req, res) => {
  let firestoreOk = false;
  let sampleDoc = null;
  try {
    const snap = await getDb().collection('MovimientosFondos').limit(1).get();
    firestoreOk = true;
    sampleDoc = snap.empty ? 'empty' : snap.docs[0].id;
  } catch (error) {
    console.error('[checkMovementsConfig] Firestore check failed:', error);
  }

  res.json({
    firestoreDatabase: FIRESTORE_DATABASE_ID,
    firestoreConnected: firestoreOk,
    sampleMovimientosFondosDoc: sampleDoc,
    triggerListeningOn: ['(default)', 'restauracion'],
    timestamp: new Date().toISOString(),
  });
});
