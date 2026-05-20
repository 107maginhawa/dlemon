/**
 * Seed: Medical history entries for Ben, Rosa, Carlos
 */
import type { DatabaseInstance } from './types';
import { medicalHistoryEntries } from '@/handlers/dental-clinical/repos/medical-history.schema';
import {
  PATIENT_BEN_ID, PATIENT_ROSA_ID, PATIENT_CARLOS_ID,
  MH_01, MH_02, MH_03, MH_04, MH_05, MH_06,
  DR_REYES_MEMBERSHIP_ID,
} from './ids';

export async function seedMedicalHistory(db: DatabaseInstance): Promise<void> {
  console.log('   Seeding medical history...');

  await db.insert(medicalHistoryEntries).values([
    // Ben Aquino — Type 2 Diabetes
    {
      id: MH_01,
      patientId: PATIENT_BEN_ID,
      entryType: 'condition',
      codeSystem: 'ICD-10',
      code: 'E11',
      displayName: 'Type 2 diabetes mellitus',
      notes: 'Diagnosed 2015, controlled with metformin. HbA1c 7.1% last check.',
      onsetDate: '2015-06-01',
      active: true,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Ben Aquino — Warfarin
    {
      id: MH_02,
      patientId: PATIENT_BEN_ID,
      entryType: 'medication',
      codeSystem: 'RxNorm',
      code: '855332',
      displayName: 'Warfarin 5mg daily',
      notes: 'For atrial fibrillation. INR target 2.0-3.0. Must coordinate with cardiologist before extractions.',
      active: true,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Ben Aquino — Penicillin allergy
    {
      id: MH_03,
      patientId: PATIENT_BEN_ID,
      entryType: 'allergy',
      codeSystem: 'RxNorm',
      code: '7980',
      displayName: 'Penicillin allergy',
      notes: 'Rash and swelling reported. Use clindamycin as alternative.',
      active: true,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Rosa Reyes — Hypertension
    {
      id: MH_04,
      patientId: PATIENT_ROSA_ID,
      entryType: 'condition',
      codeSystem: 'ICD-10',
      code: 'I10',
      displayName: 'Essential hypertension',
      notes: 'Controlled with medication. BP average 130/80.',
      onsetDate: '2020-01-15',
      active: true,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Rosa Reyes — Amlodipine
    {
      id: MH_05,
      patientId: PATIENT_ROSA_ID,
      entryType: 'medication',
      codeSystem: 'RxNorm',
      code: '329526',
      displayName: 'Amlodipine 5mg daily',
      notes: 'For hypertension management.',
      active: true,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Carlos Santos — Asthma
    {
      id: MH_06,
      patientId: PATIENT_CARLOS_ID,
      entryType: 'condition',
      codeSystem: 'ICD-10',
      code: 'J45',
      displayName: 'Asthma, controlled',
      notes: 'Mild intermittent. Uses salbutamol inhaler PRN. No recent exacerbations.',
      onsetDate: '2005-03-10',
      active: true,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
  ]).onConflictDoNothing();

  console.log('   ✅ 6 medical history entries');
}
