/**
 * Tests for workspace v1/v2 feature flags.
 *
 * Contract: every deferred-to-v2 workspace tool is gated by a `workspace.*`
 * flag that defaults OFF, so v1 ships the minimal closed loop while the code
 * stays in the tree. TDD: written first (RED), then DEFAULTS makes them GREEN.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { isFeatureEnabled, type FeatureFlag } from './feature-flags';

// The v2-deferred workspace surfaces. Each MUST default OFF in v1.
const DEFERRED_WORKSPACE_FLAGS: FeatureFlag[] = [
  'workspace.occlusion',
  'workspace.lab_orders',
  'workspace.tasks',
  'workspace.plan_docs',
  'workspace.ceph',
  'workspace.chart_export',
  'workspace.compare',
  'workspace.pmd',
  'workspace.advanced_billing',
  'workspace.visit_activity',
  'workspace.master_detail',
];

describe('workspace feature flags', () => {
  test('every deferred workspace flag defaults OFF (v1 = minimal closed loop)', () => {
    for (const flag of DEFERRED_WORKSPACE_FLAGS) {
      expect(isFeatureEnabled(flag)).toBe(false);
    }
  });

  test('pre-existing flags are unaffected', () => {
    expect(isFeatureEnabled('perio.voice_charting')).toBe(false);
  });
});

describe('dev-only localStorage override (E2E / manual QA)', () => {
  // import.meta.env is shared-by-reference in bun — MUTATE it in place (don't
  // replace the object, or the implementation module keeps the old reference).
  const metaEnv = (import.meta as unknown as { env: Record<string, unknown> }).env;
  const priorDev = metaEnv.DEV;

  beforeEach(() => {
    metaEnv.DEV = true;
    globalThis.localStorage?.clear();
  });
  afterEach(() => {
    metaEnv.DEV = priorDev;
    globalThis.localStorage?.clear();
  });

  test("localStorage 'ff:<flag>'='true' flips a default-OFF flag ON in DEV", () => {
    expect(isFeatureEnabled('workspace.pmd')).toBe(false);
    globalThis.localStorage.setItem('ff:workspace.pmd', 'true');
    expect(isFeatureEnabled('workspace.pmd')).toBe(true);
  });

  test('override is ignored when DEV is false (prod build never honours it)', () => {
    metaEnv.DEV = false;
    globalThis.localStorage.setItem('ff:workspace.pmd', 'true');
    expect(isFeatureEnabled('workspace.pmd')).toBe(false);
  });
});
