import { useQuery } from '@tanstack/react-query'
import type { CephAnalysis } from './use-ceph-landmarks'

export type { CephAnalysis }

export function useCephAnalysis(imageId: string) {
  const query = useQuery({
    queryKey: ['ceph-analysis', imageId],
    queryFn: async (): Promise<CephAnalysis> => {
      const res = await fetch(`/dental/imaging/images/${imageId}/ceph/analysis`)
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<CephAnalysis>
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
