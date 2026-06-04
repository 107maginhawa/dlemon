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

export function useRecallDueList({ branchId, from, to }: UseRecallDueListOptions) {
  const query = useQuery({
    ...listDueRecallsOptions({
      query: {
        branchId: branchId as string,
        ...(from ? { from } : {}),
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
