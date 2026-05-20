import { describe, test, expect, mock } from 'bun:test';
import { registerAuditJobs } from './index';
import type { JobScheduler } from '@/core/jobs';

describe('registerAuditJobs', () => {
  test('registers audit.retention cron job with daily-3am pattern', () => {
    const registeredJobs: Array<{ name: string; pattern: string }> = [];
    const mockScheduler: Partial<JobScheduler> = {
      registerCron: mock((name: string, pattern: string, _handler: any) => {
        registeredJobs.push({ name, pattern });
      }),
    };

    registerAuditJobs(mockScheduler as JobScheduler);

    expect(registeredJobs).toHaveLength(1);
    const job = registeredJobs[0]!;
    expect(job.name).toBe('audit.retention');
    expect(job.pattern).toBe('0 3 * * *');
  });

  test('cron handler archives then purges logs with HIPAA retention periods', async () => {
    let capturedHandler: any;
    const mockScheduler: Partial<JobScheduler> = {
      registerCron: mock((_name: string, _pattern: string, handler: any) => {
        capturedHandler = handler;
      }),
    };

    registerAuditJobs(mockScheduler as JobScheduler);

    const mockArchive = mock(() => Promise.resolve(5));
    const mockPurge = mock(() => Promise.resolve(2));

    const mockContext = {
      db: {} as any,
      logger: {
        debug: mock(() => {}),
        info: mock(() => {}),
        error: mock(() => {}),
      },
      jobId: 'test-job-1',
      jobName: 'audit.retention',
    };

    // Override the dynamic import by spying on module resolution
    // We verify the handler calls the repo methods with correct HIPAA periods
    // by injecting a mock AuditRepository into the import chain.
    // Since the handler does `await import('../repos/audit.repo')`, we mock at module level.
    mock.module('../repos/audit.repo', () => ({
      AuditRepository: class {
        constructor(_db: any, _logger: any) {}
        archiveOldLogs = mockArchive;
        purgeArchivedLogs = mockPurge;
      },
    }));

    await capturedHandler(mockContext);

    // 1 year = 365 days (archive threshold)
    expect(mockArchive).toHaveBeenCalledWith(365);
    // 7 years = 2555 days (HIPAA purge threshold)
    expect(mockPurge).toHaveBeenCalledWith(2555);
  });
});
