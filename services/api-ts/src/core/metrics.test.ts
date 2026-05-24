/**
 * Unit tests for the prom-client registry wiring.
 */

import { describe, it, expect } from 'bun:test';
import { getMetrics, httpRequestDurationHistogram } from './metrics';

describe('metrics registry', () => {
  it('exposes the http request duration histogram in Prometheus format', async () => {
    // Force at least one observation so the bucket lines render.
    httpRequestDurationHistogram.observe(
      { method: 'GET', route: '/test', status_code: '200' },
      0.012,
    );

    const out = await getMetrics();
    expect(out).toContain('http_request_duration_seconds_bucket');
    expect(out).toContain('http_request_duration_seconds_count');
  });

  it('includes default Node process metrics', async () => {
    const out = await getMetrics();
    // At least one of the default collectors must be present.
    const hasCpu = out.includes('process_cpu_seconds_total');
    const hasEventLoop = out.includes('nodejs_eventloop_lag_seconds');
    expect(hasCpu || hasEventLoop).toBe(true);
  });
});
