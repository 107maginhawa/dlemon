/**
 * useMeasurements — TanStack Query hook for imaging annotations/measurements
 *
 * API: GET/POST /dental/imaging/images/{imageId}/measurements
 *      DELETE /dental/imaging/measurements/{measurementId}
 */
import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  imagingMgmtListMeasurementsOptions,
  imagingMgmtListMeasurementsQueryKey,
} from '@monobase/sdk-ts/generated/react-query'
import {
  imagingMgmtCreateMeasurement,
  imagingMgmtDeleteMeasurement,
  imagingMgmtUpdateMeasurement,
  type DentalImagingModuleImagingAnnotation,
  type DentalImagingModuleCreateMeasurementBody,
  type DentalImagingModuleUpdateMeasurementBody,
  type DentalImagingModuleMeasurementListResponse,
} from '@monobase/sdk-ts/generated'

// View-model: preserve string-dated shape consumers already depend on.
export interface ImagingAnnotation {
  id: string
  imageId: string
  type: string
  geometry: unknown
  measurementValue: number | null
  measurementUnit: string | null
  visible: boolean
  createdAt: string
}

const toIso = (d: Date | string | undefined | null): string =>
  d == null ? '' : d instanceof Date ? d.toISOString() : String(d)

const toViewModel = (a: DentalImagingModuleImagingAnnotation): ImagingAnnotation => ({
  id: a.id,
  imageId: a.imageId,
  type: a.type,
  geometry: a.geometry,
  measurementValue: a.measurementValue,
  measurementUnit: a.measurementUnit,
  visible: a.visible,
  createdAt: toIso(a.createdAt),
})

export interface CreateMeasurementInput {
  type: string
  geometry: unknown
  measurementValue?: number | null
  measurementUnit?: string | null
}

// Edit/move patch. `type` is immutable server-side, so it's absent. geometry is the
// full new geometry object for the annotation's kind (drag/resize/retype all send it).
export interface UpdateMeasurementInput {
  id: string
  geometry?: Record<string, unknown>
  measurementValue?: number | null
  measurementUnit?: string | null
  visible?: boolean
}

export function useMeasurements(imageId: string) {
  const queryClient = useQueryClient()
  const queryKey = imagingMgmtListMeasurementsQueryKey({ path: { imageId } })

  const query = useQuery({
    ...imagingMgmtListMeasurementsOptions({ path: { imageId } }),
    enabled: Boolean(imageId),
    staleTime: 30_000,
    select: (data): ImagingAnnotation[] => {
      // SDK returns DentalImagingModuleMeasurementListResponse | ErrorResponse
      // (the latter discriminated by a top-level `error` object).
      if (!data || 'error' in data) return []
      return data.items.map(toViewModel)
    },
  })

  const createMeasurement = useMutation({
    mutationFn: async (input: CreateMeasurementInput): Promise<ImagingAnnotation> => {
      const { data } = await imagingMgmtCreateMeasurement({
        path: { imageId },
        body: {
          type: input.type as DentalImagingModuleCreateMeasurementBody['type'],
          geometry: input.geometry as { [key: string]: unknown },
          ...(input.measurementValue != null ? { measurementValue: input.measurementValue } : {}),
          ...(input.measurementUnit != null ? { measurementUnit: input.measurementUnit } : {}),
        },
        throwOnError: true,
      })
      // data is DentalImagingModuleImagingAnnotation | ErrorResponse — narrow first
      // (ErrorResponse is discriminated by a top-level `error` object).
      if (!data || 'error' in data) throw new Error('Unexpected error response from createMeasurement')
      return toViewModel(data)
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey })
      // The query cache holds the raw SDK response { items: [...] } (the `select`
      // above reads `data.items`). Optimistic updates MUST preserve that shape —
      // treating it as a bare array makes the spread throw on a non-iterable object.
      const previous = queryClient.getQueryData<DentalImagingModuleMeasurementListResponse>(queryKey)
      const tempItem = {
        id: `temp-${Date.now()}`,
        imageId,
        type: input.type as DentalImagingModuleImagingAnnotation['type'],
        geometry: (input.geometry ?? {}) as { [key: string]: unknown },
        measurementValue: input.measurementValue ?? null,
        measurementUnit: input.measurementUnit ?? null,
        toothNumber: null,
        visible: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies DentalImagingModuleImagingAnnotation
      queryClient.setQueryData<DentalImagingModuleMeasurementListResponse>(queryKey, (old) => ({
        items: [...(old?.items ?? []), tempItem],
      }))
      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  const updateMeasurement = useMutation({
    mutationFn: async ({ id, ...patch }: UpdateMeasurementInput): Promise<ImagingAnnotation> => {
      const { data } = await imagingMgmtUpdateMeasurement({
        path: { measurementId: id },
        body: patch as DentalImagingModuleUpdateMeasurementBody,
        throwOnError: true,
      })
      if (!data || 'error' in data) throw new Error('Unexpected error response from updateMeasurement')
      return toViewModel(data)
    },
    onMutate: async ({ id, ...patch }) => {
      await queryClient.cancelQueries({ queryKey })
      // Same { items: [...] } cache shape as create/delete — patch the matching item.
      const previous = queryClient.getQueryData<DentalImagingModuleMeasurementListResponse>(queryKey)
      queryClient.setQueryData<DentalImagingModuleMeasurementListResponse>(queryKey, (old) =>
        old
          ? {
              items: old.items.map((m) =>
                m.id === id ? { ...m, ...patch, geometry: (patch.geometry ?? m.geometry) as { [key: string]: unknown } } : m,
              ),
            }
          : old,
      )
      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteMeasurement = useMutation({
    mutationFn: async (measurementId: string): Promise<void> => {
      await imagingMgmtDeleteMeasurement({
        path: { measurementId },
        throwOnError: true,
      })
    },
    onMutate: async (measurementId) => {
      await queryClient.cancelQueries({ queryKey })
      // Same { items: [...] } cache shape as createMeasurement — filter inside it.
      const previous = queryClient.getQueryData<DentalImagingModuleMeasurementListResponse>(queryKey)
      queryClient.setQueryData<DentalImagingModuleMeasurementListResponse>(queryKey, (old) =>
        old ? { items: old.items.filter((m) => m.id !== measurementId) } : old,
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  // Pure-local geometry patch for live drag/resize — mutate the cache only, no
  // network (mirrors ceph dragLandmark). Commit once on pointer-up via
  // updateMeasurement.mutate. Not wrapped in the {items} previous/rollback dance
  // because pointer-up's mutation owns the server round-trip + rollback.
  const patchMeasurementLocal = useCallback(
    (id: string, geometry: Record<string, unknown>) => {
      queryClient.setQueryData<DentalImagingModuleMeasurementListResponse>(queryKey, (old) =>
        old
          ? {
              items: old.items.map((m) =>
                m.id === id ? { ...m, geometry: geometry as { [key: string]: unknown } } : m,
              ),
            }
          : old,
      )
    },
    // queryKey is a stable value for a given imageId (SDK builds it deterministically).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, imageId],
  )

  return {
    measurements: query.data ?? [],
    isLoading: query.isLoading,
    createMeasurement,
    updateMeasurement,
    patchMeasurementLocal,
    deleteMeasurement,
  }
}
