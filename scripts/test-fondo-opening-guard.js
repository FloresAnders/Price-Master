/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const vm = require("vm");

function loadOpeningRequirementModule(mockService, mockDailyClosingsService) {
  const filename = path.join(
    __dirname,
    "..",
    "src",
    "app",
    "fondogeneral",
    "utils",
    "fondo",
    "openingRequirement.ts",
  );
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const loadedModule = { exports: {} };
  vm.runInNewContext(
    compiled,
    {
      exports: loadedModule.exports,
      module: loadedModule,
      require(request) {
        if (request === "@/services/movimientos-fondos") {
          return { MovimientosFondosService: mockService };
        }
        if (request === "@/services/daily-closings") {
          return { DailyClosingsService: mockDailyClosingsService };
        }
        if (request === "../../constants") {
          return { APERTURA_FONDO_PROVIDER_CODE: "APERTURA DE FONDO" };
        }
        return require(request);
      },
    },
    { filename },
  );
  return loadedModule.exports;
}

const serviceCalls = [];
const mockService = {
  buildCompanyMovementsKey(company) {
    serviceCalls.push(["buildCompanyMovementsKey", company]);
    return `movements_${company}`;
  },
  async listMovementsPage(docId, options) {
    serviceCalls.push(["listMovementsPage", docId, options]);
    return {
      items: [
        {
          id: "cierre-1",
          accountId: "FondoGeneral",
          requiresOpening: true,
        },
      ],
    };
  },
};

const mockDailyClosingsService = {
  extractAllClosings(document) {
    return document.closings;
  },
  async getDocument(company) {
    serviceCalls.push(["getDailyClosingDocument", company]);
    return {
      company,
      updatedAt: "2026-07-21T01:35:00.000Z",
      closings: [
        {
          id: "closing-1",
          createdAt: "2026-07-21T01:34:48.948Z",
          closingDate: "2026-07-21T01:34:48.948Z",
        },
      ],
    };
  },
};

const {
  validateFondoGeneralOpeningRequirement,
  isOpeningRequiredForLatestMovement,
  isOpeningRequiredInRecentMovements,
  isOpeningRequiredAfterLatestClosing,
} = loadOpeningRequirementModule(mockService, mockDailyClosingsService);

assert.strictEqual(
  isOpeningRequiredForLatestMovement(
    { accountId: "FondoGeneral", requiresOpening: true },
    true,
  ),
  true,
  "FondoGeneral marker with requiresOpening=true must block",
);

assert.strictEqual(
  isOpeningRequiredForLatestMovement(
    { accountId: "BCR", requiresOpening: true },
    true,
  ),
  false,
  "Other accounts must not block FondoGeneral opening",
);

assert.strictEqual(
  isOpeningRequiredForLatestMovement(
    { accountId: "FondoGeneral", requiresOpening: true },
    false,
  ),
  false,
  "Empresa with solicitarApertura=false must not block",
);

assert.strictEqual(
  isOpeningRequiredInRecentMovements(
    [
      {
        id: "fcr-pago-1",
        accountId: "FondoGeneral",
        providerCode: "0015",
      },
      {
        id: "cierre-1",
        accountId: "FondoGeneral",
        providerCode: "CIERRE DE FONDO GENERAL",
        requiresOpening: true,
      },
    ],
    true,
  ),
  true,
  "A normal movement after a closing marker must not clear required opening",
);

assert.strictEqual(
  isOpeningRequiredInRecentMovements(
    [
      {
        id: "apertura-1",
        accountId: "FondoGeneral",
        providerCode: "APERTURA DE FONDO",
        requiresOpening: false,
      },
      {
        id: "cierre-1",
        accountId: "FondoGeneral",
        providerCode: "CIERRE DE FONDO GENERAL",
        requiresOpening: true,
      },
    ],
    true,
  ),
  false,
  "Apertura de Fondo must clear required opening",
);

assert.strictEqual(
  isOpeningRequiredAfterLatestClosing(
    [
      {
        id: "normal-1",
        accountId: "FondoGeneral",
        providerCode: "0015",
        createdAt: "2026-07-21T14:56:40.908Z",
      },
    ],
    {
      id: "closing-1",
      createdAt: "2026-07-21T01:34:48.948Z",
    },
    true,
  ),
  true,
  "A daily closing without a movement marker must still require opening",
);

assert.strictEqual(
  isOpeningRequiredAfterLatestClosing(
    [
      {
        id: "apertura-1",
        accountId: "FondoGeneral",
        providerCode: "APERTURA DE FONDO",
        createdAt: "2026-07-21T14:56:40.908Z",
      },
    ],
    {
      id: "closing-1",
      createdAt: "2026-07-21T01:34:48.948Z",
    },
    true,
  ),
  false,
  "Apertura after the latest daily closing must clear the closing fallback",
);

(async () => {
  const blocked = await validateFondoGeneralOpeningRequirement({
    company: "PRUEBAS",
    accountKey: "FondoGeneral",
    solicitarApertura: true,
    loadLatestClosing: async () => null,
  });

  assert.deepStrictEqual(
    { allowed: blocked.allowed, reason: blocked.reason },
    { allowed: false, reason: "opening_required" },
    "FondoGeneral movement must be blocked when latest marker requires opening",
  );
  assert.deepStrictEqual(serviceCalls[0], [
    "buildCompanyMovementsKey",
    "PRUEBAS",
  ]);
  assert.deepStrictEqual(serviceCalls[1][0], "listMovementsPage");
  assert.strictEqual(serviceCalls[1][2].pageSize, 100);
  assert.strictEqual(serviceCalls[1][2].accountId, "FondoGeneral");

  const blockedByClosingFallback =
    await validateFondoGeneralOpeningRequirement({
      company: "PRUEBAS",
      accountKey: "FondoGeneral",
      solicitarApertura: true,
      loadLatestClosing: async () => ({
        id: "closing-1",
        createdAt: "2026-07-21T01:34:48.948Z",
      }),
      loadMovementsAfterLatestClosing: async () => [],
    });
  assert.deepStrictEqual(
    {
      allowed: blockedByClosingFallback.allowed,
      reason: blockedByClosingFallback.reason,
    },
    { allowed: false, reason: "opening_required" },
    "Daily closing fallback must block when no Apertura exists after closing",
  );

  let loadCalled = false;
  const allowedOtherAccount = await validateFondoGeneralOpeningRequirement({
    company: "PRUEBAS",
    accountKey: "BCR",
    solicitarApertura: true,
    loadLatestMovement: async () => {
      loadCalled = true;
      return null;
    },
  });
  assert.strictEqual(allowedOtherAccount.allowed, true);
  assert.strictEqual(loadCalled, false, "Other accounts must skip remote load");

  const failedValidation = await validateFondoGeneralOpeningRequirement({
    company: "PRUEBAS",
    accountKey: "FondoGeneral",
    solicitarApertura: true,
    loadLatestClosing: async () => null,
    loadLatestMovement: async () => {
      throw new Error("offline");
    },
  });
  assert.deepStrictEqual(
    { allowed: failedValidation.allowed, reason: failedValidation.reason },
    { allowed: false, reason: "validation_failed" },
    "Validation errors must fail closed",
  );

  console.log("fondo opening guard tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
