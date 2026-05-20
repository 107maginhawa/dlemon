/**
 * DentalChartRepository tests
 *
 * Tests upsert (create-or-replace), per-tooth update, snapshot storage,
 * and entry-classification (P1.3).
 *
 * Prerequisites: seedAuditWorkspace() seeds the required person/patient/visit
 * rows so FK constraints are satisfied. Each test wraps in openTestTx()
 * (BEGIN/ROLLBACK) for isolation.
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'bun:test';
import { DentalChartRepository } from './dental-chart.repo';
import { openTestTx } from '@/core/test-tx';
import { createDatabase } from '@/core/database';
import { seedAuditWorkspace, AUDIT_IDS } from '@/tests/fixtures/audit-workspace-fixtures';

// Prerequisite: seed FK targets into the real DB (committed; visible to all test TXs).
const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

beforeAll(async () => {
  await seedAuditWorkspace(db);
});

// VISIT_NO_CHART = visitCompleted (no chart seeded) — safe to upsert into within test TX
const VISIT_NO_CHART = AUDIT_IDS.visitCompleted;
// VISIT_HAS_CHART  = visitActive (chart seeded via seedAuditWorkspace) — upsert will update it
const VISIT_HAS_CHART = AUDIT_IDS.visitActive;
const PATIENT = AUDIT_IDS.patient;

const SAMPLE_TEETH = [
  { toothNumber: 11, state: 'healthy' },
  { toothNumber: 21, state: 'caries', surfaces: ['mesial', 'occlusal'], conditionCode: 'K02.0' },
  { toothNumber: 36, state: 'filled', surfaces: ['occlusal'] },
];

describe('DentalChartRepository', () => {
  let repo: DentalChartRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    repo = new DentalChartRepository(txDb);
    teardown = rollback;
  });

  afterEach(() => teardown());

  // --------------------------------------------------------------------------
  // UPSERT (create or replace)
  // --------------------------------------------------------------------------

  describe('upsert', () => {
    test('creates a new chart when none exists', async () => {
      const chart = await repo.upsert({
        visitId: VISIT_NO_CHART,
        patientId: PATIENT,
        teeth: SAMPLE_TEETH,
      });

      expect(chart.id).toBeTruthy();
      expect(chart.visitId).toBe(VISIT_NO_CHART);
      expect(chart.patientId).toBe(PATIENT);
      expect(chart.teeth).toHaveLength(3);
    });

    test('replaces existing chart on second upsert for same visitId', async () => {
      await repo.upsert({ visitId: VISIT_NO_CHART, patientId: PATIENT, teeth: SAMPLE_TEETH });

      const updated = await repo.upsert({
        visitId: VISIT_NO_CHART,
        patientId: PATIENT,
        teeth: [{ toothNumber: 11, state: 'crown' }],
      });

      expect(updated.teeth).toHaveLength(1);
      expect(updated.teeth[0]!.state).toBe('crown');
    });

    test('stores ICD-10 conditionCode per tooth', async () => {
      const chart = await repo.upsert({
        visitId: VISIT_NO_CHART,
        patientId: PATIENT,
        teeth: [{ toothNumber: 21, state: 'caries', conditionCode: 'K02.0' }],
      });

      const tooth = chart.teeth.find(t => t.toothNumber === 21);
      expect(tooth!.conditionCode).toBe('K02.0');
    });

    test('stores per-tooth surfaces array', async () => {
      const chart = await repo.upsert({
        visitId: VISIT_NO_CHART,
        patientId: PATIENT,
        teeth: [{ toothNumber: 36, state: 'filled', surfaces: ['mesial', 'occlusal'] }],
      });

      const tooth = chart.teeth.find(t => t.toothNumber === 36);
      expect(tooth!.surfaces).toEqual(['mesial', 'occlusal']);
    });
  });

  // --------------------------------------------------------------------------
  // GET BY VISIT
  // --------------------------------------------------------------------------

  describe('findByVisit', () => {
    test('returns chart for a visit', async () => {
      await repo.upsert({ visitId: VISIT_NO_CHART, patientId: PATIENT, teeth: SAMPLE_TEETH });

      const chart = await repo.findByVisit(VISIT_NO_CHART);
      expect(chart).not.toBeNull();
      expect(chart!.visitId).toBe(VISIT_NO_CHART);
    });

    test('returns null when no chart exists for visit', async () => {
      const chart = await repo.findByVisit('00000000-0000-0000-0000-000000000000');
      expect(chart).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // UPDATE INDIVIDUAL TOOTH
  // --------------------------------------------------------------------------

  describe('updateTooth', () => {
    test('updates a single tooth state without affecting others', async () => {
      const chart = await repo.upsert({
        visitId: VISIT_NO_CHART,
        patientId: PATIENT,
        teeth: SAMPLE_TEETH,
      });

      const updated = await repo.updateTooth(chart.id, {
        toothNumber: 21,
        state: 'filled',
        surfaces: ['mesial'],
        conditionCode: 'K02.0',
      });

      const tooth21 = updated!.teeth.find(t => t.toothNumber === 21);
      expect(tooth21!.state).toBe('filled');
      expect(tooth21!.surfaces).toEqual(['mesial']);

      // Other teeth unchanged
      const tooth11 = updated!.teeth.find(t => t.toothNumber === 11);
      expect(tooth11!.state).toBe('healthy');
    });

    test('adds a new tooth record if toothNumber not previously in chart', async () => {
      const chart = await repo.upsert({
        visitId: VISIT_NO_CHART,
        patientId: PATIENT,
        teeth: [{ toothNumber: 11, state: 'healthy' }],
      });

      const updated = await repo.updateTooth(chart.id, {
        toothNumber: 48,
        state: 'missing',
      });

      expect(updated!.teeth).toHaveLength(2);
      const tooth48 = updated!.teeth.find(t => t.toothNumber === 48);
      expect(tooth48!.state).toBe('missing');
    });

    test('returns null for unknown chart id', async () => {
      const result = await repo.updateTooth('00000000-0000-0000-0000-000000000000', {
        toothNumber: 11,
        state: 'healthy',
      });
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // ENTRY CLASSIFICATION (P1.3)
  // --------------------------------------------------------------------------

  describe('entryClassification', () => {
    test('stores entryClassification on upsert', async () => {
      const chart = await repo.upsert({
        visitId: VISIT_NO_CHART,
        patientId: PATIENT,
        teeth: [{ toothNumber: 21, state: 'caries', entryClassification: 'existing' }],
      });

      const tooth = chart.teeth.find(t => t.toothNumber === 21);
      expect(tooth!.entryClassification).toBe('existing');
    });

    test('independent findByVisit returns entryClassification', async () => {
      await repo.upsert({
        visitId: VISIT_NO_CHART,
        patientId: PATIENT,
        teeth: [
          { toothNumber: 11, state: 'healthy', entryClassification: 'condition' },
          { toothNumber: 36, state: 'filled', entryClassification: 'treatment_plan' },
        ],
      });

      const chart = await repo.findByVisit(VISIT_NO_CHART);
      expect(chart).not.toBeNull();
      const t11 = chart!.teeth.find(t => t.toothNumber === 11);
      const t36 = chart!.teeth.find(t => t.toothNumber === 36);
      expect(t11!.entryClassification).toBe('condition');
      expect(t36!.entryClassification).toBe('treatment_plan');
    });

    test('updateTooth sets entryClassification on an existing tooth', async () => {
      const chart = await repo.upsert({
        visitId: VISIT_NO_CHART,
        patientId: PATIENT,
        teeth: [{ toothNumber: 21, state: 'caries' }],
      });

      const updated = await repo.updateTooth(chart.id, {
        toothNumber: 21,
        entryClassification: 'existing_other',
      });

      const tooth = updated!.teeth.find(t => t.toothNumber === 21);
      expect(tooth!.entryClassification).toBe('existing_other');
    });

    test('updateTooth preserves entryClassification when not provided', async () => {
      const chart = await repo.upsert({
        visitId: VISIT_NO_CHART,
        patientId: PATIENT,
        teeth: [{ toothNumber: 21, state: 'caries', entryClassification: 'existing' }],
      });

      const updated = await repo.updateTooth(chart.id, {
        toothNumber: 21,
        state: 'filled',
      });

      const tooth = updated!.teeth.find(t => t.toothNumber === 21);
      expect(tooth!.entryClassification).toBe('existing');
    });

    test('updateTooth sets entryClassification on a new tooth entry', async () => {
      const chart = await repo.upsert({
        visitId: VISIT_NO_CHART,
        patientId: PATIENT,
        teeth: [],
      });

      const updated = await repo.updateTooth(chart.id, {
        toothNumber: 48,
        state: 'missing',
        entryClassification: 'existing',
      });

      const tooth = updated!.teeth.find(t => t.toothNumber === 48);
      expect(tooth!.entryClassification).toBe('existing');
    });
  });
});
