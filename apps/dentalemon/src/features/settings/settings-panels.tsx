/**
 * Settings panel registry (dental-org FIX-003).
 *
 * The settings route used a hardcoded tab union + inline array, forcing every
 * module that needs a settings surface (consent-templates here; later the
 * data-governance retention panel and dental-pmd signing-cert panel) to
 * restructure the same route file. This registry is the single extension seam:
 * a module adds its panel by appending one entry — no route surgery.
 *
 * Intentionally minimal: a flat ordered list of { key, label, Component }.
 * No lazy loading, no per-panel RBAC framework, no cross-app plugin system —
 * the whole-page settings RBAC gate lives in the route; panels gate their own
 * write affordances internally (e.g. owner-only writes in ConsentTemplates).
 */
import type { ComponentType } from 'react';
import { ClinicSettings } from './components/clinic-settings';
import { WorkingHours } from './components/working-hours';
import { FeeSchedule } from './components/fee-schedule';
import { LocaleSettings } from './components/locale-settings';
import { NotificationSettings } from './components/notification-settings';
import { ConsentTemplates } from './components/consent-templates';
import { AuditLog } from './components/audit-log';

export interface SettingsPanel {
  key: string;
  label: string;
  Component: ComponentType;
}

export const SETTINGS_PANELS: SettingsPanel[] = [
  { key: 'clinic', label: 'Clinic', Component: ClinicSettings },
  { key: 'hours', label: 'Working Hours', Component: WorkingHours },
  { key: 'fees', label: 'Fee Schedule', Component: FeeSchedule },
  { key: 'locale', label: 'Locale', Component: LocaleSettings },
  { key: 'notifications', label: 'Notifications', Component: NotificationSettings },
  { key: 'consent', label: 'Consent Forms', Component: ConsentTemplates },
  { key: 'audit', label: 'Audit Log', Component: AuditLog },
];
