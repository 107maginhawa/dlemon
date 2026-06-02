/**
 * org-scheduling.facade.ts
 *
 * Facade exposing dental-org repo data to dental-scheduling handlers.
 */

import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import type { DatabaseInstance } from '@/core/database';
import { dentalBranches } from './branch.schema';
import { dentalMemberships } from './membership.schema';

/**
 * V-ORG-003 / BR-SCH-004 — typed contract for `dental_branch.working_hours`.
 *
 * dental-org owns the column; this is the validated shape it exposes to the
 * dental-scheduling consumer (which enforces appointment-vs-hours). Kept here
 * (the owner-of-record) so the structure is verified at the boundary rather
 * than parsed as an untyped string. The column itself remains `text` (a JSON
 * blob) to avoid a cross-module data migration; `getWorkingHours` parses and
 * validates on read.
 */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DayScheduleSchema = z.object({
  enabled: z.boolean(),
  open: z.string().regex(TIME_RE, 'Must be in HH:MM format').optional(),
  close: z.string().regex(TIME_RE, 'Must be in HH:MM format').optional(),
});

// Days are individually optional to match what the scheduling update path can
// persist (partial week schedules); a day absent from the blob means "no
// configured hours" which the consumer treats as closed.
export const WorkingHoursSchema = z.object({
  monday: DayScheduleSchema.optional(),
  tuesday: DayScheduleSchema.optional(),
  wednesday: DayScheduleSchema.optional(),
  thursday: DayScheduleSchema.optional(),
  friday: DayScheduleSchema.optional(),
  saturday: DayScheduleSchema.optional(),
  sunday: DayScheduleSchema.optional(),
});

export type DaySchedule = z.infer<typeof DayScheduleSchema>;
export type WorkingHours = z.infer<typeof WorkingHoursSchema>;

export async function getBranchSchedulingConfig(
  db: DatabaseInstance,
  branchId: string,
): Promise<{ id: string; workingHours: string | null; timezone: string } | null> {
  const [row] = await db
    .select({ id: dentalBranches.id, workingHours: dentalBranches.workingHours, timezone: dentalBranches.timezone })
    .from(dentalBranches)
    .where(eq(dentalBranches.id, branchId));
  return row ?? null;
}

/**
 * V-ORG-003 / BR-SCH-004: Validated accessor for a branch's working hours.
 *
 * Parses the stored JSON blob and validates it against `WorkingHoursSchema`,
 * returning a typed `WorkingHours` object. Returns null when the column is
 * unset, the JSON is malformed, or the structure fails validation — so a
 * corrupt blob can never reach the scheduling enforcement path as an
 * unvalidated shape.
 */
export async function getWorkingHours(
  db: DatabaseInstance,
  branchId: string,
): Promise<WorkingHours | null> {
  const config = await getBranchSchedulingConfig(db, branchId);
  if (!config?.workingHours) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(config.workingHours);
  } catch {
    return null;
  }

  const parsed = WorkingHoursSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function updateBranchWorkingHours(
  db: DatabaseInstance,
  branchId: string,
  workingHours: string,
  updatedBy: string,
): Promise<void> {
  await db
    .update(dentalBranches)
    .set({ workingHours, updatedAt: new Date(), updatedBy })
    .where(eq(dentalBranches.id, branchId));
}

/**
 * P1-25: full context needed by the public online-booking surface. Returns the
 * branch name + timezone + working-hours blob + the raw `settings` JSONB (which
 * carries the `onlineBooking` policy block), plus the active provider memberships
 * eligible to be offered online. Returns null if the branch does not exist.
 *
 * Lives on the dental-org facade because it crosses into branch + membership
 * tables which dental-org owns.
 */
export async function getBranchOnlineBookingContext(
  db: DatabaseInstance,
  branchId: string,
): Promise<{
  id: string;
  name: string;
  timezone: string;
  workingHours: string | null;
  settings: unknown;
  active: boolean;
  providers: { providerId: string; displayName: string }[];
} | null> {
  const [branch] = await db
    .select({
      id: dentalBranches.id,
      name: dentalBranches.name,
      timezone: dentalBranches.timezone,
      workingHours: dentalBranches.workingHours,
      settings: dentalBranches.settings,
      active: dentalBranches.active,
    })
    .from(dentalBranches)
    .where(eq(dentalBranches.id, branchId));
  if (!branch) return null;

  // Clinical/provider roles eligible to be booked online.
  const CLINICAL_ROLES = ['dentist_owner', 'dentist_associate', 'hygienist'] as const;
  const memberRows = await db
    .select({ id: dentalMemberships.id, displayName: dentalMemberships.displayName, role: dentalMemberships.role })
    .from(dentalMemberships)
    .where(and(eq(dentalMemberships.branchId, branchId), eq(dentalMemberships.status, 'active')));

  const providers = memberRows
    .filter((m) => (CLINICAL_ROLES as readonly string[]).includes(m.role))
    .map((m) => ({ providerId: m.id, displayName: m.displayName }));

  return {
    id: branch.id,
    name: branch.name,
    timezone: branch.timezone,
    workingHours: branch.workingHours,
    settings: branch.settings,
    active: branch.active,
    providers,
  };
}

/**
 * P1-24: the effective reminder/recall cadence policy for a branch. Reads the
 * `reminderPolicy` block from `dental_branch.settings` (JSONB) and falls back to
 * a hardcoded default when absent. Also returns the branch timezone (recall
 * due-dates are computed against branch tz). Returns the default policy with a
 * 'UTC' timezone if the branch is missing (never throws).
 */
export interface ReminderPolicy {
  leadHours: number[];
  channels: ('sms' | 'email' | 'push' | 'in-app')[];
  recallReattemptDays: number;
  recallMaxAttempts: number;
}

export const DEFAULT_REMINDER_POLICY: ReminderPolicy = {
  leadHours: [72, 24, 2],
  channels: ['email', 'in-app'],
  recallReattemptDays: 14,
  recallMaxAttempts: 3,
};

export async function getBranchReminderPolicy(
  db: DatabaseInstance,
  branchId: string,
): Promise<{ policy: ReminderPolicy; timezone: string }> {
  const [row] = await db
    .select({ settings: dentalBranches.settings, timezone: dentalBranches.timezone })
    .from(dentalBranches)
    .where(eq(dentalBranches.id, branchId));
  const raw = (row?.settings as { reminderPolicy?: Partial<ReminderPolicy> } | null)?.reminderPolicy;
  const policy: ReminderPolicy = {
    leadHours: raw?.leadHours ?? DEFAULT_REMINDER_POLICY.leadHours,
    channels: raw?.channels ?? DEFAULT_REMINDER_POLICY.channels,
    recallReattemptDays: raw?.recallReattemptDays ?? DEFAULT_REMINDER_POLICY.recallReattemptDays,
    recallMaxAttempts: raw?.recallMaxAttempts ?? DEFAULT_REMINDER_POLICY.recallMaxAttempts,
  };
  return { policy, timezone: row?.timezone ?? 'UTC' };
}

export async function getActiveBranchIdsForPerson(
  db: DatabaseInstance,
  personId: string,
): Promise<string[]> {
  const rows = await db
    .select({ branchId: dentalMemberships.branchId })
    .from(dentalMemberships)
    .where(and(eq(dentalMemberships.personId, personId), eq(dentalMemberships.status, 'active')));
  return rows.map(r => r.branchId);
}
