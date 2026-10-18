import { describe, expect, it } from "vitest";

import {
  compareCompositeIndexes,
  inspectRequiredFunctions,
  normalizeRulesSource,
} from "../../scripts/lib/firestore-cutover-verifier.mjs";

describe("verificador live del cambio de base", () => {
  it("iguala indices locales con desplegados ignorando __name__ automatico", () => {
    const local = [
      {
        collectionGroup: "movements",
        queryScope: "COLLECTION",
        fields: [
          { fieldPath: "accountId", order: "ASCENDING" },
          { fieldPath: "createdAt", order: "DESCENDING" },
        ],
      },
    ];
    const deployed = [
      {
        name: "projects/demo/databases/(default)/collectionGroups/movements/indexes/abc",
        queryScope: "COLLECTION",
        state: "READY",
        fields: [
          { fieldPath: "accountId", order: "ASCENDING" },
          { fieldPath: "createdAt", order: "DESCENDING" },
          { fieldPath: "__name__", order: "DESCENDING" },
        ],
      },
    ];

    expect(compareCompositeIndexes(local, deployed)).toEqual({
      localCount: 1,
      deployedCount: 1,
      missing: [],
      unexpected: [],
      notReady: [],
    });
  });

  it("reporta indices faltantes, extra y no READY", () => {
    const local = [
      {
        collectionGroup: "movements",
        queryScope: "COLLECTION",
        fields: [
          { fieldPath: "accountId", order: "ASCENDING" },
          { fieldPath: "createdAt", order: "DESCENDING" },
        ],
      },
    ];
    const deployed = [
      {
        name: "projects/demo/databases/(default)/collectionGroups/other/indexes/abc",
        queryScope: "COLLECTION",
        state: "CREATING",
        fields: [
          { fieldPath: "status", order: "ASCENDING" },
          { fieldPath: "createdAt", order: "DESCENDING" },
          { fieldPath: "__name__", order: "DESCENDING" },
        ],
      },
    ];

    const result = compareCompositeIndexes(local, deployed);

    expect(result.missing).toHaveLength(1);
    expect(result.unexpected).toHaveLength(1);
    expect(result.notReady).toEqual([
      "other|COLLECTION|status:ASCENDING,createdAt:DESCENDING",
    ]);
  });

  it("valida estado, base y ruta de cada funcion requerida", () => {
    const deployed = [
      {
        name: "projects/demo/locations/us-central1/functions/onMovementWrite",
        state: "ACTIVE",
        eventTrigger: {
          eventFilters: [
            { attribute: "database", value: "(default)" },
            {
              attribute: "document",
              value: "MovimientosFondos/{docId}/movements/{movementId}",
            },
          ],
        },
      },
      {
        name: "projects/demo/locations/us-central1/functions/wrongDatabase",
        state: "ACTIVE",
        eventTrigger: {
          eventFilters: [
            { attribute: "database", value: "restauracion" },
            { attribute: "document", value: "mail/{emailId}" },
          ],
        },
      },
    ];
    const required = [
      {
        name: "onMovementWrite",
        database: "(default)",
        document: "MovimientosFondos/{docId}/movements/{movementId}",
      },
      {
        name: "wrongDatabase",
        database: "(default)",
        document: "mail/{emailId}",
      },
      {
        name: "missingFunction",
        database: "(default)",
        document: "missing/{id}",
      },
    ];

    expect(inspectRequiredFunctions(deployed, required)).toEqual({
      checked: 3,
      failures: [
        "wrongDatabase: database=restauracion; esperado=(default)",
        "missingFunction: no desplegada",
      ],
    });
  });

  it("normaliza saltos de linea y espacios finales al comparar reglas", () => {
    expect(normalizeRulesSource("allow read;  \r\n\r\n")).toBe("allow read;\n");
  });
});
