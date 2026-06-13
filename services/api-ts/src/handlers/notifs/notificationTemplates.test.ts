/**
 * Notification classification tests (notifications FIX-003 + FIX-004).
 *
 * FIX-003: guard the email type→template mapping against the silent-failure seam —
 * a tag the mapper emits must be either a REGISTERED email template or a documented
 * Phase-2 dormant tag, never a phantom that fails delivery silently.
 *
 * FIX-004: pin the medical classifier as a real (live) classifier, not the former
 * hardcoded `false`, and document that V1 defines no medical types.
 */
import { describe, test, expect } from 'bun:test';
import { notificationTypeEnum } from './repos/notification.schema';
import { EmailTemplateTags } from '@/core/email.types';
import {
  NOTIFICATION_EMAIL_TEMPLATE_TAGS,
  PHASE2_UNREGISTERED_EMAIL_TEMPLATE_TAGS,
  mapNotificationTypeToEmailTemplate,
  MEDICAL_NOTIFICATION_TYPES,
  isMedicalNotificationType,
} from './notification-classification';

const REGISTERED_TAGS = new Set<string>(Object.values(EmailTemplateTags));
const PHASE2_TAGS = new Set<string>(PHASE2_UNREGISTERED_EMAIL_TEMPLATE_TAGS);

describe('email template mapping (FIX-003)', () => {
  test('every mapped tag is REGISTERED or documented-Phase-2 — no silent phantom template', () => {
    for (const [type, tag] of Object.entries(NOTIFICATION_EMAIL_TEMPLATE_TAGS)) {
      const known = REGISTERED_TAGS.has(tag) || PHASE2_TAGS.has(tag);
      expect(
        known,
        `mapping ${type} → ${tag} points at neither a registered nor a documented-Phase-2 template`,
      ).toBe(true);
    }
  });

  test('deliverable mappings (security/system) resolve to REGISTERED auth templates today', () => {
    const security = mapNotificationTypeToEmailTemplate('security');
    const system = mapNotificationTypeToEmailTemplate('system');
    expect(security).not.toBeNull();
    expect(system).not.toBeNull();
    expect(REGISTERED_TAGS.has(security!)).toBe(true);
    expect(REGISTERED_TAGS.has(system!)).toBe(true);
  });

  test('reminder/recall email templates are the documented Phase-2 gap (not yet registered)', () => {
    // If someone authors one of these templates (registers the tag), this fails and
    // prompts moving it out of the Phase-2 list — converting the gap into coverage.
    for (const tag of PHASE2_UNREGISTERED_EMAIL_TEMPLATE_TAGS) {
      expect(REGISTERED_TAGS.has(tag)).toBe(false);
    }
  });

  test('the Phase-2 allowlist is pinned to the exact reminder/recall set — it cannot be silently widened to swallow a new phantom tag', () => {
    // Closes the invariant's escape hatch: padding PHASE2 to wave through an
    // arbitrary phantom mapping now fails THIS pin too.
    expect([...PHASE2_UNREGISTERED_EMAIL_TEMPLATE_TAGS].sort()).toEqual(
      [
        'appointment.confirmation-request',
        'appointment.reminder',
        'recall.due',
        'recall.reminder',
      ].sort(),
    );
  });

  test('unmapped types resolve to null', () => {
    expect(mapNotificationTypeToEmailTemplate('booking.created')).toBeNull();
    expect(mapNotificationTypeToEmailTemplate('comms.chat-message')).toBeNull();
    expect(mapNotificationTypeToEmailTemplate('unknown')).toBeNull();
  });
});

describe('medical notification classifier (FIX-004)', () => {
  test('V1 defines no medical notification types', () => {
    expect(MEDICAL_NOTIFICATION_TYPES.size).toBe(0);
  });

  test('no current producer notification type is classified medical', () => {
    for (const type of notificationTypeEnum.enumValues) {
      expect(isMedicalNotificationType(type)).toBe(false);
    }
  });

  test('classifier is live (not hardcoded false): a type in the medical set is medical', () => {
    const set = new Set(['x.critical']);
    expect(isMedicalNotificationType('x.critical', set)).toBe(true);
    expect(isMedicalNotificationType('booking.created', set)).toBe(false);
  });
});
