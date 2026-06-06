/**
 * useMeasurements — TanStack Query hook for imaging annotations/measurements
 *
 * API: GET/POST /dental/imaging/images/{imageId}/measurements
 *      DELETE /dental/imaging/measurements/{measurementId}
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  imagingMgmtListMeasurementsOptions,
  imagingMgmtListMeasurementsQueryKey,
} from '@monobase/sdk-ts/generated/react-query'
import {
  imagingMgmtCreateMeasurement,
  imagingMgmtDeleteMeasurement,
  type DentalImagingModuleImagingAnnotation,
  type DentalImagingModuleCreateMeasurementBody,
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
      const previous = queryClient.getQueryData<ImagingAnnotation[]>(queryKey)
      const tempItem: ImagingAnnotation = {
        id: `temp-${Date.now()}`,
        imageId,
        type: input.type,
        geometry: input.geometry,
        measurementValue: input.measurementValue ?? null,
        measurementUnit: input.measurementUnit ?? null,
        visible: true,
        createdAt: new Date().toISOString(),
      }
      queryClient.setQueryData<ImagingAnnotation[]>(queryKey, (old) => [...(old ?? []), tempItem])
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
      const previous = queryClient.getQueryData<ImagingAnnotation[]>(queryKey)
      queryClient.setQueryData<ImagingAnnotation[]>(queryKey, (old) =>
        (old ?? []).filter((m) => m.id !== measurementId),
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

  return {
    measurements: query.data ?? [],
    isLoading: query.isLoading,
    createMeasurement,
    deleteMeasurement,
  }
}
