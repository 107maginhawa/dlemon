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
// when the AppointmentCard action buttons were de-duplicated into one shared class.
const BASELINE = 346;

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
