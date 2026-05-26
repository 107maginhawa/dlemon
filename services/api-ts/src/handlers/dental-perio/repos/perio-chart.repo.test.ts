/**
 * PerioChartRepository + PerioReadingRepository tests.
 *
 * Covers:
 *  - chart create + findByVisitId
 *  - reading upsert (insert + update path)
 *  - countByChart for BR-P07
 *  - complete sets status + summary stats
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { PerioChartRepository } from './perio-chart.repo';
import { PerioReadingRepository } from './perio-reading.repo';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';

const VISIT_1 = CHAIN_IDS.VISIT_1;
const VISIT_2 = CHAIN_IDS.VISIT_2;
const PATIENT_1 = CHAIN_IDS.PATIENT_1;
const BRANCH_1 = CHAIN_IDS.BRANCH_1;
const MEMBER_1 = CHAIN_IDS.MEMBERSHIP_1;

const baseChart = {
  visitId: VISIT_1,
  patientId: PATIENT_1,
  branchId: BRANCH_1,
  examinerMemberId: MEMBER_1,
};

describe('PerioChartRepository', () => {
  let chartRepo: PerioChartRepository;
  let readingRepo: PerioReadingRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db, rollback } = await openTestTx();
    chartRepo = new PerioChartRepository(db);
    readingRepo = new PerioReadingRepository(db);
    await seedClinicalChain(db, { visits: 2 });
    teardown = rollback;
  });

  afterEach(() => teardown());

  describe('chart create', () => {
    test('creates a chart in draft', async () => {
      const c = await chartRepo.createOne(baseChart);
      expect(c.id).toBeTruthy();
      expect(c.status).toBe('draft');
      expect(c.visitId).toBe(VISIT_1);
    });

    test('findByVisitId returns the chart', async () => {
      const c = await chartRepo.createOne(baseChart);
      const found = await chartRepo.findByVisitId(VISIT_1);
      expect(found?.id).toBe(c.id);
    });

    test('findByVisitId returns null when none', async () => {
      const found = await chartRepo.findByVisitId(VISIT_2);
      expect(found).toBeNull();
    });

    test('unique constraint blocks duplicate visit chart', async () => {
      await chartRepo.createOne(baseChart);
      await expect(chartRepo.createOne(baseChart)).rejects.toThrow();
    });
  });

  describe('reading upsert', () => {
    test('inserts on first call', async () => {
      const c = await chartRepo.createOne(baseChart);
      const r = await readingRepo.upsert({
        chartId: c.id,
        toothNumber: 11,
        depthBM: 3,
        depthBC: 2,
        depthBD: 4,
        bopBM: true,
      });
      expect(r.toothNumber).toBe(11);
      expect(r.depthBM).toBe(3);
      expect(r.mobility).toBe(0);
    });

    test('updates on second call for same chart+tooth', async () => {
      const c = await chartRepo.createOne(baseChart);
      await readingRepo.upsert({ chartId: c.id, toothNumber: 11, depthBM: 3 });
      const r2 = await readingRepo.upsert({ chartId: c.id, toothNumber: 11, depthBM: 5, depthBC: 6 });
      expect(r2.depthBM).toBe(5);
      expect(r2.depthBC).toBe(6);
      const all = await readingRepo.findMany({ chartId: c.id });
      expect(all).toHaveLength(1);
    });

    test('countByChart returns reading count', async () => {
      const c = await chartRepo.createOne(baseChart);
      await readingRepo.upsert({ chartId: c.id, toothNumber: 11 });
      await readingRepo.upsert({ chartId: c.id, toothNumber: 12 });
      await readingRepo.upsert({ chartId: c.id, toothNumber: 13 });
      expect(await readingRepo.countByChart(c.id)).toBe(3);
    });
  });

  describe('chart complete', () => {
    test('sets status to completed with summary stats', async () => {
      const c = await chartRepo.createOne(baseChart);
      const updated = await chartRepo.complete(c.id, {
        bopPercent: 33.33,
        meanDepth: 2.5,
        deepPocketCount: 4,
      });
      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeInstanceOf(Date);
      expect(Number(updated?.summaryBopPercent)).toBeCloseTo(33.33, 2);
      expect(Number(updated?.summaryMeanDepth)).toBeCloseTo(2.5, 2);
      expect(updated?.summaryDeepPocketCount).toBe(4);
    });
  });
});
