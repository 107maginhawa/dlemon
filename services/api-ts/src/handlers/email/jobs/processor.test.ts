/**
 * Email processor job unit tests
 *
 * Tests the emailProcessorJob function with mocked email service.
 */

import { describe, test, expect, mock } from 'bun:test';
import { emailProcessorJob } from './processor';

const mockLogger = {
  debug: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
  child: mock(() => mockLogger),
} as any;

describe('emailProcessorJob', () => {
  test('calls emailService.processPendingEmails', async () => {
    const mockEmailService = {
      processPendingEmails: mock(async () => {}),
    };

    const context = {
      db: {} as any,
      logger: mockLogger,
      jobId: 'job-1',
      jobName: 'email-processor',
    };

    await emailProcessorJob(context, mockEmailService as any);

    expect(mockEmailService.processPendingEmails).toHaveBeenCalledTimes(1);
  });

  test('logs debug on start and completion', async () => {
    const mockEmailService = {
      processPendingEmails: mock(async () => {}),
    };

    const logger = {
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      child: mock(function (this: any) { return this; }),
    } as any;

    const context = {
      db: {} as any,
      logger,
      jobId: 'job-2',
      jobName: 'email-processor',
    };

    await emailProcessorJob(context, mockEmailService as any);

    expect(logger.debug).toHaveBeenCalledTimes(2); // start + completion
  });

  test('throws and logs error when email service fails', async () => {
    const mockEmailService = {
      processPendingEmails: mock(async () => {
        throw new Error('SMTP connection failed');
      }),
    };

    const logger = {
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      child: mock(function (this: any) { return this; }),
    } as any;

    const context = {
      db: {} as any,
      logger,
      jobId: 'job-3',
      jobName: 'email-processor',
    };

    await expect(emailProcessorJob(context, mockEmailService as any)).rejects.toThrow(
      'SMTP connection failed'
    );

    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  test('passes context data correctly', async () => {
    const mockEmailService = {
      processPendingEmails: mock(async () => {}),
    };

    const context = {
      db: { fake: true } as any,
      logger: mockLogger,
      jobId: 'job-4',
      jobName: 'email-processor',
      data: { batchSize: 50 },
    };

    await emailProcessorJob(context, mockEmailService as any);
    expect(mockEmailService.processPendingEmails).toHaveBeenCalledTimes(1);
  });
});
