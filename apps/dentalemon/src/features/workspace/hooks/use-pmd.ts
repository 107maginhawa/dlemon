/**
 * usePMD — TanStack Query hook for fetching the PMD document for a visit
 *
 * API: GET /dental/visits/:visitId/pmd
 * Returns the PMDDocument for the given visitId, or null if not found.
 */
import { useQuery } from '@tanstack/react-query';
import { getPmdForVisitOptions } from '@monobase/sdk-ts/generated/react-query';
import { SdkError } from '@monobase/sdk-ts/client';
import type { PmdDocument } from '@monobase/sdk-ts/generated';
import type { PMDDocument } from '@/features/pmd/types';

// Cause-fix (oli QA_ESCAPES §6): map the SDK PmdDocument to the pmd feature's
// app-facing PMDDocument explicitly instead of an `as unknown as`. The app
// contract uses ISO-string dates (createdAt/signedAt) — the SDK + getPmdForVisit
// transformer give Date — so normalize them here; tsc checks every field-access.
const toIso = (d: Date | string | null | undefined): string | null =>
  d == null ? null : d instanceof Date ? d.toISOString() : String(d);

function toPMDDocument(d: PmdDocument): PMDDocument {
  return {
    id: d.id,
    visitId: d.visitId,
    patientId: d.patientId,
    status: d.status,
    content: d.content,
    signature: d.signature ?? null,
    signedAt: toIso(d.signedAt),
    supersedesId: d.supersedesId ?? null,
    checksum: d.checksum,
    createdAt: toIso(d.createdAt) ?? '',
  };
}

export function usePMD(visitId: string | null) {
  const options = getPmdForVisitOptions({ path: { visitId: visitId as string } });
  // Pin the generics: queryFn yields the generated `PmdDocument | null` (the
  // 404→null contract widens the union), `select` maps that to the app-facing
  // `PMDDocument | null`. Without explicit generics the null widening defeats
  // the useQuery overload and `data` silently falls back to `PmdDocument`.
  return useQuery<PmdDocument | null, Error, PMDDocument | null, typeof options.queryKey>({
    queryKey: options.queryKey,
    // A visit with no PMD yet returns 404 — that's "none", not an error. Honor
    // the documented "null if not found" contract (matches app.tsx person-404).
    queryFn: async (ctx) => {
      try {
        return await options.queryFn!(ctx);
      } catch (error) {
        if (error instanceof SdkError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: !!visitId,
    retry: false,
    select: (data) => (data ? toPMDDocument(data) : null),
  });
}
