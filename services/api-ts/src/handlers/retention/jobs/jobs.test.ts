/**
 * Retention job registration + dry-run gating tests.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { registerRetentionJobs } from './index';
import type { JobScheduler } from '@/core/jobs';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any;

afterEach(() => {
  delete process.env['RETENTION_ENFORCEMENT_ENABLED'];
});

describe('registerRetentionJobs', () => {
  test('registers retention.enforcement cron at 03:30 daily', () => {
    const registered: Array<{ name: string; pattern: string }> = [];
    const scheduler: Partial<JobScheduler> = {
      registerCron: mock((name: string, pattern: string) => {
        registered.push({ name, pattern });
      }),
    };

    registerRetentionJobs(scheduler as JobScheduler);

    expect(registered).toHaveLength(1);
    expect(registered[0]!.name).toBe('retention.enforcement');
    expect(registered[0]!.pattern).toBe('30 3 * * *');
  });

  test('handler runs in DRY-RUN when RETENTION_ENFORCEMENT_ENABLED is unset', async () => {
    delete process.env['RETENTION_ENFORCEMENT_ENABLED'];

    let capturedOptions: any;
    mock.module('../repos/retention-policy.repo', () => ({
      RetentionPolicyRepository: class {
        findEnabled = async () => [];
      },
    }));
    mock.module('../retention-engine', () => ({
      evaluateRetention: async (_db: any, _logger: any, _policies: any, options: any) => {
        capturedOptions = options;
        return [];
      },
    }));

    let handler: any;
    const scheduler: Partial<JobScheduler> = {
      registerCron: (_n: string, _p: string, h: any) => {
        handler = h;
      },
    };
    registerRetentionJobs(scheduler as JobScheduler);

    await handler({ db: {}, logger: noopLogger, jobId: 'test-1', jobName: 'retention.enforcement' });
    expect(capturedOptions.dryRun).toBe(true);
  });

  test('handler runs LIVE only when RETENTION_ENFORCEMENT_ENABLED="true"', async () => {
    process.env['RETENTION_ENFORCEMENT_ENABLED'] = 'true';

    let capturedOptions: any;
    mock.module('../repos/retention-policy.repo', () => ({
      RetentionPolicyRepository: class {
        findEnabled = async () => [];
      },
    }));
    mock.module('../retention-engine', () => ({
      evaluateRetention: async (_db: any, _logger: any, _policies: any, options: any) => {
        capturedOptions = options;
        return [];
      },
    }));

    let handler: any;
    const scheduler: Partial<JobScheduler> = {
      registerCron: (_n: string, _p: string, h: any) => {
        handler = h;
      },
    };
    registerRetentionJobs(scheduler as JobScheduler);

    await handler({ db: {}, logger: noopLogger, jobId: 'test-2', jobName: 'retention.enforcement' });
    expect(capturedOptions.dryRun).toBe(false);
  });
});
