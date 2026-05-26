/**
 * Seed: Dental attachment records (P2-006)
 *
 * 2 attachment records: a dental X-ray for Juan dela Cruz and a consent
 * form PDF for Rosa Reyes. Both reference existing visits.
 */
import type { DatabaseInstance } from './types';
import { dentalAttachments } from '@/handlers/dental-clinical/repos/attachment.schema';
import {
  PATIENT_JUAN_ID,
  PATIENT_ROSA_ID,
  VISIT_01,
  VISIT_03,
  ATTACHMENT_01,
  ATTACHMENT_02,
} from './ids';

export async function seedAttachments(db: DatabaseInstance): Promise<void> {
  console.log('   Seeding attachment records...');

  await db.insert(dentalAttachments).values([
    // 1. Periapical X-ray for Juan dela Cruz (Visit 1)
    {
      id: ATTACHMENT_01,
      visitId: VISIT_01,
      patientId: PATIENT_JUAN_ID,
      imageType: 'xray',
      toothNumbers: [14, 15],
      fileName: 'juan-periapical-xray-2024-11-15.jpg',
      filePath: 'attachments/d1000000-0000-1000-8000-000000000001/juan-periapical-xray-2024-11-15.jpg',
      fileSizeBytes: 524288,
      mimeType: 'image/jpeg',
      note: 'Periapical X-ray — teeth #14 and #15 pre-restoration assessment',
      createdBy: 'c0000000-0000-1000-8000-000000000001',
      updatedBy: 'c0000000-0000-1000-8000-000000000001',
    },
    // 2. Consent form PDF for Rosa Reyes (Visit 3)
    {
      id: ATTACHMENT_02,
      visitId: VISIT_03,
      patientId: PATIENT_ROSA_ID,
      imageType: 'document',
      toothNumbers: null,
      fileName: 'rosa-consent-form-2024-11-18.pdf',
      filePath: 'attachments/d1000000-0000-1000-8000-000000000002/rosa-consent-form-2024-11-18.pdf',
      fileSizeBytes: 102400,
      mimeType: 'application/pdf',
      note: 'Signed patient consent form — orthodontic treatment',
      createdBy: 'c0000000-0000-1000-8000-000000000001',
      updatedBy: 'c0000000-0000-1000-8000-000000000001',
    },
  ]).onConflictDoNothing();

  console.log('   2 attachment records (Juan: X-ray, Rosa: consent form PDF)');
}
