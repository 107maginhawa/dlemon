import { useQuery } from '@tanstack/react-query'
import { apiBaseUrl } from '@/lib/config'
import type { CephAnalysis } from './use-ceph-landmarks'

export type { CephAnalysis }

export function useCephAnalysis(imageId: string, analysisType: string = 'steiner_hybrid_sn') {
  const query = useQuery({
    // analysisType in the key so the switcher refetches per protocol; the commit
    // mutation's invalidate(['ceph-analysis', imageId]) prefix-matches all types.
    queryKey: ['ceph-analysis', imageId, analysisType],
    queryFn: async (): Promise<CephAnalysis> => {
      const qs = `?analysisType=${encodeURIComponent(analysisType)}`
      const res = await fetch(`${apiBaseUrl}/dental/imaging/images/${imageId}/ceph/analysis${qs}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(await res.text())
      // GET /ceph/analysis returns the list-response shape {items, analysis};
      // the analysis lives under .analysis.
      const data = (await res.json()) as { analysis: CephAnalysis }
      return data.analysis
    },
    enabled: Boolean(imageId),
    staleTime: 30_000,
    // A tier-gate 403 (free/null imaging tier) will never succeed on retry, so
    // surface it to the addon/upgrade UI immediately instead of running the
    // default 3× exponential backoff first (which delayed the gate >15s under
    // load and flaked the B01 journey). Other (transient) errors still retry.
    retry: (failureCount, error) => {
      const msg = error instanceof Error ? error.message : String(error)
      if (/403|forbidden|imaging_tier_required/i.test(msg)) return false
      return failureCount < 2
    },
  })

  return {
    analysis: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
