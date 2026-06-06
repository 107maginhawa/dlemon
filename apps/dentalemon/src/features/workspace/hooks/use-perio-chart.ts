/**
 * usePerioChart — fetch/create/update/complete a per-visit perio chart.
 *
 * Mirrors the use-recalls.ts wrapper shape: SDK hooks against the dental API,
 * typed with the generated SDK response types, with centralized query-key
 * invalidation. Components stay dumb — they call startChart / upsertReading /
 * completeChart and read { chart, readings, isLoading, isError, ... }.
 *
 * API (services/api-ts/src/handlers/dental-perio):
 *   GET  /dental/visits/:visitId/perio-chart            → 200 chart | 204/404 none yet
 *   POST /dental/perio-charts                           → 201 chart
 *   PUT  /dental/perio-charts/:chartId/readings/:tooth  → 200 reading (draft only)
 *   POST /dental/perio-charts/:chartId/complete         → 200 summary + stage/grade
 *
 * Errors surface as a single toast (V-FE-ERR-001); the raw error message is
 * mapped to clinician-readable copy for the known perio error codes.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getVisitPerioChartQueryKey,
  createPerioChartMutation,
  upsertToothReadingMutation,
  completePerioChartMutation,
} from '@monobase/sdk-ts/generated/react-query';
import { getVisitPerioChart } from '@monobase/sdk-ts/generated';
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

interface UsePerioChartArgs {
  visitId: string;
  patientId: string;
  enabled?: boolean;
}

export function usePerioChart({ visitId, patientId, enabled = true }: UsePerioChartArgs) {
  const qc = useQueryClient();

  // The SDK GetVisitPerioChartResponse is `PerioChart | void` (200 | 204).
  // 404 is also surfaced as null per the original contract: "no chart yet" state.
  // We use a custom queryFn that calls getVisitPerioChart directly (without
  // throwOnError) so we can intercept 204 and 404 and return null instead of
  // letting TanStack Query surface them as error state.
  const query = useQuery({
    queryKey: getVisitPerioChartQueryKey({ path: { visitId } }),
    queryFn: async (): Promise<PerioChart | null> => {
      const result = await getVisitPerioChart({ path: { visitId } });
      const response = result.response;
      // 204 No Content or 404 — no chart exists yet (the "start exam" state).
      if (response?.status === 204 || response?.status === 404) return null;
      if (!response?.ok) {
        throw new Error(`Failed to fetch perio chart (${response?.status ?? 0})`);
      }
      const data = result.data;
      // If SDK returned a plain object (Content-Type: application/json), use it directly.
      if (data && typeof data === 'object' && 'id' in (data as object)) {
        return data as PerioChart;
      }
      // Fallback A: SDK returned a raw JSON string (happy-dom test env returns the
      // response body text verbatim when no Content-Type header is set).
      if (typeof data === 'string' && data) {
        try {
          const parsed: unknown = JSON.parse(data);
          if (parsed && typeof parsed === 'object' && 'id' in (parsed as object)) return parsed as PerioChart;
        } catch {
          /* not valid JSON */
        }
      }
      // Fallback B: SDK returned a ReadableStream (production browser env with no
      // Content-Type). Read the response text and parse manually.
      if (!response.bodyUsed) {
        try {
          const text = await response.text();
          if (text) {
            const parsed: unknown = JSON.parse(text);
            if (parsed && typeof parsed === 'object' && 'id' in (parsed as object)) return parsed as PerioChart;
          }
        } catch {
          /* empty or non-JSON body */
        }
      }
      return null;
    },
    enabled: enabled && Boolean(visitId),
    staleTime: 15_000,
    retry: (failureCount, error: unknown) => {
      // Don't retry 404 (no chart exists yet) — that's expected.
      if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 404) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const chart = query.data ?? null;
  const chartId = chart?.id ?? null;

  function onError(err: unknown) {
    const raw = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
    // Map SDK error body codes to clinician copy if available.
    const body = err && typeof err === 'object' && 'body' in err
      ? (err as { body?: { code?: string } }).body
      : undefined;
    const friendly =
      (body?.code && PERIO_ERROR_MESSAGES[body.code]) ||
      (err && typeof err === 'object' && 'code' in err && typeof (err as { code?: unknown }).code === 'string'
        ? PERIO_ERROR_MESSAGES[(err as { code: string }).code] ?? raw
        : raw);
    toast.error(friendly);
  }

  const startChart = useMutation({
    ...createPerioChartMutation(),
    onSuccess: () => qc.invalidateQueries({ queryKey: getVisitPerioChartQueryKey({ path: { visitId } }) }),
    onError,
  });

  const upsertReading = useMutation({
    ...upsertToothReadingMutation(),
    onSuccess: () => qc.invalidateQueries({ queryKey: getVisitPerioChartQueryKey({ path: { visitId } }) }),
    onError,
  });

  const completeChart = useMutation({
    ...completePerioChartMutation(),
    onSuccess: () => qc.invalidateQueries({ queryKey: getVisitPerioChartQueryKey({ path: { visitId } }) }),
    onError,
  });

  return {
    chart,
    readings: chart?.readings ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    startChart: () =>
      startChart.mutate({ body: { visitId, patientId } }),
    upsertReading: (toothNumber: number, body: UpsertToothReadingRequest) => {
      if (!chartId) {
        onError(new PerioApiError('No chart to update yet.', 409));
        return;
      }
      upsertReading.mutate({ path: { chartId, toothNumber }, body });
    },
    completeChart: (body: CompletePerioChartRequest) => {
      if (!chartId) {
        onError(new PerioApiError('No chart to complete yet.', 409));
        return;
      }
      completeChart.mutate({ path: { chartId }, body });
    },
    completion: completeChart.data ?? null,
    completionError: (() => {
      const err = completeChart.error;
      if (!err) return null;
      if (err instanceof PerioApiError) return err;
      // In test environments (no ApiProvider error interceptor), throwOnError throws
      // the raw parsed body ({ code, message }) rather than a wrapped SdkError.
      // Normalize it so the inline error copy renders correctly.
      const body = err && typeof err === 'object' ? err as { code?: string; message?: string; status?: number; body?: { code?: string; message?: string } } : undefined;
      const code = body?.code ?? body?.body?.code;
      const message = body?.message ?? body?.body?.message ?? (err instanceof Error ? err.message : 'Something went wrong.');
      const friendly = (code && PERIO_ERROR_MESSAGES[code]) || message;
      return new PerioApiError(friendly, body?.status ?? 422, code);
    })(),
    isStarting: startChart.isPending,
    isUpserting: upsertReading.isPending,
    isCompleting: completeChart.isPending,
  };
}
