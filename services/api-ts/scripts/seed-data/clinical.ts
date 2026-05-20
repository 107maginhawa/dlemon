/**
 * Seed: Prescriptions and lab orders
 */
import type { DatabaseInstance } from './types';
import { prescriptions } from '@/handlers/dental-clinical/repos/prescription.schema';
import { labOrders } from '@/handlers/dental-clinical/repos/lab-order.schema';
import {
  DR_REYES_MEMBERSHIP_ID,
  PATIENT_BEN_ID, PATIENT_ROSA_ID, PATIENT_CARLOS_ID,
  VISIT_04, VISIT_06, VISIT_09, VISIT_10,
  RX_01, RX_02, RX_03,
  LAB_ORDER_01, LAB_ORDER_02,
} from './ids';

export async function seedClinical(db: DatabaseInstance): Promise<void> {
  console.log('   Seeding prescriptions and lab orders...');

  // ── Prescriptions ─────────────────────────────────────────────────
  await db.insert(prescriptions).values([
    // Ben V2 (extraction) — amoxicillin
    {
      id: RX_01,
      visitId: VISIT_09,
      patientId: PATIENT_BEN_ID,
      prescriberMemberId: DR_REYES_MEMBERSHIP_ID,
      rxNormCode: '308182',
      drugName: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'TID (3x daily)',
      duration: '5 days',
      quantity: '15 capsules',
      instructions: 'Take after meals. Complete full course even if symptoms improve.',
      dispenseAsWritten: false,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Ben V2 (extraction) — ibuprofen
    {
      id: RX_02,
      visitId: VISIT_09,
      patientId: PATIENT_BEN_ID,
      prescriberMemberId: DR_REYES_MEMBERSHIP_ID,
      rxNormCode: '197803',
      drugName: 'Ibuprofen',
      dosage: '400mg',
      frequency: 'PRN (as needed for pain)',
      duration: '3-5 days',
      quantity: '10 tablets',
      instructions: 'Take with food. Do not exceed 3 tablets per day. Note: coordinate with warfarin — monitor for bruising.',
      dispenseAsWritten: false,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Rosa V2 (root canal) — mefenamic acid
    {
      id: RX_03,
      visitId: VISIT_04,
      patientId: PATIENT_ROSA_ID,
      prescriberMemberId: DR_REYES_MEMBERSHIP_ID,
      rxNormCode: '197851',
      drugName: 'Mefenamic Acid',
      dosage: '500mg',
      frequency: 'PRN (as needed for pain)',
      duration: '3 days',
      quantity: '9 capsules',
      instructions: 'Take after meals as needed for pain. Maximum 3 capsules per day.',
      dispenseAsWritten: false,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
  ]).onConflictDoNothing();

  // ── Lab Orders ────────────────────────────────────────────────────
  await db.insert(labOrders).values([
    // Carlos V2 — PFM Crown tooth #19
    {
      id: LAB_ORDER_01,
      visitId: VISIT_06,
      patientId: PATIENT_CARLOS_ID,
      labName: 'Manila Dental Lab',
      description: 'PFM Crown for tooth #19. Shade A2. Polyvinyl siloxane impression enclosed.',
      status: 'in_fabrication',
      orderedAt: new Date('2026-04-07T02:30:00Z'),
      expectedDeliveryDate: new Date('2026-05-14T00:00:00+08:00'),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Ben V3 — Complete Denture upper
    {
      id: LAB_ORDER_02,
      visitId: VISIT_10,
      patientId: PATIENT_BEN_ID,
      labName: 'Makati Dental Lab',
      description: 'Complete Denture — maxillary. Alginate primary impression. Custom tray needed.',
      status: 'ordered',
      orderedAt: new Date('2026-05-05T02:00:00Z'),
      expectedDeliveryDate: new Date('2026-05-20T00:00:00+08:00'),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
  ]).onConflictDoNothing();

  console.log('   ✅ 3 prescriptions, 2 lab orders');
}
