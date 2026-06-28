#!/usr/bin/env bun
/**
 * check-arbitrary-font-size.ts — Tailwind arbitrary font-size ratchet.
 *
 * The dentalemon app accumulated ~348 pixel-literal font sizes
 * (`text-[10px]`, `text-[11px]`, `text-[13px]`, even `text-[7px]`) that
 * bypass the rem-based Tailwind type scale (`text-xs`/`text-sm`/`text-base`…).
 * This hurts consistency, breaks user font-scaling, and produces sub-legible
 * text on iPad / arm's-length use.
 *
 * Rather than block on a one-shot mass rewrite, this is a RATCHET: it counts
 * the arbitrary font-size literals and fails if the count rises above the
 * current baseline. As literals are migrated to the token scale, lower
 * BASELINE — it can only go down, never up.
 *
 * Use the scale instead:  text-[11px] -> text-xs (12px) | text-[13px] -> text-sm (14px)
 * Inputs on touch get >=16px automatically via the @media (pointer: coarse)
 * rule in globals.css; prefer text-base (16px) for primary reading text.
 *
 * Usage:  bun run check:font-size
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Lower this as arbitrary font sizes are migrated to the token scale.
// It must never increase. Current count at introduction: 348; lowered to 346
// when the AppointmentCard action buttons were de-duplicated into one shared class;
// lowered to 343 when the workspace context strip + New Visit affordance moved to
// the rem token scale (text-xs) during the workspace-first-slice UX pass.
// lowered to 333 when imaging rail + perio chart legibility pass migrated tooth
// numbers, arch/site labels, and the upload card to the rem token scale.
// lowered to 332 when the treatment-plan CDT-year stamp moved into the labeled
// field grid (rem token scale) during the record-tabs polish pass.
// lowered to 327 — layer key on historical cards uses text-xs (no new raw px).
// lowered to 326 — carousel header scope chips (#4) use text-xs, not text-[10px].
// lowered to 286 — workspace UI-standardization pass migrated 11px/13px literals
// in the discrete sheets/banners/badges/panels (chart-conflict-banner,
// findings-panel, attachments-sheet, treatment-plans-sheet, sync-status-badge,
// recalls-sheet, timeline-carousel, chart-export-view, and the perio
// summary/comparison/overlay/voice surfaces) to the rem token scale (text-xs /
// text-sm). The workspace-payment-modal dense money panel and the dental-chart
// canvas glyphs are intentionally left for a dedicated, individually-verified pass.
// lowered to 183 — billing UI-standardization pass migrated the dense financial
// tables (billing-list, invoice-detail, claims-worklist, collections-view,
// payment-plan-view/create, invoice-insurance-block): 11px column headers ->
// text-xs, 13px chips/cells -> text-sm, 15px bold totals -> text-base. Verified
// in-browser at iPad/desktop that the money columns don't overflow.
// lowered to 178 — imaging safe slice: patient-image-list, CbctStudyCard and
// SuperimpositionPanel 11px labels -> text-xs. The imaging viewer's broader
// palette is an intentional dark PACS theme, deferred (see B9 in the audit).
// lowered to 163 — scheduling pass: calendar day/week/month, appointment-card,
// recall-due-list and queue-board 11/13/15px literals -> text-xs/sm/base. The
// appointment-modal (DESIGN-exempt transactional panel) keeps its 1 literal,
// deferred with the workspace-payment-modal (B2).
// lowered to 149 — dashboard pass: metric-card, morning-briefing,
// attention-queue, kpi-ribbon, schedule-timeline 11/13px -> text-xs/sm.
// lowered to 136 — remaining light modules (patients follow-up-notes/profile/
// duplicate-panel, settings data-erasure/audit-log, notifications bell) 11/13px
// -> text-xs/sm. The residual literals are text-[10px] (Micro, no rem token) and
// the deferred dense panels (B2: workspace-payment-modal + appointment-modal).
// lowered to 120 — B2 done: the two exempt transactional panels
// (workspace-payment-modal, appointment-modal) migrated 11/13px -> text-xs/sm
// and 15px totals/CTAs -> text-base, browser-verified no overflow. Residual
// literals are text-[10px] (Micro) + dense chart internals (B3/B4/B5).
const BASELINE = 120;

const ROOT = join(import.meta.dir, '..', 'apps', 'dentalemon', 'src');
const FONT_RE = /text-\[\d+px\]/g;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|ts)$/.test(entry)) out.push(p);
  }
  return out;
}

let count = 0;
const hits: string[] = [];
for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    const m = line.match(FONT_RE);
    if (m) {
      count += m.length;
      hits.push(`${file.replace(ROOT, 'src')}:${i + 1}  ${m.join(' ')}`);
    }
  });
}

if (count > BASELINE) {
  console.error(
    `✗ Arbitrary Tailwind font sizes rose to ${count} (baseline ${BASELINE}).`,
  );
  console.error('  New text-[Npx] literals are not allowed — use the token scale');
  console.error('  (text-xs / text-sm / text-base …). Offending lines:');
  for (const h of hits) console.error(`    ${h}`);
  process.exit(1);
}

if (count < BASELINE) {
  console.log(
    `✓ Arbitrary font sizes down to ${count} (baseline ${BASELINE}). ` +
      `Lower BASELINE to ${count} in scripts/check-arbitrary-font-size.ts.`,
  );
} else {
  console.log(`✓ Arbitrary font sizes at baseline (${count}). No new literals.`);
}
