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
import { AppearanceSettings } from './components/appearance-settings';
import { ClinicSettings } from './components/clinic-settings';
import { WorkingHours } from './components/working-hours';
import { FeeSchedule } from './components/fee-schedule';
import { PaymentTermsSettings } from './components/payment-terms-settings';
import { TaxModeSettings } from './components/tax-mode-settings';
import { ReminderCadenceSettings } from './components/reminder-cadence-settings';
import { OnlineBookingSettings } from './components/online-booking-settings';
import { LocaleSettings } from './components/locale-settings';
import { NotificationSettings } from './components/notification-settings';
import { ConsentTemplates } from './components/consent-templates';
import { TreatmentTemplates } from './components/treatment-templates';
import { AuditLog } from './components/audit-log';
import { DataErasure } from './components/data-erasure';

export interface SettingsPanel {
  key: string;
  label: string;
  Component: ComponentType;
}

export const SETTINGS_PANELS: SettingsPanel[] = [
  { key: 'appearance', label: 'Appearance', Component: AppearanceSettings },
  { key: 'clinic', label: 'Clinic', Component: ClinicSettings },
  { key: 'hours', label: 'Working Hours', Component: WorkingHours },
  { key: 'fees', label: 'Fee Schedule', Component: FeeSchedule },
  { key: 'payment-terms', label: 'Payment Terms', Component: PaymentTermsSettings },
  { key: 'tax-mode', label: 'Tax (VAT)', Component: TaxModeSettings },
  { key: 'reminder-cadence', label: 'Reminder Cadence', Component: ReminderCadenceSettings },
  { key: 'online-booking', label: 'Online Booking', Component: OnlineBookingSettings },
  { key: 'locale', label: 'Locale', Component: LocaleSettings },
  { key: 'notifications', label: 'Notifications', Component: NotificationSettings },
  { key: 'consent', label: 'Consent Forms', Component: ConsentTemplates },
  { key: 'treatment-templates', label: 'Treatment Templates', Component: TreatmentTemplates },
  { key: 'audit', label: 'Audit Log', Component: AuditLog },
  { key: 'erasure', label: 'Data Erasure', Component: DataErasure },
];
