import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");

const solicitudesService = read("src/services/solicitudes.ts");
const header = read("src/components/layout/Header.tsx");
const modal = read("src/components/modals/NotificationModal.tsx");
const indexes = read("firestore.indexes.json");

assert.match(
  solicitudesService,
  /normalizeSolicitudEmpresaKey/,
  "SolicitudesService debe exponer normalizacion propia de empresa.",
);

assert.match(
  solicitudesService,
  /getPendingSolicitudesByEmpresa/,
  "SolicitudesService debe exponer query compartida de pendientes por empresa.",
);

assert.match(
  header,
  /SolicitudesService\.subscribePendingSolicitudesByEmpresa/,
  "Header debe usar el listener compartido de solicitudes pendientes.",
);

assert.doesNotMatch(
  header,
  /collection\(db,\s*["']solicitudes["']\)/,
  "Header no debe consultar solicitudes crudas; evita divergencia con modal.",
);

assert.match(
  modal,
  /SolicitudesService\.getPendingSolicitudesByEmpresa/,
  "NotificationModal debe usar el mismo query de solicitudes pendientes.",
);

assert.match(
  header,
  /onSolicitudesSeen=\{handleSolicitudesSeen\}/,
  "Modal debe poder limpiar solo alerta de solicitudes.",
);

assert.match(
  header,
  /onClosingExtensionsSeen=\{handleClosingExtensionsSeen\}/,
  "Modal debe poder limpiar solo alerta FV.",
);

assert.match(
  header,
  /seenSolicitudesRef/,
  "Header debe recordar solicitudes vistas para no reactivar el punto al abrir modal.",
);

assert.match(
  solicitudesService,
  /initializedSources\.size < expectedSources\.size/,
  "Listener compartido debe esperar snapshots iniciales antes de emitir.",
);

assert.match(
  indexes,
  /"collectionGroup": "solicitudes"[\s\S]*"fieldPath": "empresaKey"[\s\S]*"fieldPath": "createdAt"/,
  "Firestore indexes debe incluir solicitudes por empresaKey + createdAt.",
);

console.log("notification solicitudes separation OK");
