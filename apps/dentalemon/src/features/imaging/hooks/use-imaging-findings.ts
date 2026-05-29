/**
 * useImagingFindings — TanStack Query hook for imaging findings CRUD
 *
 * Provides list query + create/update/delete mutations for findings on an image.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface ImagingFinding {
  id: string
  imageId: string
  findingCode: string
  toothNumber?: string
  surface?: string
  severity?: string
  note?: string
  createdAt: string
}

export interface CreateFindingInput {
  findingCode: string
  toothNumber?: string
  surface?: string
  severity?: string
  note?: string
}

interface UseImagingFindingsResult {
  findings: ImagingFinding[]
  isLoading: boolean
  isError: boolean
  error: unknown
  /**
   * CONF-IMG-L2-001: readable surface for the last mutation failure
   * (tier-block 402/403, validation 422, etc.) so a component can render it
   * instead of the error being swallowed into console.error only.
   */
  mutationError: Error | null
  createFinding: ReturnType<typeof useMutation<ImagingFinding, Error, CreateFindingInput>>
  updateFinding: ReturnType<typeof useMutation<ImagingFinding, Error, { id: string } & Partial<CreateFindingInput>>>
  deleteFinding: ReturnType<typeof useMutation<void, Error, string>>
}

export function useImagingFindings(imageId: string): UseImagingFindingsResult {
  const queryClient = useQueryClient()

  const findingsQuery = useQuery<ImagingFinding[]>({
    queryKey: ['imaging-findings', imageId],
    queryFn: async () => {
      const res = await fetch(`/dental/imaging/images/${imageId}/findings`)
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<ImagingFinding[]>
    },
  })

  const createFinding = useMutation<ImagingFinding, Error, CreateFindingInput>({
    mutationFn: async (input) => {
      const res = await fetch(`/dental/imaging/images/${imageId}/findings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<ImagingFinding>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imaging-findings', imageId] })
    },
    onError: (err) => {
      console.error('[useImagingFindings] create failed:', err)
    },
  })

  const updateFinding = useMutation<ImagingFinding, Error, { id: string } & Partial<CreateFindingInput>>({
    mutationFn: async ({ id, ...patch }) => {
      const res = await fetch(`/dental/imaging/images/${imageId}/findings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<ImagingFinding>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imaging-findings', imageId] })
    },
    onError: (err) => {
      console.error('[useImagingFindings] update failed:', err)
    },
  })

  const deleteFinding = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const res = await fetch(`/dental/imaging/images/${imageId}/findings/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(await res.text())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imaging-findings', imageId] })
    },
    onError: (err) => {
      console.error('[useImagingFindings] delete failed:', err)
    },
  })

  return {
    findings: findingsQuery.data ?? [],
    isLoading: findingsQuery.isLoading,
    isError: findingsQuery.isError,
    error: findingsQuery.error,
    // CONF-IMG-L2-001: expose the most recent mutation error so the UI can
    // surface tier-block / validation failures instead of silently logging.
    mutationError:
      createFinding.error ?? updateFinding.error ?? deleteFinding.error ?? null,
    createFinding,
    updateFinding,
    deleteFinding,
  }
}
