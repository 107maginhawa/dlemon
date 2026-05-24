/**
 * HTTP latency observation middleware.
 *
 * Records request duration into the prom-client histogram, labeled with
 * method / matched route / status code. Skips `/metrics` itself to avoid
 * recursive observation noise.
 */

import { Next } from 'hono';
import type { AppContext } from '@/types/app';
import { httpRequestDurationHistogram } from '@/core/metrics';

export async function metricsMiddleware(ctx: AppContext, next: Next): Promise<void> {
  // Don't measure scrape requests themselves.
  if (ctx.req.path === '/metrics') {
    await next();
    return;
  }

  const start = performance.now();
  try {
    await next();
  } finally {
    const durationSeconds = (performance.now() - start) / 1000;
    // routePath is set after route match; fall back to raw path for unmatched/404s.
    const route = (ctx.req as unknown as { routePath?: string }).routePath ?? ctx.req.path;
    const status = ctx.res?.status ?? 0;
    httpRequestDurationHistogram.observe(
      {
        method: ctx.req.method,
        route,
        status_code: status.toString(),
      },
      durationSeconds,
    );
  }
}
