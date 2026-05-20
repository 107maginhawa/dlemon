import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { openTestTx } from '@/core/test-tx';
import { AuditRepository } from './audit.repo';

let repo: AuditRepository;
let teardown: () => Promise<void>;

const noopLogger = { info() {}, error() {}, debug() {}, warn() {} } as any;

beforeEach(async () => {
  const { db, rollback } = await openTestTx();
  repo = new AuditRepository(db, noopLogger);
  teardown = rollback;
});
afterEach(() => teardown());

describe('AuditRepository', () => {
  describe('logEvent', () => {
    test('creates audit entry with integrity hash', async () => {
      const entry = await repo.logEvent({
        eventType: 'data-access',
        category: 'clinical',
        action: 'read',
        outcome: 'success',
        user: 'aaaaaaaa-0000-4000-8000-000000000001',
        userType: 'host',
        resourceType: 'patient',
        resource: 'bbbbbbbb-0000-4000-8000-000000000001',
        description: 'Read patient chart for chart review',
        details: { reason: 'chart review' },
      });

      expect(entry).not.toBeNull();
      expect(entry.id).not.toBeNull();
      expect(entry.eventType).toBe('data-access');
      expect(entry.integrityHash).not.toBeNull();
      expect(entry.integrityHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256
      expect(entry.purgeAfter).not.toBeNull(); // 7-year retention
    });

    test('creates entries with unique integrity hashes', async () => {
      const entry1 = await repo.logEvent({
        eventType: 'data-access', category: 'clinical', action: 'read',
        outcome: 'success', user: 'aaaaaaaa-0000-4000-8000-000000000001', userType: 'host',
        resourceType: 'patient', resource: 'bbbbbbbb-0000-4000-8000-000000000001',
        description: 'Read patient record',
      });
      const entry2 = await repo.logEvent({
        eventType: 'data-modification', category: 'clinical', action: 'update',
        outcome: 'success', user: 'aaaaaaaa-0000-4000-8000-000000000002', userType: 'host',
        resourceType: 'patient', resource: 'bbbbbbbb-0000-4000-8000-000000000002',
        description: 'Updated patient record',
      });

      expect(entry1.integrityHash).not.toBe(entry2.integrityHash);
    });
  });

  describe('verifyIntegrity', () => {
    test('returns no compromised entries for unmodified logs', async () => {
      await repo.logEvent({
        eventType: 'authentication', category: 'security', action: 'login',
        outcome: 'success', user: 'aaaaaaaa-0000-4000-8000-000000000001', userType: 'host',
        resourceType: 'session', resource: 'cccccccc-0000-4000-8000-000000000001',
        description: 'Staff login',
      });

      const result = await repo.verifyIntegrity();
      expect(result.compromisedEntries).toEqual([]);
      expect(result.verifiedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('archiveOldLogs', () => {
    test('returns count of archived entries (0 for fresh db)', async () => {
      const count = await repo.archiveOldLogs(365);
      expect(count).toBe(0);
    });
  });

  describe('getAuditStatistics', () => {
    test('returns statistics object with expected keys', async () => {
      const stats = await repo.getAuditStatistics();
      expect(stats).not.toBeNull();
      expect(typeof stats.totalEntries).toBe('number');
      expect(typeof stats.activeEntries).toBe('number');
      expect(typeof stats.archivedEntries).toBe('number');
      expect(typeof stats.pendingPurge).toBe('number');
    });
  });
});
