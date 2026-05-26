/**
 * Seed: Dental audit log entries (P2-005)
 *
 * 4 realistic clinical/billing audit events attributed to Dr. Reyes,
 * covering treatment creation, invoice issuance, discount application,
 * and visit notes signing.
 */
import type { DatabaseInstance } from './types';
import { dentalAudit } from '@/db/audit.schema';
import {
  ORG_ID,
  PERSON_JUAN_ID,
  PERSON_ROSA_ID,
  TREATMENT_01,
  INVOICE_01,
  VISIT_NOTE_01,
  AUDIT_01,
  AUDIT_02,
  AUDIT_03,
  AUDIT_04,
} from './ids';

// Dr. Reyes person ID (owner/admin person)
const DR_REYES_PERSON_ID = 'c0000000-0000-1000-8000-000000000001';

export async function seedAuditLogs(db: DatabaseInstance): Promise<void> {
  console.log('   Seeding audit log entries...');

  await db.insert(dentalAudit).values([
    // 1. Treatment created for Juan
    {
      id: AUDIT_01,
      personId: DR_REYES_PERSON_ID,
      action: 'dental_treatment.created',
      resourceType: 'dental_treatment',
      resourceId: TREATMENT_01,
      tenantId: ORG_ID,
      timestamp: new Date('2024-11-15T09:12:00Z'),
      metadata: {
        patientId: PERSON_JUAN_ID,
        description: 'Tooth #14 composite restoration — created during visit',
      },
    },
    // 2. Invoice issued for Juan
    {
      id: AUDIT_02,
      personId: DR_REYES_PERSON_ID,
      action: 'dental_invoice.issued',
      resourceType: 'dental_invoice',
      resourceId: INVOICE_01,
      tenantId: ORG_ID,
      timestamp: new Date('2024-11-15T10:45:00Z'),
      metadata: {
        patientId: PERSON_JUAN_ID,
        totalAmount: 4500,
        currency: 'PHP',
      },
    },
    // 3. Discount applied on Rosa's invoice
    {
      id: AUDIT_03,
      personId: DR_REYES_PERSON_ID,
      action: 'dental_discount.applied',
      resourceType: 'dental_invoice',
      resourceId: null,
      tenantId: ORG_ID,
      timestamp: new Date('2024-11-18T11:20:00Z'),
      metadata: {
        patientId: PERSON_ROSA_ID,
        discountPercent: 10,
        reason: 'Senior citizen discount',
      },
    },
    // 4. Visit notes signed for Rosa
    {
      id: AUDIT_04,
      personId: DR_REYES_PERSON_ID,
      action: 'visit_notes.signed',
      resourceType: 'dental_visit_note',
      resourceId: VISIT_NOTE_01,
      tenantId: ORG_ID,
      timestamp: new Date('2024-11-18T14:05:00Z'),
      metadata: {
        patientId: PERSON_ROSA_ID,
        signedAt: '2024-11-18T14:05:00Z',
      },
    },
  ]).onConflictDoNothing();

  console.log('   4 audit log entries (treatment, invoice, discount, notes signed)');
}
