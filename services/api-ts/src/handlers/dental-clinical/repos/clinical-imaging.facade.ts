/**
 * clinical-imaging.facade.ts
 *
 * Facade exposing dental-clinical + dental-visit data to dental-imaging handlers.
 */
import { eq, and, isNull, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalAttachments } from './attachment.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';

export type LegacyAttachmentImage = {
  id: string;
  patientId: string;
  visitId: string;
  imageType: 'xray' | 'photo' | 'scan' | 'document' | 'other';
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  toothNumbers: number[] | null;
  createdAt: Date;
  deletedAt: Date | null;
};

export async function getLegacyAttachmentImages(
  db: DatabaseInstance,
  patientId: string,
  branchId: string,
): Promise<LegacyAttachmentImage[]> {
  const rows = await db
    .select({
      id: dentalAttachments.id,
      patientId: dentalAttachments.patientId,
      visitId: dentalAttachments.visitId,
      imageType: dentalAttachments.imageType,
      fileName: dentalAttachments.fileName,
      mimeType: dentalAttachments.mimeType,
      fileSizeBytes: dentalAttachments.fileSizeBytes,
      toothNumbers: dentalAttachments.toothNumbers,
      createdAt: dentalAttachments.createdAt,
      deletedAt: dentalAttachments.deletedAt,
    })
    .from(dentalAttachments)
    .innerJoin(dentalVisits, eq(dentalAttachments.visitId, dentalVisits.id))
    .where(
      and(
        eq(dentalAttachments.patientId, patientId),
        eq(dentalVisits.branchId, branchId),
        isNull(dentalAttachments.deletedAt),
        inArray(dentalAttachments.imageType, ['xray', 'photo', 'scan']),
      ),
    );
  return rows as LegacyAttachmentImage[];
}
