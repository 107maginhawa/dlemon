/**
 * useImageLibrary / useImageLinks — TanStack Query hooks for G5 image-library writes
 *
 * API: PATCH  /dental/imaging/images/{imageId}/metadata   (isDiagnostic/quality/tags)
 *      POST   /dental/imaging/images/{imageId}/links      (context link)
 *      GET    /dental/imaging/images/{imageId}/links      (per-image links)
 *      DELETE /dental/imaging/links/{linkId}              (remove link)
 *
 * Every write invalidates the patient image-list query so badges/filters refresh.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  imagingMgmtListImageLinksOptions,
  imagingMgmtListImageLinksQueryKey,
  patientImageMgmtListPatientImagesQueryKey,
} from '@monobase/sdk-ts/generated/react-query'
import {
  imagingMgmtUpdateImageMetadata,
  imagingMgmtUpdateImageModality,
  imagingMgmtDeleteImage,
  imagingMgmtCreateImageLink,
  imagingMgmtDeleteImageLink,
  type DentalImagingModuleUpdateImageMetadataBody,
  type DentalImagingModuleModalityEnum,
  type DentalImagingModuleImagingLink,
} from '@monobase/sdk-ts/generated'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'
import { toastError } from '@/lib/error-toast'

export type ImageLinkType = DentalImagingModuleImagingLink['linkType']
export type ImageModality = DentalImagingModuleModalityEnum

export interface ImageLinkView {
  id: string
  imageId: string
  linkType: ImageLinkType
  targetId: string
}

const toLinkView = (l: DentalImagingModuleImagingLink): ImageLinkView => ({
  id: l.id,
  imageId: l.imageId,
  linkType: l.linkType,
  targetId: l.targetId,
})

interface UseImageLibraryArgs {
  patientId: string
  branchId: string
}

interface UpdateMetadataInput {
  imageId: string
  body: DentalImagingModuleUpdateImageMetadataBody
}

interface CreateLinkInput {
  imageId: string
  linkType: ImageLinkType
  targetId: string
}

/**
 * useImageLibrary — metadata + context-link write mutations for an image. Each
 * mutation invalidates the patient image list (and the per-image links query) so
 * the list's badges, filters and link chips reflect the change.
 */
export function useImageLibrary({ patientId, branchId }: UseImageLibraryArgs) {
  const queryClient = useQueryClient()

  const invalidateList = () => {
    void queryClient.invalidateQueries({
      queryKey: patientImageMgmtListPatientImagesQueryKey({
        path: { patientId },
        query: { branchId },
      }),
    })
  }

  const invalidateLinks = (imageId: string) => {
    void queryClient.invalidateQueries({
      queryKey: imagingMgmtListImageLinksQueryKey({ path: { imageId } }),
    })
  }

  const updateMetadata = useMutation({
    mutationFn: async ({ imageId, body }: UpdateMetadataInput) => {
      const { data } = await imagingMgmtUpdateImageMetadata({
        path: { imageId },
        body,
        throwOnError: true,
      })
      if (!data || 'error' in data) throw new Error('Unexpected error response from updateImageMetadata')
      return data
    },
    onSuccess: () => toast.success('Image updated'),
    onError: (e) => {
      logger.error('image-library', 'updateMetadata failed', e)
      toastError(e, 'Could not update the image.')
    },
    onSettled: () => invalidateList(),
  })

  const updateModality = useMutation({
    mutationFn: async ({ imageId, modality }: { imageId: string; modality: ImageModality }) => {
      const { data } = await imagingMgmtUpdateImageModality({
        path: { imageId },
        body: { modality },
        throwOnError: true,
      })
      if (!data || 'error' in data) throw new Error('Unexpected error response from updateImageModality')
      return data
    },
    onSuccess: () => toast.success('Image type updated'),
    onError: (e) => {
      logger.error('image-library', 'updateModality failed', e)
      toastError(e, 'Could not update the image type.')
    },
    onSettled: () => invalidateList(),
  })

  const deleteImage = useMutation({
    // Soft-delete (archive). The 200 body is ignored — the list refetch is the
    // source of truth; the archived image drops out of listPatientImages.
    mutationFn: async ({ imageId }: { imageId: string }): Promise<void> => {
      await imagingMgmtDeleteImage({ path: { imageId }, throwOnError: true })
    },
    onSuccess: () => toast.success('Image deleted'),
    onError: (e) => {
      logger.error('image-library', 'deleteImage failed', e)
      toastError(e, 'Could not delete the image.')
    },
    onSettled: () => invalidateList(),
  })

  const createLink = useMutation({
    mutationFn: async ({ imageId, linkType, targetId }: CreateLinkInput): Promise<ImageLinkView> => {
      const { data } = await imagingMgmtCreateImageLink({
        path: { imageId },
        body: { linkType, targetId },
        throwOnError: true,
      })
      if (!data || 'error' in data) throw new Error('Unexpected error response from createImageLink')
      return toLinkView(data)
    },
    onSuccess: () => toast.success('Image linked'),
    onError: (e) => {
      logger.error('image-library', 'createLink failed', e)
      toastError(e, 'Could not link the image.')
    },
    onSettled: (_data, _err, vars) => {
      invalidateList()
      invalidateLinks(vars.imageId)
    },
  })

  const deleteLink = useMutation({
    mutationFn: async ({ linkId }: { linkId: string; imageId?: string }): Promise<void> => {
      await imagingMgmtDeleteImageLink({ path: { linkId }, throwOnError: true })
    },
    onSuccess: () => toast.success('Link removed'),
    onError: (e) => {
      logger.error('image-library', 'deleteLink failed', e)
      toastError(e, 'Could not remove the link.')
    },
    onSettled: (_data, _err, vars) => {
      invalidateList()
      if (vars.imageId) invalidateLinks(vars.imageId)
    },
  })

  return {
    updateMetadata,
    updateModality,
    deleteImage,
    createLink,
    deleteLink,
    mutationError:
      updateMetadata.error ??
      updateModality.error ??
      deleteImage.error ??
      createLink.error ??
      deleteLink.error ??
      null,
  }
}

/** useImageLinks — per-image context links (fresh source for the editor). */
export function useImageLinks(imageId: string, opts?: { enabled?: boolean }) {
  const enabled = (opts?.enabled ?? true) && Boolean(imageId)
  const query = useQuery({
    ...imagingMgmtListImageLinksOptions({ path: { imageId } }),
    enabled,
    staleTime: 30_000,
    select: (data): ImageLinkView[] => {
      if (!data || 'error' in data) return []
      return data.items.map(toLinkView)
    },
  })
  return {
    links: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}
