/**
 * usePerioChart — fetch/create/update/complete a per-visit perio chart.
 *
 * Mirrors the use-recalls.ts wrapper shape: raw fetch against the dental API,
 * typed with the generated SDK response types, with centralized query-key
 * invalidation. Components stay dumb — they call startChart / upsertReading /
 * completeChart and read { chart, readings, isLoading, isError, ... }.
 *
 * API (services/api-ts/src/handlers/dental-perio):
 *   GET  /dental/visits/:visitId/perio-chart            → 200 chart | 404 none yet
 *   POST /dental/perio-charts                           → 201 chart
 *   PUT  /dental/perio-charts/:chartId/readings/:tooth  → 200 reading (draft only)
 *   POST /dental/perio-charts/:chartId/complete         → 200 summary + stage/grade
 *
 * Errors surface as a single toast (V-FE-ERR-001); the raw error message is
 * mapped to clinician-readable copy for the known perio error codes.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiBaseUrl } from '@/lib/config';
import type {
  PerioChart,
  PerioToothReading,
  CompletePerioChartRequest,
  CompletePerioChartResponse,
  UpsertToothReadingRequest,
} from '@monobase/sdk-ts/generated';

export type { PerioChart, PerioToothReading, CompletePerioChartRequest, CompletePerioChartResponse };

// ---------------------------------------------------------------------------
// Error mapping — perio handler codes → clinician copy (V-FE-ERR-001).
// ---------------------------------------------------------------------------

export const PERIO_ERROR_MESSAGES: Record<string, string> = {
  CHART_COMPLETED: 'This chart is completed and can no longer be edited.',
  VISIT_LOCKED: 'The visit is locked — the chart is read-only.',
  INSUFFICIENT_READINGS: 'Chart at least 16 teeth (8 for primary) before completing.',
  INVALID_GRADE: 'Mobility and furcation must be a grade of 0–3.',
  INVALID_TOOTH_NUMBER: 'That tooth number is not valid for this chart.',
};

export class PerioApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'PerioApiError';
    this.status = status;
    this.code = code;
  }
}

async function readError(res: Response): Promise<PerioApiError> {
  let code: string | undefined;
  let message: string | undefined;
  try {
    const body = (await res.json()) as { code?: string; message?: string };
    code = body.code;
    message = body.message;
  } catch {
    /* non-JSON body */
  }
  const friendly = (code && PERIO_ERROR_MESSAGES[code]) || message || `Request failed (${res.status})`;
  return new PerioApiError(friendly, res.status, code);
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

function visitChartKey(visitId: string) {
  return ['perio-chart', 'visit', visitId] as const;
}

interface UsePerioChartArgs {
  visitId: string;
  patientId: string;
  enabled?: boolean;
}

export function usePerioChart({ visitId, patientId, enabled = true }: UsePerioChartArgs) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: visitChartKey(visitId),
    queryFn: async (): Promise<PerioChart | null> => {
      const res = await fetch(`${apiBaseUrl}/dental/visits/${visitId}/perio-chart`, {
        credentials: 'include',
      });
      // 404 = no chart for this visit yet → not an error, just "start exam" state.
      if (res.status === 404) return null;
      if (!res.ok) throw await readError(res);
      return (await res.json()) as PerioChart;
    },
    enabled: enabled && Boolean(visitId),
    staleTime: 15_000,
  });

  const chart = query.data ?? null;
  const chartId = chart?.id ?? null;

  function onError(err: unknown) {
    const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
    toast.error(message);
  }

  const startChart = useMutation({
    mutationFn: async (): Promise<PerioChart> => {
      const res = await fetch(`${apiBaseUrl}/dental/perio-charts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId, patientId }),
      });
      if (!res.ok) throw await readError(res);
      return (await res.json()) as PerioChart;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: visitChartKey(visitId) }),
    onError,
  });

  const upsertReading = useMutation({
    mutationFn: async ({
      toothNumber,
      body,
    }: {
      toothNumber: number;
      body: UpsertToothReadingRequest;
    }): Promise<PerioToothReading> => {
      if (!chartId) throw new PerioApiError('No chart to update yet.', 409);
      const res = await fetch(
        `${apiBaseUrl}/dental/perio-charts/${chartId}/readings/${toothNumber}`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw await readError(res);
      return (await res.json()) as PerioToothReading;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: visitChartKey(visitId) }),
    onError,
  });

  const completeChart = useMutation({
    mutationFn: async (body: CompletePerioChartRequest): Promise<CompletePerioChartResponse> => {
      if (!chartId) throw new PerioApiError('No chart to complete yet.', 409);
      const res = await fetch(`${apiBaseUrl}/dental/perio-charts/${chartId}/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw await readError(res);
      return (await res.json()) as CompletePerioChartResponse;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: visitChartKey(visitId) }),
    onError,
  });

  return {
    chart,
    readings: chart?.readings ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    startChart: () => startChart.mutate(),
    upsertReading: (toothNumber: number, body: UpsertToothReadingRequest) =>
      upsertReading.mutate({ toothNumber, body }),
    completeChart: (body: CompletePerioChartRequest) => completeChart.mutate(body),
    completion: completeChart.data ?? null,
    completionError: completeChart.error instanceof PerioApiError ? completeChart.error : null,
    isStarting: startChart.isPending,
    isUpserting: upsertReading.isPending,
    isCompleting: completeChart.isPending,
  };
}
