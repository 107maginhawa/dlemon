/**
 * useVisits — TanStack Query hook for patient visits
 *
 * Replaces the broken use-visit.ts (which always returned null).
 * Returns the full visit list plus a convenience activeVisit derived value.
 *
 * API: GET /dental/visits?patientId=
 */
import { useQuery } from '@tanstack/react-query';
import { listDentalVisitsOptions } from '@monobase/sdk-ts/generated/react-query';
import type { DentalVisit } from '@monobase/sdk-ts/generated';

// The timeline/breakdown consumers and their local formatDate(iso: string) helpers
// treat visit timestamps as ISO strings. The SDK types them as Date and the
// listDentalVisits transformer converts them to Date objects at runtime, so this
// view-model keeps them as strings (normalized below) — the consumer contract.
export interface Visit {
  id: string;
  patientId: string;
  status: DentalVisit['status'];
  // E3: 'general' (dentist-led) or 'hygiene' (hygienist-led). Scopes which roles
  // may sign the visit's notes — see canSignNotesForVisitType.
  visitType: DentalVisit['visitType'];
  chiefComplaint?: string;
  createdAt: string;
  activatedAt?: string;
  completedAt?: string;
  lockedAt?: string;
}

const toIso = (d: Date | string | undefined): string | undefined =>
  d == null ? undefined : d instanceof Date ? d.toISOString() : String(d);

interface UseVisitsOptions {
  patientId: string;
  branchId?: string | null;
}

export function useVisits({ patientId, branchId }: UseVisitsOptions) {
  const query = useQuery({
    ...listDentalVisitsOptions({
      query: {
        patientId: patientId as string,
        ...(branchId ? { branchId: branchId as string } : {}),
      },
    }),
    enabled: !!patientId,
    // Cause-fix (oli QA_ESCAPES §6): consume the SDK DentalVisit and map it to the
    // string-dated view-model the consumers expect — no `as unknown as`. tsc now
    // checks every field-access against the real backend type.
    select: (data): Visit[] => {
      const items = Array.isArray(data) ? data : (data?.data ?? []);
      // Discarded (abandoned/auto-discarded) visits are not part of the patient's
      // clinical timeline — exclude them so they don't render as ghost cards or
      // count toward the open-visit / New-Visit gating.
      return items
        .filter((v) => v.status !== 'discarded')
        .map((v) => ({
        id: v.id,
        patientId: v.patientId,
        status: v.status,
        visitType: v.visitType,
        chiefComplaint: v.chiefComplaint,
        createdAt: toIso(v.createdAt) ?? '',
        activatedAt: toIso(v.activatedAt),
        completedAt: toIso(v.completedAt),
        lockedAt: toIso(v.lockedAt),
      }));
    },
  });

  const visits = query.data ?? [];
  const activeVisit = visits.find((v) => v.status === 'active') ?? null;

  return {
    visits,
    activeVisit,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
