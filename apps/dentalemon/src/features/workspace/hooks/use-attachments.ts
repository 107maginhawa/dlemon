/**
 * useAttachments — TanStack Query hooks for dental visit attachments
 *
 * Upload flow: POST /storage/files/upload → PUT to presigned URL →
 *              POST /storage/files/{file}/complete → POST /dental/visits/{visitId}/attachments
 *
 * API: GET/POST /dental/visits/{visitId}/attachments
 *      DELETE /dental/visits/{visitId}/attachments/{attachmentId}
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAttachmentsOptions, listAttachmentsQueryKey } from '@monobase/sdk-ts/generated/react-query';
import {
  uploadFile,
  completeFileUpload,
  createAttachment,
  deleteAttachment,
  type DentalAttachment,
  type DentalAttachmentImageType,
} from '@monobase/sdk-ts/generated';
import { toastError } from '@/lib/error-toast';

// Cause-fix (oli QA_ESCAPES §6): the image-type enum + attachment row were
// hand-rolled duplicates of the SDK. Alias them — the SDK shape is the truthful
// one (createdAt/updatedAt are Date and fileSizeBytes is bigint at runtime, per
// the dentalAttachment response transformer; the local string/number typings were
// wrong, and formatBytes already accepts bigint).
export type AttachmentImageType = DentalAttachmentImageType;
export type { DentalAttachment };

export const IMAGE_TYPE_LABELS: Record<AttachmentImageType, string> = {
  xray: 'X-Ray',
  photo: 'Photo',
  scan: 'Scan',
  document: 'Document',
  other: 'Other',
};

export const IMAGE_TYPES = Object.keys(IMAGE_TYPE_LABELS) as AttachmentImageType[];

export interface UploadAttachmentInput {
  file: File;
  imageType: AttachmentImageType;
  toothNumbers?: number[];
  note?: string;
}

export function useAttachments(visitId: string | null) {
  return useQuery({
    ...listAttachmentsOptions({ path: { visitId: visitId! } }),
    // SDK response is { data: DentalAttachment[]; pagination } — no cast needed.
    select: (data) => (Array.isArray(data) ? data : (data?.data ?? [])),
    enabled: Boolean(visitId),
    staleTime: 30_000,
  });
}

export function useUploadAttachment(visitId: string | null, patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadAttachmentInput) => {
      const { file, imageType, toothNumbers, note } = input;

      // Step 1: request presigned upload URL
      const { data: uploadData } = await uploadFile({
        body: {
          filename: file.name,
          size: BigInt(file.size),
          mimeType: file.type || 'application/octet-stream',
        },
      });
      if (!uploadData) throw new Error('Failed to initiate upload');
      const { file: fileId, uploadUrl, uploadMethod } = uploadData as { file: string; uploadUrl: string; uploadMethod?: string };

      // Step 2: upload to presigned URL (external S3/MinIO — stays as raw fetch)
      // eslint-disable-next-line no-restricted-syntax -- presigned S3/MinIO PUT, not an API endpoint
      const putRes = await fetch(uploadUrl, {
        method: uploadMethod ?? 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!putRes.ok) throw new Error(`Failed to upload file (${putRes.status})`);

      // Step 3: complete upload
      await completeFileUpload({ path: { file: fileId } });

      // Step 4: create attachment record
      const { data } = await createAttachment({
        path: { visitId: visitId! },
        body: {
          visitId: visitId!,
          patientId,
          imageType,
          fileName: file.name,
          filePath: fileId,
          fileSizeBytes: BigInt(file.size),
          mimeType: file.type || 'application/octet-stream',
          toothNumbers: toothNumbers ?? [],
          note: note ?? '',
        },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listAttachmentsQueryKey({ path: { visitId: visitId! } }) });
    },
    // V-FE-ERR-001: surface upload failures (presign/PUT/complete/record) instead
    // of swallowing the rejected promise at the call site.
    onError: (err) => {
      toastError(err, 'Failed to upload attachment. Please try again.');
    },
  });
}

export function useDeleteAttachment(visitId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      deleteAttachment({ path: { visitId: visitId!, attachmentId }, throwOnError: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listAttachmentsQueryKey({ path: { visitId: visitId! } }) });
    },
    // V-FE-ERR-001: surface delete failures rather than failing silently.
    onError: (err) => {
      toastError(err, 'Failed to delete attachment. Please try again.');
    },
  });
}
