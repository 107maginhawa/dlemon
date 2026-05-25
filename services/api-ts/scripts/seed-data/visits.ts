/**
 * Seed: Visits, dental charts, treatments, and visit notes
 */
import type { DatabaseInstance } from './types';
import { eq } from 'drizzle-orm';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { dentalCharts, type ToothChartState } from '@/handlers/dental-visit/repos/dental-chart.schema';
import { dentalTreatments } from '@/handlers/dental-visit/repos/treatment.schema';
import { visitNotes } from '@/handlers/dental-visit/repos/treatment.schema';
import {
  BRANCH_ID, DR_REYES_MEMBERSHIP_ID,
  PATIENT_JUAN_ID, PATIENT_ROSA_ID, PATIENT_CARLOS_ID, PATIENT_LIZA_ID, PATIENT_BEN_ID,
  VISIT_01, VISIT_02, VISIT_03, VISIT_04, VISIT_05, VISIT_06, VISIT_07,
  VISIT_08, VISIT_09, VISIT_10, VISIT_11, VISIT_12, VISIT_13, VISIT_14,
  VISIT_15, VISIT_16, VISIT_17, VISIT_18, VISIT_19, VISIT_20,
  CHART_01, CHART_02, CHART_03, CHART_04, CHART_05, CHART_06, CHART_07,
  CHART_08, CHART_09, CHART_10, CHART_11, CHART_12, CHART_13, CHART_14,
  CHART_15, CHART_16, CHART_17, CHART_18, CHART_19, CHART_20,
  TREATMENT_01, TREATMENT_02, TREATMENT_03, TREATMENT_04, TREATMENT_05,
  TREATMENT_06, TREATMENT_07, TREATMENT_08, TREATMENT_09, TREATMENT_10,
  TREATMENT_11, TREATMENT_12, TREATMENT_13, TREATMENT_14, TREATMENT_15,
  TREATMENT_16, TREATMENT_17, TREATMENT_18, TREATMENT_19, TREATMENT_20,
  TREATMENT_21, TREATMENT_22,
  VISIT_NOTE_01, VISIT_NOTE_02, VISIT_NOTE_03, VISIT_NOTE_04, VISIT_NOTE_05,
  VISIT_NOTE_06, VISIT_NOTE_07, VISIT_NOTE_08, VISIT_NOTE_09, VISIT_NOTE_10,
  VISIT_NOTE_11, VISIT_NOTE_12, VISIT_NOTE_13, VISIT_NOTE_14, VISIT_NOTE_15,
  VISIT_NOTE_16, VISIT_NOTE_17, VISIT_NOTE_18, VISIT_NOTE_19, VISIT_NOTE_20,
} from './ids';

// ── Tooth chart helpers ─────────────────────────────────────────────

// ISO 3950 / FDI permanent tooth numbers (used by backend + this app)
// Upper right: 11–18, Upper left: 21–28, Lower left: 31–38, Lower right: 41–48
const FDI_PERMANENT_TEETH = [
  11, 12, 13, 14, 15, 16, 17, 18,
  21, 22, 23, 24, 25, 26, 27, 28,
  31, 32, 33, 34, 35, 36, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48,
];

/** Generate a full adult dentition (FDI 11–48), mostly healthy */
function healthyTeeth(overrides: Partial<Record<number, Omit<ToothChartState, 'toothNumber'>>>): ToothChartState[] {
  return FDI_PERMANENT_TEETH.map((toothNumber) => {
    const override = overrides[toothNumber];
    return {
      toothNumber,
      state: override?.state ?? 'healthy',
      surfaces: override?.surfaces,
      conditionCode: override?.conditionCode,
      note: override?.note,
    };
  });
}

export async function seedVisits(db: DatabaseInstance): Promise<void> {
  console.log('   Seeding visits...');

  // ── 1. Visits ─────────────────────────────────────────────────────
  await db.insert(dentalVisits).values([
    // Visit 01: Juan V1 — prophylaxis (completed)
    {
      id: VISIT_01,
      patientId: PATIENT_JUAN_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-03-10T01:00:00Z'),
      completedAt: new Date('2026-03-10T02:00:00Z'),
      chiefComplaint: 'Routine cleaning',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 02: Juan V2 — composite filling (completed)
    {
      id: VISIT_02,
      patientId: PATIENT_JUAN_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-04-21T02:00:00Z'),
      completedAt: new Date('2026-04-21T03:30:00Z'),
      chiefComplaint: 'Sensitivity on lower right molar',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 03: Rosa V1 — exam + panoramic (completed)
    {
      id: VISIT_03,
      patientId: PATIENT_ROSA_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-02-28T06:00:00Z'),
      completedAt: new Date('2026-02-28T07:00:00Z'),
      chiefComplaint: 'New patient — comprehensive exam',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 04: Rosa V2 — root canal completed
    {
      id: VISIT_04,
      patientId: PATIENT_ROSA_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-03-31T01:00:00Z'),
      completedAt: new Date('2026-04-30T03:00:00Z'),
      chiefComplaint: 'Tooth #14 pain — root canal treatment',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 05: Carlos V1 — exam + prophylaxis (completed)
    {
      id: VISIT_05,
      patientId: PATIENT_CARLOS_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-03-05T03:00:00Z'),
      completedAt: new Date('2026-03-05T04:00:00Z'),
      chiefComplaint: 'Routine check-up and cleaning',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 06: Carlos V2 — crown prep (completed)
    {
      id: VISIT_06,
      patientId: PATIENT_CARLOS_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-04-07T01:00:00Z'),
      completedAt: new Date('2026-04-07T02:30:00Z'),
      chiefComplaint: 'Crown preparation for tooth #19',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 07: Liza V1 — prophylaxis (completed)
    {
      id: VISIT_07,
      patientId: PATIENT_LIZA_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-04-14T07:00:00Z'),
      completedAt: new Date('2026-04-14T07:45:00Z'),
      chiefComplaint: 'Routine cleaning',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 08: Ben V1 — exam + panoramic (completed)
    {
      id: VISIT_08,
      patientId: PATIENT_BEN_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-03-03T02:00:00Z'),
      completedAt: new Date('2026-03-03T03:00:00Z'),
      chiefComplaint: 'New patient exam — multiple complaints',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 09: Ben V2 — surgical extraction (completed)
    {
      id: VISIT_09,
      patientId: PATIENT_BEN_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-04-21T06:00:00Z'),
      completedAt: new Date('2026-04-21T07:00:00Z'),
      chiefComplaint: 'Extraction of tooth #18',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 10: Ben V3 — denture impression (completed)
    {
      id: VISIT_10,
      patientId: PATIENT_BEN_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-05-05T01:00:00Z'),
      completedAt: new Date('2026-05-05T02:00:00Z'),
      chiefComplaint: 'Denture impression — upper arch',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 11: Juan V3 — follow-up, new caries found (completed)
    {
      id: VISIT_11,
      patientId: PATIENT_JUAN_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-05-08T01:00:00Z'),
      completedAt: new Date('2026-05-08T02:00:00Z'),
      chiefComplaint: 'Six-month recall — sensitivity upper left',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 12: Rosa V3 — root canal obturation (completed)
    {
      id: VISIT_12,
      patientId: PATIENT_ROSA_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-04-14T01:00:00Z'),
      completedAt: new Date('2026-04-14T02:30:00Z'),
      chiefComplaint: 'Root canal obturation — tooth #14',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 13: Rosa V4 — composite on #3 + prophylaxis (completed)
    {
      id: VISIT_13,
      patientId: PATIENT_ROSA_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-05-02T03:00:00Z'),
      completedAt: new Date('2026-05-02T04:30:00Z'),
      chiefComplaint: 'Filling on upper right molar + cleaning',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 14: Carlos V3 — crown cementation (completed)
    {
      id: VISIT_14,
      patientId: PATIENT_CARLOS_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-04-28T01:00:00Z'),
      completedAt: new Date('2026-04-28T01:45:00Z'),
      chiefComplaint: 'Crown cementation — tooth #19',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 15: Carlos V4 — composite filling + watchlist (completed)
    {
      id: VISIT_15,
      patientId: PATIENT_CARLOS_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-05-10T02:00:00Z'),
      completedAt: new Date('2026-05-10T03:00:00Z'),
      chiefComplaint: 'Filling lower right molar + check-up',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 16: Liza V2 — sealants on premolars (completed)
    {
      id: VISIT_16,
      patientId: PATIENT_LIZA_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-05-06T06:00:00Z'),
      completedAt: new Date('2026-05-06T06:45:00Z'),
      chiefComplaint: 'Preventive sealants requested',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 17: Liza V3 — small cavity found on follow-up (completed)
    {
      id: VISIT_17,
      patientId: PATIENT_LIZA_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-05-11T03:00:00Z'),
      completedAt: new Date('2026-05-11T03:45:00Z'),
      chiefComplaint: 'Sharp pain biting on lower left',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 18: Ben V4 — denture try-in + caries treatment (completed)
    {
      id: VISIT_18,
      patientId: PATIENT_BEN_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'completed',
      activatedAt: new Date('2026-05-09T01:00:00Z'),
      completedAt: new Date('2026-05-09T02:30:00Z'),
      chiefComplaint: 'Denture try-in and composite filling #15',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 19: Juan V4 — multiple fillings (active)
    {
      id: VISIT_19,
      patientId: PATIENT_JUAN_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'active',
      activatedAt: new Date('2026-05-12T01:00:00Z'),
      chiefComplaint: 'Multiple fillings — teeth #25 and #36',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Visit 20: Rosa V5 — recall + whitening consult (active)
    {
      id: VISIT_20,
      patientId: PATIENT_ROSA_ID,
      branchId: BRANCH_ID,
      dentistMemberId: DR_REYES_MEMBERSHIP_ID,
      status: 'active',
      activatedAt: new Date('2026-05-12T03:00:00Z'),
      chiefComplaint: 'Six-month recall + whitening consultation',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
  ]).onConflictDoNothing();

  // Ensure VISIT_04 is completed so VISIT_20 (Rosa's active recall) can satisfy
  // the dental_visit_active_patient_unique constraint on re-runs with stale data.
  await db.update(dentalVisits)
    .set({ status: 'completed', completedAt: new Date('2026-04-30T03:00:00Z'), updatedAt: new Date() })
    .where(eq(dentalVisits.id, VISIT_04));

  // ── 2. Dental Charts ──────────────────────────────────────────────
  await db.insert(dentalCharts).values([
    // Juan V1 — mostly healthy
    {
      id: CHART_01,
      visitId: VISIT_01,
      patientId: PATIENT_JUAN_ID,
      teeth: healthyTeeth({
        46: { state: 'caries', surfaces: ['occlusal'], note: 'Early caries noted — watch' }, // #30 (lower right first molar)
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Juan V2 — tooth 30 now filled
    {
      id: CHART_02,
      visitId: VISIT_02,
      patientId: PATIENT_JUAN_ID,
      teeth: healthyTeeth({
        46: { state: 'filled', surfaces: ['occlusal'], note: 'Composite restoration placed' }, // #30 (lower right first molar)
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Rosa V1 — multiple findings
    {
      id: CHART_03,
      visitId: VISIT_03,
      patientId: PATIENT_ROSA_ID,
      teeth: healthyTeeth({
        26: { state: 'caries', surfaces: ['mesial', 'occlusal'], note: 'Deep caries — pulp involvement suspected' }, // #14 (upper left first molar)
        36: { state: 'filled', note: 'Old amalgam filling, marginal integrity OK' }, // #19 (lower left first molar)
        16: { state: 'caries', surfaces: ['distal'], note: 'Small distal caries' }, // #3 (upper right first molar)
        14: { state: 'filled', note: 'Old composite' }, // #5 (upper right second premolar)
        21: { state: 'crown', note: 'PFM crown 2019' }, // #9 (upper left central incisor)
        24: { state: 'filled' }, // #12 (upper left first premolar)
        35: { state: 'caries', surfaces: ['buccal'] }, // #20 (lower left second premolar)
        41: { state: 'missing', note: 'Congenitally missing' }, // #25 (lower right central incisor)
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Rosa V2 — root canal on 14
    {
      id: CHART_04,
      visitId: VISIT_04,
      patientId: PATIENT_ROSA_ID,
      teeth: healthyTeeth({
        26: { state: 'caries', surfaces: ['mesial', 'occlusal'], note: 'Root canal in progress — canals located and cleaned' }, // #14 (upper left first molar)
        36: { state: 'filled' }, // #19 (lower left first molar)
        16: { state: 'caries', surfaces: ['distal'] }, // #3 (upper right first molar)
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Carlos V1 — exam findings
    {
      id: CHART_05,
      visitId: VISIT_05,
      patientId: PATIENT_CARLOS_ID,
      teeth: healthyTeeth({
        36: { state: 'fractured', note: 'Fractured cusp — crown recommended' }, // #19 (lower left first molar)
        26: { state: 'filled', note: 'Existing composite, good condition' }, // #14 (upper left first molar)
        16: { state: 'filled' }, // #3 (upper right first molar)
        21: { state: 'crown' }, // #9 (upper left central incisor)
        46: { state: 'caries', surfaces: ['mesial'] }, // #30 (lower right first molar)
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Carlos V2 — crown prep on 19
    {
      id: CHART_06,
      visitId: VISIT_06,
      patientId: PATIENT_CARLOS_ID,
      teeth: healthyTeeth({
        36: { state: 'crown', note: 'Tooth prepped for PFM crown — temp crown placed' }, // #19 (lower left first molar)
        26: { state: 'filled' }, // #14 (upper left first molar)
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Liza V1 — all healthy
    {
      id: CHART_07,
      visitId: VISIT_07,
      patientId: PATIENT_LIZA_ID,
      teeth: healthyTeeth({}),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Ben V1 — multiple issues (elderly)
    {
      id: CHART_08,
      visitId: VISIT_08,
      patientId: PATIENT_BEN_ID,
      teeth: healthyTeeth({
        18: { state: 'missing', note: 'Previously extracted' }, // #1 (upper right third molar)
        28: { state: 'missing', note: 'Previously extracted' }, // #16 (upper left third molar)
        38: { state: 'missing', note: 'Previously extracted' }, // #17 (lower left third molar)
        17: { state: 'filled', note: 'Old amalgam' }, // #2 (upper right second molar)
        16: { state: 'crown', note: 'PFM crown 2020' }, // #3 (upper right first molar)
        21: { state: 'filled' }, // #9 (upper left central incisor)
        26: { state: 'crown' }, // #14 (upper left first molar)
        43: { state: 'caries', surfaces: ['distal'] }, // #27 (lower right canine)
        37: { state: 'caries', surfaces: ['mesial', 'distal', 'occlusal'], note: 'Grossly decayed — extraction recommended' }, // #18 (lower left second molar)
        46: { state: 'filled' }, // #30 (lower right first molar)
        47: { state: 'filled' }, // #31 (lower right second molar)
        27: { state: 'caries', surfaces: ['occlusal'], note: 'Moderate caries' }, // #15 (upper left second molar)
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Ben V2 — tooth 18 extracted
    {
      id: CHART_09,
      visitId: VISIT_09,
      patientId: PATIENT_BEN_ID,
      teeth: healthyTeeth({
        18: { state: 'missing' }, // #1
        28: { state: 'missing' }, // #16
        38: { state: 'missing' }, // #17
        37: { state: 'extracted', note: 'Surgically extracted this visit' }, // #18 (lower left second molar)
        46: { state: 'filled' }, // #30
        47: { state: 'filled' }, // #31
        27: { state: 'caries', surfaces: ['occlusal'] }, // #15
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Ben V3 — denture impression
    {
      id: CHART_10,
      visitId: VISIT_10,
      patientId: PATIENT_BEN_ID,
      teeth: healthyTeeth({
        18: { state: 'missing' }, // #1
        28: { state: 'missing' }, // #16
        38: { state: 'missing' }, // #17
        37: { state: 'extracted' }, // #18
        46: { state: 'filled' }, // #30
        47: { state: 'filled' }, // #31
        27: { state: 'caries', surfaces: ['occlusal'] }, // #15
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Juan V3 — new caries upper left + existing filling holding
    {
      id: CHART_11,
      visitId: VISIT_11,
      patientId: PATIENT_JUAN_ID,
      teeth: healthyTeeth({
        46: { state: 'filled', surfaces: ['occlusal'], note: 'Existing composite — good condition' },
        25: { state: 'caries', surfaces: ['mesial', 'occlusal'], note: 'MO caries extending to DEJ' },
        36: { state: 'caries', surfaces: ['buccal'], note: 'Early buccal pit caries' },
        17: { state: 'watchlist', surfaces: ['distal'], note: 'Suspicious shadow distal — monitor' },
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Rosa V3 — root canal completed, post-op chart
    {
      id: CHART_12,
      visitId: VISIT_12,
      patientId: PATIENT_ROSA_ID,
      teeth: healthyTeeth({
        26: { state: 'filled', surfaces: ['mesial', 'occlusal'], note: 'Root canal completed — obturation with gutta-percha, composite access restoration' },
        36: { state: 'filled', note: 'Old amalgam — stable' },
        16: { state: 'caries', surfaces: ['distal'], note: 'Distal caries — schedule composite' },
        14: { state: 'filled' },
        21: { state: 'crown' },
        24: { state: 'filled' },
        35: { state: 'caries', surfaces: ['buccal'], note: 'Unchanged from V1' },
        41: { state: 'missing' },
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Rosa V4 — composite on #3 done, prophylaxis
    {
      id: CHART_13,
      visitId: VISIT_13,
      patientId: PATIENT_ROSA_ID,
      teeth: healthyTeeth({
        26: { state: 'filled', surfaces: ['mesial', 'occlusal'] },
        36: { state: 'filled' },
        16: { state: 'filled', surfaces: ['distal'], note: 'Composite placed — 1 surface' },
        14: { state: 'filled' },
        21: { state: 'crown' },
        24: { state: 'filled' },
        35: { state: 'caries', surfaces: ['buccal'], note: 'Small — monitoring, patient declined tx' },
        41: { state: 'missing' },
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Carlos V3 — crown cemented, mesial caries on 46 treated
    {
      id: CHART_14,
      visitId: VISIT_14,
      patientId: PATIENT_CARLOS_ID,
      teeth: healthyTeeth({
        36: { state: 'crown', note: 'PFM crown cemented — occlusion checked, margins sealed' },
        26: { state: 'filled' },
        16: { state: 'filled' },
        21: { state: 'crown' },
        46: { state: 'caries', surfaces: ['mesial'], note: 'Will address next visit' },
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Carlos V4 — 46 filled, watchlist on 15
    {
      id: CHART_15,
      visitId: VISIT_15,
      patientId: PATIENT_CARLOS_ID,
      teeth: healthyTeeth({
        36: { state: 'crown' },
        26: { state: 'filled' },
        16: { state: 'filled' },
        21: { state: 'crown' },
        46: { state: 'filled', surfaces: ['mesial'], note: 'Composite restoration placed' },
        15: { state: 'watchlist', surfaces: ['occlusal'], note: 'Suspicious staining — not cavitated, watch 3 months' },
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Liza V2 — sealants placed, all healthy
    {
      id: CHART_16,
      visitId: VISIT_16,
      patientId: PATIENT_LIZA_ID,
      teeth: healthyTeeth({
        14: { state: 'filled', surfaces: ['occlusal'], note: 'Pit & fissure sealant placed' },
        24: { state: 'filled', surfaces: ['occlusal'], note: 'Pit & fissure sealant placed' },
        34: { state: 'filled', surfaces: ['occlusal'], note: 'Pit & fissure sealant placed' },
        44: { state: 'filled', surfaces: ['occlusal'], note: 'Pit & fissure sealant placed' },
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Liza V3 — small caries found + filled same visit
    {
      id: CHART_17,
      visitId: VISIT_17,
      patientId: PATIENT_LIZA_ID,
      teeth: healthyTeeth({
        14: { state: 'filled', surfaces: ['occlusal'] },
        24: { state: 'filled', surfaces: ['occlusal'] },
        34: { state: 'filled', surfaces: ['occlusal'] },
        44: { state: 'filled', surfaces: ['occlusal'] },
        36: { state: 'filled', surfaces: ['occlusal', 'mesial'], note: 'Caries found and filled same visit — MO composite' },
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Ben V4 — caries on 27 filled, denture try-in
    {
      id: CHART_18,
      visitId: VISIT_18,
      patientId: PATIENT_BEN_ID,
      teeth: healthyTeeth({
        18: { state: 'missing' },
        28: { state: 'missing' },
        38: { state: 'missing' },
        37: { state: 'extracted' },
        46: { state: 'filled' },
        47: { state: 'filled' },
        27: { state: 'filled', surfaces: ['occlusal'], note: 'Composite restoration — caries removed' },
        16: { state: 'crown' },
        17: { state: 'filled' },
        43: { state: 'filled', surfaces: ['distal'], note: 'Composite placed this visit' },
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Juan V4 — active visit, multiple fillings in progress
    {
      id: CHART_19,
      visitId: VISIT_19,
      patientId: PATIENT_JUAN_ID,
      teeth: healthyTeeth({
        46: { state: 'filled', surfaces: ['occlusal'] },
        25: { state: 'filled', surfaces: ['mesial', 'occlusal'], note: 'MO composite placed' },
        36: { state: 'caries', surfaces: ['buccal'], note: 'Filling in progress' },
        17: { state: 'watchlist', surfaces: ['distal'] },
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // Rosa V5 — active recall visit
    {
      id: CHART_20,
      visitId: VISIT_20,
      patientId: PATIENT_ROSA_ID,
      teeth: healthyTeeth({
        26: { state: 'filled', surfaces: ['mesial', 'occlusal'] },
        36: { state: 'filled' },
        16: { state: 'filled', surfaces: ['distal'] },
        14: { state: 'filled' },
        21: { state: 'crown' },
        24: { state: 'filled' },
        35: { state: 'caries', surfaces: ['buccal'], note: 'Patient now agrees to treatment' },
        41: { state: 'missing' },
        47: { state: 'watchlist', surfaces: ['occlusal'], note: 'New finding — early demineralization' },
      }),
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
  ]).onConflictDoNothing();

  // ── 3. Treatments ─────────────────────────────────────────────────
  await db.insert(dentalTreatments).values([
    // V01 Juan: prophylaxis
    {
      id: TREATMENT_01,
      visitId: VISIT_01,
      patientId: PATIENT_JUAN_ID,
      cdtCode: 'D1110',
      description: 'Oral Prophylaxis — adult',
      status: 'performed',
      priceCents: 150000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V02 Juan: composite filling tooth 30 → FDI 46
    {
      id: TREATMENT_02,
      visitId: VISIT_02,
      patientId: PATIENT_JUAN_ID,
      toothNumber: 46,
      surfaces: ['occlusal'],
      cdtCode: 'D2391',
      description: 'Composite filling — 1 surface',
      status: 'performed',
      priceCents: 250000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V03 Rosa: panoramic x-ray
    {
      id: TREATMENT_03,
      visitId: VISIT_03,
      patientId: PATIENT_ROSA_ID,
      cdtCode: 'D0330',
      description: 'Panoramic radiograph',
      status: 'performed',
      priceCents: 80000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V04 Rosa: root canal molar tooth 14 → FDI 26 (upper left first molar)
    {
      id: TREATMENT_04,
      visitId: VISIT_04,
      patientId: PATIENT_ROSA_ID,
      toothNumber: 26,
      cdtCode: 'D3330',
      description: 'Root canal — molar',
      status: 'planned',
      priceCents: 1500000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V05 Carlos: prophylaxis
    {
      id: TREATMENT_05,
      visitId: VISIT_05,
      patientId: PATIENT_CARLOS_ID,
      cdtCode: 'D1110',
      description: 'Oral Prophylaxis — adult',
      status: 'performed',
      priceCents: 150000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V06 Carlos: PFM Crown tooth 19 → FDI 36 (lower left first molar)
    {
      id: TREATMENT_06,
      visitId: VISIT_06,
      patientId: PATIENT_CARLOS_ID,
      toothNumber: 36,
      cdtCode: 'D2750',
      description: 'PFM Crown',
      status: 'performed',
      priceCents: 2000000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V07 Liza: prophylaxis
    {
      id: TREATMENT_07,
      visitId: VISIT_07,
      patientId: PATIENT_LIZA_ID,
      cdtCode: 'D1110',
      description: 'Oral Prophylaxis — adult',
      status: 'performed',
      priceCents: 150000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V08 Ben: panoramic x-ray
    {
      id: TREATMENT_08,
      visitId: VISIT_08,
      patientId: PATIENT_BEN_ID,
      cdtCode: 'D0330',
      description: 'Panoramic radiograph',
      status: 'performed',
      priceCents: 80000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V09 Ben: surgical extraction tooth 18 → FDI 37 (lower left second molar)
    {
      id: TREATMENT_09,
      visitId: VISIT_09,
      patientId: PATIENT_BEN_ID,
      toothNumber: 37,
      cdtCode: 'D7210',
      description: 'Surgical extraction',
      status: 'performed',
      priceCents: 500000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V10 Ben: denture impression (planned, not yet fabricated)
    {
      id: TREATMENT_10,
      visitId: VISIT_10,
      patientId: PATIENT_BEN_ID,
      cdtCode: 'D5110',
      description: 'Complete denture — maxillary',
      status: 'planned',
      priceCents: 2500000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V11 Juan: periapical x-ray + fluoride
    {
      id: TREATMENT_11,
      visitId: VISIT_11,
      patientId: PATIENT_JUAN_ID,
      cdtCode: 'D0220',
      description: 'Periapical radiograph — first film',
      status: 'performed',
      priceCents: 50000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V12 Rosa: root canal obturation
    {
      id: TREATMENT_12,
      visitId: VISIT_12,
      patientId: PATIENT_ROSA_ID,
      toothNumber: 26,
      cdtCode: 'D3330',
      description: 'Root canal obturation — molar (completion)',
      status: 'performed',
      priceCents: 1500000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V13 Rosa: composite filling #3 → FDI 16
    {
      id: TREATMENT_13,
      visitId: VISIT_13,
      patientId: PATIENT_ROSA_ID,
      toothNumber: 16,
      surfaces: ['distal'],
      cdtCode: 'D2391',
      description: 'Composite filling — 1 surface',
      status: 'performed',
      priceCents: 250000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V13 Rosa: prophylaxis
    {
      id: TREATMENT_14,
      visitId: VISIT_13,
      patientId: PATIENT_ROSA_ID,
      cdtCode: 'D1110',
      description: 'Oral Prophylaxis — adult',
      status: 'performed',
      priceCents: 150000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V14 Carlos: crown cementation
    {
      id: TREATMENT_15,
      visitId: VISIT_14,
      patientId: PATIENT_CARLOS_ID,
      toothNumber: 36,
      cdtCode: 'D2750',
      description: 'PFM Crown cementation',
      status: 'performed',
      priceCents: 500000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V15 Carlos: composite filling 46
    {
      id: TREATMENT_16,
      visitId: VISIT_15,
      patientId: PATIENT_CARLOS_ID,
      toothNumber: 46,
      surfaces: ['mesial'],
      cdtCode: 'D2391',
      description: 'Composite filling — 1 surface',
      status: 'performed',
      priceCents: 250000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V16 Liza: sealants x4
    {
      id: TREATMENT_17,
      visitId: VISIT_16,
      patientId: PATIENT_LIZA_ID,
      cdtCode: 'D1351',
      description: 'Pit & fissure sealant — per tooth (x4)',
      status: 'performed',
      priceCents: 200000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V17 Liza: composite MO filling 36
    {
      id: TREATMENT_18,
      visitId: VISIT_17,
      patientId: PATIENT_LIZA_ID,
      toothNumber: 36,
      surfaces: ['occlusal', 'mesial'],
      cdtCode: 'D2392',
      description: 'Composite filling — 2 surfaces',
      status: 'performed',
      priceCents: 350000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V18 Ben: composite filling 27
    {
      id: TREATMENT_19,
      visitId: VISIT_18,
      patientId: PATIENT_BEN_ID,
      toothNumber: 27,
      surfaces: ['occlusal'],
      cdtCode: 'D2391',
      description: 'Composite filling — 1 surface',
      status: 'performed',
      priceCents: 250000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V18 Ben: composite filling 43
    {
      id: TREATMENT_20,
      visitId: VISIT_18,
      patientId: PATIENT_BEN_ID,
      toothNumber: 43,
      surfaces: ['distal'],
      cdtCode: 'D2391',
      description: 'Composite filling — 1 surface',
      status: 'performed',
      priceCents: 250000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V19 Juan: composite MO filling 25 (in progress)
    {
      id: TREATMENT_21,
      visitId: VISIT_19,
      patientId: PATIENT_JUAN_ID,
      toothNumber: 25,
      surfaces: ['mesial', 'occlusal'],
      cdtCode: 'D2392',
      description: 'Composite filling — 2 surfaces',
      status: 'performed',
      priceCents: 350000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    // V19 Juan: buccal filling 36 (planned)
    {
      id: TREATMENT_22,
      visitId: VISIT_19,
      patientId: PATIENT_JUAN_ID,
      toothNumber: 36,
      surfaces: ['buccal'],
      cdtCode: 'D2391',
      description: 'Composite filling — 1 surface',
      status: 'planned',
      priceCents: 250000,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
  ]).onConflictDoNothing();

  // ── 4. Visit Notes (SOAP) ────────────────────────────────────────
  await db.insert(visitNotes).values([
    {
      id: VISIT_NOTE_01,
      visitId: VISIT_01,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Patient presents for routine cleaning. No complaints.',
      objective: 'Moderate calculus build-up on lingual surfaces of lower anteriors. Mild gingivitis.',
      assessment: 'Gingivitis with calculus. Early caries on tooth #30.',
      plan: 'Completed prophylaxis. Advised improved brushing technique. Follow-up in 6 months.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_02,
      visitId: VISIT_02,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Patient reports cold sensitivity on lower right side for 2 weeks.',
      objective: 'Tooth #30 — occlusal caries confirmed with explorer. Positive cold test. No periapical pathology on radiograph.',
      assessment: 'Caries on #30 — confined to enamel/dentin junction.',
      plan: 'Composite restoration placed. Sensitivity expected to resolve in 1-2 weeks.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_03,
      visitId: VISIT_03,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'New patient. Intermittent toothache upper left. Has not seen dentist in 3 years.',
      objective: 'Panoramic taken. Deep caries #14 with possible pulp involvement. Old amalgam #19 intact. Small distal caries #3.',
      assessment: 'Multiple caries. #14 likely requires root canal. #3 can be restored with composite.',
      plan: 'Scheduled root canal for #14. Will address #3 at future visit.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_04,
      visitId: VISIT_04,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Returning for root canal on #14. Pain has worsened.',
      objective: 'Tooth #14 — access opened, 3 canals located (MB, DB, P). Working lengths established. Canals irrigated and dressed with Ca(OH)2.',
      assessment: 'Irreversible pulpitis, #14. Root canal in progress — first appointment completed.',
      plan: 'Temporary restoration placed. Return in 2 weeks for obturation.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_05,
      visitId: VISIT_05,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Patient here for routine check-up. Chipped tooth bothering him when chewing.',
      objective: 'Fractured cusp on #19. Existing composite on #14 in good condition. Otherwise unremarkable.',
      assessment: 'Fractured cusp #19 — needs crown. All other teeth healthy.',
      plan: 'Prophylaxis completed. Crown prep scheduled for next visit.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_06,
      visitId: VISIT_06,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Here for crown preparation on #19.',
      objective: 'Tooth #19 prepped for PFM crown. Impression taken with polyvinyl siloxane. Shade A2 selected. Temporary crown cemented.',
      assessment: 'Crown preparation successful. Good margins achieved.',
      plan: 'Sent to Manila Dental Lab. Crown fitting in 2-3 weeks.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_07,
      visitId: VISIT_07,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Routine cleaning. No complaints.',
      objective: 'Minimal plaque. No caries detected. Gingiva healthy. All 32 teeth present.',
      assessment: 'Excellent oral health.',
      plan: 'Prophylaxis completed. See again in 6 months.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_08,
      visitId: VISIT_08,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'New patient. Multiple missing teeth. Wants denture. On warfarin for afib.',
      objective: 'Panoramic taken. Teeth 1, 16, 17 missing. Tooth #18 grossly decayed. Moderate caries #15. Old fillings #30, #31.',
      assessment: 'Edentulous areas 1, 16, 17. #18 non-restorable — extraction needed. Note: warfarin therapy — coordinate with cardiologist.',
      plan: 'Scheduled extraction #18 after INR check. Will plan upper denture after healing.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_09,
      visitId: VISIT_09,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Here for extraction of #18. INR checked yesterday — 2.3, within range.',
      objective: 'Surgical extraction performed on #18. Flap raised, bone removed, tooth sectioned and removed. Socket irrigated and sutured with 3-0 chromic gut.',
      assessment: 'Successful surgical extraction. Hemostasis achieved.',
      plan: 'Prescribed amoxicillin 500mg TID x5 days and ibuprofen 400mg PRN. Suture removal in 7 days. Begin denture planning after 4-week healing.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_10,
      visitId: VISIT_10,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Extraction site healed well. Ready for denture impression.',
      objective: 'Extraction site #18 fully healed. Primary impression taken for upper complete denture using alginate. Tray selected and adjusted.',
      assessment: 'Healing satisfactory. Good ridge for denture retention.',
      plan: 'Impression sent to Makati Dental Lab. Custom tray and final impression at next visit.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_11,
      visitId: VISIT_11,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Six-month recall. Reports occasional sensitivity upper left when eating cold food.',
      objective: 'Periapical radiograph taken — MO caries on tooth #25 extending to DEJ. Early buccal pit caries on #36. Suspicious distal shadow on #17.',
      assessment: 'MO caries #25 requires restoration. Buccal caries #36. #17 — watchlist, not cavitated.',
      plan: 'Schedule MO composite #25 and buccal composite #36 for next visit. Monitor #17 in 3 months.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_12,
      visitId: VISIT_12,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Returning for root canal completion on #14. Temporary filling intact, no pain since last visit.',
      objective: 'Canals obturated with gutta-percha and AH Plus sealer. Working length confirmed with radiograph. Good apical seal achieved. Access restored with composite.',
      assessment: 'Root canal #14 completed successfully. No periapical pathology.',
      plan: 'Post-operative radiograph satisfactory. Crown recommended within 6 months to prevent fracture. Schedule composite on #3 next visit.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_13,
      visitId: VISIT_13,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Here for filling on upper right molar and cleaning. Root canal tooth feels fine.',
      objective: 'Distal caries on #3 removed. Composite restoration placed. Prophylaxis performed. Buccal caries on #20 discussed — patient declines treatment at this time.',
      assessment: 'Composite restoration #3 successful. #20 caries stable — patient informed of risks of delaying.',
      plan: 'Follow-up 6 months. Revisit #20 treatment decision. Consider crown on #14 at next recall.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_14,
      visitId: VISIT_14,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Here for permanent crown cementation on #19. Temporary crown was loose for 2 days.',
      objective: 'Temporary crown removed. PFM crown tried in — marginal fit excellent, occlusion adjusted, shade match A2 confirmed. Cemented with glass ionomer cement.',
      assessment: 'Crown #19 cemented successfully. Mesial caries noted on #30.',
      plan: 'Crown bite check in 1 week. Schedule composite for #30 mesial caries.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_15,
      visitId: VISIT_15,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Here for filling on lower right molar. Crown on #19 feels great.',
      objective: 'Mesial caries on #30 removed — composite restoration placed. Suspicious staining on #15 occlusal — not cavitated, no radiographic evidence of caries.',
      assessment: 'Composite #30 successful. #15 — monitor, possible incipient caries.',
      plan: '#15 watchlist — reassess in 3 months. Next recall 6 months.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_16,
      visitId: VISIT_16,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Patient requests preventive sealants. No complaints.',
      objective: 'Sealants placed on teeth #14, #24, #34, #44 (all first premolars). Isolation with cotton rolls. Etch, prime, seal, light cure protocol.',
      assessment: 'Sealants applied successfully. Good adaptation and flow into pits and fissures.',
      plan: 'Check sealant retention at next recall in 6 months.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_17,
      visitId: VISIT_17,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Sharp pain when biting on lower left side for 3 days.',
      objective: 'Tooth #36 — MO caries confirmed with explorer and bitewing radiograph. Positive to percussion. Vital on cold test. No apical pathology.',
      assessment: 'Reversible pulpitis #36 secondary to MO caries. Sealants on premolars intact.',
      plan: 'MO composite restoration placed same visit. Sensitivity expected to resolve. Follow-up if pain persists beyond 2 weeks.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_18,
      visitId: VISIT_18,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Returning for denture try-in and filling on #15. Extraction site comfortable.',
      objective: 'Denture try-in — wax rim adjusted for occlusion and aesthetics. Patient approved. Composite placed on #15 (occlusal caries) and #27 (distal caries).',
      assessment: 'Denture design confirmed. Both composites successful.',
      plan: 'Denture processing — final delivery in 10 days. No further caries detected.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_19,
      visitId: VISIT_19,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Here for fillings on #25 and #36 as planned. No new complaints.',
      objective: 'MO caries on #25 removed — composite restoration placed. Buccal caries on #36 — preparation in progress.',
      assessment: '#25 MO composite successful. #36 buccal filling in progress.',
      plan: 'Complete #36 filling. Watchlist #17 unchanged — reassess 3 months.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: VISIT_NOTE_20,
      visitId: VISIT_20,
      authorMemberId: DR_REYES_MEMBERSHIP_ID,
      subjective: 'Six-month recall. Interested in whitening. Buccal caries on #20 has been bothering her.',
      objective: 'Exam performed. Root canal #14 stable. Crown #9 intact. New finding: early demineralization on #31 occlusal. Patient now agrees to treat #20 buccal caries.',
      assessment: 'Overall stable. #20 buccal caries — schedule filling. #31 — early demineralization, watchlist.',
      plan: 'Schedule composite #20. Whitening options discussed — take-home tray recommended. #31 fluoride varnish applied.',
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
  ]).onConflictDoNothing();

  console.log('   ✅ 20 visits, 20 charts, 22 treatments, 20 visit notes');
}
