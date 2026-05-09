/**
 * File upload flow unit tests
 *
 * Tests FileTooLargeError, S3UploadError, and the exported error classes.
 * The main flow requires mocking generated SDK functions, so we test
 * the error classes and constant defaults.
 */

import { describe, test, expect } from 'bun:test';
import { FileTooLargeError, S3UploadError, SdkError } from './file-upload';

describe('FileTooLargeError', () => {
  test('has correct message for 50MB limit', () => {
    const err = new FileTooLargeError(50 * 1024 * 1024);
    expect(err.message).toContain('50MB');
    expect(err.name).toBe('FileTooLargeError');
  });

  test('stores limitBytes', () => {
    const limit = 10 * 1024 * 1024;
    const err = new FileTooLargeError(limit);
    expect(err.limitBytes).toBe(limit);
  });

  test('extends Error', () => {
    const err = new FileTooLargeError(1024);
    expect(err instanceof Error).toBe(true);
  });

  test('message rounds to nearest MB', () => {
    const err = new FileTooLargeError(25 * 1024 * 1024);
    expect(err.message).toContain('25MB');
  });
});

describe('S3UploadError', () => {
  test('stores status and statusText', () => {
    const err = new S3UploadError(403, 'Forbidden');
    expect(err.status).toBe(403);
    expect(err.statusText).toBe('Forbidden');
    expect(err.name).toBe('S3UploadError');
  });

  test('message includes status info', () => {
    const err = new S3UploadError(500, 'Internal Server Error');
    expect(err.message).toContain('500');
    expect(err.message).toContain('Internal Server Error');
  });

  test('extends Error', () => {
    const err = new S3UploadError(400, 'Bad Request');
    expect(err instanceof Error).toBe(true);
  });
});

describe('Re-exported SdkError', () => {
  test('SdkError is re-exported from file-upload module', () => {
    expect(SdkError).toBeDefined();
    const err = new SdkError({ status: 500 });
    expect(err.status).toBe(500);
  });
});
