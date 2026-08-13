import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProvisionedDevice,
  createDeviceToken,
} from "./provision-gente-crystal-device.mjs";

const now = new Date("2026-08-13T02:15:00.000Z");

test("buildProvisionedDevice stores only the token hash", () => {
  const result = buildProvisionedDevice({
    companyId: "company-palmares",
    deviceId: "palmares-01",
    deviceName: "PALMARES-PC-01",
    token: "tm_gc_test_secret",
    now,
  });

  assert.equal(result.token, "tm_gc_test_secret");
  assert.equal(
    result.tokenHash,
    "6df67f36d87393770b857f9800285e14a5db7eee4883d336c8f0abafd18e5e63",
  );
  assert.equal(
    result.documentPath,
    "genteCrystalIntegrationDevices/6df67f36d87393770b857f9800285e14a5db7eee4883d336c8f0abafd18e5e63",
  );
  assert.equal("token" in result.document, false);
  assert.deepEqual(result.document, {
    companyId: "company-palmares",
    deviceId: "palmares-01",
    deviceName: "PALMARES-PC-01",
    permissions: ["gentecrystal.sales.write"],
    createdAt: now,
  });
});

test("provisioning rejects unsafe document segments", () => {
  assert.throws(
    () =>
      buildProvisionedDevice({
        companyId: "companies/palmares",
        deviceId: "palmares-01",
        deviceName: "PALMARES-PC-01",
        token: "tm_gc_test_secret",
        now,
      }),
    /companyId/,
  );
  assert.throws(
    () =>
      buildProvisionedDevice({
        companyId: "company-palmares",
        deviceId: " ",
        deviceName: "PALMARES-PC-01",
        token: "tm_gc_test_secret",
        now,
      }),
    /deviceId/,
  );
});

test("provisioning validates the display name and token prefix", () => {
  assert.throws(
    () =>
      buildProvisionedDevice({
        companyId: "company-palmares",
        deviceId: "palmares-01",
        deviceName: " ",
        token: "tm_gc_test_secret",
        now,
      }),
    /deviceName/,
  );
  assert.throws(
    () =>
      buildProvisionedDevice({
        companyId: "company-palmares",
        deviceId: "palmares-01",
        deviceName: "PALMARES-PC-01",
        token: "shared-secret",
        now,
      }),
    /token/,
  );
});

test("generated device tokens use the integration prefix", () => {
  const token = createDeviceToken();
  assert.match(token, /^tm_gc_[a-f0-9]{64}$/);
});
