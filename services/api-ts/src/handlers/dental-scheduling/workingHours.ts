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

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { eq } from 'drizzle-orm';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

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

/** Returns true if the given Date falls within working hours for the branch. */
export function isWithinWorkingHours(scheduledAt: Date, durationMinutes: number, hours: WorkingHours): boolean {
  const day = scheduledAt.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as typeof DAYS[number];
  const schedule = hours[day];
  if (!schedule?.enabled) return false;
  if (!schedule.open || !schedule.close) return true; // no time restriction

  const [oh, om] = schedule.open.split(':').map(Number);
  const [ch, cm] = schedule.close.split(':').map(Number);
  const startMins = scheduledAt.getHours() * 60 + scheduledAt.getMinutes();
  const endMins = startMins + durationMinutes;
  const openMins = oh! * 60 + om!;
  const closeMins = ch! * 60 + cm!;

  return startMins >= openMins && endMins <= closeMins;
}

export async function getWorkingHours(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const branchId = ctx.req.param('branchId');
  const db = ctx.get('database') as DatabaseInstance;

  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!branch) throw new NotFoundError('Branch not found');

  const hours = parseWorkingHours(branch.workingHours);
  return ctx.json({ branchId, workingHours: hours }, 200);
}

export async function updateWorkingHours(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const branchId = ctx.req.param('branchId');
  const db = ctx.get('database') as DatabaseInstance;

  let body: any;
  try { body = await ctx.req.json(); } catch { throw new ValidationError('Invalid JSON'); }

  const workingHours = body.workingHours;
  if (!workingHours || typeof workingHours !== 'object') {
    throw new ValidationError('workingHours is required and must be an object');
  }

  // Validate structure
  for (const day of DAYS) {
    const schedule = workingHours[day] as DaySchedule | undefined;
    if (!schedule) continue;
    if (typeof schedule.enabled !== 'boolean') {
      throw new ValidationError(`workingHours.${day}.enabled must be a boolean`);
    }
    if (schedule.enabled) {
      if (schedule.open && !TIME_RE.test(schedule.open)) {
        throw new ValidationError(`workingHours.${day}.open must be in HH:MM format`);
      }
      if (schedule.close && !TIME_RE.test(schedule.close)) {
        throw new ValidationError(`workingHours.${day}.close must be in HH:MM format`);
      }
    }
  }

  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!branch) throw new NotFoundError('Branch not found');

  await db.update(dentalBranches)
    .set({ workingHours: JSON.stringify(workingHours), updatedAt: new Date(), updatedBy: user.id })
    .where(eq(dentalBranches.id, branchId));

  return ctx.json({ branchId, workingHours }, 200);
}
