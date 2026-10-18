import { beforeAll, describe, expect, it } from "vitest";

type FirestoreEndpoint = {
  __endpoint?: {
    eventTrigger?: {
      eventFilters?: { database?: string };
      eventFilterPathPatterns?: { document?: string };
    };
  };
};

type FunctionsModule = Record<string, FirestoreEndpoint>;

const DEFAULT_DATABASE = "(default)";

const productionMovementTriggers = {
  onMovementWrite: "MovimientosFondos/{docId}/movements/{movementId}",
  onMovementWriteLegacyPath: "MovimientosFondos/{docId}/Movements/{movementId}",
  onTucanMovementWrite: "MovimientosFondos/{docId}/tucan/{movementId}",
  onTiemposMovementWrite: "MovimientosFondos/{docId}/tiempos/{movementId}",
} as const;

const restorationMovementTriggers = {
  onMovementWriteRestauracion: "MovimientosFondos/{docId}/movements/{movementId}",
  onMovementWriteLegacyPathRestauracion: "MovimientosFondos/{docId}/Movements/{movementId}",
  onTucanMovementWriteRestauracion: "MovimientosFondos/{docId}/tucan/{movementId}",
  onTiemposMovementWriteRestauracion: "MovimientosFondos/{docId}/tiempos/{movementId}",
} as const;

describe("Cloud Functions despues del cambio de base", () => {
  let functionsModule: FunctionsModule;

  beforeAll(async () => {
    functionsModule = (await import("../../functions/index.js")) as FunctionsModule;
  });

  it.each(Object.entries(productionMovementTriggers))(
    "%s escucha su ruta productiva en (default)",
    (exportName, expectedDocument) => {
      const endpoint = functionsModule[exportName]?.__endpoint?.eventTrigger;

      expect(endpoint, `${exportName} debe ser un trigger Firestore v2`).toBeDefined();
      expect(endpoint?.eventFilters?.database).toBe(DEFAULT_DATABASE);
      expect(endpoint?.eventFilterPathPatterns?.document).toBe(expectedDocument);
    },
  );

  it.each(Object.entries(restorationMovementTriggers))(
    "%s conserva su ruta de rollback en restauracion",
    (exportName, expectedDocument) => {
      const endpoint = functionsModule[exportName]?.__endpoint?.eventTrigger;

      expect(endpoint, `${exportName} debe ser un trigger Firestore v2`).toBeDefined();
      expect(endpoint?.eventFilters?.database).toBe("restauracion");
      expect(endpoint?.eventFilterPathPatterns?.document).toBe(expectedDocument);
    },
  );

  it("conserva trigger de correo en default", () => {
    const endpoint = functionsModule.sendEmailTrigger?.__endpoint?.eventTrigger;

    expect(endpoint?.eventFilters?.database).toBe(DEFAULT_DATABASE);
    expect(endpoint?.eventFilterPathPatterns?.document).toBe("mail/{emailId}");
  });
});
