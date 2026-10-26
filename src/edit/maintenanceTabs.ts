import {
  Building,
  Clock,
  DollarSign,
  FileText,
  List,
  Megaphone,
  PartyPopper,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { User } from "@/types/firestore";

export type MaintenanceDataFile =
  | "sorteos"
  | "users"
  | "schedules"
  | "ccss"
  | "empresas"
  | "fondoTypes"
  | "funciones"
  | "systemMaintenance"
  | "systemAnnouncements"
  | "seasonalEffects";

export interface MaintenanceTab {
  key: MaintenanceDataFile;
  label: string;
  icon: LucideIcon;
  count?: number;
}

export function isMaintenanceTabAllowed(
  tab: MaintenanceDataFile,
  role: User["role"],
): boolean {
  if (
    tab === "systemMaintenance" ||
    tab === "systemAnnouncements" ||
    tab === "seasonalEffects"
  ) {
    return role === "superadmin";
  }
  if (tab === "fondoTypes" || tab === "funciones") {
    return role !== "user";
  }
  return true;
}

interface MaintenanceTabCounts {
  users?: number;
  sorteos?: number;
  ccss?: number;
  empresas?: number;
}

export function getMaintenanceTabs(
  role: User["role"],
  counts: MaintenanceTabCounts = {},
): MaintenanceTab[] {
  const tabs: Array<MaintenanceTab & { adminOnly?: boolean; superadminOnly?: boolean }> = [
    { key: "users", label: "Usuarios", count: counts.users, icon: Users },
    { key: "sorteos", label: "Sorteos", count: counts.sorteos, icon: FileText },
    { key: "schedules", label: "Planilla", icon: Clock },
    { key: "ccss", label: "Configuración", count: counts.ccss, icon: DollarSign },
    { key: "empresas", label: "Empresas", count: counts.empresas, icon: Building },
    { key: "fondoTypes", label: "Tipos Fondo", icon: List, adminOnly: true },
    { key: "funciones", label: "Funciones", icon: List, adminOnly: true },
    {
      key: "systemMaintenance",
      label: "Modo sistema",
      icon: ShieldAlert,
      superadminOnly: true,
    },
    {
      key: "systemAnnouncements",
      label: "Anuncios",
      icon: Megaphone,
      superadminOnly: true,
    },
    {
      key: "seasonalEffects",
      label: "Celebraciones",
      icon: PartyPopper,
      superadminOnly: true,
    },
  ];

  return tabs.filter((tab) => isMaintenanceTabAllowed(tab.key, role));
}
