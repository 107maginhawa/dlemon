import { useQuery } from '@tanstack/react-query'
import type { components } from '@monobase/api-spec/types'
import { apiBaseUrl } from '@/lib/config'

export type PatientImageItem = components['schemas']['DentalImagingModule.PatientImageItem']

export function useImagingStudies(patientId: string, branchId?: string) {
  return useQuery({
    queryKey: ['imaging', 'patient', patientId, branchId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (branchId) params.set('branchId', branchId)
      const res = await fetch(`${apiBaseUrl}/dental/patients/${patientId}/images?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{ items: PatientImageItem[]; total: number }>
    },
    enabled: Boolean(patientId) && Boolean(branchId),
    staleTime: 30_000,
  })
}
