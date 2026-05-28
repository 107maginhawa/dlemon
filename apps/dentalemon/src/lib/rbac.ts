/**
 * RBAC utility for Dentalemon dental practice management
 *
 * Implements the access control matrix from PRD FR6.2.
 * Each role maps to a set of accessible modules.
 */

export type DentalRole = 'dentist_owner' | 'dentist_associate' | 'staff_full' | 'staff_scheduling';
export type DentalModule = 'dashboard' | 'workspace' | 'patients' | 'calendar' | 'billing' | 'reports' | 'staff' | 'settings';

const ACCESS_MATRIX: Record<DentalRole, Record<DentalModule, boolean>> = {
  dentist_owner: {
    dashboard: true,
    workspace: true,
    patients: true,
    calendar: true,
    billing: true,
    reports: true,
    staff: true,
    settings: true,
  },
  dentist_associate: {
    dashboard: true,
    workspace: true,
    patients: true,
    calendar: true,
    billing: true,
    reports: false,
    staff: false,
    settings: false,
  },
  staff_full: {
    dashboard: true,
    workspace: true,
    patients: true,
    calendar: true,
    billing: false,
    reports: false,
    staff: false,
    settings: false,
  },
  staff_scheduling: {
    dashboard: false,
    workspace: false,
    patients: true,
    calendar: true,
    billing: false,
    reports: false,
    staff: false,
    settings: false,
  },
};

const MODULE_ROUTE_MAP: Record<DentalModule, string> = {
  dashboard: '/dashboard',
  workspace: '/workspace',
  patients: '/patients',
  calendar: '/calendar',
  billing: '/billing',
  reports: '/reports',
  staff: '/staff',
  settings: '/settings',
};

const MODULE_ORDER: DentalModule[] = [
  'dashboard',
  'workspace',
  'patients',
  'calendar',
  'billing',
  'reports',
  'staff',
  'settings',
];

/**
 * Check if a role has access to a module
 */
export function canAccess(role: DentalRole, module: DentalModule): boolean {
  return ACCESS_MATRIX[role]?.[module] ?? false;
}

/**
 * Get the default route for a role (first accessible module)
 */
export function getDefaultRoute(role: DentalRole): string {
  const matrix = ACCESS_MATRIX[role];
  if (!matrix) return '/dashboard';

  for (const mod of MODULE_ORDER) {
    if (matrix[mod]) {
      return MODULE_ROUTE_MAP[mod];
    }
  }

  return '/dashboard';
}

/**
 * Check if a role can view financial data (billing module access)
 */
export function canViewFinancials(role: DentalRole): boolean {
  return role === 'dentist_owner' || role === 'dentist_associate';
}

/**
 * Check if a role can manage staff
 */
export function canManageStaff(role: DentalRole): boolean {
  return role === 'dentist_owner';
}

/**
 * Check if a role can access reports
 */
export function canAccessReports(role: DentalRole): boolean {
  return role === 'dentist_owner';
}
