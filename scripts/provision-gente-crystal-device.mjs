import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const WRITE_PERMISSION = "gentecrystal.sales.write";

function readSegment(value, field) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 160 || normalized.includes("/")) {
    throw new Error(`${field} must be a non-empty Firestore document segment.`);
  }
  return normalized;
}

export function createDeviceToken() {
  return `tm_gc_${randomBytes(32).toString("hex")}`;
}

export function buildProvisionedDevice({
  companyId,
  deviceId,
  deviceName,
  token,
  now,
}) {
  const normalizedCompanyId = readSegment(companyId, "companyId");
  const normalizedDeviceId = readSegment(deviceId, "deviceId");
  const normalizedDeviceName =
    typeof deviceName === "string" ? deviceName.trim() : "";
  if (!normalizedDeviceName || normalizedDeviceName.length > 160) {
    throw new Error("deviceName must contain between 1 and 160 characters.");
  }
  if (
    typeof token !== "string" ||
    !/^tm_gc_[A-Za-z0-9_-]{8,160}$/.test(token)
  ) {
    throw new Error("token must use the tm_gc_ integration prefix.");
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("now must be a valid Date.");
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  return {
    token,
    tokenHash,
    documentPath: `genteCrystalIntegrationDevices/${tokenHash}`,
    document: {
      companyId: normalizedCompanyId,
      deviceId: normalizedDeviceId,
      deviceName: normalizedDeviceName,
      permissions: [WRITE_PERMISSION],
      createdAt: now,
    },
  };
}

function readServiceAccount(raw) {
  if (!raw?.trim()) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is required.");
  }
  const parsed = JSON.parse(raw);
  const projectId = parsed.project_id || parsed.projectId;
  const clientEmail = parsed.client_email || parsed.clientEmail;
  const rawPrivateKey = parsed.private_key || parsed.privateKey;
  const privateKey =
    typeof rawPrivateKey === "string"
      ? rawPrivateKey.replace(/\\n/g, "\n")
      : undefined;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is missing project_id, client_email, or private_key.",
    );
  }
  return { projectId, clientEmail, privateKey };
}

async function main() {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());

  const [companyId, deviceId, deviceName] = process.argv.slice(2);
  if (!companyId || !deviceId || !deviceName) {
    throw new Error(
      'Usage: npm run provision:gente-crystal-device -- <companyId> <deviceId> "<deviceName>"',
    );
  }

  const provisioned = buildProvisionedDevice({
    companyId,
    deviceId,
    deviceName,
    token: createDeviceToken(),
    now: new Date(),
  });
  const serviceAccount = readServiceAccount(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
  );
  const app = getApps()[0] ??
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  const databaseId =
    process.env.FIRESTORE_DATABASE_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim();
  const firestore = databaseId
    ? getFirestore(app, databaseId)
    : getFirestore(app);

  await firestore.doc(provisioned.documentPath).create(provisioned.document);

  console.log(
    JSON.stringify(
      {
        ok: true,
        companyId: provisioned.document.companyId,
        deviceId: provisioned.document.deviceId,
        deviceName: provisioned.document.deviceName,
        databaseId: databaseId || "(default)",
        token: provisioned.token,
        warning: "Copy this token now; Firestore stores only its SHA-256 hash.",
      },
      null,
      2,
    ),
  );
}

const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
