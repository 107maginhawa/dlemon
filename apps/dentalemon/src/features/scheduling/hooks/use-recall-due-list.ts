/**
 * useRecallDueList — TanStack Query hook for the branch recare due-list (P1-24).
 *
 * GET /dental/recalls/due?branchId=&from=&to= — non-terminal recalls (pending/sent)
 * due within the window, enriched with patient name. Feeds the front-desk
 * continuing-care queue. Uses the generated SDK query options.
 */
import { useQuery } from '@tanstack/react-query';
import { listDueRecallsOptions } from '@monobase/sdk-ts/generated/react-query';

export interface RecallDueItem {
  id: string;
  patientId: string;
  patientName: string;
  type: 'cleaning' | 'checkup' | 'treatment' | 'other';
  dueDate: string;
  status: 'pending' | 'sent' | 'completed' | 'cancelled';
  intervalMonths: number | null;
  sendAttempts: number;
  lastSentAt: string | null;
}

interface UseRecallDueListOptions {
  branchId?: string;
  from?: string;
  to?: string;
}

/**
 * Front-desk recare floor: the due endpoint defaults `from` to today, which
 * silently drops OVERDUE recalls (dueDate in the past) — exactly the patients
 * who most need outreach and a V1-required "Overdue" recare category. The chase
 * queue must look back, so default `from` to a far-past floor unless the caller
 * scopes a narrower window. `to` is left to the backend default (today + 30d).
 */
const RECARE_DUE_FROM_FLOOR = '2000-01-01';

export function useRecallDueList({ branchId, from, to }: UseRecallDueListOptions) {
  const query = useQuery({
    ...listDueRecallsOptions({
      query: {
        branchId: branchId as string,
        from: from ?? RECARE_DUE_FROM_FLOOR,
        ...(to ? { to } : {}),
      },
    }),
    enabled: Boolean(branchId),
    staleTime: 30_000,
    select: (data) => (Array.isArray(data) ? (data as RecallDueItem[]) : []),
  });

  return {
    recalls: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
