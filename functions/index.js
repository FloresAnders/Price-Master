import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';

// Definir secretos
const gmailUser = defineSecret("GMAIL_USER");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

// Inicializar Firebase Admin
admin.initializeApp();

// Obtener referencia a la base de datos 'restauracion'
const getDb = () => admin.firestore().databaseId === 'restauracion' 
  ? admin.firestore() 
  : admin.app().firestore('restauracion');

const REPORTS_COLLECTION = 'reportes_movimientos';
const REPORTS_DETAIL_COLLECTION = 'reportes_detalle';
const MOVEMENT_TYPES_COLLECTION = 'fondoMovementTypes';

/**
 * Cache in-memory de la categoría de cada paymentType para clasificar en ingreso/gasto/egreso.
 * Minimiza reads: se carga una vez por instancia (cold start) y se reutiliza.
 */
let movementTypeCategoryCache = {
  loadedAtMs: 0,
  map: new Map(),
};

const CATEGORY_TTL_MS = 10 * 60 * 1000; // 10 min (balancea frescura vs reads)

const normalizeCurrency = (value) => (value === 'USD' ? 'USD' : 'CRC');

const parseLocalDateFromMovementId = (movementId, createdAtFallback) => {
  const raw = String(movementId || '');
  const head = raw.split('-')[0] || ''; // YYYY_MM_DD
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

const resolveEmpresaFromLedger = async (docId) => {
  if (!docId) return '';
  const snap = await getDb().collection('MovimientosFondos').doc(String(docId)).get();
  const company = String(snap.get('company') || '').trim();
  return company || String(docId);
};

const ensureMovementTypeCategoryCache = async () => {
  const now = Date.now();
  if (movementTypeCategoryCache.map.size > 0 && now - movementTypeCategoryCache.loadedAtMs < CATEGORY_TTL_MS) {
    return;
  }

  try {
    const snap = await getDb().collection(MOVEMENT_TYPES_COLLECTION).get();
    const next = new Map();
    snap.forEach((doc) => {
      const id = String(doc.id || '').trim();
      const name = String(doc.get('name') || '').trim();
      const idKey = id.toUpperCase();
      const nameKey = name.toUpperCase();
      const cat = String(doc.get('category') || '').toUpperCase().trim();
      if (cat === 'INGRESO' || cat === 'GASTO' || cat === 'EGRESO') {
        if (idKey) next.set(idKey, cat);
        if (nameKey) next.set(nameKey, cat);
      }
    });
    movementTypeCategoryCache = { loadedAtMs: now, map: next };
  } catch (err) {
    console.error('[onMovementWrite] Error loading fondoMovementTypes cache:', err);
    movementTypeCategoryCache = { loadedAtMs: now, map: new Map() };
  }
};

const resolveCategory = (paymentType, amountIngreso, amountEgreso) => {
  const key = String(paymentType || '').trim().toUpperCase();
  const cached = key ? movementTypeCategoryCache.map.get(key) : null;
  if (cached === 'INGRESO' || cached === 'GASTO' || cached === 'EGRESO') return cached;

  // Fallback si no hay configuración: inferir por montos.
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

/**
 * OLAP Trigger: materializa reportes por día/empresa/cuenta
 * - Agregado en: /reportes_movimientos/{date}_{empresa}_{accountId}
 * - Detalle en: /reportes_detalle/{reporteId}/items/{movementId}
 *
 * Diseñado para minimizar reads:
 * - No lee el documento agregado en cada write (usa increment)
 * - Cachea categorías de tipos de movimiento
 * - Usa "empresa" desde el movimiento si viene; si no, lee el ledger 1 vez (fallback)
 */
export const onMovementWrite = onDocumentWritten(
  {
    document: 'MovimientosFondos/{docId}/movements/{movementId}',
    database: 'restauracion',
  },
  async (event) => {
    const docId = safeDocIdPart(event.params.docId);
    const movementId = safeDocIdPart(event.params.movementId);

    const before = event.data?.before?.data() ?? null;
    const after = event.data?.after?.data() ?? null;

    if (!before && !after) return;

    await ensureMovementTypeCategoryCache();

    const refData = after ?? before;
    const createdAt = String(refData?.createdAt || '').trim();
    const { date, year, month } = parseLocalDateFromMovementId(movementId, createdAt);

    const accountId = safeDocIdPart(refData?.accountId) || 'FondoGeneral';
    const currency = normalizeCurrency(refData?.currency);
    const paymentType = safeDocIdPart(refData?.paymentType) || '(Sin tipo)';

    // Preferir empresa embebida en el movimiento (cero reads extra). Fallback a leer ledger.
    let empresa = safeDocIdPart(refData?.empresa);
    if (!empresa) {
      try {
        empresa = await resolveEmpresaFromLedger(docId);
      } catch (err) {
        console.error('[onMovementWrite] Error resolving empresa from ledger:', err);
        empresa = docId;
      }
    }

    const reporteId = `${date}_${empresa}_${accountId}`;
    const aggRef = getDb().collection(REPORTS_COLLECTION).doc(reporteId);
    const detailRef = getDb()
      .collection(REPORTS_DETAIL_COLLECTION)
      .doc(reporteId)
      .collection('items')
      .doc(movementId);

    const amountIngresoAfter = Math.trunc(Number(after?.amountIngreso ?? 0)) || 0;
    const amountEgresoAfter = Math.trunc(Number(after?.amountEgreso ?? 0)) || 0;
    const amountIngresoBefore = Math.trunc(Number(before?.amountIngreso ?? 0)) || 0;
    const amountEgresoBefore = Math.trunc(Number(before?.amountEgreso ?? 0)) || 0;

    const catAfter = after
      ? resolveCategory(paymentType, amountIngresoAfter, amountEgresoAfter)
      : null;
    const catBefore = before
      ? resolveCategory(before?.paymentType, amountIngresoBefore, amountEgresoBefore)
      : null;

    const classificationAfter = catAfter ? categoryToClassification(catAfter) : null;
    const classificationBefore = catBefore ? categoryToClassification(catBefore) : null;

    const inc = admin.firestore.FieldValue.increment;
    const serverTs = admin.firestore.FieldValue.serverTimestamp;

    const baseAgg = {
      date,
      year,
      month,
      empresa,
      accountId,
      updatedAt: serverTs(),
    };

    const deltaUpdate = {};

    // Helper para escribir increments en nested map byType.
    const setByTypeDelta = (obj, typeKey, curKey, deltaCount, deltaIngreso, deltaGasto, deltaEgreso) => {
      const fieldCount = new admin.firestore.FieldPath('byType', typeKey, curKey, 'count');
      const fieldIngreso = new admin.firestore.FieldPath('byType', typeKey, curKey, 'ingreso');
      const fieldGasto = new admin.firestore.FieldPath('byType', typeKey, curKey, 'gasto');
      const fieldEgreso = new admin.firestore.FieldPath('byType', typeKey, curKey, 'egreso');
      obj[fieldCount] = inc(deltaCount);
      obj[fieldIngreso] = inc(deltaIngreso);
      obj[fieldGasto] = inc(deltaGasto);
      obj[fieldEgreso] = inc(deltaEgreso);
    };

    const applyTotalsDelta = (obj, deltaIngreso, deltaGasto, deltaEgreso) => {
      obj.totalIngreso = inc(deltaIngreso);
      obj.totalGasto = inc(deltaGasto);
      obj.totalEgreso = inc(deltaEgreso);
    };

    const deltaFromCategory = (category, amountIngreso, amountEgreso) => {
      if (category === 'INGRESO') return { ingreso: amountIngreso, gasto: 0, egreso: 0 };
      if (category === 'GASTO') return { ingreso: 0, gasto: amountEgreso, egreso: 0 };
      return { ingreso: 0, gasto: 0, egreso: amountEgreso };
    };

    const promises = [];

    // DELETE
    if (!after && before) {
      const curBefore = normalizeCurrency(before?.currency);
      const typeBefore = safeDocIdPart(before?.paymentType) || '(Sin tipo)';
      const d = deltaFromCategory(catBefore, amountIngresoBefore, amountEgresoBefore);

      deltaUpdate.count = inc(-1);
      applyTotalsDelta(deltaUpdate, -d.ingreso, -d.gasto, -d.egreso);
      setByTypeDelta(deltaUpdate, typeBefore, curBefore, -1, -d.ingreso, -d.gasto, -d.egreso);

      await aggRef.set(baseAgg, { merge: true });
      await aggRef.update(deltaUpdate);
      await detailRef.delete().catch(() => null);
      return;
    }

    // CREATE / UPDATE
    if (!after) return;

    const isCreate = !before;
    if (isCreate) {
      deltaUpdate.count = inc(1);
      // lastMovementAt: set only on create to avoid extra reads
      if (createdAt) deltaUpdate.lastMovementAt = createdAt;
    }

    const dAfter = deltaFromCategory(catAfter, amountIngresoAfter, amountEgresoAfter);
    const dBefore = before ? deltaFromCategory(catBefore, amountIngresoBefore, amountEgresoBefore) : { ingreso: 0, gasto: 0, egreso: 0 };

    const deltaIngreso = dAfter.ingreso - dBefore.ingreso;
    const deltaGasto = dAfter.gasto - dBefore.gasto;
    const deltaEgreso = dAfter.egreso - dBefore.egreso;
    applyTotalsDelta(deltaUpdate, deltaIngreso, deltaGasto, deltaEgreso);

    // byType breakdown: handle bucket change on update
    const typeAfter = paymentType;
    const curAfter = currency;

    if (isCreate) {
      setByTypeDelta(deltaUpdate, typeAfter, curAfter, 1, dAfter.ingreso, dAfter.gasto, dAfter.egreso);
    } else {
      const typeBefore = safeDocIdPart(before?.paymentType) || '(Sin tipo)';
      const curBefore = normalizeCurrency(before?.currency);

      const bucketChanged = typeBefore !== typeAfter || curBefore !== curAfter;
      if (bucketChanged) {
        // remove from old bucket
        setByTypeDelta(deltaUpdate, typeBefore, curBefore, -1, -dBefore.ingreso, -dBefore.gasto, -dBefore.egreso);
        // add to new bucket
        setByTypeDelta(deltaUpdate, typeAfter, curAfter, 1, dAfter.ingreso, dAfter.gasto, dAfter.egreso);
      } else {
        // same bucket: count stays, only amounts delta
        setByTypeDelta(deltaUpdate, typeAfter, curAfter, 0, deltaIngreso, deltaGasto, deltaEgreso);
      }
    }

    await aggRef.set(baseAgg, { merge: true });
    await aggRef.update(deltaUpdate);

    // Detalle (para modal) - siempre upsert
    promises.push(
      detailRef.set(
        {
          movementId,
          empresa,
          createdAt: createdAt || '',
          accountId,
          manager: String(after?.manager || ''),
          paymentType: typeAfter,
          classification: classificationAfter || 'egreso',
          amountIngreso: amountIngresoAfter,
          amountEgreso: amountEgresoAfter,
          currency: curAfter,
          invoiceNumber: String(after?.invoiceNumber || ''),
          providerCode: String(after?.providerCode || ''),
          notes: String(after?.notes || ''),
        },
        { merge: true }
      )
    );

    await Promise.all(promises);
  }
);

/**
 * Cloud Function que se dispara cuando se crea un documento en la colección 'mail'
 * Procesa y envía el email usando nodemailer
 */
export const sendEmailTrigger = onDocumentCreated(
  {
    document: "mail/{emailId}",
    database: "restauracion",
    secrets: [gmailUser, gmailAppPassword],
  },
  async (event) => {
  const emailData = event.data.data();
  const emailId = event.params.emailId;

  console.log(`📧 Processing email ${emailId}:`, {
    to: emailData.to,
    subject: emailData.subject,
  });

  try {
    // Validar datos requeridos
    if (!emailData.to || !emailData.subject) {
      throw new Error("Missing required email fields: to, subject");
    }

    // Configurar transporter de nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser.value(),
        pass: gmailAppPassword.value(),
      },
      pool: true,
      maxConnections: 1,
      rateDelta: 20000,
      rateLimit: 5,
    });

    // Preparar opciones del email
    const mailOptions = {
      from: {
        name: "Time Master System",
        address: gmailUser.value() || "",
      },
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text || "",
      html: emailData.html || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #333; margin-bottom: 20px;">Time Master System</h2>
            <div style="background-color: white; padding: 20px; border-radius: 6px; border-left: 4px solid #007bff;">
              ${(emailData.text || "").replace(/\n/g, "<br>")}
            </div>
            <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 6px;">
              <p style="margin: 0; font-size: 12px; color: #6c757d;">
                Este correo fue enviado desde el sistema Time Master. 
                Si no esperabas recibir este mensaje, por favor ignóralo.
              </p>
            </div>
          </div>
        </div>
      `,
      attachments: emailData.attachments || [],
      headers: {
        "X-Priority": "3",
        "X-MSMail-Priority": "Normal",
        "Importance": "Normal",
        "X-Mailer": "Time Master System",
        "Reply-To": gmailUser.value() || "",
      },
      messageId: `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@pricemaster.local>`,
      date: new Date(),
    };

    // Enviar email
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully:", info.messageId);

    // Actualizar documento en Firestore con el estado
    await getDb().collection("mail").doc(emailId).update({
      status: "sent",
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      messageId: info.messageId,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending email:", error);

    // Actualizar documento con el error
    await getDb().collection("mail").doc(emailId).update({
      status: "failed",
      error: error.message,
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // No lanzar error para evitar reintentos automáticos infinitos
    // Firebase Functions reintenta automáticamente en caso de error
    return { success: false, error: error.message };
  }
});

/**
 * Función auxiliar para verificar la configuración del sistema de emails
 * Puede ser llamada manualmente para diagnóstico
 */
export const checkEmailConfig = onRequest(
  { secrets: [gmailUser, gmailAppPassword] },
  async (req, res) => {
    const hasGmailUser = !!gmailUser.value();
    const hasGmailPassword = !!gmailAppPassword.value();

    res.json({
      configured: hasGmailUser && hasGmailPassword,
      gmailUser: hasGmailUser ? gmailUser.value() : "NOT_SET",
      gmailPassword: hasGmailPassword ? "SET" : "NOT_SET",
      timestamp: new Date().toISOString(),
    });
  }
);

/**
 * Función de prueba para enviar un email de prueba
 * Uso: POST /testEmail con body { "to": "email@example.com" }
 */
export const testEmail = onRequest(
  { secrets: [gmailUser, gmailAppPassword] },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ error: "Missing 'to' email address in request body" });
    }

    try {
      // Crear documento de email de prueba en Firestore
      const emailData = {
        to: to,
        subject: "🧪 Email de Prueba - Time Master",
        text: "Este es un email de prueba para verificar que el sistema de correos funciona correctamente.",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending",
      };

      const docRef = await getDb().collection("mail").add(emailData);

      res.json({
        success: true,
        message: "Email de prueba encolado",
        emailId: docRef.id,
        note: "El trigger sendEmailTrigger debería procesarlo automáticamente",
      });
    } catch (error) {
      console.error("Error creating test email:", error);
      res.status(500).json({ error: error.message });
    }
  }
);
