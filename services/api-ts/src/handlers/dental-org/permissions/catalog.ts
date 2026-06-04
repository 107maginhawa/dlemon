/**
 * Granular feature-permission catalog (P2-17).
 *
 * The single source of truth for the per-feature permission grid that layers
 * on top of the coarse role enum. Each feature declares the set of roles that
 * are allowed BY DEFAULT — these defaults mirror the current hard-coded
 * `assertBranchRole([...])` behavior so that, with no org overrides present,
 * the effective permissions are exactly what they are today.
 *
 * Orgs may override any (role, feature) pair (see dental_feature_permission),
 * but in the ABSENCE of an override the catalog default applies. This makes the
 * model strictly additive and backward-safe: existing orgs are never locked out
 * because they have no override rows and therefore fall back to today's defaults.
 */

import type { MemberRole } from '@/handlers/dental-org/repos/membership.schema';

/** Stable feature keys. Adding a key is backward-safe; never rename/remove. */
export const PERMISSION_FEATURES = [
  'billing.invoice.issue',
  'billing.invoice.void',
  'billing.payment.record',
  'billing.discount.apply',
  'fee_schedule.edit',
  'clinical.prescription.write',
  'clinical.note.sign',
  'patient.delete',
  'staff.manage',
  'reports.view',
] as const;

export type PermissionFeature = (typeof PERMISSION_FEATURES)[number];

export interface PermissionFeatureDef {
  feature: PermissionFeature;
  /** Human-readable label for the settings grid. */
  label: string;
  /** Grouping for the settings grid UI. */
  category: 'Billing' | 'Clinical' | 'Patients' | 'Administration' | 'Reports';
  /** Roles allowed by default (mirrors current assertBranchRole sets). */
  defaultAllowedRoles: MemberRole[];
}

/**
 * Catalog. `defaultAllowedRoles` mirrors the existing inline role checks:
 * - billing issue / fee-schedule edit / prescriptions: owner + associate
 * - billing void / fee-schedule create / patient delete / staff manage / reports: owner only
 * - payment record / discount: owner + associate + staff_full
 */
export const PERMISSION_CATALOG: PermissionFeatureDef[] = [
  {
    feature: 'billing.invoice.issue',
    label: 'Issue invoices',
    category: 'Billing',
    defaultAllowedRoles: ['dentist_owner', 'dentist_associate'],
  },
  {
    feature: 'billing.invoice.void',
    label: 'Void invoices',
    category: 'Billing',
    defaultAllowedRoles: ['dentist_owner'],
  },
  {
    feature: 'billing.payment.record',
    label: 'Record payments',
    category: 'Billing',
    defaultAllowedRoles: ['dentist_owner', 'dentist_associate', 'staff_full'],
  },
  {
    feature: 'billing.discount.apply',
    label: 'Apply discounts',
    category: 'Billing',
    defaultAllowedRoles: ['dentist_owner', 'dentist_associate'],
  },
  {
    feature: 'fee_schedule.edit',
    label: 'Edit fee schedule',
    category: 'Billing',
    defaultAllowedRoles: ['dentist_owner', 'dentist_associate'],
  },
  {
    feature: 'clinical.prescription.write',
    label: 'Write prescriptions',
    category: 'Clinical',
    defaultAllowedRoles: ['dentist_owner', 'dentist_associate'],
  },
  {
    feature: 'clinical.note.sign',
    label: 'Sign clinical notes',
    category: 'Clinical',
    defaultAllowedRoles: ['dentist_owner', 'dentist_associate'],
  },
  {
    feature: 'patient.delete',
    label: 'Delete / archive patients',
    category: 'Patients',
    defaultAllowedRoles: ['dentist_owner'],
  },
  {
    feature: 'staff.manage',
    label: 'Manage staff & roles',
    category: 'Administration',
    defaultAllowedRoles: ['dentist_owner'],
  },
  {
    feature: 'reports.view',
    label: 'View reports',
    category: 'Reports',
    defaultAllowedRoles: ['dentist_owner'],
  },
];

const CATALOG_BY_FEATURE = new Map<PermissionFeature, PermissionFeatureDef>(
  PERMISSION_CATALOG.map((d) => [d.feature, d]),
);

/** Returns true if `feature` is a known catalog key. */
export function isKnownFeature(feature: string): feature is PermissionFeature {
  return CATALOG_BY_FEATURE.has(feature as PermissionFeature);
}

/** The default allow decision for a (role, feature) pair, ignoring overrides. */
export function defaultAllows(role: MemberRole, feature: PermissionFeature): boolean {
  const def = CATALOG_BY_FEATURE.get(feature);
  if (!def) return false;
  return def.defaultAllowedRoles.includes(role);
}
