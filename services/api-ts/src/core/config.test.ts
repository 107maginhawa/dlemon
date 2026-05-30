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

  // --------------------------------------------------------------------------
  // T-002: email-verification gate (env-gated, prod-safe-by-default)
  // --------------------------------------------------------------------------

  test('requireEmailVerification defaults to false in dev/test', () => {
    delete process.env['NODE_ENV'];
    delete process.env['AUTH_REQUIRE_EMAIL_VERIFICATION'];
    expect(parseConfig().auth.requireEmailVerification).toBe(false);
  });

  test('requireEmailVerification can be forced on via env', () => {
    delete process.env['NODE_ENV'];
    process.env['AUTH_REQUIRE_EMAIL_VERIFICATION'] = 'true';
    expect(parseConfig().auth.requireEmailVerification).toBe(true);
  });

  test('requireEmailVerification defaults to TRUE in production', () => {
    // Satisfy the production secret guard so parseConfig() doesn't refuse to start.
    process.env['NODE_ENV'] = 'production';
    process.env['AUTH_SECRET'] = 'x'.repeat(40);
    process.env['INTERNAL_SERVICE_TOKEN'] = 'y'.repeat(40);
    process.env['DATABASE_URL'] = 'postgres://real:cred@db.example.com:5432/prod';
    process.env['STORAGE_ACCESS_KEY_ID'] = 'real-access-key';
    process.env['STORAGE_SECRET_ACCESS_KEY'] = 'real-secret-key';
    delete process.env['AUTH_REQUIRE_EMAIL_VERIFICATION'];
    expect(parseConfig().auth.requireEmailVerification).toBe(true);
  });

  test('production can explicitly opt out via env', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['AUTH_SECRET'] = 'x'.repeat(40);
    process.env['INTERNAL_SERVICE_TOKEN'] = 'y'.repeat(40);
    process.env['DATABASE_URL'] = 'postgres://real:cred@db.example.com:5432/prod';
    process.env['STORAGE_ACCESS_KEY_ID'] = 'real-access-key';
    process.env['STORAGE_SECRET_ACCESS_KEY'] = 'real-secret-key';
    process.env['AUTH_REQUIRE_EMAIL_VERIFICATION'] = 'false';
    expect(parseConfig().auth.requireEmailVerification).toBe(false);
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

  // --------------------------------------------------------------------------
  // Production guard — insecure credentials are rejected at startup
  // --------------------------------------------------------------------------

  describe('production guard', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'production';
      process.env['AUTH_SECRET'] = 'a'.repeat(32);
      process.env['INTERNAL_SERVICE_TOKEN'] = 'b'.repeat(32);
      process.env['DATABASE_URL'] = 'postgres://app:strong@prod-db:5432/monobase';
      process.env['STORAGE_ACCESS_KEY_ID'] = 'real-access-key';
      process.env['STORAGE_SECRET_ACCESS_KEY'] = 'real-secret-key';
    });

    test('prod-safe env: does not throw', () => {
      expect(() => parseConfig()).not.toThrow();
    });

    test('missing AUTH_SECRET throws', () => {
      delete process.env['AUTH_SECRET'];
      expect(() => parseConfig()).toThrow('AUTH_SECRET');
    });

    test('short AUTH_SECRET throws', () => {
      process.env['AUTH_SECRET'] = 'tooshort';
      expect(() => parseConfig()).toThrow('AUTH_SECRET');
    });

    test('missing INTERNAL_SERVICE_TOKEN throws', () => {
      delete process.env['INTERNAL_SERVICE_TOKEN'];
      expect(() => parseConfig()).toThrow('INTERNAL_SERVICE_TOKEN');
    });

    test('default DATABASE_URL (localhost/password) throws', () => {
      process.env['DATABASE_URL'] = 'postgres://postgres:password@localhost:5432/monobase';
      expect(() => parseConfig()).toThrow('DATABASE_URL');
    });

    test('missing DATABASE_URL throws', () => {
      delete process.env['DATABASE_URL'];
      expect(() => parseConfig()).toThrow('DATABASE_URL');
    });

    test('default STORAGE_ACCESS_KEY_ID (minioadmin) throws', () => {
      process.env['STORAGE_ACCESS_KEY_ID'] = 'minioadmin';
      expect(() => parseConfig()).toThrow('STORAGE_ACCESS_KEY_ID');
    });

    test('missing STORAGE_ACCESS_KEY_ID throws', () => {
      delete process.env['STORAGE_ACCESS_KEY_ID'];
      expect(() => parseConfig()).toThrow('STORAGE_ACCESS_KEY_ID');
    });

    test('default STORAGE_SECRET_ACCESS_KEY (minioadmin) throws', () => {
      process.env['STORAGE_SECRET_ACCESS_KEY'] = 'minioadmin';
      expect(() => parseConfig()).toThrow('STORAGE_SECRET_ACCESS_KEY');
    });

    test('missing STORAGE_SECRET_ACCESS_KEY throws', () => {
      delete process.env['STORAGE_SECRET_ACCESS_KEY'];
      expect(() => parseConfig()).toThrow('STORAGE_SECRET_ACCESS_KEY');
    });
  });
});
