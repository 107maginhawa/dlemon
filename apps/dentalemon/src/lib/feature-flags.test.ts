/**
 * Tests for workspace v1/v2 feature flags.
 *
 * Contract: every deferred-to-v2 workspace tool is gated by a `workspace.*`
 * flag that defaults OFF, so v1 ships the minimal closed loop while the code
 * stays in the tree. TDD: written first (RED), then DEFAULTS makes them GREEN.
 */
import { describe, test, expect } from 'bun:test';
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
