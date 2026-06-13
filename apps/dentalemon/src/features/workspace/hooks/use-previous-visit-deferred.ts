/**
 * usePreviousVisitDeferred — FIX-002 (Batch B) carry-over candidate source.
 *
 * The visit-completion gate forbids completing a visit with diagnosed/planned treatments,
 * so a completed prior visit never holds pending work to auto-carry. The functional
 * carry-over path (FR1.11) is restoring DEFERRED (dismissed) treatments from the previous
 * visit. getTreatmentPlan excludes dismissed, so this hook reads the previous visit's own
 * treatment list and returns the dismissed treatment ids — the candidates for restore.
 *
 * "Previous visit" = the most recent visit that is not the just-created destination visit.
 */
import { useQuery } from '@tanstack/react-query';
import { listDentalTreatmentsOptions } from '@monobase/sdk-ts/generated/react-query';

interface VisitLike {
  id: string;
  createdAt: string;
}

interface UsePreviousVisitDeferredOptions {
  visits: VisitLike[];
  currentVisitId: string | null;
}

export function usePreviousVisitDeferred({ visits, currentVisitId }: UsePreviousVisitDeferredOptions) {
  const previousVisit = visits
    .filter((v) => v.id !== currentVisitId)
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const query = useQuery({
    ...listDentalTreatmentsOptions({ path: { visitId: (previousVisit?.id ?? '') as string } }),
    enabled: !!previousVisit?.id,
    select: (data) => {
      const items = Array.isArray(data) ? data : (data?.data ?? []);
      return items.filter((t) => t.status === 'dismissed').map((t) => t.id);
    },
  });

  return {
    deferredIds: query.data ?? [],
    previousVisitId: previousVisit?.id ?? null,
    isLoading: query.isLoading,
  };
}
