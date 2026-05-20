/**
 * Working Hours handlers (FR3.10 / FR8.6)
 *
 * GET  /dental/branches/:branchId/working-hours  — get working hours config
 * PUT  /dental/branches/:branchId/working-hours  — update working hours config
 *
 * Working hours format:
 * {
 *   "monday":    { "open": "09:00", "close": "18:00", "enabled": true },
 *   "tuesday":   { "open": "09:00", "close": "18:00", "enabled": true },
 *   "wednesday": { "open": "09:00", "close": "18:00", "enabled": true },
 *   "thursday":  { "open": "09:00", "close": "18:00", "enabled": true },
 *   "friday":    { "open": "09:00", "close": "18:00", "enabled": true },
 *   "saturday":  { "open": "09:00", "close": "13:00", "enabled": false },
 *   "sunday":    { "enabled": false }
 * }
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { eq } from 'drizzle-orm';
import { assertBranchAccess } from './utils/assert-branch-access';
import { z } from 'zod';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const dayScheduleSchema = z.object({
  enabled: z.boolean(),
  open: z.string().regex(TIME_RE, 'Must be in HH:MM format').optional(),
  close: z.string().regex(TIME_RE, 'Must be in HH:MM format').optional(),
});

const updateWorkingHoursSchema = z.object({
  workingHours: z.object({
    monday: dayScheduleSchema.optional(),
    tuesday: dayScheduleSchema.optional(),
    wednesday: dayScheduleSchema.optional(),
    thursday: dayScheduleSchema.optional(),
    friday: dayScheduleSchema.optional(),
    saturday: dayScheduleSchema.optional(),
    sunday: dayScheduleSchema.optional(),
  }),
});

export interface DaySchedule {
  enabled: boolean;
  open?: string;   // 'HH:MM'
  close?: string;  // 'HH:MM'
}

export type WorkingHours = Record<typeof DAYS[number], DaySchedule>;

export function parseWorkingHours(raw: string | null | undefined): WorkingHours | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as WorkingHours; } catch { return null; }
}

/** Returns true if the given Date falls within working hours for the branch.
 *  @param timezone - IANA timezone string for the branch (e.g. 'Asia/Manila'). Falls back to 'UTC'.
 */
export function isWithinWorkingHours(
  scheduledAt: Date,
  durationMinutes: number,
  hours: WorkingHours,
  timezone: string = 'UTC',
): boolean {
  const tz = timezone || 'UTC';
  const day = scheduledAt.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz }).toLowerCase() as typeof DAYS[number];
  const schedule = hours[day];
  if (!schedule?.enabled) return false;
  if (!schedule.open || !schedule.close) return true; // no time restriction

  const [oh, om] = schedule.open.split(':').map(Number);
  const [ch, cm] = schedule.close.split(':').map(Number);

  // Use Intl to extract hour/minute in the branch's timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(scheduledAt);
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);

  const startMins = hour * 60 + minute;
  const endMins = startMins + durationMinutes;
  const openMins = oh! * 60 + om!;
  const closeMins = ch! * 60 + cm!;

  return startMins >= openMins && endMins <= closeMins;
}

export async function getWorkingHours(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const branchId = ctx.req.param('branchId')!;
  const db = ctx.get('database') as DatabaseInstance;

  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!branch) throw new NotFoundError('Branch not found');

  await assertBranchAccess(db, user.id, branchId);

  const hours = parseWorkingHours(branch.workingHours);
  return ctx.json({ branchId, workingHours: hours }, 200);
}

export async function updateWorkingHours(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const branchId = ctx.req.param('branchId')!;
  const db = ctx.get('database') as DatabaseInstance;

  const [existingBranch] = await db.select({ id: dentalBranches.id }).from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!existingBranch) throw new NotFoundError('Branch not found');

  await assertBranchAccess(db, user.id, branchId);

  let rawBody: unknown;
  try { rawBody = await ctx.req.json(); } catch { rawBody = {}; }
  const parsed = updateWorkingHoursSchema.safeParse(rawBody);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ValidationError(msg || 'Invalid working hours');
  }
  const { workingHours } = parsed.data;

  await db.update(dentalBranches)
    .set({ workingHours: JSON.stringify(workingHours), updatedAt: new Date(), updatedBy: user.id })
    .where(eq(dentalBranches.id, branchId!));

  return ctx.json({ branchId, workingHours }, 200);
}
