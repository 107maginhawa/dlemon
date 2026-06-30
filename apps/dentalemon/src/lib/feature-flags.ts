/**
 * Lightweight, build-time-overridable feature flags.
 *
 * There is no flag service in this template; flags are simple booleans sourced
 * from Vite env vars with a hard-coded default. They are intentionally additive
 * and default-OFF for in-progress features (e.g. `perio.voice_charting`).
 *
 * Usage:
 *   import { isFeatureEnabled } from '@/lib/feature-flags';
 *   if (isFeatureEnabled('perio.voice_charting')) { … }
 *
 * Override at build/dev time:
 *   VITE_FF_PERIO_VOICE_CHARTING=true bun run dev
 */

export type FeatureFlag =
  | 'perio.voice_charting'
  // ── workspace v1/v2 boundary ──────────────────────────────────────────────
  // v1 ships the smallest closed loop (chart · plan · notes · consent · Rx ·
  // photos · imaging-view · recalls · billing). Everything below is real, tested
  // code that's hidden in v1 and flipped ON for v2. Each comment IS the backlog.
  | 'workspace.occlusion' // occlusion screening tool
  | 'workspace.lab_orders' // structured lab-order tracking
  | 'workspace.tasks' // patient task worklist
  | 'workspace.plan_docs' // FSM plan documents + case-presentation
  | 'workspace.ceph' // cephalometric analysis / imaging superimposition
  | 'workspace.chart_export' // print-ready chart export
  | 'workspace.compare' // two-visit chart compare overlay (in timeline-carousel)
  | 'workspace.pmd' // portable medical document share/import
  | 'workspace.advanced_billing' // payment plans, collections/dunning, claims/HMO LOA, AR/statements, refund workflows
  | 'workspace.visit_activity' // v2 per-visit activity surfacing (detail-panel tabs, last-done stamps)
  | 'workspace.master_detail'; // v2 landscape side-by-side master-detail layout

const DEFAULTS: Record<FeatureFlag, boolean> = {
  // P2-4 Voice / hands-free perio charting. Default OFF — behind a documented
  // compliance review (off-device audio / PHI) and capability detection.
  'perio.voice_charting': false,
  // Workspace v2-deferred surfaces — all OFF in v1 (smallest closed loop).
  'workspace.occlusion': false,
  'workspace.lab_orders': false,
  'workspace.tasks': false,
  'workspace.plan_docs': false,
  'workspace.ceph': false,
  'workspace.chart_export': false,
  'workspace.compare': false,
  'workspace.pmd': false,
  'workspace.advanced_billing': false,
  'workspace.visit_activity': false,
  'workspace.master_detail': false,
};

/** Map a flag name to its Vite env var key, e.g. `VITE_FF_PERIO_VOICE_CHARTING`. */
function envKey(flag: FeatureFlag): string {
  return `VITE_FF_${flag.replace(/[.\-]/g, '_').toUpperCase()}`;
}

function readEnv(key: string): string | undefined {
  // import.meta.env is statically replaced by Vite; guard for non-Vite test runs.
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.[key];
}

/**
 * Resolve a feature flag. Env var (`VITE_FF_*`, parsed as a boolean) wins over
 * the built-in default; unknown/empty env values fall back to the default.
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const raw = readEnv(envKey(flag));
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return DEFAULTS[flag];
}
