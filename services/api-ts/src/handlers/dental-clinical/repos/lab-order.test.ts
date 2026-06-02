/**
 * LabOrderRepository tests
 *
 * Key behaviors:
 * - State machine: ordered → inFabrication → delivered → fitted (or cancelled)
 * - No backward transitions, no skipping states
 * - Cancel with reason at any non-terminal state
 * - Defective flag triggers replacement order
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { LabOrderRepository } from './lab-order.repo';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';

const VISIT_1   = CHAIN_IDS.VISIT_1;
const PATIENT_1 = CHAIN_IDS.PATIENT_1;

const baseOrder = {
  visitId: VISIT_1,
  patientId: PATIENT_1,
  labName: 'Precision Dental Lab',
  description: 'PFM Crown tooth 21',
};

describe('LabOrderRepository', () => {
  let repo: LabOrderRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db, rollback } = await openTestTx();
    repo = new LabOrderRepository(db);
    await seedClinicalChain(db, { visits: 2 });
    teardown = rollback;
  });

  afterEach(() => teardown());

  describe('create', () => {
    test('creates an order in ordered status by default', async () => {
      const order = await repo.createOne(baseOrder);
      expect(order.id).toBeTruthy();
      expect(order.status).toBe('ordered');
      expect(order.isDefective).toBe(false);
      expect(order.orderedAt).toBeInstanceOf(Date);
    });

    test('stores optional expectedDeliveryDate', async () => {
      const date = new Date('2025-12-01');
      const order = await repo.createOne({ ...baseOrder, expectedDeliveryDate: date });
      expect(order.expectedDeliveryDate).toBeInstanceOf(Date);
    });

    // V-CLI-003 / spec §7 / WF-017: lab order carries the FDI tooth it is for.
    test('stores toothFdi when provided', async () => {
      const order = await repo.createOne({ ...baseOrder, toothFdi: '21' });
      expect(order.toothFdi).toBe('21');
    });

    test('toothFdi defaults to null when omitted', async () => {
      const order = await repo.createOne(baseOrder);
      expect(order.toothFdi).toBeNull();
    });

    // P2-12: restoration shade / material / due date
    test('stores shade, material and dueDate when provided', async () => {
      const due = new Date('2026-01-15');
      const order = await repo.createOne({
        ...baseOrder,
        shade: 'A2',
        material: 'Zirconia',
        dueDate: due,
      });
      expect(order.shade).toBe('A2');
      expect(order.material).toBe('Zirconia');
      expect(order.dueDate).toBeInstanceOf(Date);
    });

    test('shade/material/dueDate default to null when omitted', async () => {
      const order = await repo.createOne(baseOrder);
      expect(order.shade).toBeNull();
      expect(order.material).toBeNull();
      expect(order.dueDate).toBeNull();
    });

    test('update() can edit shade, material and dueDate without a status change', async () => {
      const order = await repo.createOne(baseOrder);
      const due = new Date('2026-02-01');
      const updated = await repo.update(order.id, { shade: 'B1', material: 'E.max', dueDate: due });
      expect(updated!.shade).toBe('B1');
      expect(updated!.material).toBe('E.max');
      expect(updated!.dueDate).toBeInstanceOf(Date);
      expect(updated!.status).toBe('ordered');
    });
  });

  describe('state machine transitions', () => {
    test('ordered → inFabrication succeeds', async () => {
      const order = await repo.createOne(baseOrder);
      const { order: updated, error } = await repo.updateStatus(order.id, 'in_fabrication');
      expect(error).toBeUndefined();
      expect(updated!.status).toBe('in_fabrication');
    });

    test('inFabrication → delivered succeeds and records deliveredAt', async () => {
      const order = await repo.createOne(baseOrder);
      await repo.updateStatus(order.id, 'in_fabrication');
      const { order: updated } = await repo.updateStatus(order.id, 'delivered');
      expect(updated!.status).toBe('delivered');
      expect(updated!.deliveredAt).toBeInstanceOf(Date);
    });

    test('delivered → fitted succeeds and records fittedAt', async () => {
      const order = await repo.createOne(baseOrder);
      await repo.updateStatus(order.id, 'in_fabrication');
      await repo.updateStatus(order.id, 'delivered');
      const { order: updated } = await repo.updateStatus(order.id, 'fitted');
      expect(updated!.status).toBe('fitted');
      expect(updated!.fittedAt).toBeInstanceOf(Date);
    });

    test('ordered → cancelled succeeds and records cancelledAt', async () => {
      const order = await repo.createOne(baseOrder);
      const { order: updated } = await repo.updateStatus(order.id, 'cancelled');
      expect(updated!.status).toBe('cancelled');
      expect(updated!.cancelledAt).toBeInstanceOf(Date);
    });

    test('cannot skip: ordered → delivered is rejected', async () => {
      const order = await repo.createOne(baseOrder);
      const { order: updated, error } = await repo.updateStatus(order.id, 'delivered');
      expect(error).not.toBeNull();
      expect(updated).toBeNull();
    });

    test('cannot go backward: delivered → ordered is rejected', async () => {
      const order = await repo.createOne(baseOrder);
      await repo.updateStatus(order.id, 'in_fabrication');
      await repo.updateStatus(order.id, 'delivered');
      const { order: updated, error } = await repo.updateStatus(order.id, 'ordered');
      expect(error).not.toBeNull();
      expect(updated).toBeNull();
    });

    test('fitted is terminal — no further transitions', async () => {
      const order = await repo.createOne(baseOrder);
      await repo.updateStatus(order.id, 'in_fabrication');
      await repo.updateStatus(order.id, 'delivered');
      await repo.updateStatus(order.id, 'fitted');
      const { order: updated, error } = await repo.updateStatus(order.id, 'cancelled');
      expect(error).not.toBeNull();
      expect(updated).toBeNull();
    });

    test('cancelled is terminal — cannot transition further', async () => {
      const order = await repo.createOne(baseOrder);
      await repo.updateStatus(order.id, 'cancelled');
      const { error } = await repo.updateStatus(order.id, 'in_fabrication');
      expect(error).not.toBeNull();
    });
  });

  describe('defective', () => {
    test('can mark an order as defective', async () => {
      const order = await repo.createOne(baseOrder);
      await repo.updateStatus(order.id, 'in_fabrication');
      await repo.updateStatus(order.id, 'delivered');
      const updated = await repo.update(order.id, { isDefective: true });
      expect(updated!.isDefective).toBe(true);
    });

    test('can link replacedByOrderId', async () => {
      const original = await repo.createOne(baseOrder);
      const replacement = await repo.createOne({ ...baseOrder, description: 'Replacement PFM Crown' });
      const updated = await repo.update(original.id, { replacedByOrderId: replacement.id });
      expect(updated!.replacedByOrderId).toBe(replacement.id);
    });
  });

  describe('findMany', () => {
    test('filters by visitId', async () => {
      await repo.createOne(baseOrder);
      await repo.createOne({ ...baseOrder, visitId: CHAIN_IDS.VISIT_2 });
      const results = await repo.findMany({ visitId: VISIT_1 });
      expect(results).toHaveLength(1);
    });

    test('filters by status', async () => {
      const order = await repo.createOne(baseOrder);
      await repo.updateStatus(order.id, 'in_fabrication');
      const results = await repo.findMany({ status: 'in_fabrication' });
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
