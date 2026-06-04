/**
 * availability.service.ts (P1-25)
 *
 * DB-bound composition of the pure availability engine (availability.ts) with
 * the branch config, appointment overlap query, and active-hold query. Produces
 * the list of truly-bookable slots for one branch + visit type + provider set.
 */

import type { DatabaseInstance } from '@/core/database';
import { parseWorkingHours } from './workingHours';
import { getBranchOnlineBookingContext } from '@/handlers/dental-org/repos/org-scheduling.facade';
import { DentalAppointmentRepository } from './repos/dental-appointment.repo';
import { AppointmentHoldRepository } from './repos/appointment-hold.repo';
import {
  generateCandidateSlots,
  isSlotFree,
  type CandidateSlot,
  type OccupiedInterval,
} from './availability';
import {
  parseOnlineBookingConfig,
  durationForVisitType,
  isOnlineBookable,
  type OnlineBookingConfig,
} from './online-booking-config';
import type { VisitType } from './appointment-wire';

export interface AvailabilitySlot extends CandidateSlot {
  providerId: string;
  visitType: VisitType;
}

export class OnlineBookingDisabledError extends Error {}
export class BranchNotFoundError extends Error {}
export class VisitTypeNotBookableError extends Error {}

/**
 * Resolve the set of providers to offer, honoring the config allow-list.
 */
function resolveProviders(
  config: OnlineBookingConfig,
  allProviders: { providerId: string; displayName: string }[],
  requestedProviderId?: string,
): { providerId: string; displayName: string }[] {
  let eligible = allProviders;
  if (config.bookableProviderMemberIds !== 'all') {
    const allow = new Set(config.bookableProviderMemberIds);
    eligible = eligible.filter((p) => allow.has(p.providerId));
  }
  if (requestedProviderId) {
    eligible = eligible.filter((p) => p.providerId === requestedProviderId);
  }
  return eligible;
}

export async function computeAvailability(
  db: DatabaseInstance,
  args: {
    branchId: string;
    visitType: VisitType;
    dateFrom: Date;
    dateTo: Date;
    providerId?: string;
    now?: Date;
  },
): Promise<{ providers: { providerId: string; displayName: string }[]; slots: AvailabilitySlot[]; config: OnlineBookingConfig }> {
  const now = args.now ?? new Date();
  const ctx = await getBranchOnlineBookingContext(db, args.branchId);
  if (!ctx || !ctx.active) throw new BranchNotFoundError('Branch not found');

  const config = parseOnlineBookingConfig(ctx.settings);
  if (!config.enabled) throw new OnlineBookingDisabledError('Online booking is not enabled for this branch');
  if (!isOnlineBookable(config, args.visitType)) {
    throw new VisitTypeNotBookableError(`Visit type '${args.visitType}' is not bookable online`);
  }

  const hours = parseWorkingHours(ctx.workingHours);
  if (!hours) return { providers: [], slots: [], config };

  const providers = resolveProviders(config, ctx.providers, args.providerId);
  if (providers.length === 0) return { providers: ctx.providers, slots: [], config };

  const durationMinutes = durationForVisitType(args.visitType);
  const notBefore = new Date(now.getTime() + config.leadTimeMinutes * 60 * 1000);
  const notAfter = new Date(now.getTime() + config.horizonDays * 24 * 60 * 60 * 1000);

  const apptRepo = new DentalAppointmentRepository(db);
  const holdRepo = new AppointmentHoldRepository(db);

  const slots: AvailabilitySlot[] = [];
  for (const provider of providers) {
    const candidates = generateCandidateSlots({
      hours,
      timezone: ctx.timezone || 'UTC',
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
      stepMinutes: config.slotStepMinutes,
      durationMinutes,
      notBefore,
      notAfter,
    });
    if (candidates.length === 0) continue;

    // Load this provider's occupied intervals once for the window.
    const windowStart = candidates[0]!.startAt;
    const windowEnd = candidates[candidates.length - 1]!.endAt;
    const windowMinutes = Math.ceil((windowEnd.getTime() - windowStart.getTime()) / 60000);

    const appts = await apptRepo.findOverlapping(provider.providerId, args.branchId, windowStart, windowMinutes);
    const holds = await holdRepo.findActiveOverlapping(provider.providerId, args.branchId, windowStart, windowMinutes, now);

    const occupied: OccupiedInterval[] = [
      ...appts.map((a) => ({ startAt: a.scheduledAt, durationMinutes: a.durationMinutes })),
      ...holds.map((h) => ({ startAt: h.startAt, durationMinutes: h.durationMinutes })),
    ];

    for (const c of candidates) {
      if (isSlotFree(c, occupied)) {
        slots.push({ ...c, providerId: provider.providerId, visitType: args.visitType });
      }
    }
  }

  slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime() || a.providerId.localeCompare(b.providerId));
  return { providers, slots, config };
}
