/**
 * case-presentation-imaging.facade.ts
 *
 * Narrow, read-only surface so the P1-20 case-presentation aggregate can list the
 * patient's *own* annotated images (radiographs / intraoral photos that carry
 * clinician findings) without importing the full dental-imaging repo across the
 * module boundary. Follows the same loose-coupling pattern as
 * appointment-link.facade.ts (relative schema import, facade file = boundary-exempt).
 *
 * Returns only minimal, presentation-relevant refs (image id, type, tooth, finding
 * count) — never raw storage keys. The FE reuses the existing imaging overlay +
 * presigned-download pattern to actually render the annotated image.
 */

import { eq, and, count } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { imagingStudyImages } from '../../dental-imaging/repos/imaging.schema';
import { imagingFindings } from '../../dental-imaging/repos/imaging_finding.schema';

export interface CasePresentationImageRef {
  id: string;
  imageType: string;
  toothNumber: number | null;
  findingCount: number;
}

/**
 * The patient's annotated images: every image that carries at least one finding for
 * this patient, with its modality and finding count. Scoped strictly to the given
 * patientId (findings carry a loose patientId ref).
 */
export async function listPatientAnnotatedImages(
  db: DatabaseInstance,
  patientId: string,
): Promise<CasePresentationImageRef[]> {
  const rows = await db
    .select({
      id: imagingStudyImages.id,
      imageType: imagingStudyImages.modality,
      toothNumber: imagingFindings.toothNumber,
      findingCount: count(imagingFindings.id),
    })
    .from(imagingFindings)
    .innerJoin(imagingStudyImages, eq(imagingFindings.imageId, imagingStudyImages.id))
    .where(
      and(
        eq(imagingFindings.patientId, patientId),
        eq(imagingStudyImages.status, 'active'),
      ),
    )
    .groupBy(imagingStudyImages.id, imagingStudyImages.modality, imagingFindings.toothNumber);

  return rows.map((r) => ({
    id: r.id,
    imageType: r.imageType,
    toothNumber: r.toothNumber ?? null,
    findingCount: Number(r.findingCount),
  }));
}
