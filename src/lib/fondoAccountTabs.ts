import type { UserPermissions } from "@/types/firestore";
import type { MovementAccountKey } from "@/services/movimientos-fondos";

export type FondoAccountTabId =
  | "fondo"
  | "bcr"
  | "bn"
  | "bac"
  | "cajanegra"
  | "tucan"
  | "tiempos";

export type FondoAccountTab = {
  id: FondoAccountTabId;
  label: string;
  namespace: "fg" | "bcr" | "bn" | "bac" | "cn" | "tc" | "ti";
  accountId: MovementAccountKey;
  permission: keyof UserPermissions;
};

export const FONDO_ACCOUNT_TABS: readonly FondoAccountTab[] = [
  {
    id: "fondo",
    label: "Fondo General",
    namespace: "fg",
    accountId: "FondoGeneral",
    permission: "fondogeneral",
  },
  {
    id: "bcr",
    label: "Cuenta BCR",
    namespace: "bcr",
    accountId: "BCR",
    permission: "fondogeneralBCR",
  },
  {
    id: "bn",
    label: "Cuenta BN",
    namespace: "bn",
    accountId: "BN",
    permission: "fondogeneralBN",
  },
  {
    id: "bac",
    label: "Cuenta BAC",
    namespace: "bac",
    accountId: "BAC",
    permission: "fondogeneralBAC",
  },
  {
    id: "cajanegra",
    label: "Caja Negra",
    namespace: "cn",
    accountId: "CajaNegra",
    permission: "cajaNegra",
  },
  {
    id: "tucan",
    label: "Tucan",
    namespace: "tc",
    accountId: "Tucan",
    permission: "tucan",
  },
  {
    id: "tiempos",
    label: "Tiempos",
    namespace: "ti",
    accountId: "Tiempos",
    permission: "tiempos",
  },
];

export function getAvailableFondoAccountTabs(
  permissions: Partial<UserPermissions>,
): FondoAccountTab[] {
  return FONDO_ACCOUNT_TABS.filter((account) => Boolean(permissions[account.permission]));
}
