/**
 * Seed: Sync log entries for Phil Fernan (offline-created scenario — P1-004)
 *
 * Phil was registered on a tablet while the clinic had no internet.
 * Two records were created locally and are awaiting server sync.
 */
import type { DatabaseInstance } from './types';
import { dentalSyncLogs } from '@/handlers/dental-patient/repos/sync-log.schema';
import {
  BRANCH_ID, DR_REYES_MEMBERSHIP_ID,
  PATIENT_PHIL_ID,
  SYNC_01, SYNC_02,
} from './ids';

export async function seedSyncLogs(db: DatabaseInstance): Promise<void> {
  console.log('   Seeding sync logs...');

  await db.insert(dentalSyncLogs).values([
    // Phil patient record — created offline, pending upload
    {
      id: SYNC_01,
      localId: 'local-phil-patient-001',
      serverId: PATIENT_PHIL_ID,
      entityType: 'dental_patient',
      entityId: PATIENT_PHIL_ID,
      branchId: BRANCH_ID,
      syncStatus: 'pending',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Phil intake form — created offline, failed to sync (network timeout)
    {
      id: SYNC_02,
      localId: 'local-phil-intake-001',
      entityType: 'dental_medical_history',
      entityId: PATIENT_PHIL_ID,
      branchId: BRANCH_ID,
      syncStatus: 'failed',
      error: 'Network timeout — retry pending',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
  ]).onConflictDoNothing();

  console.log('   ✅ 2 sync log entries (Phil: 1 pending, 1 failed)');
}
