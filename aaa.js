const path = require('path');
const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps && admin.apps.length > 0) return;

  // Prefer explicit GOOGLE_APPLICATION_CREDENTIALS if present.
  // Fallback to local serviceAccountKey.json in repo root.
  let credential;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credential = admin.credential.applicationDefault();
  } else {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
    credential = admin.credential.cert(serviceAccount);
  }

  admin.initializeApp({ credential });
}

function normalizeDocIdPart(raw) {
  const base = String(raw || '')
    .trim()
    .replaceAll('/', '-')
    .replaceAll('\\', '-')
    .replace(/\s+/g, '_');

  const safe = base
    .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return safe.slice(0, 160) || 'funcion';
}

function buildFuncionDocId(funcionId, nombre) {
  return `${String(funcionId).trim()}_${normalizeDocIdPart(nombre)}`;
}

function formatNumericFuncionId(value, padLength = 4) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  return String(safe).padStart(Math.max(1, Math.trunc(padLength)), '0');
}

async function getNextNumericFuncionId({ ownerId, padLength = 4 }) {
  const owner = String(ownerId || '').trim();
  if (!owner) throw new Error('ownerId requerido para generar funcionId.');

  initAdmin();
  const db = admin.firestore();

  const snap = await db.collection('funciones').where('ownerId', '==', owner).get();
  let max = -1;
  snap.forEach((doc) => {
    const d = doc.data() || {};
    const isGeneral = d.type === 'general' || (d.funcionId && d.nombre && !d.empresaId);
    if (!isGeneral) return;
    const raw = String(d.funcionId || '').trim();
    if (!/^[0-9]+$/.test(raw)) return;
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > max) max = n;
  });

  return formatNumericFuncionId(max + 1, padLength);
}

async function upsertFuncionGeneral({ ownerId, funcionId, nombre, descripcion }) {
  const owner = String(ownerId || '').trim();
  const fid = String(funcionId || '').trim();
  const name = String(nombre || '').trim();
  if (!owner) throw new Error('ownerId requerido');
  if (!fid) throw new Error('funcionId requerido');
  if (!name) throw new Error('nombre requerido');

  initAdmin();
  const db = admin.firestore();

  const nowIso = new Date().toISOString();
  const docId = buildFuncionDocId(fid, name);

  const ref = db.collection('funciones').doc(docId);
  const existing = await ref.get();
  const createdAt = existing.exists && existing.data() && existing.data().createdAt ? String(existing.data().createdAt) : nowIso;

  const payload = {
    type: 'general',
    ownerId: owner,
    funcionId: fid,
    nombre: name,
    descripcion: descripcion ? String(descripcion).trim() : '',
    createdAt,
    updatedAt: nowIso,
  };

  await ref.set(payload, { merge: true });
  return { docId, ...payload };
}

const NOMBRES_BASE = [
  'Ventas',
  'Inventario',
  'Facturacion',
  'Reportes',
  'Clientes',
  'Proveedores',
  'Compras',
  'Produccion',
  'Logistica',
  'Contabilidad',
  'RecursosHumanos',
  'Auditoria',
  'Seguridad',
  'Marketing',
  'Analisis',
];

const DESCRIPCIONES = [
  'Gestion principal del modulo',
  'Control y monitoreo',
  'Administracion avanzada',
  'Operacion automatica',
  'Configuracion del sistema',
  'Seguimiento y trazabilidad',
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generarNombreRandom(index) {
  const base = randomItem(NOMBRES_BASE);
  const sufijo = Math.floor(Math.random() * 999);
  return `${base}_${sufijo}_${index}`;
}

async function seedFuncionesRandom(ownerId) {
  if (!ownerId) throw new Error('ownerId requerido');

  console.log('🔥 Generando funciones random...');

  for (let i = 0; i < 25; i++) {
    const funcionId = await getNextNumericFuncionId({ ownerId, padLength: 4 });

    const nombre = generarNombreRandom(i + 1);
    const descripcion = randomItem(DESCRIPCIONES);

    await upsertFuncionGeneral({ ownerId, funcionId, nombre, descripcion });

    console.log(`✅ Creada funcion ${funcionId} - ${nombre}`);
  }

  console.log('🎉 Listo. Tus 25 funciones ya existen.');
}

module.exports = { seedFuncionesRandom };

// CLI usage: node .\aaa.js <ownerId>
if (require.main === module) {
  const ownerId = process.argv[2] || process.env.OWNER_ID;
  seedFuncionesRandom(ownerId).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}