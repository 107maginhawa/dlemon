/**
 * DentalChartRepository tests
 *
 * Tests upsert (create-or-replace), per-tooth update, and snapshot storage.
 *
 * Written RED — no implementation exists yet.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { DentalChartRepository } from './dental-chart.repo';
import { createDatabase } from '@/core/database';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const VISIT_1  = 'e0000000-0000-1000-8000-000000000001';
const VISIT_2  = 'e0000000-0000-1000-8000-000000000002';
const PATIENT_1 = 'b0000000-0000-1000-8000-000000000001';

const SAMPLE_TEETH = [
  { toothNumber: 11, state: 'healthy' },
  { toothNumber: 21, state: 'caries', surfaces: ['mesial', 'occlusal'], conditionCode: 'K02.0' },
  { toothNumber: 36, state: 'filled', surfaces: ['occlusal'] },
];

describe('DentalChartRepository', () => {
  let repo: DentalChartRepository;

  beforeEach(() => {
    repo = new DentalChartRepository(db);
  });

  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_chart CASCADE`);
  });

  // --------------------------------------------------------------------------
  // UPSERT (create or replace)
  // --------------------------------------------------------------------------

  describe('upsert', () => {
    test('creates a new chart when none exists', async () => {
      const chart = await repo.upsert({
        visitId: VISIT_1,
        patientId: PATIENT_1,
        teeth: SAMPLE_TEETH,
      });

      expect(chart.id).toBeTruthy();
      expect(chart.visitId).toBe(VISIT_1);
      expect(chart.patientId).toBe(PATIENT_1);
      expect(chart.teeth).toHaveLength(3);
    });

    test('replaces existing chart on second upsert for same visitId', async () => {
      await repo.upsert({ visitId: VISIT_1, patientId: PATIENT_1, teeth: SAMPLE_TEETH });

      const updated = await repo.upsert({
        visitId: VISIT_1,
        patientId: PATIENT_1,
        teeth: [{ toothNumber: 11, state: 'crown' }],
      });

      expect(updated.teeth).toHaveLength(1);
      expect(updated.teeth[0]!.state).toBe('crown');
    });

    test('stores ICD-10 conditionCode per tooth', async () => {
      const chart = await repo.upsert({
        visitId: VISIT_1,
        patientId: PATIENT_1,
        teeth: [{ toothNumber: 21, state: 'caries', conditionCode: 'K02.0' }],
      });

      const tooth = chart.teeth.find(t => t.toothNumber === 21);
      expect(tooth!.conditionCode).toBe('K02.0');
    });

    test('stores per-tooth surfaces array', async () => {
      const chart = await repo.upsert({
        visitId: VISIT_1,
        patientId: PATIENT_1,
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
      await repo.upsert({ visitId: VISIT_1, patientId: PATIENT_1, teeth: SAMPLE_TEETH });

      const chart = await repo.findByVisit(VISIT_1);
      expect(chart).not.toBeNull();
      expect(chart!.visitId).toBe(VISIT_1);
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
        visitId: VISIT_1,
        patientId: PATIENT_1,
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
        visitId: VISIT_1,
        patientId: PATIENT_1,
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
});
