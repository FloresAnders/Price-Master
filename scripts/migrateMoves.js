/* eslint-disable no-console */
const admin = require("firebase-admin");
const path = require("path");

const REPORTS_COLLECTION = "reportes_movimientos";
const REPORTS_DETAIL_COLLECTION = "reportes_detalle";
const MOVEMENT_TYPES_COLLECTION = "fondoMovementTypes";

function parseArgs(argv) {
  const args = {
    apply: false,
    database: "restauracion", // "" => default DB
    ledgerCollection: "MovimientosFondos",
    reportsCollection: REPORTS_COLLECTION,
    detailCollection: REPORTS_DETAIL_COLLECTION,
    pageSizeLedgers: 2000,
    pageSizeMovements: 4000,
    serviceAccount: "../serviceAccountKey.json",
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--database") {
      args.database = String(argv[i + 1] || "").trim();
      i++;
      continue;
    }
    if (token === "--ledger-collection") {
      args.ledgerCollection = String(argv[i + 1] || "").trim() || args.ledgerCollection;
      i++;
      continue;
    }
    if (token === "--reports-collection") {
      args.reportsCollection = String(argv[i + 1] || "").trim() || args.reportsCollection;
      i++;
      continue;
    }
    if (token === "--detail-collection") {
      args.detailCollection = String(argv[i + 1] || "").trim() || args.detailCollection;
      i++;
      continue;
    }
    if (token === "--page-size-ledgers") {
      const n = Number(argv[i + 1]);
      i++;
      if (Number.isFinite(n) && n > 0 && n <= 500) args.pageSizeLedgers = Math.floor(n);
      continue;
    }
    if (token === "--page-size-movements") {
      const n = Number(argv[i + 1]);
      i++;
      if (Number.isFinite(n) && n > 0 && n <= 500) args.pageSizeMovements = Math.floor(n);
      continue;
    }
    if (token === "--service-account") {
      args.serviceAccount = String(argv[i + 1] || "").trim() || args.serviceAccount;
      i++;
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Uso:
  node scripts/backfill-reportes-movimientos.js [opciones]

Opciones:
  --apply                         Aplica cambios (si no, dry-run)
  --database <id>                 Base nombrada (ej: restauracion). Vacío = default
  --ledger-collection <name>      Default: MovimientosFondos
  --reports-collection <name>     Default: reportes_movimientos
  --detail-collection <name>      Default: reportes_detalle
  --page-size-ledgers <n>         Default: 200
  --page-size-movements <n>       Default: 400
  --service-account <path>        Default: ../serviceAccountKey.json
  -h, --help                      Ayuda

Ejemplos:
  node scripts/backfill-reportes-movimientos.js
  node scripts/backfill-reportes-movimientos.js --apply
  node scripts/backfill-reportes-movimientos.js --database restauracion --apply
`);
}

function getDb(databaseId) {
  if (!databaseId) return admin.firestore();
  return admin.app().firestore(databaseId);
}

function normalizeCurrency(value) {
  return value === "USD" ? "USD" : "CRC";
}

function safeString(value) {
  return String(value || "").trim();
}

function parseLocalDateFromMovementId(movementId, createdAtFallback) {
  const raw = String(movementId || "");
  const head = raw.split("-")[0] || ""; // YYYY_MM_DD
  const parts = head.split("_");

  if (parts.length === 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      const date = `${String(y)}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      return { date, year: y, month: m };
    }
  }

  const dt = createdAtFallback ? new Date(createdAtFallback) : new Date();
  const safe = Number.isNaN(dt.getTime()) ? new Date() : dt;
  const date = safe.toISOString().split("T")[0];
  return { date, year: safe.getFullYear(), month: safe.getMonth() + 1 };
}

function categoryToClassification(category) {
  if (category === "INGRESO") return "ingreso";
  if (category === "GASTO") return "gasto";
  return "egreso";
}

function deltaFromCategory(category, amountIngreso, amountEgreso) {
  if (category === "INGRESO") return { ingreso: amountIngreso, gasto: 0, egreso: 0 };
  if (category === "GASTO") return { ingreso: 0, gasto: amountEgreso, egreso: 0 };
  return { ingreso: 0, gasto: 0, egreso: amountEgreso };
}

async function loadMovementTypeCategories(db) {
  const map = new Map();
  const snap = await db.collection(MOVEMENT_TYPES_COLLECTION).get();
  snap.forEach((doc) => {
    const id = safeString(doc.id);
    if (!id) return;
    const cat = safeString(doc.get("category")).toUpperCase();
    if (cat === "INGRESO" || cat === "GASTO" || cat === "EGRESO") {
      map.set(id, cat);
    }
  });
  return map;
}

function resolveCategory(paymentType, amountIngreso, amountEgreso, categoriesMap) {
  const key = safeString(paymentType);
  const cached = key ? categoriesMap.get(key) : null;
  if (cached === "INGRESO" || cached === "GASTO" || cached === "EGRESO") return cached;

  const ingreso = Math.trunc(Number(amountIngreso ?? 0)) || 0;
  const egreso = Math.trunc(Number(amountEgreso ?? 0)) || 0;
  if (ingreso > 0) return "INGRESO";
  if (egreso > 0) return "EGRESO";
  return "EGRESO";
}

function ensureBucket(byType, paymentType, currency) {
  if (!byType[paymentType]) byType[paymentType] = {};
  if (!byType[paymentType][currency]) {
    byType[paymentType][currency] = { count: 0, ingreso: 0, gasto: 0, egreso: 0 };
  }
  return byType[paymentType][currency];
}

function parseDateMaybe(value) {
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) ? ms : 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const serviceAccountPath = path.resolve(__dirname, args.serviceAccount);
  const serviceAccount = require(serviceAccountPath);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const db = getDb(args.database);

  console.log("Configuracion:");
  console.log({
    apply: args.apply,
    database: args.database || "(default)",
    ledgerCollection: args.ledgerCollection,
    reportsCollection: args.reportsCollection,
    detailCollection: args.detailCollection,
    pageSizeLedgers: args.pageSizeLedgers,
    pageSizeMovements: args.pageSizeMovements,
  });

  console.log("Cargando categorias de paymentType...");
  const categoriesMap = await loadMovementTypeCategories(db);
  console.log(`Categorias cargadas: ${categoriesMap.size}`);

  const aggregateMap = new Map(); // reporteId => aggregate object
  const details = []; // array de { reporteId, movementId, data }

  let scannedLedgers = 0;
  let scannedMovements = 0;

  let lastLedgerDoc = null;
  while (true) {
    let q = db
      .collection(args.ledgerCollection)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(args.pageSizeLedgers);

    if (lastLedgerDoc) q = q.startAfter(lastLedgerDoc);

    const ledgersSnap = await q.get();
    if (ledgersSnap.empty) break;

    for (const ledgerDoc of ledgersSnap.docs) {
      scannedLedgers++;
      const ledgerId = ledgerDoc.id;
      const ledgerData = ledgerDoc.data() || {};
      const ledgerCompany = safeString(ledgerData.company) || ledgerId;

      let lastMovementDoc = null;
      while (true) {
        let mq = ledgerDoc.ref
          .collection("movements")
          .orderBy(admin.firestore.FieldPath.documentId())
          .limit(args.pageSizeMovements);

        if (lastMovementDoc) mq = mq.startAfter(lastMovementDoc);

        const movementsSnap = await mq.get();
        if (movementsSnap.empty) break;

        for (const movementDoc of movementsSnap.docs) {
          scannedMovements++;
          const movementId = movementDoc.id;
          const movement = movementDoc.data() || {};

          const createdAt = String(movement.createdAt || "").trim();
          const { date, year, month } = parseLocalDateFromMovementId(movementId, createdAt);

          const empresa = safeString(movement.empresa) || ledgerCompany || ledgerId;
          const accountId = safeString(movement.accountId) || "FondoGeneral";
          const paymentType = safeString(movement.paymentType) || "(Sin tipo)";
          const currency = normalizeCurrency(movement.currency);

          const amountIngreso = Math.trunc(Number(movement.amountIngreso ?? 0)) || 0;
          const amountEgreso = Math.trunc(Number(movement.amountEgreso ?? 0)) || 0;

          const category = resolveCategory(paymentType, amountIngreso, amountEgreso, categoriesMap);
          const classification = categoryToClassification(category);
          const delta = deltaFromCategory(category, amountIngreso, amountEgreso);

          const reporteId = `${date}_${empresa}_${accountId}`;
          let agg = aggregateMap.get(reporteId);
          if (!agg) {
            agg = {
              date,
              year,
              month,
              empresa,
              accountId,
              count: 0,
              totalIngreso: 0,
              totalGasto: 0,
              totalEgreso: 0,
              byType: {},
              lastMovementAt: "",
              _lastMovementAtMs: 0,
            };
            aggregateMap.set(reporteId, agg);
          }

          agg.count += 1;
          agg.totalIngreso += delta.ingreso;
          agg.totalGasto += delta.gasto;
          agg.totalEgreso += delta.egreso;

          const bucket = ensureBucket(agg.byType, paymentType, currency);
          bucket.count += 1;
          bucket.ingreso += delta.ingreso;
          bucket.gasto += delta.gasto;
          bucket.egreso += delta.egreso;

          const createdMs = parseDateMaybe(createdAt);
          if (createdAt && createdMs >= agg._lastMovementAtMs) {
            agg._lastMovementAtMs = createdMs;
            agg.lastMovementAt = createdAt;
          }

          details.push({
            reporteId,
            movementId,
            data: {
              movementId,
              empresa,
              createdAt: createdAt || "",
              accountId,
              manager: String(movement.manager || ""),
              paymentType,
              classification,
              amountIngreso,
              amountEgreso,
              currency,
              invoiceNumber: String(movement.invoiceNumber || ""),
              providerCode: String(movement.providerCode || ""),
              notes: String(movement.notes || ""),
            },
          });
        }

        lastMovementDoc = movementsSnap.docs[movementsSnap.docs.length - 1];
      }
      lastLedgerDoc = ledgerDoc;
    }

    console.log(
      `Progreso lectura -> ledgers: ${scannedLedgers}, movements: ${scannedMovements}, reportes: ${aggregateMap.size}`
    );
  }

  console.log("---");
  console.log("Resumen backfill:");
  console.log({
    scannedLedgers,
    scannedMovements,
    reportsToWrite: aggregateMap.size,
    detailItemsToWrite: details.length,
  });

  if (!args.apply) {
    console.log("Dry-run finalizado. Ejecuta con --apply para escribir.");
    return;
  }

  console.log("Escribiendo agregados y detalle...");
  const writer = db.bulkWriter();
  writer.onWriteError((error) => {
    console.error("BulkWriter error:", error.code, error.message);
    if (error.failedAttempts < 5) return true;
    return false;
  });

  const serverTs = admin.firestore.FieldValue.serverTimestamp();

  for (const [reporteId, agg] of aggregateMap.entries()) {
    const { _lastMovementAtMs, ...docData } = agg;
    const payload = {
      ...docData,
      updatedAt: serverTs,
    };

    const reportRef = db.collection(args.reportsCollection).doc(reporteId);
    writer.set(reportRef, payload, { merge: false });
  }

  for (const item of details) {
    const detailRef = db
      .collection(args.detailCollection)
      .doc(item.reporteId)
      .collection("items")
      .doc(item.movementId);

    writer.set(detailRef, item.data, { merge: true });
  }

  await writer.close();

  console.log("Backfill completado ✅");
  console.log({
    reportsWritten: aggregateMap.size,
    detailsWritten: details.length,
  });
}

main().catch((err) => {
  console.error("Error en backfill:", err);
  process.exit(1);
});