#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gradlePath = path.join(root, "android", "app", "build.gradle");
const versionPath = path.join(root, "src", "data", "version.json");

const gradle = fs.readFileSync(gradlePath, "utf8");
const versionData = JSON.parse(fs.readFileSync(versionPath, "utf8"));
const versionName = String(versionData.version || "").trim();

if (!/^\d+\.\d+\.\d+$/.test(versionName)) {
  throw new Error(`Versión web inválida en version.json: ${versionName}`);
}

const versionCodeMatch = gradle.match(/versionCode\s+(\d+)/);
if (!versionCodeMatch) {
  throw new Error("No se encontró versionCode en android/app/build.gradle");
}

const currentVersionCode = Number(versionCodeMatch[1]);
if (!Number.isSafeInteger(currentVersionCode) || currentVersionCode < 1) {
  throw new Error(`versionCode inválido: ${versionCodeMatch[1]}`);
}

const nextVersionCode = currentVersionCode + 1;
const nextGradle = gradle
  .replace(
    /versionCode\s+\d+/,
    `versionCode ${nextVersionCode}`,
  )
  .replace(
    /versionName\s+"[^"]+"/,
    `versionName "${versionName}"`,
  );

if (nextGradle === gradle) {
  throw new Error("No se pudo actualizar versión Android");
}

fs.writeFileSync(gradlePath, nextGradle);
console.log(
  `Versión APK: versionCode ${currentVersionCode} -> ${nextVersionCode}, versionName ${versionName}`,
);
