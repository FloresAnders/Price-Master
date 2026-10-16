import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ReportDetailAccessError,
  getAuthorizedReportDetailItems,
  isReportDetailItemPath,
} from "@/services/reportes-detail.server";

const baseRequest = {
  fromIso: "2026-10-01T06:00:00.000Z",
  toExclusiveIso: "2026-10-17T06:00:00.000Z",
  empresas: ["DELIKOR SAN VITO"],
  accountIds: ["FondoGeneral"],
  currency: "CRC",
  paymentType: "PRESTAMOS INTERCOMPAÑIA (EGRESO)",
  limit: 50,
};

const companies = [
  {
    id: "san-vito",
    name: "DELIKOR SAN VITO",
    ubicacion: "San Vito",
    ownerId: "owner-1",
  },
  {
    id: "delifood",
    name: "DELIFOOD",
    ubicacion: "Delifood",
    ownerId: "owner-2",
  },
];

const reportItem = {
  id: "movement-1",
  movementId: "movement-1",
  empresa: "DELIKOR SAN VITO",
  createdAt: "2026-10-01T13:48:49.178Z",
  accountId: "FondoGeneral",
  paymentType: "PRESTAMOS INTERCOMPAÑIA (EGRESO)",
  classification: "egreso",
  amountIngreso: 0,
  amountEgreso: 100000,
  currency: "CRC",
};

const listCompanies = vi.fn(async () => companies);
const queryItems = vi.fn(async () => [reportItem]);

beforeEach(() => {
  listCompanies.mockClear();
  queryItems.mockClear();
});

describe("authorized Fondo report detail", () => {
  it("accepts only documents inside reportes_detalle/*/items/*", () => {
    expect(
      isReportDetailItemPath(
        "reportes_detalle/report-1/items/movement-1",
      ),
    ).toBe(true);
    expect(isReportDetailItemPath("inventario/store/items/movement-1")).toBe(
      false,
    );
    expect(isReportDetailItemPath("reportes_detalle/report-1")).toBe(false);
  });

  it("passes an owner-scoped admin request to the report query unchanged", async () => {
    const user = {
      id: "admin-1",
      role: "admin",
      ownerId: "owner-1",
      eliminate: false,
      permissions: { fondogeneral: true },
    } as any;

    await expect(
      getAuthorizedReportDetailItems(user, baseRequest, {
        listCompanies,
        queryItems,
      }),
    ).resolves.toEqual([reportItem]);

    expect(queryItems).toHaveBeenCalledWith(baseRequest);
  });

  it("rejects a foreign company before querying detail", async () => {
    const user = {
      id: "user-1",
      role: "user",
      ownercompanie: "DELIKOR SAN VITO",
      permissions: { fondogeneral: true },
    } as any;

    const action = getAuthorizedReportDetailItems(
      user,
      { ...baseRequest, empresas: ["DELIFOOD"] },
      { listCompanies, queryItems },
    );

    await expect(action).rejects.toMatchObject<Partial<ReportDetailAccessError>>({
      status: 403,
      code: "forbidden_company",
    });
    expect(queryItems).not.toHaveBeenCalled();
  });

  it("rejects an account missing from user permissions", async () => {
    const user = {
      id: "user-1",
      role: "user",
      ownercompanie: "DELIKOR SAN VITO",
      permissions: { fondogeneral: true, fondogeneralBN: false },
    } as any;

    const action = getAuthorizedReportDetailItems(
      user,
      { ...baseRequest, accountIds: ["BN"] },
      { listCompanies, queryItems },
    );

    await expect(action).rejects.toMatchObject<Partial<ReportDetailAccessError>>({
      status: 403,
      code: "forbidden_account",
    });
    expect(queryItems).not.toHaveBeenCalled();
  });

  it("rejects users without Fondo General access", async () => {
    const user = {
      id: "user-1",
      role: "user",
      ownercompanie: "DELIKOR SAN VITO",
      permissions: { fondogeneral: false },
    } as any;

    await expect(
      getAuthorizedReportDetailItems(user, baseRequest, {
        listCompanies,
        queryItems,
      }),
    ).rejects.toMatchObject<Partial<ReportDetailAccessError>>({
      status: 403,
      code: "forbidden",
    });
    expect(listCompanies).not.toHaveBeenCalled();
    expect(queryItems).not.toHaveBeenCalled();
  });

  it("rejects an invalid date range", async () => {
    const user = {
      id: "super-1",
      role: "superadmin",
      permissions: { fondogeneral: true },
    } as any;

    await expect(
      getAuthorizedReportDetailItems(
        user,
        {
          ...baseRequest,
          fromIso: "2026-10-17T06:00:00.000Z",
          toExclusiveIso: "2026-10-01T06:00:00.000Z",
        },
        { listCompanies, queryItems },
      ),
    ).rejects.toMatchObject<Partial<ReportDetailAccessError>>({
      status: 400,
      code: "invalid_date_range",
    });
    expect(queryItems).not.toHaveBeenCalled();
  });

  it("rejects a string pretending to be a numeric page limit", async () => {
    const user = {
      id: "super-1",
      role: "superadmin",
      permissions: { fondogeneral: true },
    } as any;

    await expect(
      getAuthorizedReportDetailItems(
        user,
        { ...baseRequest, limit: "50" },
        { listCompanies, queryItems },
      ),
    ).rejects.toMatchObject<Partial<ReportDetailAccessError>>({
      status: 400,
      code: "invalid_limit",
    });
    expect(queryItems).not.toHaveBeenCalled();
  });

  it("lets a superadmin query requested scope without loading companies", async () => {
    const user = {
      id: "super-1",
      role: "superadmin",
      permissions: { fondogeneral: true },
    } as any;

    await expect(
      getAuthorizedReportDetailItems(user, baseRequest, {
        listCompanies,
        queryItems,
      }),
    ).resolves.toEqual([reportItem]);
    expect(listCompanies).not.toHaveBeenCalled();
  });
});
