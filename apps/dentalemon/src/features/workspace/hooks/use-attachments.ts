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
import { apiBaseUrl } from '@/utils/config';

const API = apiBaseUrl;

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

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchAttachments(visitId: string): Promise<DentalAttachment[]> {
  const res = await fetch(`${API}/dental/visits/${visitId}/attachments`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to load attachments (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.data ?? []);
}

// ---------------------------------------------------------------------------
// Upload (presigned URL flow)
// ---------------------------------------------------------------------------

async function uploadAttachment(
  visitId: string,
  patientId: string,
  input: UploadAttachmentInput,
): Promise<DentalAttachment> {
  const { file, imageType, toothNumbers, note } = input;

  // Step 1: request presigned upload URL
  const initRes = await fetch(`${API}/storage/files/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      filename: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    }),
  });
  if (!initRes.ok) throw new Error(`Failed to initiate upload (${initRes.status})`);
  const { file: fileId, uploadUrl, uploadMethod } = await initRes.json();

  // Step 2: upload to presigned URL
  const putRes = await fetch(uploadUrl, {
    method: uploadMethod ?? 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!putRes.ok) throw new Error(`Failed to upload file (${putRes.status})`);

  // Step 3: complete upload
  const completeRes = await fetch(`${API}/storage/files/${fileId}/complete`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!completeRes.ok) throw new Error(`Failed to complete upload (${completeRes.status})`);

  // Step 4: create attachment record
  const attRes = await fetch(`${API}/dental/visits/${visitId}/attachments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      visitId,
      patientId,
      imageType,
      fileName: file.name,
      filePath: fileId,
      fileSizeBytes: file.size,
      mimeType: file.type || 'application/octet-stream',
      toothNumbers: toothNumbers ?? [],
      note: note ?? '',
    }),
  });
  if (!attRes.ok) throw new Error(`Failed to create attachment record (${attRes.status})`);
  return attRes.json();
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

async function deleteAttachment(visitId: string, attachmentId: string): Promise<void> {
  const res = await fetch(
    `${API}/dental/visits/${visitId}/attachments/${attachmentId}`,
    { method: 'DELETE', credentials: 'include' },
  );
  if (!res.ok) throw new Error(`Failed to delete attachment (${res.status})`);
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAttachments(visitId: string | null) {
  return useQuery({
    queryKey: ['attachments', visitId],
    queryFn: () => fetchAttachments(visitId!),
    enabled: Boolean(visitId),
    staleTime: 30_000,
  });
}

export function useUploadAttachment(visitId: string | null, patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadAttachmentInput) =>
      uploadAttachment(visitId!, patientId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attachments', visitId] });
    },
  });
}

export function useDeleteAttachment(visitId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(visitId!, attachmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attachments', visitId] });
    },
  });
}
