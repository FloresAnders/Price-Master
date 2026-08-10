import type { Empresas, User } from "@/types/firestore";

export type ProviderTypesOwnerInput = {
  adminCompany: string;
  allowedOwnerIds: ReadonlySet<string>;
  canSelectCompany: boolean;
  ownerCompanies: Empresas[];
  user?: Pick<User, "id" | "ownerId"> | null;
};

const normalizeCompanyKey = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export function resolveProviderTypesOwnerId({
  adminCompany,
  allowedOwnerIds,
  canSelectCompany,
  ownerCompanies,
  user,
}: ProviderTypesOwnerInput): string {
  if (canSelectCompany) {
    const normalizedCompany = normalizeCompanyKey(adminCompany);
    if (normalizedCompany.length > 0) {
      const match = ownerCompanies.find((emp) => {
        const candidates = [emp.name, emp.ubicacion, emp.id]
          .map(normalizeCompanyKey)
          .filter(Boolean);
        return candidates.includes(normalizedCompany);
      });
      const ownerId =
        typeof match?.ownerId === "string" ? match.ownerId.trim() : "";
      if (ownerId) return ownerId;
    }

    return "";
  }

  const firstAllowedOwner = Array.from(allowedOwnerIds)[0] || "";
  if (firstAllowedOwner) return String(firstAllowedOwner).trim();

  const directOwnerId =
    typeof user?.ownerId === "string" ? user.ownerId.trim() : "";
  if (directOwnerId) return directOwnerId;

  return typeof user?.id === "string" ? user.id.trim() : "";
}
