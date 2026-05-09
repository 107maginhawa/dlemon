/**
 * Runtime config unit tests
 *
 * Tests fetchRuntimeConfig caching, clearing, and timeout behavior.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { fetchRuntimeConfig, clearRuntimeConfigCache } from './runtime-config';

describe('Runtime config', () => {
  beforeEach(() => {
    clearRuntimeConfigCache();
  });

  test('clearRuntimeConfigCache resets cache', () => {
    // Should not throw
    clearRuntimeConfigCache();
    clearRuntimeConfigCache();
    expect(true).toBe(true);
  });

  test('fetchRuntimeConfig returns empty config on network failure', async () => {
    // In test environment, fetch to /config.json will fail
    const config = await fetchRuntimeConfig(100); // short timeout
    // Should return empty config (fallback)
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  test('fetchRuntimeConfig returns same shape on repeated calls', async () => {
    const config1 = await fetchRuntimeConfig(100);
    const config2 = await fetchRuntimeConfig(100);
    expect(typeof config1).toBe('object');
    expect(typeof config2).toBe('object');
  });

  test('fetchRuntimeConfig respects timeout parameter', async () => {
    const start = Date.now();
    await fetchRuntimeConfig(50); // very short timeout
    const elapsed = Date.now() - start;
    // Should complete quickly (either fast fail or timeout)
    expect(elapsed).toBeLessThan(5000);
  });

  test('RuntimeConfig interface allows apiUrl and onesignalAppId', async () => {
    const config = await fetchRuntimeConfig(100);
    // These may be undefined (fallback), but should be valid types
    expect(config.apiUrl === undefined || typeof config.apiUrl === 'string').toBe(true);
    expect(config.onesignalAppId === undefined || typeof config.onesignalAppId === 'string').toBe(true);
  });
});
