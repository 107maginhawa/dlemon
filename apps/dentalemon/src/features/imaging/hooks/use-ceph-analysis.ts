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
  })

  return {
    analysis: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
