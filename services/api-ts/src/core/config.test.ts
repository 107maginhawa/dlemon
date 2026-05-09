/**
 * parseConfig() unit tests
 *
 * Validates default values, env-var overrides, and edge cases.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { parseConfig } from './config';

describe('parseConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  // --------------------------------------------------------------------------
  // Defaults
  // --------------------------------------------------------------------------

  test('returns default server port 7213', () => {
    delete process.env['SERVER_PORT'];
    delete process.env['PORT'];
    const config = parseConfig();
    expect(config.server.port).toBe(7213);
  });

  test('returns default server host 0.0.0.0', () => {
    delete process.env['SERVER_HOST'];
    const config = parseConfig();
    expect(config.server.host).toBe('0.0.0.0');
  });

  test('returns default database URL', () => {
    delete process.env['DATABASE_URL'];
    const config = parseConfig();
    expect(config.database.url).toBe('postgres://postgres:password@localhost:5432/monobase');
  });

  test('returns default CORS origins as wildcard', () => {
    delete process.env['CORS_ORIGINS'];
    const config = parseConfig();
    expect(config.cors.origins).toEqual(['*']);
  });

  test('returns default log level info', () => {
    delete process.env['LOG_LEVEL'];
    const config = parseConfig();
    expect(config.logging.level).toBe('info');
  });

  test('returns default rate limit max 100', () => {
    delete process.env['RATE_LIMIT_MAX'];
    const config = parseConfig();
    expect(config.rateLimit.max).toBe(100);
  });

  test('returns default storage provider minio', () => {
    delete process.env['STORAGE_PROVIDER'];
    const config = parseConfig();
    expect(config.storage.provider).toBe('minio');
  });

  // --------------------------------------------------------------------------
  // Env var overrides
  // --------------------------------------------------------------------------

  test('SERVER_PORT overrides default port', () => {
    process.env['SERVER_PORT'] = '9999';
    const config = parseConfig();
    expect(config.server.port).toBe(9999);
  });

  test('PORT is used when SERVER_PORT is absent', () => {
    delete process.env['SERVER_PORT'];
    process.env['PORT'] = '8080';
    const config = parseConfig();
    expect(config.server.port).toBe(8080);
  });

  test('DATABASE_URL overrides default', () => {
    process.env['DATABASE_URL'] = 'postgres://custom:pass@db:5432/mydb';
    const config = parseConfig();
    expect(config.database.url).toBe('postgres://custom:pass@db:5432/mydb');
  });

  test('LOG_LEVEL accepts valid levels', () => {
    process.env['LOG_LEVEL'] = 'debug';
    expect(parseConfig().logging.level).toBe('debug');

    process.env['LOG_LEVEL'] = 'warn';
    expect(parseConfig().logging.level).toBe('warn');

    process.env['LOG_LEVEL'] = 'error';
    expect(parseConfig().logging.level).toBe('error');
  });

  test('invalid LOG_LEVEL falls back to info', () => {
    process.env['LOG_LEVEL'] = 'verbose';
    const config = parseConfig();
    expect(config.logging.level).toBe('info');
  });

  test('CORS_ORIGINS parses comma-separated list', () => {
    process.env['CORS_ORIGINS'] = 'http://a.com, http://b.com';
    const config = parseConfig();
    expect(config.cors.origins).toEqual(['http://a.com', 'http://b.com']);
  });

  test('boolean env vars parse correctly', () => {
    process.env['CORS_STRICT'] = 'true';
    expect(parseConfig().cors.strict).toBe(true);

    process.env['CORS_STRICT'] = 'false';
    expect(parseConfig().cors.strict).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------

  test('non-numeric SERVER_PORT falls back to default', () => {
    process.env['SERVER_PORT'] = 'abc';
    const config = parseConfig();
    expect(config.server.port).toBe(7213);
  });

  test('google social provider configured when env vars present', () => {
    process.env['GOOGLE_CLIENT_ID'] = 'test-id';
    process.env['GOOGLE_CLIENT_SECRET'] = 'test-secret';
    const config = parseConfig();
    expect(config.auth.socialProviders?.google?.clientId).toBe('test-id');
  });

  test('google social provider undefined when env vars missing', () => {
    delete process.env['GOOGLE_CLIENT_ID'];
    delete process.env['GOOGLE_CLIENT_SECRET'];
    const config = parseConfig();
    expect(config.auth.socialProviders?.google).toBeUndefined();
  });

  test('billing config defaults to stripe provider', () => {
    const config = parseConfig();
    expect(config.billing.provider).toBe('stripe');
  });
});
