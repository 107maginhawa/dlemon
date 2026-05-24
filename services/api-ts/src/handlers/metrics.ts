/**
 * GET /metrics — Prometheus scrape endpoint.
 *
 * Auth: static bearer token from `METRICS_TOKEN` env var.
 * If the env var is missing/empty, the endpoint returns 401 to fail closed.
 */

import type { Context } from 'hono';
import { getMetrics, getMetricsContentType } from '@/core/metrics';

export async function metricsHandler(c: Context): Promise<Response> {
  const expected = process.env['METRICS_TOKEN'];
  const authHeader = c.req.header('authorization') ?? c.req.header('Authorization') ?? '';
  const presented = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  if (!expected || !presented || presented !== expected) {
    return c.text('unauthorized', 401);
  }

  const body = await getMetrics();
  return c.body(body, 200, {
    'Content-Type': getMetricsContentType(),
  });
}
