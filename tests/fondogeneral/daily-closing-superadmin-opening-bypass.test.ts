import { describe, expect, it } from "vitest";

import * as openingRequirement from "@/app/fondogeneral/utils/fondo/openingRequirement";

type OpeningPolicy = (input: {
  isSuperAdminUser: boolean;
  solicitarApertura: boolean;
}) => boolean;

const shouldValidateOpeningBeforeDailyClosing = (
  openingRequirement as unknown as {
    shouldValidateOpeningBeforeDailyClosing?: OpeningPolicy;
  }
).shouldValidateOpeningBeforeDailyClosing;

describe("apertura requerida antes del cierre diario", () => {
  it("permite que solo superadmin omita la apertura requerida", () => {
    expect(
      shouldValidateOpeningBeforeDailyClosing?.({
        isSuperAdminUser: true,
        solicitarApertura: true,
      }),
    ).toBe(false);
    expect(
      shouldValidateOpeningBeforeDailyClosing?.({
        isSuperAdminUser: false,
        solicitarApertura: true,
      }),
    ).toBe(true);
    expect(
      shouldValidateOpeningBeforeDailyClosing?.({
        isSuperAdminUser: false,
        solicitarApertura: false,
      }),
    ).toBe(false);
  });
});
