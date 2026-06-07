/**
 * RBAC utility for Dentalemon dental practice management
 *
 * Implements the access control matrix from PRD FR6.2.
 * Each role maps to a set of accessible modules.
 */

export type DentalRole =
  // PRD-defined roles (FR6.2)
  | 'dentist_owner'
  | 'dentist_associate'
  | 'staff_full'
  | 'staff_scheduling'
  // Extended staff roles (G8-S3, member_role enum)
  | 'hygienist'
  | 'dental_assistant'
  | 'front_desk'
  | 'billing_staff'
  | 'treatment_coordinator'
  | 'read_only';
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
  // staff_full reaches the billing module to "Record payments only" (matrix:
  // Billing Write Operations). Issue/void/create-invoice actions are gated
  // separately by canWriteBilling — see J-RBAC-001.
  staff_full: {
    dashboard: true,
    workspace: true,
    patients: true,
    calendar: true,
    billing: true,
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
  // --- Extended staff roles (G8-S3 member_role enum) ---
  // hygienist: clinical R/W for hygiene (perio/prophy); no billing edits.
  hygienist: {
    dashboard: true,
    workspace: true,
    patients: true,
    calendar: true,
    billing: false,
    reports: false,
    staff: false,
    settings: false,
  },
  // dental_assistant: chairside chart updates under a dentist, imaging capture.
  dental_assistant: {
    dashboard: true,
    workspace: true,
    patients: true,
    calendar: true,
    billing: false,
    reports: false,
    staff: false,
    settings: false,
  },
  // front_desk: check-in, scheduling, demographics; no clinical write, no billing.
  front_desk: {
    dashboard: true,
    workspace: false,
    patients: true,
    calendar: true,
    billing: false,
    reports: false,
    staff: false,
    settings: false,
  },
  // billing_staff: invoices/payments/fee-schedule READ + patient read floor.
  billing_staff: {
    dashboard: true,
    workspace: false,
    patients: true,
    calendar: false,
    billing: true,
    reports: false,
    staff: false,
    settings: false,
  },
  // treatment_coordinator: presents treatment plans + financials to patients.
  // Needs the workspace (treatment plans / case presentation), patients,
  // calendar (to schedule accepted plans), and billing (to present cost +
  // payment options). No staff/reports/settings admin surface.
  treatment_coordinator: {
    dashboard: true,
    workspace: true,
    patients: true,
    calendar: true,
    billing: true,
    reports: false,
    staff: false,
    settings: false,
  },
  // read_only: read across granted modules (dashboard, patients, calendar).
  // NOTE: reports stays false — the reports module is owner-only per the
  // Administrative Operations table (Export reports ✅ owner only) and the
  // existing owner-only `canAccessReports`. The matrix's coarse "reports view"
  // for an observer is not wired as a separate read-only reports surface, so
  // granting module access here would dead-end at the canAccessReports content
  // guard. Treated as owner-only to stay consistent. (Assumption.)
  read_only: {
    dashboard: true,
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
 * Check if a role may see FINANCIAL FIGURES on the dashboard / morning briefing
 * (daily collections, revenue). Per ROLE_PERMISSION_MATRIX.md Dashboard row,
 * staff_full is "Schedule + follow-ups (no financials)" — so this is NOT the
 * same as billing-module access. Only the two dentist roles see dashboard
 * financials.
 *
 * NOTE: reaching the billing module to record payments is a separate concept —
 * use canAccess(role, 'billing') for that, and canWriteBilling for issue/void.
 */
export function canViewFinancials(role: DentalRole): boolean {
  return role === 'dentist_owner' || role === 'dentist_associate';
}

/**
 * Check if a role can perform billing WRITE operations that mutate invoice
 * lifecycle: create / issue / void invoice (and create payment plan).
 *
 * Per ROLE_PERMISSION_MATRIX.md "Billing Write Operations", only
 * dentist_owner and dentist_associate may do these. staff_full and
 * billing_staff can reach billing (canViewFinancials) and record payments,
 * but must NOT see issue/void/create-invoice actions (J-RBAC-001).
 *
 * Note: recording a payment is intentionally NOT gated by this helper —
 * staff_full has "Record payment ✅" in the matrix.
 */
export function canWriteBilling(role: DentalRole): boolean {
  return role === 'dentist_owner' || role === 'dentist_associate';
}

/**
 * Check if a role can PRESENT a treatment plan / case presentation to a patient
 * (the treatment-presentation surface). Mirrors the backend gate on
 * createCasePresentation + the plan "presented" transition: clinicians plus the
 * treatment coordinator. (E1)
 */
export function canPresentCase(role: DentalRole): boolean {
  return (
    role === 'dentist_owner' ||
    role === 'dentist_associate' ||
    role === 'treatment_coordinator'
  );
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
