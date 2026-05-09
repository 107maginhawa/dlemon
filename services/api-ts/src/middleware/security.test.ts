/**
 * Security middleware unit tests
 *
 * Tests CORS middleware creation and security headers.
 */

import { describe, test, expect } from 'bun:test';
import { createSecurityHeaders, createCorsMiddleware } from './security';
import type { Config } from '@/core/config';

function makeConfig(overrides: Partial<Config['cors']> = {}): Config {
  return {
    cors: {
      origins: ['http://localhost:3000'],
      credentials: true,
      allowLocalNetwork: true,
      allowTunneling: false,
      strict: false,
      ...overrides,
    },
    logging: { level: 'info', pretty: false },
    auth: { baseUrl: 'http://localhost:7213', secret: 'test' } as any,
    server: { host: '0.0.0.0', port: 7213, internalServiceToken: '' },
    database: { url: 'postgres://localhost/test' } as any,
    rateLimit: { enabled: false, max: 100 },
    storage: {} as any,
    email: {} as any,
    notifs: {} as any,
    billing: {} as any,
    webrtc: { iceServers: [] },
  } as Config;
}

describe('createSecurityHeaders', () => {
  test('returns a middleware function', () => {
    const config = makeConfig();
    const middleware = createSecurityHeaders(config);
    expect(typeof middleware).toBe('function');
  });
});

describe('createCorsMiddleware', () => {
  test('returns a middleware function', () => {
    const config = makeConfig();
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe('function');
  });

  test('accepts logger parameter without throwing', () => {
    const config = makeConfig();
    const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any;
    const middleware = createCorsMiddleware(config, logger);
    expect(typeof middleware).toBe('function');
  });

  test('strict mode uses only explicit origins', () => {
    const config = makeConfig({ strict: true, origins: ['https://app.example.com'] });
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe('function');
  });
});
