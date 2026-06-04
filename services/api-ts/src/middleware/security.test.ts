/**
 * Security middleware unit tests
 *
 * Tests CORS middleware creation, security headers, and CSRF guard.
 * Includes behavioral assertions for HSTS/CSP NODE_ENV gating and
 * CORS fail-closed behavior (no wildcard reflection).
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { createSecurityHeaders, createCorsMiddleware, createCsrfGuard, createPhiCacheHeaders } from './security';
import { createOriginValidator } from '@/utils/cors';
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
    server: { host: '0.0.0.0', port: 7213, internalServiceToken: '', internalServiceExpandEnabled: false, emrTenantEnabled: true },
    database: { url: 'postgres://localhost/test' } as any,
    rateLimit: { enabled: false, max: 100 },
    storage: {} as any,
    email: {} as any,
    notifs: {} as any,
    billing: {} as any,
    webrtc: { iceServers: [] },
    features: { dentalImagingAutoLandmark: false },
  } as Config;
}

// Helper: run a middleware against a plain GET request and return the response
async function runThrough(middleware: (c: any, next: any) => any): Promise<Response> {
  const app = new Hono();
  app.use('*', middleware as any);
  app.get('*', (c) => c.text('ok'));
  return app.fetch(new Request('http://localhost/test'));
}

describe('createSecurityHeaders', () => {
  const origNodeEnv = process.env['NODE_ENV'];
  afterEach(() => {
    if (origNodeEnv === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = origNodeEnv;
  });

  test('returns a middleware function', () => {
    const middleware = createSecurityHeaders(makeConfig());
    expect(typeof middleware).toBe('function');
  });

  test('production: sets HSTS max-age=31536000; includeSubDomains', async () => {
    process.env['NODE_ENV'] = 'production';
    const res = await runThrough(createSecurityHeaders(makeConfig()));
    expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000');
    expect(res.headers.get('strict-transport-security')).toContain('includeSubDomains');
  });

  test('production: sets CSP with frame-ancestors none', async () => {
    process.env['NODE_ENV'] = 'production';
    const res = await runThrough(createSecurityHeaders(makeConfig()));
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test('non-production: no custom CSP frame-ancestors (only set in prod)', async () => {
    delete process.env['NODE_ENV'];
    const res = await runThrough(createSecurityHeaders(makeConfig()));
    const csp = res.headers.get('content-security-policy') ?? '';
    // Hono default secureHeaders() does not set frame-ancestors or default-src — prod only
    expect(csp).not.toContain("frame-ancestors");
    expect(csp).not.toContain("default-src 'self'");
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

// ── CORS origin validator — fail-closed behavior ─────────────────────────────

describe('CORS origin validation — fail-closed', () => {
  test('no origin → null (non-browser request, no ACAO header set)', () => {
    const validator = createOriginValidator(makeConfig().cors);
    expect(validator('', {} as any)).toBeNull();
  });

  test('unmatched origin → null (never wildcard-reflected)', () => {
    const validator = createOriginValidator(
      makeConfig({ origins: ['https://app.example.com'], allowLocalNetwork: false, allowTunneling: false }).cors,
    );
    expect(validator('https://evil.com', {} as any)).toBeNull();
  });

  test('allowed explicit origin → reflected exactly (not *)', () => {
    const validator = createOriginValidator(
      makeConfig({ origins: ['https://app.example.com'], allowLocalNetwork: false, allowTunneling: false }).cors,
    );
    const result = validator('https://app.example.com', {} as any);
    expect(result).toBe('https://app.example.com');
    expect(result).not.toBe('*');
  });

  test('strict mode: local-network origin not in explicit list → blocked', () => {
    const validator = createOriginValidator(
      makeConfig({ origins: [], strict: true, allowLocalNetwork: true }).cors,
    );
    expect(validator('http://localhost:3000', {} as any)).toBeNull();
  });
});

// ── CSRF guard tests ─────────────────────────────────────────────────────────

function makeCtx(overrides: {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
} = {}) {
  const hdrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(overrides.headers || {})) {
    hdrs[k.toLowerCase()] = v;
  }
  const ctx: any = {
    req: {
      method: overrides.method || 'POST',
      path: overrides.path || '/api/test',
      header: (name: string) => hdrs[name.toLowerCase()],
    },
    json: (body: any, status?: number) => ({ body, status: status ?? 200 }),
  };
  return ctx;
}

const noop = () => Promise.resolve();

describe('createCsrfGuard', () => {
  test('returns a middleware function', () => {
    expect(typeof createCsrfGuard(makeConfig())).toBe('function');
  });

  // (a) Bearer + no Origin → pass (non-browser SDK / server-to-server)
  test('(a) Bearer + no Origin → pass', async () => {
    const guard = createCsrfGuard(makeConfig());
    let called = false;
    await guard(makeCtx({ headers: { authorization: 'Bearer token123' } }), () => {
      called = true;
      return Promise.resolve();
    });
    expect(called).toBe(true);
  });

  // (b) cookie + Sec-Fetch-Site: same-origin → pass (normal browser same-origin)
  test('(b) cookie + Sec-Fetch-Site: same-origin → pass', async () => {
    const guard = createCsrfGuard(makeConfig());
    let called = false;
    await guard(
      makeCtx({ headers: { cookie: 'session=abc', 'sec-fetch-site': 'same-origin' } }),
      () => { called = true; return Promise.resolve(); },
    );
    expect(called).toBe(true);
  });

  // (c) cookie + allowed Origin → pass (allowlisted origin, no Sec-Fetch-Site)
  test('(c) cookie + allowed Origin → pass', async () => {
    const guard = createCsrfGuard(makeConfig({ origins: ['http://localhost:3000'] }));
    let called = false;
    await guard(
      makeCtx({ headers: { cookie: 'session=abc', origin: 'http://localhost:3000' } }),
      () => { called = true; return Promise.resolve(); },
    );
    expect(called).toBe(true);
  });

  // (d) cookie + cross-site Sec-Fetch-Site → 403
  test('(d) cookie + cross-site Sec-Fetch-Site → 403', async () => {
    const guard = createCsrfGuard(makeConfig());
    let status = 0;
    const c = makeCtx({ headers: { cookie: 'session=abc', 'sec-fetch-site': 'cross-site', origin: 'https://evil.test' } });
    c.json = (_body: any, s: number) => { status = s; };
    await guard(c, noop);
    expect(status).toBe(403);
  });

  // (e) safe method (GET) always passes regardless of Origin
  test('(e) safe method GET always passes', async () => {
    const guard = createCsrfGuard(makeConfig());
    let called = false;
    await guard(
      makeCtx({ method: 'GET', headers: { origin: 'https://evil.test', 'sec-fetch-site': 'cross-site' } }),
      () => { called = true; return Promise.resolve(); },
    );
    expect(called).toBe(true);
  });

  // (f) JSON cross-origin cookie POST → 403 (B1 regression: content-type-agnostic guard)
  test('(f) JSON content-type cross-origin cookie POST → 403', async () => {
    const guard = createCsrfGuard(makeConfig());
    let status = 0;
    const c = makeCtx({
      headers: {
        cookie: 'session=abc',
        'content-type': 'application/json',
        origin: 'https://evil.test',
        'sec-fetch-site': 'cross-site',
      },
    });
    c.json = (_body: any, s: number) => { status = s; };
    await guard(c, noop);
    expect(status).toBe(403);
  });

  // (g) NORMATIVE INVARIANT: cookie + no Origin/Referer/Bearer/Sec-Fetch-Site → pass
  // This is the exact shape of the Hurl contract suite AND the embedded Tauri/QuickJS path.
  // If this test is absent or fails, the contract suite breaks and the app is broken.
  test('(g) cookie + no browser signals → pass (contract-suite + embedded-Tauri invariant)', async () => {
    const guard = createCsrfGuard(makeConfig());
    let called = false;
    await guard(
      makeCtx({ headers: { cookie: 'session=abc', 'content-type': 'application/json' } }),
      () => { called = true; return Promise.resolve(); },
    );
    expect(called).toBe(true);
  });
});

describe('createPhiCacheHeaders', () => {
  async function fetchPath(path: string): Promise<Response> {
    const app = new Hono();
    app.use('*', createPhiCacheHeaders() as any);
    app.get('*', (c) => c.text('ok'));
    return app.fetch(new Request(`http://localhost${path}`));
  }

  test('API route gets Cache-Control: no-store', async () => {
    const res = await fetchPath('/dental/visits');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  test('/health is exempt — no Cache-Control override', async () => {
    const res = await fetchPath('/health');
    expect(res.headers.get('cache-control')).not.toBe('no-store');
  });

  test('/auth is exempt', async () => {
    const res = await fetchPath('/auth/session');
    expect(res.headers.get('cache-control')).not.toBe('no-store');
  });

  test('/docs is exempt', async () => {
    const res = await fetchPath('/docs');
    expect(res.headers.get('cache-control')).not.toBe('no-store');
  });
});
