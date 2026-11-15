import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const assetLinksPath = path.join(
  process.cwd(),
  "public",
  ".well-known",
  "assetlinks.json",
);

describe("Android passkey Digital Asset Links", () => {
  it("asocia timemaster.es con paquete y certificado debug del APK", async () => {
    const document = JSON.parse(await readFile(assetLinksPath, "utf8")) as Array<{
      relation: string[];
      target: {
        namespace: string;
        package_name: string;
        sha256_cert_fingerprints: string[];
      };
    }>;

    expect(document).toContainEqual({
      relation: [
        "delegate_permission/common.handle_all_urls",
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: "com.timemaster.app",
        sha256_cert_fingerprints: [
          "E8:FF:4F:60:7A:AD:41:BA:0A:8B:A6:51:AE:9E:0D:E5:73:E7:BD:01:CD:A5:3E:30:A5:9B:94:4D:1C:30:93:73",
        ],
      },
    });
  });
});
