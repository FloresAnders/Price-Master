import { describe, expect, it } from "vitest";
import { buildFirebaseCustomTokenClaims } from "@/lib/firebase/custom-token-claims.server";
import type { User } from "@/types/firestore";

describe("Firebase custom-token Fondo claims", () => {
  it("copies every report account permission into the nested claims map", () => {
    const user = {
      id: "report-user",
      name: "Reportes",
      role: "user",
      permissions: {
        fondogeneral: true,
        fondogeneralBCR: true,
        fondogeneralBN: false,
        fondogeneralBAC: true,
        cajaNegra: true,
        tucan: false,
        tiempos: true,
      },
    } as User;

    expect(buildFirebaseCustomTokenClaims(user).permissions).toMatchObject({
      fondogeneral: true,
      fondogeneralBCR: true,
      fondogeneralBN: false,
      fondogeneralBAC: true,
      cajaNegra: true,
      tucan: false,
      tiempos: true,
    });
  });
});
