/**
 * Error classes and error handler unit tests
 */

import { describe, test, expect } from 'bun:test';
import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  BusinessLogicError,
  ConflictError,
  RateLimitError,
  AuthenticationError,
  AuthorizationError,
  HipaaComplianceError,
  TimeoutError,
  ExternalServiceError,
  NotFoundError,
} from './errors';

describe('Error classes', () => {
  test('AppError defaults to 500 and INTERNAL_ERROR', () => {
    const err = new AppError('something broke');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.message).toBe('something broke');
    expect(err.name).toBe('AppError');
  });

  test('AppError accepts custom code, status, and details', () => {
    const err = new AppError('custom', 'MY_CODE', 418, { extra: true });
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe('MY_CODE');
    expect(err.details).toEqual({ extra: true });
  });

  test('UnauthorizedError has 401 status', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Unauthorized');
  });

  test('UnauthorizedError accepts custom message', () => {
    const err = new UnauthorizedError('bad token');
    expect(err.message).toBe('bad token');
    expect(err.statusCode).toBe(401);
  });

  test('ForbiddenError has 403 status', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  test('ValidationError has 400 status', () => {
    const err = new ValidationError('invalid email');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  test('BusinessLogicError has 422 status', () => {
    const err = new BusinessLogicError('cannot cancel', 'CANCEL_FAILED');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('CANCEL_FAILED');
  });

  test('ConflictError has 409 status', () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });

  test('RateLimitError has 429 status and details', () => {
    const err = new RateLimitError('slow down', { retryAfter: 30 });
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.details?.['retryAfter']).toBe(30);
  });

  test('AuthenticationError has 401 status with scheme details', () => {
    const err = new AuthenticationError('bad creds', 'bearer', ['bearer', 'basic']);
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTHENTICATION_ERROR');
    expect(err.details?.['scheme']).toBe('bearer');
    expect(err.details?.['supportedSchemes']).toEqual(['bearer', 'basic']);
  });

  test('AuthorizationError has 403 status with permission details', () => {
    const err = new AuthorizationError('no access', 'admin:write', ['user:read'], 'invoice');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('AUTHORIZATION_ERROR');
    expect(err.details?.['requiredPermission']).toBe('admin:write');
    expect(err.details?.['resource']).toBe('invoice');
  });

  test('HipaaComplianceError has 400 status with hipaa details', () => {
    const err = new HipaaComplianceError('PHI exposed', '164.502', 'privacy');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('HIPAA_COMPLIANCE_ERROR');
    expect(err.details?.['hipaaRule']).toBe('164.502');
    expect(err.details?.['violationType']).toBe('privacy');
  });

  test('TimeoutError has 408 status', () => {
    const err = new TimeoutError('timed out', 5000, 'db-query', true);
    expect(err.statusCode).toBe(408);
    expect(err.code).toBe('TIMEOUT_ERROR');
    expect(err.details?.['timeoutMs']).toBe(5000);
    expect(err.details?.['retryable']).toBe(true);
  });

  test('ExternalServiceError has 503 status', () => {
    const err = new ExternalServiceError('stripe down', 'stripe', 'charge', 'E100', 'fail', true, 120);
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('EXTERNAL_SERVICE_ERROR');
    expect(err.details?.['service']).toBe('stripe');
    expect(err.details?.['retryable']).toBe(true);
    expect(err.details?.['retryAfter']).toBe(120);
  });

  test('NotFoundError has 404 status with options', () => {
    const err = new NotFoundError('user missing', {
      resourceType: 'user',
      resource: 'abc-123',
      suggestions: ['check id'],
    });
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.details?.['resourceType']).toBe('user');
    expect(err.details?.['suggestions']).toEqual(['check id']);
  });

  test('all error classes extend AppError', () => {
    const errors = [
      new UnauthorizedError(),
      new ForbiddenError(),
      new ValidationError(),
      new BusinessLogicError('x'),
      new ConflictError(),
      new RateLimitError(),
      new AuthenticationError(),
      new AuthorizationError(),
      new NotFoundError(),
    ];
    for (const err of errors) {
      expect(err instanceof AppError).toBe(true);
      expect(err instanceof Error).toBe(true);
    }
  });
});
