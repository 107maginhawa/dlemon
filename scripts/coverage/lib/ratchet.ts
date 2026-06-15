/**
 * ratchet.ts — the universal coverage gate.
 *
 * Every coverage matrix generator produces a list of *gaps* (an op with no
 * negative-path test, a journey with no lock, a status token never asserted,
 * …). A raw "fail on any gap" gate is impossible to adopt on a codebase with a
 * pre-existing backlog, and a static "max N gaps" threshold rots. The ratchet
 * is the middle path:
 *
 *   - Each generator ships an ALLOWLIST of gap ids that are knowingly tolerated,
 *     every entry justified by a `reason`.
 *   - A gap NOT on the allowlist FAILS the gate (`newGaps`). New debt cannot be
 *     introduced silently.
 *   - An allowlist id that is no longer a current gap is REPORTED as `resolved`
 *     so the allowlist can be tightened — the ratchet only ever loosens by an
 *     explicit, reviewed edit, and tightens automatically as gaps are closed.
 *
 * This module is generator-agnostic: a `Gap` is anything with a string `id`.
 */

import { existsSync, readFileSync } from 'node:fs';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A coverage gap. Only `id` is required; generators attach their own fields. */
export interface Gap {
  id: string;
  [k: string]: unknown;
}

/** One tolerated gap, with a human-readable justification. */
export interface AllowlistEntry {
  id: string;
  reason: string;
}

export interface RatchetResult {
  /** Current gaps whose id is NOT on the allowlist — these FAIL the gate. */
  newGaps: Gap[];
  /** Allowlist ids no longer present in `current` — the allowlist can shrink. */
  resolved: string[];
  /** True iff there are no new gaps. */
  ok: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare current gaps against an allowlist.
 *
 *   newGaps  — current gaps whose `id` is not allowlisted (gate FAILS on these).
 *   resolved — allowlisted ids that are not in `current` (allowlist can shrink).
 *   ok       — `newGaps.length === 0`.
 *
 * Duplicate current gap ids are preserved in `newGaps` (a generator that emits
 * the same id twice has a real problem worth seeing); `resolved` is de-duped.
 */
export function ratchet(current: Gap[], allowlist: AllowlistEntry[]): RatchetResult {
  const allowed = new Set(allowlist.map((e) => e.id));
  const currentIds = new Set(current.map((g) => g.id));

  const newGaps = current.filter((g) => !allowed.has(g.id));
  const resolved = [...new Set(allowlist.map((e) => e.id))].filter(
    (id) => !currentIds.has(id),
  );

  return { newGaps, resolved, ok: newGaps.length === 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Allowlist loading
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load an allowlist from a JSON file.
 *
 *   - A missing file is tolerated → `[]` (a generator with no backlog needs no
 *     allowlist file).
 *   - The JSON must be an array of `{ id, reason }`; each entry is validated to
 *     have a non-empty string `id` and a non-empty string `reason`. A malformed
 *     entry or a non-array root throws — a broken allowlist must never silently
 *     widen the gate.
 */
export function loadAllowlist(path: string): AllowlistEntry[] {
  if (!existsSync(path)) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`Allowlist ${path} is not valid JSON: ${(err as Error).message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Allowlist ${path} must be a JSON array of { id, reason }.`);
  }

  return parsed.map((entry, i) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Allowlist ${path} entry ${i} is not an object.`);
    }
    const { id, reason } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error(`Allowlist ${path} entry ${i} has a missing/empty "id".`);
    }
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      throw new Error(`Allowlist ${path} entry ${i} (${id}) has a missing/empty "reason".`);
    }
    return { id, reason };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reporting
// ─────────────────────────────────────────────────────────────────────────────

export interface FormatOpts {
  /** Prefix for the report (e.g. the generator name). Defaults to "ratchet". */
  label?: string;
}

/**
 * Render a `RatchetResult` as a human-readable, multi-line string suitable for
 * CI logs. Lists every new gap (with the fields that explain why it failed) and
 * every resolved allowlist id (a hint to tighten the allowlist).
 */
export function formatRatchetReport(result: RatchetResult, opts: FormatOpts = {}): string {
  const label = opts.label ?? 'ratchet';
  const lines: string[] = [];

  if (result.ok) {
    lines.push(`✓ ${label}: no new gaps.`);
  } else {
    lines.push(`✗ ${label}: ${result.newGaps.length} new gap(s) (not allowlisted):`);
    for (const gap of result.newGaps) {
      lines.push(`  - ${gap.id}${formatGapDetail(gap)}`);
    }
  }

  if (result.resolved.length > 0) {
    lines.push('');
    lines.push(
      `↓ ${label}: ${result.resolved.length} allowlist entr${
        result.resolved.length === 1 ? 'y is' : 'ies are'
      } no longer needed — tighten the allowlist:`,
    );
    for (const id of result.resolved) {
      lines.push(`  - ${id}`);
    }
  }

  return lines.join('\n');
}

/** Render the non-`id` fields of a gap as a compact ` (k=v, …)` suffix. */
function formatGapDetail(gap: Gap): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(gap)) {
    if (k === 'id') continue;
    parts.push(`${k}=${formatValue(v)}`);
  }
  return parts.length ? ` (${parts.join(', ')})` : '';
}

function formatValue(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
