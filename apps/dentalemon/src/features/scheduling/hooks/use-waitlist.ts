/**
 * useWaitlist — PP-5 (ISSUE-039) front-desk waitlist (short-notice fills).
 *
 * GET  /dental/branches/:branchId/waitlist?status=active  — fillable entries
 * POST /dental/waitlist/:entryId/promote                  — book a slot + mark scheduled
 *
 * Promote books a `scheduled` appointment for the chosen window/provider, so on
 * success we invalidate BOTH the waitlist (the entry leaves the active list) and
 * the appointments list (the new booking shows on the calendar).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listWaitlistOptions,
  listWaitlistQueryKey,
  promoteWaitlistEntryMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type { DentalWaitlistModuleWaitlistEntry } from '@monobase/sdk-ts/generated';

export type WaitlistUrgency = 'routine' | 'soon' | 'asap';

export interface WaitlistEntry {
  id: string;
  patientId: string;
  patientName?: string;
  branchId: string;
  preferredProviderId: string | null;
  visitType: string | null;
  urgency: WaitlistUrgency;
  status: 'active' | 'scheduled' | 'cancelled';
  notes: string | null;
  createdAt: string;
}

function toEntry(raw: DentalWaitlistModuleWaitlistEntry): WaitlistEntry {
  return {
    id: raw.id,
    patientId: raw.patientId,
    // Not enriched server-side today (same as the queue board) — read it if a later
    // slice adds it; the panel falls back to a truncated id.
    patientName: (raw as DentalWaitlistModuleWaitlistEntry & { patientName?: string }).patientName,
    branchId: raw.branchId,
    preferredProviderId: raw.preferredProviderId ?? null,
    visitType: raw.visitType ?? null,
    urgency: raw.urgency,
    status: raw.status,
    notes: raw.notes ?? null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : (raw.createdAt as Date).toISOString(),
  };
}

export function useWaitlist(branchId?: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    ...listWaitlistOptions({ path: { branchId: branchId ?? '' }, query: { status: 'active' } }),
    enabled: Boolean(branchId),
    staleTime: 30_000,
    select: (data): WaitlistEntry[] => (Array.isArray(data) ? (data as DentalWaitlistModuleWaitlistEntry[]).map(toEntry) : []),
  });

  const promote = useMutation({
    ...promoteWaitlistEntryMutation(),
    onSuccess: () => {
      if (branchId) {
        qc.invalidateQueries({ queryKey: listWaitlistQueryKey({ path: { branchId }, query: { status: 'active' } }) });
      }
      // refresh the calendar — promote just booked an appointment
      qc.invalidateQueries({ predicate: (q) => (q.queryKey[0] as { _id?: string })?._id === 'listAppointments' });
    },
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    promote: promote.mutateAsync,
    isPromoting: promote.isPending,
  };
}
