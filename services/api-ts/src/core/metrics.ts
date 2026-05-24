/**
 * Prometheus metrics registry and collectors.
 *
 * Exposes default Node.js process metrics (CPU, heap, GC, event loop lag)
 * and an HTTP request duration histogram for latency tracking.
 *
 * Scraped via `GET /metrics` (see `src/handlers/metrics.ts`).
 */

import { Registry, collectDefaultMetrics, Histogram, Gauge } from 'prom-client';

export const register = new Registry();

// Default Node process metrics: cpu, heap, eventloop lag, GC, file descriptors.
collectDefaultMetrics({ register });

export const httpRequestDurationHistogram = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds, labeled by method/route/status_code',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

// Pool-level DB gauges. Hosts may update these from their pg/postgres pool stats.
export const dbPoolSizeGauge = new Gauge({
  name: 'db_pool_size',
  help: 'Total connections in the database pool',
  registers: [register],
});

export const dbPoolIdleGauge = new Gauge({
  name: 'db_pool_idle',
  help: 'Idle connections in the database pool',
  registers: [register],
});

export const dbPoolWaitingGauge = new Gauge({
  name: 'db_pool_waiting',
  help: 'Pending acquire requests waiting for a database connection',
  registers: [register],
});

// Queue depth gauge for pg-boss-style background job queues.
export const queueDepthGauge = new Gauge({
  name: 'queue_depth',
  help: 'Pending jobs in a background queue',
  labelNames: ['queue'] as const,
  registers: [register],
});

/**
 * Returns the Prometheus exposition format string for all registered metrics.
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Returns the content-type expected by Prometheus scrapers.
 */
export function getMetricsContentType(): string {
  return register.contentType;
}
