import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const servicePath = "src/services/pending-invoice-deletion-requests.ts";
assert.ok(fs.existsSync(path.join(root, servicePath)), "service file exists");

const service = read(servicePath);
[
  "PendingInvoiceDeletionRequestsService",
  "requestDeletion",
  "approveDeletion",
  "rejectDeletion",
  "getPendingDeletionRequestsByCompany",
  "getAnsweredDeletionRequestsByRequester",
  "markResponseSeen",
  "isPendingForDeletion",
  'const COLLECTION_NAME = "pendingInvoiceDeletionRequests"',
  'const RESPONSE_COLLECTION_NAME = "invoiceDeletionRequestResponses"',
  "tx.delete(invoiceRef)",
  "tx.delete(ref)",
  "tx.set(responseRef",
  "return id;",
].forEach((needle) => {
  assert.ok(service.includes(needle), `service contains ${needle}`);
});

const header = read("src/components/layout/Header.tsx");
assert.ok(
  header.includes('"pendingInvoiceDeletionRequests"') &&
    header.includes('"invoiceDeletionRequestResponses"'),
  "Header listens for pending invoice deletion requests and responses",
);

const modal = read("src/components/modals/NotificationModal.tsx");
[
  "PendingInvoiceDeletionRequestsService",
  "Eliminacion solicitada",
  "Eliminar / confirmar",
  "Solicitud de eliminacion realizada",
].forEach((needle) => {
  assert.ok(modal.includes(needle), `NotificationModal contains ${needle}`);
});

const facturas = read("src/app/fondogeneral/facturas/FacturasPage.tsx");
[
  "PendingInvoiceDeletionRequestsService",
  "Solicitar eliminacion",
  "Eliminacion solicitada",
  "Motivo de eliminacion",
  "deletionRequestTarget",
  "pendingDeletionRequestIds",
  "handleRequestInvoiceDeletion",
].forEach((needle) => {
  assert.ok(facturas.includes(needle), `FacturasPage contains ${needle}`);
});

const rules = read("firestore.rules");
assert.ok(
  rules.includes("pendingInvoiceDeletionRequests"),
  "rules cover pendingInvoiceDeletionRequests",
);
assert.ok(
  rules.includes("invoiceDeletionRequestResponses"),
  "rules cover invoiceDeletionRequestResponses",
);
assert.ok(
  rules.includes("collection != 'pendingInvoiceDeletionRequests'"),
  "catch-all excludes deletion requests",
);
assert.ok(rules.includes("collection != 'Facturas'"), "catch-all excludes Facturas");
assert.ok(
  rules.includes("match /Facturas/{empresaId}/movements/{movementId}"),
  "rules explicitly protect Facturas movements",
);
assert.ok(
  rules.includes("allow delete: if isAdmin();"),
  "rules restrict destructive deletes to admin",
);
assert.ok(
  rules.includes("resource.data.requestedBy == request.auth.token.email"),
  "response seen is limited to requester email",
);
assert.ok(
  rules.includes("resource.data.requestedBy == request.auth.uid"),
  "response seen is limited to requester uid",
);
assert.ok(
  rules.includes("resource.data.status == 'rejected'") &&
    rules.includes("request.resource.data.status == 'pending'"),
  "rules allow resubmitting a rejected deletion request",
);

const indexes = JSON.parse(read("firestore.indexes.json"));
const indexSignatures = indexes.indexes.map((index) =>
  `${index.collectionGroup}:${index.fields
    .map((field) => `${field.fieldPath}:${field.order || field.arrayConfig}`)
    .join(",")}`,
);
[
  "pendingInvoiceDeletionRequests:companyKey:ASCENDING,status:ASCENDING,createdAt:DESCENDING",
  "pendingInvoiceDeletionRequests:status:ASCENDING,createdAt:DESCENDING",
  "invoiceDeletionRequestResponses:requestedBy:ASCENDING,status:ASCENDING,updatedAt:DESCENDING",
].forEach((signature) => {
  assert.ok(indexSignatures.includes(signature), `index exists ${signature}`);
});

console.log("pending invoice deletion request checks passed");
