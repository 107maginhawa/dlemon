/**
 * useTreatmentReport — TanStack Query hook for the treatment report
 *
 * Fetches all visits for a branch, then fetches treatments per visit.
 * Groups treatments by CDT code with count and total billed.
 *
 * API: GET /dental/visits?branchId=  then  GET /dental/visits/{visitId}/treatments
 */
import { useQuery, useQueries } from '@tanstack/react-query';
import { listDentalVisitsOptions } from '@monobase/sdk-ts/generated/react-query';
import { listDentalTreatmentsOptions } from '@monobase/sdk-ts/generated/react-query';

// ─── Exported types ─────────────────────────────────────────────────────────

export interface TreatmentRow {
  cdtCode: string;
  description: string;
  priceCents: number;
  createdAt: string;
}

export interface CdtGroup {
  cdtCode: string;
  description: string;
  count: number;
  totalCents: number;
}

// ─── Pure helpers (exported for tests) ──────────────────────────────────────

export function groupByCdtCode(treatments: TreatmentRow[]): CdtGroup[] {
  const map = new Map<string, CdtGroup>();
  for (const t of treatments) {
    const existing = map.get(t.cdtCode);
    if (existing) {
      existing.count += 1;
      existing.totalCents += t.priceCents;
    } else {
      map.set(t.cdtCode, {
        cdtCode: t.cdtCode,
        description: t.description,
        count: 1,
        totalCents: t.priceCents,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalCents - a.totalCents);
}

export function filterByDateRange(
  treatments: TreatmentRow[],
  startDate: string,
  endDate: string,
): TreatmentRow[] {
  if (!startDate && !endDate) return treatments;
  return treatments.filter((t) => {
    const d = t.createdAt.slice(0, 10);
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  });
}

// ─── Hook options ───────────────────────────────────────────────────────────

export interface UseTreatmentReportOptions {
  branchId?: string;
  startDate?: string;
  endDate?: string;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useTreatmentReport(options: UseTreatmentReportOptions) {
  const { branchId, startDate = '', endDate = '' } = options;

  // Step 1: Fetch all visits for the branch
  const visitsQuery = useQuery({
    ...listDentalVisitsOptions({
      query: {
        branchId: branchId || undefined,
        limit: 100,
      },
    }),
    enabled: !!branchId,
  });

  // Extract visit IDs
  const visits = visitsQuery.data;
  const visitIds: string[] = (() => {
    if (!visits) return [];
    if (Array.isArray(visits)) return visits.map((v: { id: string }) => v.id);
    const data = (visits as Record<string, unknown>).data;
    if (Array.isArray(data)) return data.map((v: { id: string }) => v.id);
    return [];
  })();

  // Step 2: Fetch treatments for each visit (parallel queries)
  const treatmentQueries = useQueries({
    queries: visitIds.map((visitId) => ({
      ...listDentalTreatmentsOptions({
        path: { visitId },
      }),
      enabled: visitIds.length > 0,
    })),
  });

  const isLoadingTreatments = treatmentQueries.some((q) => q.isLoading);
  const isLoading = visitsQuery.isLoading || (visitIds.length > 0 && isLoadingTreatments);

  // Step 3: Flatten all treatments into TreatmentRow[]
  const allTreatments: TreatmentRow[] = treatmentQueries
    .filter((q) => q.data)
    .flatMap((q) => {
      const data = q.data;
      const items: Array<{
        cdtCode: string;
        description: string;
        priceCents: number | bigint;
        createdAt: string | Date;
      }> = Array.isArray(data)
        ? data
        : ((data as Record<string, unknown>)?.data as typeof items) ?? [];
      return items.map((t) => ({
        cdtCode: t.cdtCode,
        description: t.description,
        priceCents: Number(t.priceCents),
        createdAt: typeof t.createdAt === 'string' ? t.createdAt : (t.createdAt as Date).toISOString(),
      }));
    });

  // Step 4: Filter by date range and group
  const filtered = filterByDateRange(allTreatments, startDate, endDate);
  const grouped = groupByCdtCode(filtered);

  return {
    grouped,
    allTreatments: filtered,
    isLoading,
    error: visitsQuery.error,
    totalCount: filtered.length,
    totalBilledCents: filtered.reduce((sum, t) => sum + t.priceCents, 0),
  };
}
