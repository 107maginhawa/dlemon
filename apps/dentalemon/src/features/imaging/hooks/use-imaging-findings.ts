/**
 * useImagingFindings — TanStack Query hook for imaging findings CRUD
 *
 * API: GET/POST /dental/imaging/images/{imageId}/findings
 *      PATCH /dental/imaging/findings/{findingId}
 *      DELETE /dental/imaging/findings/{findingId}
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  imagingFindingsMgmtListFindingsOptions,
  imagingFindingsMgmtListFindingsQueryKey,
} from '@monobase/sdk-ts/generated/react-query'
import {
  imagingFindingsMgmtCreateFinding,
  imagingFindingsMgmtUpdateFinding,
  imagingFindingsMgmtDeleteFinding,
  type DentalImagingModuleImagingFinding,
  type DentalImagingModuleImagingFindingType,
  type DentalImagingModuleImagingFindingStatus,
} from '@monobase/sdk-ts/generated'
import { logger } from '@/lib/logger'

// Re-export SDK types so consumers keep the same import path.
export type ImagingFindingType = DentalImagingModuleImagingFindingType
export type ImagingFindingStatus = DentalImagingModuleImagingFindingStatus

// View-model: match the SDK shape but with string dates (consumers use ISO strings).
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

const toIso = (d: Date | string | undefined | null): string =>
  d == null ? '' : d instanceof Date ? d.toISOString() : String(d)

const toViewModel = (f: DentalImagingModuleImagingFinding): ImagingFinding => ({
  id: f.id,
  imageId: f.imageId,
  annotationId: f.annotationId,
  treatmentId: f.treatmentId,
  visitId: f.visitId,
  patientId: f.patientId,
  branchId: f.branchId,
  type: f.type,
  status: f.status,
  toothNumber: f.toothNumber,
  surfaces: f.surfaces ?? null,
  note: f.note,
  createdAt: toIso(f.createdAt),
  updatedAt: toIso(f.updatedAt),
})

interface CreateFindingInput {
  type: ImagingFindingType
  status?: ImagingFindingStatus
  toothNumber?: number | null
  surfaces?: string[] | null
  note?: string | null
  annotationId?: string | null
  // visitId/patientId/branchId are required by the backend but callers that have
  // already scoped to an image may omit them; they are forwarded if provided.
  visitId?: string
  patientId?: string
  branchId?: string
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
  const enabled = (opts?.enabled ?? true) && Boolean(imageId)

  const listOptions = imagingFindingsMgmtListFindingsOptions({
    path: { imageId },
  })

  const queryKey = imagingFindingsMgmtListFindingsQueryKey({ path: { imageId } })

  const query = useQuery({
    ...listOptions,
    enabled,
    staleTime: 30_000,
    select: (data): ImagingFinding[] => {
      // SDK returns DentalImagingModuleImagingFindingListResponse | ErrorResponse.
      // Narrow to the success shape: { items: [...] }.
      if (!data || 'error' in data) return []
      return data.items.map(toViewModel)
    },
  })

  const createFinding = useMutation({
    mutationFn: async (input: CreateFindingInput): Promise<ImagingFinding> => {
      const { data } = await imagingFindingsMgmtCreateFinding({
        path: { imageId },
        body: {
          type: input.type,
          ...(input.status != null ? { status: input.status } : {}),
          ...(input.toothNumber != null ? { toothNumber: input.toothNumber } : {}),
          ...(input.surfaces != null ? { surfaces: input.surfaces } : {}),
          ...(input.note != null ? { note: input.note } : {}),
          ...(input.annotationId != null ? { annotationId: input.annotationId } : {}),
          // The backend requires these fields; callers should provide them. If absent
          // they are omitted from the body and the server will 422 — that is correct.
          ...(input.visitId != null ? { visitId: input.visitId } : {}),
          ...(input.patientId != null ? { patientId: input.patientId } : {}),
          ...(input.branchId != null ? { branchId: input.branchId } : {}),
        } as Parameters<typeof imagingFindingsMgmtCreateFinding>[0]['body'],
        throwOnError: true,
      })
      // data is DentalImagingModuleImagingFinding | ErrorResponse — narrow first.
      if (!data || 'error' in data) throw new Error('Unexpected error response from createFinding')
      return toViewModel(data)
    },
    onError: (e) => logger.error('imaging-findings', 'mutation failed', e),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  const updateFinding = useMutation({
    mutationFn: async ({
      findingId,
      data: input,
    }: {
      findingId: string
      data: UpdateFindingInput
    }): Promise<ImagingFinding> => {
      const { data } = await imagingFindingsMgmtUpdateFinding({
        path: { findingId },
        body: {
          ...(input.type != null ? { type: input.type } : {}),
          ...(input.status != null ? { status: input.status } : {}),
          ...(input.toothNumber != null ? { toothNumber: input.toothNumber } : {}),
          ...(input.surfaces != null ? { surfaces: input.surfaces } : {}),
          ...(input.note != null ? { note: input.note } : {}),
        },
        throwOnError: true,
      })
      // data is DentalImagingModuleImagingFinding | ErrorResponse — narrow first.
      if (!data || 'error' in data) throw new Error('Unexpected error response from updateFinding')
      return toViewModel(data)
    },
    onError: (e) => logger.error('imaging-findings', 'mutation failed', e),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteFinding = useMutation({
    mutationFn: async (findingId: string): Promise<void> => {
      await imagingFindingsMgmtDeleteFinding({
        path: { findingId },
        throwOnError: true,
      })
    },
    onError: (e) => logger.error('imaging-findings', 'mutation failed', e),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  return {
    findings: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    // CONF-IMG-L2-001 (V-IMG-004): surface the list-query error so the UI can
    // render it instead of swallowing failures (tier-block / 422) into console.
    error: query.error,
    // CONF-IMG-L2-001 (V-IMG-004): readable surface for the most recent mutation
    // failure (tier-block 402/403, validation 422, etc.) for visible error UI.
    mutationError:
      createFinding.error ?? updateFinding.error ?? deleteFinding.error ?? null,
    createFinding,
    updateFinding,
    deleteFinding,
  }
}
