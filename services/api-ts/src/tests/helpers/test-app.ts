/**
 * Shared validator-mounting test harness — `buildTestApp`.
 *
 * WHY THIS EXISTS (the raw-handler-test-blindspot)
 * ------------------------------------------------
 * Most backend integration tests build a bespoke Hono app and mount the *raw*
 * handler — either with no validator at all, or with a hand-written
 * `zValidator(...)` chain copied per file. Both drift from production:
 *
 *   - No-validator mounts let a malformed body reach the handler. Handlers that
 *     read `ctx.req.valid('json')` then crash (500) or silently accept garbage,
 *     so a contract violation that production rejects with a clean 400 ships
 *     green. This is the mechanism behind nearly every FE↔BE contract drift the
 *     AHA pipeline fixed (BUG-IMG-001 et al). Only the Hurl contract suite — a
 *     separate, env-gated, out-of-process backstop — ever caught them.
 *
 *   - Hand-copied `zValidator` chains can themselves drift from the *generated*
 *     wiring (wrong schema, missing param validator, stale auth role).
 *
 * `buildTestApp` removes both gaps by assembling the app from the EXACT
 * production route table — `registerRoutes` from `@/generated/openapi/routes`,
 * the same function `createApp` calls. Every request therefore traverses the
 * real middleware chain: `authMiddleware` → generated `zValidator` (param +
 * json + query) → handler → the real error envelope. The only substitution is
 * the Better-Auth session: a stub `auth.api.getSession` returns the configured
 * test user (or `null` for the unauthenticated case) so authenticated requests
 * can be driven without a live Better-Auth login.
 *
 * Hurl stays the cross-process backstop; this harness is the in-process, fast,
 * seed-friendly equivalent for catching the same class of drift.
 *
 * KNOWN DIVERGENCES FROM `createApp` (do NOT write these tests through the harness)
 * --------------------------------------------------------------------------------
 * The harness mounts ONLY the generated route table (`registerRoutes`). `createApp`
 * additionally hand-mounts a handful of Cat-1 routes BEFORE the generated table and
 * runs global guards the harness omits. For these, the harness is NOT faithful —
 * test them against the real `createApp(parseConfig())` instead:
 *
 *   - `POST /dental/org/members/:memberId/recover-pin` — production shadows this with
 *     `authMiddleware`; the generated route has none (handler self-guards). Harness
 *     reaches the generated route (handler-level 401 only).
 *   - `GET /dental/visits/history/:patientId/teeth/:toothNumber` — production hand-mounts
 *     it WITHOUT the param validator; the generated route HAS one, so the harness is
 *     STRICTER than production for `toothNumber`.
 *   - `DELETE/PUT/PATCH /dental/audit-events/:id` and `/dental/pmd/imported/:id` — the
 *     405 append-only immutability guards are hand-mounted in app.ts; the harness
 *     returns 404 / generic 405 instead of the domain-specific immutable code.
 *   - `GET|POST /dental/patients/:patientId/treatment-plans/:planId[/accept]` — plural
 *     re-export shims hand-mounted in app.ts; absent from the harness (→ 404).
 *   - `/dev/verify-email`, `/dev/promote-admin` — dev-only, registered by createApp only.
 *
 * Also omitted (harmless for validator-drift tests, but don't assert on them): CSRF
 * guard, `Cache-Control: no-store` PHI headers, security headers, CORS, metrics. The
 * M2M expand bypass (`X-Internal-Service-Token`) is wired but session-revocation side
 * effects (auth.api.revokeSession) are a no-op. Handlers needing services beyond
 * db/logger/auth (storage, notifs, audit, jobs, email, billing, ws) get `undefined`
 * unless passed via `opts.services` — they will throw if exercised.
 *
 * USAGE
 * -----
 *   const app = buildTestApp({ db, user: TEST_USER });
 *   const res = await app.request('/dental/visits/' + visitId + '/consents', {
 *     method: 'POST',
 *     headers: { 'content-type': 'application/json' },
 *     body: JSON.stringify({ ... }),
 *   });
 *
 * Omit `user` (or pass `null`) to exercise the unauthenticated path → 401.
 */

import { Hono } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import type { User } from '@/types/auth';
import type { App, Variables } from '@/types/app';
import type { Config } from '@/core/config';
import { parseConfig } from '@/core/config';
import { registerRoutes } from '@/generated/openapi/routes';
import { registerHandlers as registerErrorHandlers } from '@/core/errors';

/**
 * No-op logger satisfying the Pino-shaped `Logger` contract. `child` returns
 * itself so `logger.child({...})` call-sites stay silent too.
 */
export const SILENT_LOGGER: Logger = (() => {
  const noop = () => {};
  const base = { debug: noop, info: noop, warn: noop, error: noop, fatal: noop, trace: noop, silent: noop };
  return { ...base, child: () => SILENT_LOGGER } as unknown as Logger;
})();

/**
 * Default authenticated test user. Role `user` satisfies the common
 * `authMiddleware({ roles: ['user'] })` gate; branch/clinic-role checks still
 * run inside handlers against seeded membership rows.
 */
export const DEFAULT_TEST_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'harness@clinic.test',
  emailVerified: true,
  name: 'Harness User',
  role: 'user',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
} as unknown as User;

export interface BuildTestAppOptions {
  /** Drizzle instance the handlers read via `ctx.get('database')`. Required. */
  db: DatabaseInstance;
  /**
   * The authenticated user. `undefined`/`null` → `getSession` returns null →
   * `authMiddleware` throws 401 (unauthenticated path). Pass a partial to
   * override the default (e.g. `{ role: 'admin' }`).
   */
  user?: Partial<User> | null;
  /** Logger; defaults to {@link SILENT_LOGGER}. */
  logger?: Logger;
  /**
   * Extra context variables to inject (e.g. `storage`, `notifs`, `audit`) for
   * handlers that need services beyond db/logger/auth. Most validator-drift
   * tests need none.
   */
  services?: Partial<Variables>;
  /** Config for the error envelope; defaults to a lazily-parsed shared config. */
  config?: Config;
}

let cachedConfig: Config | undefined;
function defaultConfig(): Config {
  if (!cachedConfig) cachedConfig = parseConfig();
  return cachedConfig;
}

/**
 * Build a Hono app from the generated production route table with a stubbed
 * session. Each call returns a fresh app bound to the given user, so per-user
 * scenarios build one app each (matching the per-user `buildTestApp(user)`
 * pattern the bespoke helpers already use).
 */
export function buildTestApp(opts: BuildTestAppOptions): Hono<{ Variables: Variables }> {
  const { db, logger = SILENT_LOGGER, services, config = defaultConfig() } = opts;
  const user: User | null = opts.user
    ? ({ ...DEFAULT_TEST_USER, ...opts.user } as User)
    : null;

  // Stub Better-Auth: the only substitution vs production. `authMiddleware`
  // calls `auth.api.getSession({ headers })`; we ignore headers and answer from
  // the closure. `userHasRole` reads only `user.role`, so role gating still runs
  // against the configured role for real (401/403 behaviour is faithful).
  const authStub = {
    api: {
      getSession: async () =>
        user
          ? {
              user,
              session: {
                id: 'harness-session',
                userId: user.id,
                token: 'harness-token',
                expiresAt: new Date(Date.now() + 3_600_000),
                createdAt: new Date(),
                updatedAt: new Date(),
                ipAddress: '127.0.0.1',
                userAgent: 'test-harness',
              },
            }
          : null,
    // Role-assignment handlers (e.g. createProvider) call revokeSession to force
    // re-auth after a role change; it is wrapped in try/catch, so a no-op keeps the
    // happy path green. Session-invalidation side effects are NOT exercised here.
    revokeSession: async () => ({ status: true }),
    },
  };

  const app = new Hono<{ Variables: Variables }>();

  // Dependency injection — must run before the generated routes so their
  // authMiddleware/handlers see db, logger, auth, requestId.
  app.use('*', async (c, next) => {
    c.set('database', db);
    c.set('logger', logger);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stub narrows AuthInstance to the single method authMiddleware uses
    c.set('auth', authStub as any);
    c.set('config', config);
    c.set('requestId', 'harness-request');
    // `app` instance is read by the expand middleware (ctx.get('app').request(...));
    // without it `?expand=` silently degrades. `internalServiceToken` lets the M2M
    // expand-bypass branch in authMiddleware behave as production does.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- App self-references its own Variables type
    c.set('app', app as any);
    c.set('internalServiceToken', config.server.internalServiceToken);
    if (services) {
      for (const [key, value] of Object.entries(services)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service injection keyed by Variables field name
        c.set(key as any, value as any);
      }
    }
    await next();
  });

  // The exact production route table: authMiddleware → generated zValidator → handler.
  registerRoutes(app);

  // The real error envelope (canonical {error, code, ...} + 404/405 handling),
  // so status/code assertions match production and the Hurl backstop.
  registerErrorHandlers(app as unknown as App, config);

  return app;
}
