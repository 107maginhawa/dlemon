import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type ImagingFindingType =
  | 'caries'
  | 'secondary_caries'
  | 'bone_loss'
  | 'furcation_involvement'
  | 'periapical_lesion'
  | 'root_resorption'
  | 'calculus'
  | 'crown_fracture'
  | 'root_fracture'
  | 'impacted_tooth'
  | 'over_eruption'
  | 'open_contact'
  | 'overhang'
  | 'crown_needed'
  | 'implant_needed'

export type ImagingFindingStatus = 'suspected' | 'confirmed' | 'monitoring' | 'resolved'

export interface ImagingFinding {
  id: string
  imageId: string
  annotationId: string | null
  treatmentId: string | null
  visitId: string
  patientId: string
  branchId: string
  type: ImagingFindingType
  status: ImagingFindingStatus
  toothNumber: number | null
  surfaces: string[] | null
  note: string | null
  createdAt: string
  updatedAt: string
}

interface CreateFindingInput {
  type: ImagingFindingType
  status?: ImagingFindingStatus
  toothNumber?: number | null
  surfaces?: string[] | null
  note?: string | null
  annotationId?: string | null
}

interface UpdateFindingInput {
  status?: ImagingFindingStatus
  toothNumber?: number | null
  surfaces?: string[] | null
  note?: string | null
  type?: ImagingFindingType
}

// useImagingFindings — TanStack Query hook for imaging findings CRUD
export function useImagingFindings(imageId: string, opts?: { enabled?: boolean }) {
  const queryClient = useQueryClient()
  const queryKey = ['imaging-findings', imageId]
  const enabled = (opts?.enabled ?? true) && Boolean(imageId)

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ImagingFinding[]> => {
      const res = await fetch(`/dental/imaging/images/${imageId}/findings`)
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as { data: ImagingFinding[] }
      return data.data
    },
    enabled,
    staleTime: 30_000,
  })

  const createFinding = useMutation({
    mutationFn: async (input: CreateFindingInput): Promise<ImagingFinding> => {
      const res = await fetch(`/dental/imaging/images/${imageId}/findings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<ImagingFinding>
    },
    onError: (e) => console.error('[imaging-findings]', e),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  const updateFinding = useMutation({
    mutationFn: async ({
      findingId,
      data,
    }: {
      findingId: string
      data: UpdateFindingInput
    }): Promise<ImagingFinding> => {
      const res = await fetch(`/dental/imaging/findings/${findingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<ImagingFinding>
    },
    onError: (e) => console.error('[imaging-findings]', e),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteFinding = useMutation({
    mutationFn: async (findingId: string): Promise<void> => {
      const res = await fetch(`/dental/imaging/findings/${findingId}`, {
        method: 'DELETE',
      })
      if (!res.ok && res.status !== 204) throw new Error(await res.text())
    },
    onError: (e) => console.error('[imaging-findings]', e),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  return {
    findings: query.data ?? [],
    isLoading: query.isLoading,
    createFinding,
    updateFinding,
    deleteFinding,
  }
}
