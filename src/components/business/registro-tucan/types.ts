import type { LucideIcon } from "lucide-react";
import type { Empresas } from "../../../types/firestore";

export type RegistroTucanSortOrder = "desc" | "asc";

export type EmpresaOption = {
  value: string;
  label: string;
  empresa: Empresas | null;
};

export type RegistroTucanMetricCard = {
  label: string;
  value: number;
  icon: LucideIcon;
};
