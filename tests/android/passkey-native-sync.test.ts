import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("sincronización nativa de passkeys Android", () => {
  it("restaura MainActivity y build.gradle desde plantillas rastreables", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "timemaster-passkeys-"));
    temporaryDirectories.push(projectRoot);

    const templateDirectory = path.join(projectRoot, "capacitor-android");
    const javaDirectory = path.join(
      projectRoot,
      "android",
      "app",
      "src",
      "main",
      "java",
      "com",
      "timemaster",
      "app",
    );
    await mkdir(templateDirectory, { recursive: true });
    await mkdir(javaDirectory, { recursive: true });

    await writeFile(path.join(templateDirectory, "MainActivity.java"), "main-template");
    await writeFile(path.join(templateDirectory, "build.gradle"), "gradle-template");
    await writeFile(path.join(javaDirectory, "MainActivity.java"), "main-old");
    await writeFile(
      path.join(projectRoot, "android", "app", "build.gradle"),
      "gradle-old",
    );

    const result = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(process.cwd(), "scripts", "sync-android-passkey-files.ps1"),
        "-ProjectRoot",
        projectRoot,
      ],
      { encoding: "utf8" },
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    await expect(
      readFile(path.join(javaDirectory, "MainActivity.java"), "utf8"),
    ).resolves.toBe("main-template");
    await expect(
      readFile(path.join(projectRoot, "android", "app", "build.gradle"), "utf8"),
    ).resolves.toBe("gradle-template");
  });
});
