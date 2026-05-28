import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

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

export interface CreateMeasurementInput {
  type: string
  geometry: unknown
  measurementValue?: number | null
  measurementUnit?: string | null
}

export function useMeasurements(imageId: string) {
  const queryClient = useQueryClient()
  const queryKey = ['measurements', imageId]

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ImagingAnnotation[]> => {
      const res = await fetch(`/dental/imaging/images/${imageId}/measurements`)
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as { items: ImagingAnnotation[] }
      return data.items
    },
    enabled: Boolean(imageId),
    staleTime: 30_000,
  })

  const createMeasurement = useMutation({
    mutationFn: async (input: CreateMeasurementInput): Promise<ImagingAnnotation> => {
      const res = await fetch(`/dental/imaging/images/${imageId}/measurements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<ImagingAnnotation>
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
      const res = await fetch(`/dental/imaging/measurements/${measurementId}`, {
        method: 'DELETE',
      })
      if (!res.ok && res.status !== 204) throw new Error(await res.text())
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
