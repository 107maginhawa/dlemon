/**
 * Notification classification helpers (notifications FIX-003 / FIX-004).
 *
 * Pure, dependency-free classifiers extracted from NotificationRepository so the
 * two behaviours they drive can be asserted directly (the repo methods delegate
 * here):
 *   - which email template tag a notification type maps to (FIX-003), and
 *   - whether a type is medical/safety-critical and must fail open (FIX-004).
 */

/**
 * Notification type → email template tag.
 *
 * FIX-003: `security`/`system` resolve to REGISTERED auth templates
 * (EmailTemplateTags). The appointment/recall reminder tags are intentionally
 * listed but NOT yet backed by a registered template — reminder/recall EMAIL is
 * Phase-2 (no `.hbs` template authored; the tag is absent from EmailTemplateTags).
 * The in-app and push channels for those reminders already work. See
 * PHASE2_UNREGISTERED_EMAIL_TEMPLATE_TAGS and the notificationTemplates test,
 * which guards against a NEW mapping silently pointing at a phantom template.
 */
export const NOTIFICATION_EMAIL_TEMPLATE_TAGS: Readonly<Record<string, string>> = {
  security: 'auth.password-reset',
  system: 'auth.welcome',
  // Phase-2 (reminder/recall email templates not yet authored):
  'appointment.reminder': 'appointment.reminder',
  'appointment.confirmation-request': 'appointment.confirmation-request',
  'recall.due': 'recall.due',
  'recall.reminder': 'recall.reminder',
};

/**
 * Email template tags the mapper emits that are NOT yet registered in
 * EmailTemplateTags (reminder/recall email is Phase-2). Documented here so the
 * registry-invariant test can distinguish a KNOWN dormant tag from a NEW silent
 * typo that would fail delivery.
 */
export const PHASE2_UNREGISTERED_EMAIL_TEMPLATE_TAGS: readonly string[] = [
  'appointment.reminder',
  'appointment.confirmation-request',
  'recall.due',
  'recall.reminder',
];

/** Map a notification type to its email template tag, or null if unmapped. */
export function mapNotificationTypeToEmailTemplate(type: string): string | null {
  return NOTIFICATION_EMAIL_TEMPLATE_TAGS[type] ?? null;
}

/**
 * Medical / safety-critical notification types.
 *
 * FIX-004 (product decision: medical-priority notifications fail open — bypass any
 * quiet-hours/batching). V1 ships NO quiet-hours/batching, so fail-open is already
 * satisfied for every notification; the only differential effect of "medical" today
 * is a high push priority (OneSignal priority 10). V1 also defines no medical
 * notification types, so this set is intentionally EMPTY — the classifier is real
 * and live (not the former hardcoded `false`), ready for the first medical type.
 */
export const MEDICAL_NOTIFICATION_TYPES: ReadonlySet<string> = new Set<string>();

/**
 * Whether a notification type is medical/safety-critical (and must fail open with
 * elevated delivery priority). Pure and set-injectable for testing.
 */
export function isMedicalNotificationType(
  type: string,
  medicalTypes: ReadonlySet<string> = MEDICAL_NOTIFICATION_TYPES,
): boolean {
  return medicalTypes.has(type);
}
