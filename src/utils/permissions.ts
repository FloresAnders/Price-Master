import { UserPermissions } from '../types/firestore';

/**
 * Default permissions for different user roles
 */
export const DEFAULT_PERMISSIONS: Record<string, UserPermissions> = {
  superadmin: {
    scanner: true,
    calculator: true,
    converter: true,
    cashcounter: true,
    timingcontrol: true,
    controlhorario: true,
    supplierorders: true,
    mantenimiento: true,
    fondogeneral: true,
    fondogeneralBCR: true,
    fondogeneralBN: true,
    fondogeneralBAC: true,
    solicitud: true,
    scanhistory: true,
    scanhistoryEmpresas: [],
  },
  // Admins now receive the same default configuration as SuperAdmins
  admin: {
    scanner: true,
    calculator: true,
    converter: true,
    cashcounter: true,
    timingcontrol: true,
    controlhorario: true,
    supplierorders: true,
    mantenimiento: true,
    fondogeneral: true,
    fondogeneralBCR: true,
    fondogeneralBN: true,
    fondogeneralBAC: true,
    solicitud: true,
    scanhistory: true,
    scanhistoryEmpresas: [],
  },
  user: {
    scanner: false,
    calculator: true,
    converter: false,
    cashcounter: true,
    timingcontrol: true,
    controlhorario: true,
    supplierorders: false,
    mantenimiento: false,
    fondogeneral: false,
    fondogeneralBCR: false,
    fondogeneralBN: false,
    fondogeneralBAC: false,
    solicitud: false,
    scanhistory: false,
    scanhistoryEmpresas: [],
  },
};

/**
 * Get default permissions for a specific role
 */
export function getDefaultPermissions(role: 'admin' | 'user' | 'superadmin' = 'user'): UserPermissions {
  return { ...DEFAULT_PERMISSIONS[role] };
}

/**
 * Create permissions with all sections enabled
 */
export function getAllPermissions(): UserPermissions {
  return {
    scanner: true,
    calculator: true,
    converter: true,
    cashcounter: true,
    timingcontrol: true,
    controlhorario: true,
    supplierorders: true,
    mantenimiento: true,
    fondogeneral: true,
    fondogeneralBCR: true,
    fondogeneralBN: true,
    fondogeneralBAC: true,
    solicitud: true,
    scanhistory: true,
    scanhistoryEmpresas: [],
  };
}

/**
 * Create permissions with all sections disabled
 */
export function getNoPermissions(): UserPermissions {
  return {
    scanner: false,
    calculator: false,
    converter: false,
    cashcounter: false,
    timingcontrol: false,
    controlhorario: false,
    supplierorders: false,
    mantenimiento: false,
    fondogeneral: false,
    fondogeneralBCR: false,
    fondogeneralBN: false,
    fondogeneralBAC: false,
    solicitud: false,
    scanhistory: false,
    scanhistoryEmpresas: [],
  };
}

/**
 * Update specific permissions while keeping others intact
 */
export function updatePermissions(
  currentPermissions: UserPermissions | undefined,
  updates: Partial<UserPermissions>
): UserPermissions {
  const current = currentPermissions || getNoPermissions();
  return {
    ...current,
    ...updates,
  };
}

/**
 * Check if user has permission for a specific section
 */
export function hasPermission(
  permissions: UserPermissions | undefined,
  section: keyof UserPermissions
): boolean {
  return permissions?.[section] === true;
}
