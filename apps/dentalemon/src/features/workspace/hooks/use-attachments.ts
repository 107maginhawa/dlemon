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
import { uploadFile, completeFileUpload, createAttachment, deleteAttachment } from '@monobase/sdk-ts/generated';

export type AttachmentImageType = 'xray' | 'photo' | 'scan' | 'document' | 'other';

export const IMAGE_TYPE_LABELS: Record<AttachmentImageType, string> = {
  xray: 'X-Ray',
  photo: 'Photo',
  scan: 'Scan',
  document: 'Document',
  other: 'Other',
};

export const IMAGE_TYPES = Object.keys(IMAGE_TYPE_LABELS) as AttachmentImageType[];

export interface DentalAttachment {
  id: string;
  visitId: string;
  patientId: string;
  imageType: AttachmentImageType;
  toothNumbers?: number[];
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  mimeType: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface UploadAttachmentInput {
  file: File;
  imageType: AttachmentImageType;
  toothNumbers?: number[];
  note?: string;
}

export function useAttachments(visitId: string | null) {
  return useQuery({
    ...listAttachmentsOptions({ path: { visitId: visitId! } }),
    select: (data) => (Array.isArray(data) ? data : (data as Record<string, unknown>).data ?? []) as unknown as DentalAttachment[],
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
          imageType: imageType as Parameters<typeof createAttachment>[0]['body']['imageType'],
          fileName: file.name,
          filePath: fileId,
          fileSizeBytes: BigInt(file.size),
          mimeType: file.type || 'application/octet-stream',
          toothNumbers: toothNumbers ?? [],
          note: note ?? '',
        },
      });
      return data as unknown as DentalAttachment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listAttachmentsQueryKey({ path: { visitId: visitId! } }) });
    },
  });
}

export function useDeleteAttachment(visitId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      deleteAttachment({ path: { visitId: visitId!, attachmentId }, throwOnError: true } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listAttachmentsQueryKey({ path: { visitId: visitId! } }) });
    },
  });
}
