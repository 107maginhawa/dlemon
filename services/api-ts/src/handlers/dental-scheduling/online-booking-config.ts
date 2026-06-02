/**
 * online-booking-config.ts (P1-25)
 *
 * Typed contract + parser for the per-branch online-booking policy. The policy
 * is stored inside the existing `dental_branch.settings` JSONB blob under an
 * `onlineBooking` key (no new column — config, not relational data). This module
 * is the single place that validates and applies defaults so a missing/partial
 * blob can never reach the availability or booking path as an unvalidated shape.
 */

import { z } from 'zod';
import { VISIT_TYPES, type VisitType } from './appointment-wire';

export const OnlineBookingConfigSchema = z.object({
  enabled: z.boolean().default(false),
  // Restrict what is bookable online; emergency is never offered self-service.
  bookableVisitTypes: z.array(z.enum(VISIT_TYPES)).default(['checkup', 'recall']),
  // 'all' or an explicit allow-list of provider membership ids.
  bookableProviderMemberIds: z.union([z.literal('all'), z.array(z.string())]).default('all'),
  leadTimeMinutes: z.number().int().min(0).default(120),
  horizonDays: z.number().int().min(1).max(365).default(60),
  slotStepMinutes: z.number().int().min(5).max(120).default(15),
  requirePatientAuth: z.boolean().default(false),
});

export type OnlineBookingConfig = z.infer<typeof OnlineBookingConfigSchema>;

/** Visit-type → default slot length (minutes) when not otherwise configured. */
export const VISIT_TYPE_DURATION_MINUTES: Record<VisitType, number> = {
  checkup: 30,
  recall: 30,
  treatment: 60,
  emergency: 60,
};

export function durationForVisitType(visitType: VisitType): number {
  return VISIT_TYPE_DURATION_MINUTES[visitType] ?? 30;
}

/**
 * Parse the `onlineBooking` block out of a branch `settings` JSONB value,
 * applying defaults. Returns a fully-populated config object (disabled by
 * default) — never throws.
 */
export function parseOnlineBookingConfig(settings: unknown): OnlineBookingConfig {
  const raw = (settings && typeof settings === 'object' && 'onlineBooking' in (settings as Record<string, unknown>))
    ? (settings as Record<string, unknown>)['onlineBooking']
    : undefined;
  const parsed = OnlineBookingConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : OnlineBookingConfigSchema.parse({});
}

/** Emergency may never be booked online regardless of config. */
export function isOnlineBookable(config: OnlineBookingConfig, visitType: VisitType): boolean {
  if (visitType === 'emergency') return false;
  return config.bookableVisitTypes.includes(visitType);
}
