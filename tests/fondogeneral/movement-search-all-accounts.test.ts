import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { MovementAccountKey } from "@/services/movimientos-fondos";
import {
  shouldApplyAutomaticMovementRange,
  shouldShowMovementSearchButton,
  shouldUseServerMovementFiltering,
} from "@/app/fondogeneral/utils/v2movements";

const ACCOUNT_KEYS: MovementAccountKey[] = [
  "FondoGeneral",
  "BCR",
  "BN",
  "BAC",
  "CajaNegra",
  "Tucan",
  "Tiempos",
];

describe("búsqueda de movimientos en cada cuenta", () => {
  it.each(ACCOUNT_KEYS)(
    "muestra Buscar y permite aplicar el rango en %s",
    (accountKey) => {
      expect(shouldUseServerMovementFiltering(accountKey)).toBe(true);

      expect(
        shouldApplyAutomaticMovementRange({
          accountKey,
          hasFirestoreFilterDraft: true,
        }),
      ).toBe(true);

      expect(
        shouldShowMovementSearchButton({
          accountKey,
          entriesHydrated: true,
          fromFilter: "2026-10-01",
          toFilter: "2026-10-18",
          quickRange: null,
          hasFirestoreFilterDraft: false,
        }),
      ).toBe(true);
    },
  );

  it.each(["cajanegra", "tucan", "tiempos"])(
    "declara índices para todos los filtros remotos de %s",
    (collectionGroup) => {
      const config = JSON.parse(
        readFileSync("firestore.indexes.json", "utf8"),
      ) as {
        indexes: Array<{
          collectionGroup: string;
          fields: Array<{ fieldPath: string }>;
        }>;
      };
      const signatures = config.indexes
        .filter((index) => index.collectionGroup === collectionGroup)
        .map((index) => index.fields.map((field) => field.fieldPath).join(","));

      expect(signatures).toEqual(
        expect.arrayContaining([
          "providerCode,createdAt",
          "paymentType,createdAt",
          "invoiceNumber,createdAt",
          "providerCode,paymentType,createdAt",
          "providerCode,invoiceNumber,createdAt",
          "paymentType,invoiceNumber,createdAt",
          "providerCode,paymentType,invoiceNumber,createdAt",
        ]),
      );
    },
  );
});
