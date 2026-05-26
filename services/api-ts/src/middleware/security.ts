/**
 * Security middleware
 * Provides security headers, CORS configuration, and CSRF guard
 */

import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import type { Config } from '@/core/config';
import type { Logger } from '@/types/logger';
import { createOriginValidator } from '@/utils/cors';

/**
 * Create security headers middleware
 * Adds CSP, HSTS, X-Frame-Options, and other security headers
 */
export function createSecurityHeaders(config: Config) {
  if (process.env['NODE_ENV'] === 'production') {
    return secureHeaders({
      strictTransportSecurity: 'max-age=31536000; includeSubDomains',
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    });
  }
  return secureHeaders();
}

/**
 * Create CORS middleware with dynamic origin validation
 * Configures allowed origins, methods, headers, and credentials
 */
export function createCorsMiddleware(config: Config, logger?: Logger) {
  const originValidator = createOriginValidator(config.cors, logger);

  const corsConfig = {
    origin: originValidator,
    credentials: config.cors.credentials,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // When adding custom headers, add to BOTH allowHeaders AND exposeHeaders
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key'],
    exposeHeaders: ['X-Request-ID'],
    maxAge: 600,
  };

  // Log the CORS configuration being applied if logger is provided
  if (logger) {
    logger.debug({
      corsSettings: {
        allowLocalNetwork: config.cors.allowLocalNetwork,
        allowTunneling: config.cors.allowTunneling,
        strict: config.cors.strict,
        explicitOrigins: config.cors.origins,
      },
      credentials: corsConfig.credentials,
      allowMethods: corsConfig.allowMethods,
      allowHeaders: corsConfig.allowHeaders,
    }, 'CORS middleware configured with dynamic origin validation');
  }

  return cors(corsConfig);
}

// ASVS V8: PHI responses must not be cached by browsers or proxies.
// Applies to all API routes; excludes public-safe paths.
const PHI_EXEMPT_PREFIXES = ['/health', '/auth', '/docs', '/scalar', '/openapi'];

export function createPhiCacheHeaders() {
  return async function phiCacheHeaders(c: any, next: () => Promise<void>): Promise<void> {
    const path = c.req.path as string;
    const isExempt = PHI_EXEMPT_PREFIXES.some(p => path.startsWith(p));
    await next();
    if (!isExempt) {
      c.res.headers.set('Cache-Control', 'no-store');
    }
  };
}

const CSRF_UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Create CSRF guard middleware.
 *
 * Strategy: content-type-agnostic (covers JSON POSTs that Hono's built-in
 * csrf() would miss). Uses browser fetch metadata + Origin for detection.
 *
 * NORMATIVE INVARIANT — do NOT weaken without updating the plan:
 *   cookie + unsafe method + no Origin + no Referer + no Bearer + no Sec-Fetch-Site → ALLOW
 * This is the exact request shape of both the Hurl contract suite and the
 * embedded Tauri/QuickJS path. Browsers always send Sec-Fetch-Site; only
 * non-browser clients omit all signals. Tightening this to 403 breaks the
 * contract suite immediately and every embedded clinical write once Tauri
 * sync is wired.
 */
export function createCsrfGuard(config: Config, logger?: Logger) {
  const originValidator = createOriginValidator(config.cors, logger);

  return async function csrfGuard(c: any, next: () => Promise<void>): Promise<Response | void> {
    const method = (c.req.method as string).toUpperCase();

    // Safe methods never need CSRF protection
    if (!CSRF_UNSAFE_METHODS.has(method)) {
      return next();
    }

    // Path-based exemptions: Better-Auth manages its own CSRF; Stripe webhook
    // is not auth-gated and uses signature verification instead
    const path = c.req.path as string;
    if (path.startsWith('/auth/') || path === '/billing/webhooks/stripe') {
      return next();
    }

    const authHeader = (c.req.header('Authorization') as string | undefined) ?? '';
    const internalToken = (c.req.header('X-Internal-Service-Token') as string | undefined) ?? '';

    // Bearer token: non-browser client — attackers cannot set Authorization
    // cross-origin, so no CSRF risk
    if (authHeader.startsWith('Bearer ')) {
      return next();
    }

    // Internal service expand path: explicitly exempted
    if (internalToken && config.server.internalServiceExpandEnabled) {
      return next();
    }

    const secFetchSite = (c.req.header('Sec-Fetch-Site') as string | undefined) ?? '';
    const origin = (c.req.header('Origin') as string | undefined) ?? '';
    const referer = (c.req.header('Referer') as string | undefined) ?? '';

    // NORMATIVE INVARIANT (see above): no browser signals → non-browser client → ALLOW
    if (!secFetchSite && !origin && !referer) {
      logger?.warn({ method, path }, 'csrf-guard: no browser signals, passing non-browser client');
      return next();
    }

    // Sec-Fetch-Site present: most reliable signal (modern browsers)
    if (secFetchSite) {
      if (secFetchSite === 'same-origin' || secFetchSite === 'same-site' || secFetchSite === 'none') {
        return next();
      }
      logger?.warn({ method, path, secFetchSite }, 'csrf-guard: cross-site Sec-Fetch-Site rejected');
      return c.json({ error: 'CSRF check failed' }, 403);
    }

    // No Sec-Fetch-Site but Origin/Referer present: check against CORS allow-list
    const requestOrigin = origin || (() => {
      try { return new URL(referer).origin; } catch { return ''; }
    })();

    if (requestOrigin) {
      const allowed = originValidator(requestOrigin, c);
      if (allowed) {
        return next();
      }
      logger?.warn({ method, path, origin: requestOrigin }, 'csrf-guard: non-allowlisted Origin rejected');
      return c.json({ error: 'CSRF check failed' }, 403);
    }

    // Fallback — no actionable signal (guarded by the invariant above, shouldn't reach here)
    return next();
  };
}