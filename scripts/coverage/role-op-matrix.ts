#!/usr/bin/env bun
/**
 * role-op-matrix.ts — role×operation drift detector.
 *
 * WHY: role↔spec drift is the latent PHI-leak / broken-authorization bug class.
 * A prior manual compliance pass found and hand-fixed several instances where a
 * handler's `assertBranchRole([...])` allow-list silently diverged from the
 * intent documented in docs/product/ROLE_PERMISSION_MATRIX.md (e.g. staff_full
 * could create invoices; hygienist could create general visits). This script
 * computes that comparison instead of hunting for it by hand.
 *
 * WHAT it does, deterministically:
 *   1. Loads the contract spine (operationId → handler file, method, path, module).
 *   2. For each operation, statically reads the handler source and extracts the
 *      allow-list passed to the FIRST `assertBranchRole(db, user, branch, <ROLES>)`
 *      inside the function whose name === operationId. The role set may be:
 *         - a string-literal array  → ['dentist_owner', ...]  (the code's allow-list)
 *         - a spread / computed set → 'dynamic'  (e.g. the E3 hygiene ternary)
 *         - absent                  → null  (no role gate on this operation)
 *      Re-export entrypoints (`export { foo } from './bar'`) are followed.
 *   3. Loads the spec's allow-list per operation from the role-permission matrix.
 *   4. Diffs code-truth vs spec-truth → `drift: boolean` per joined operation.
 *   5. Emits docs/testing/coverage/role-op-matrix.{json,md}.
 *
 * Run from repo root:  bun scripts/coverage/role-op-matrix.ts
 * (root-level script — does NOT trip the api-ts db-guard preload).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  ROOT,
  loadContractSpine,
  loadRolePermissionMatrix,
  type SpecAllow,
} from './lib/sources';

const OUT_JSON = join(ROOT, 'docs/testing/coverage/role-op-matrix.json');
const OUT_MD = join(ROOT, 'docs/testing/coverage/role-op-matrix.md');

// ─────────────────────────────────────────────────────────────────────────────
// Static extraction of the assertBranchRole allow-list
// ─────────────────────────────────────────────────────────────────────────────

export type CodeAllowed = string[] | 'dynamic' | null;

/**
 * Find the body span (start/end source offsets) of the function whose name is
 * `fnName`, declared as `export [async] function fnName(...) { ... }`.
 * Returns null if not found. Brace-balanced so nested blocks are respected.
 */
function findFunctionBody(src: string, fnName: string): { start: number; end: number } | null {
  // Match the declaration up to the opening brace of the body.
  const declRe = new RegExp(
    `export\\s+(?:async\\s+)?function\\s+${escapeRe(fnName)}\\s*[<(]`,
  );
  const m = declRe.exec(src);
  if (!m) return null;

  // Find the opening brace of the function body after the signature.
  const braceStart = src.indexOf('{', m.index);
  if (braceStart === -1) return null;

  // Brace-balance to find the matching close.
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { start: braceStart, end: i };
    }
  }
  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Blank out `//` line comments and block comments so prose mentions of
 * `assertBranchRole(...)` (which are common in handler doc-comments) are never
 * mistaken for real call sites. Replaces comment characters with spaces so all
 * source offsets are preserved.
 */
function stripComments(src: string): string {
  const out = src.split('');
  let i = 0;
  while (i < out.length) {
    const ch = src[i];
    const next = src[i + 1];
    // String literals — skip their contents so a // inside a string is not a comment.
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') {
        out[i] = ' ';
        i++;
      }
      continue;
    }
    if (ch === '/' && next === '*') {
      out[i] = ' ';
      out[i + 1] = ' ';
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] !== '\n') out[i] = ' ';
        i++;
      }
      if (i < src.length) {
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 2;
      }
      continue;
    }
    i++;
  }
  return out.join('');
}

/**
 * Given the source for a `assertBranchRole(...)` call whose open paren is at
 * `openParenIdx`, return the raw text of the 4th positional argument (the role
 * set). Paren/bracket-balanced so commas inside the array are not split on.
 */
function extractFourthArg(src: string, openParenIdx: number): string | null {
  let depth = 0;
  let argIndex = 0;
  let argStart = openParenIdx + 1;
  for (let i = openParenIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      if (depth === 1 && ch === '(') argStart = i + 1;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) {
        // End of the call — the final argument runs from argStart to here.
        if (argIndex === 3) return src.slice(argStart, i).trim();
        return null;
      }
    } else if (ch === ',' && depth === 1) {
      if (argIndex === 3) return src.slice(argStart, i).trim();
      argIndex++;
      argStart = i + 1;
    }
  }
  return null;
}

/**
 * Parse the 4th-argument text into a CodeAllowed value.
 *   ['a', 'b']        → ['a','b']
 *   [...someVar]      → 'dynamic'  (computed/conditional set)
 *   someVar           → 'dynamic'
 *   [a, computed()]   → 'dynamic'  (non-string-literal element)
 */
function parseRoleArg(argText: string): CodeAllowed {
  const t = argText.trim();
  if (!t.startsWith('[')) return 'dynamic'; // bare variable / call → computed
  const inner = t.slice(1, t.lastIndexOf(']'));
  if (inner.includes('...')) return 'dynamic'; // spread of a computed set
  const roles: string[] = [];
  const re = /'([^']+)'|"([^"]+)"/g;
  let m: RegExpExecArray | null;
  let matched = '';
  while ((m = re.exec(inner))) {
    roles.push(m[1] ?? m[2]!);
    matched += m[0];
  }
  // If after stripping the matched string literals + separators there is any
  // non-trivial token left (an identifier, a call), the array is not a pure
  // literal → treat as dynamic to avoid emitting a partial/bogus allow-list.
  const residue = inner.replace(/'[^']*'|"[^"]*"|,|\s/g, '');
  if (residue.length > 0) return 'dynamic';
  if (roles.length === 0 && inner.trim().length > 0) return 'dynamic';
  return roles;
}

/**
 * Extract the code-enforced allow-list for the assertBranchRole gate inside the
 * function `fnName` in `src`. Returns the role array, 'dynamic', or null.
 * Uses the FIRST assertBranchRole call in the function body (the primary gate).
 */
export function extractAllowedRolesFromSource(srcRaw: string, fnName: string): CodeAllowed {
  // Strip comments first so prose mentions of assertBranchRole(...) in handler
  // doc-comments are never mistaken for a real call site.
  const src = stripComments(srcRaw);
  const body = findFunctionBody(src, fnName);
  if (!body) return null;
  const bodyText = src.slice(body.start, body.end + 1);

  const callRe = /assertBranchRole\s*\(/g;
  const m = callRe.exec(bodyText);
  if (!m) return null;
  const openParen = bodyText.indexOf('(', m.index);
  const argText = extractFourthArg(bodyText, openParen);
  if (argText == null) return null;
  return parseRoleArg(argText);
}

/**
 * Extract the code-enforced allow-list for `opId` whose codegen entrypoint is
 * `handlerPath`, following up to a small number of indirection hops:
 *   - re-export entrypoints:  `export { opId } from './impl';`
 *   - delegation wrappers:    `export function opId(ctx){ return impl(ctx as ..); }`
 *     where `impl` is imported from a relative module (the ImagingMgmt_* pattern).
 * Returns the role array, 'dynamic', null (gate-less), or 'unresolved' when the
 * handler file itself cannot be read.
 */
function extractForOperation(handlerPath: string, opId: string): CodeAllowed | 'unresolved' {
  const abs = join(ROOT, handlerPath);
  if (!existsSync(abs)) return 'unresolved';
  return extractFollowing(abs, opId, 3);
}

function extractFollowing(abs: string, fnName: string, hopsLeft: number): CodeAllowed {
  if (hopsLeft < 0 || !existsSync(abs)) return null;
  const src = readFileSync(abs, 'utf8');

  // (1) Re-export entrypoint: `export { fnName } from './impl';`
  if (!findFunctionBody(stripComments(src), fnName)) {
    const reexportRe = new RegExp(
      `export\\s*\\{[^}]*\\b${escapeRe(fnName)}\\b[^}]*\\}\\s*from\\s*'([^']+)'`,
    );
    const rx = reexportRe.exec(src);
    if (rx) {
      const targetAbs = resolveRelative(abs, rx[1]!);
      if (targetAbs) return extractFollowing(targetAbs, fnName, hopsLeft - 1);
    }
    return null;
  }

  // (2) The function exists here. Try a direct gate first.
  const direct = extractAllowedRolesFromSource(src, fnName);
  if (direct !== null) return direct;

  // (3) Delegation wrapper: the body `return <impl>(ctx ...)`. Follow <impl> to
  // its relative import and extract its gate instead.
  const delegate = findDelegatedCallee(stripComments(src), fnName);
  if (delegate) {
    const importRe = new RegExp(
      `import\\s*\\{[^}]*\\b${escapeRe(delegate)}\\b[^}]*\\}\\s*from\\s*'([^']+)'`,
    );
    const im = importRe.exec(src);
    if (im) {
      const targetAbs = resolveRelative(abs, im[1]!);
      if (targetAbs && existsSync(targetAbs)) {
        return extractFollowing(targetAbs, delegate, hopsLeft - 1);
      }
    }
  }
  return null;
}

/**
 * If the body of `fnName` is a thin wrapper that returns a single delegated
 * call `return <callee>(...)`, return <callee>; else null. Comment-stripped src
 * expected.
 */
function findDelegatedCallee(src: string, fnName: string): string | null {
  const body = findFunctionBody(src, fnName);
  if (!body) return null;
  const bodyText = src.slice(body.start + 1, body.end);
  const m = /return\s+([A-Za-z_$][\w$]*)\s*\(/.exec(bodyText);
  return m ? m[1]! : null;
}

function resolveRelative(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = join(dirname(fromFile), spec);
  for (const cand of [base, `${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(cand)) return cand;
  }
  return `${base}.ts`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when the code's allow-list drifts from the spec's intent.
 *
 * Rules:
 *   - No spec entry (undefined) → not drift here (reported as "unmappable").
 *   - Code 'dynamic' vs a spec WITH a conditional (✅ᴴ) → not drift (both are
 *     intentionally type/condition-scoped — the E3 hygiene case).
 *   - Code 'dynamic' vs a flat (non-conditional) spec → drift (the code gate is
 *     computed but the spec expects a fixed set — worth a human look).
 *   - Otherwise compare the code role set to the spec's unconditional `roles`
 *     as order-insensitive sets.
 */
export function diffRoles(code: CodeAllowed, spec: SpecAllow | undefined): boolean {
  if (!spec) return false; // unmappable — surfaced separately
  if (code === null) return true; // spec gates the op but code has no role gate
  if (code === 'dynamic') return !spec.hasConditional;
  return !setsEqual(code, spec.roles);
}

function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bs = new Set(b);
  return a.every((x) => bs.has(x));
}

// ─────────────────────────────────────────────────────────────────────────────
// Row type + generator
// ─────────────────────────────────────────────────────────────────────────────

interface MatrixRow {
  operationId: string;
  method: string;
  path: string;
  module: string | null;
  codeAllowedRoles: CodeAllowed;
  specAllowedRoles: string[] | null;
  /** Roles the spec allows conditionally (✅ᴴ), if any. */
  specConditionalRoles?: string[];
  drift: boolean;
}

function build(): MatrixRow[] {
  const spine = loadContractSpine();
  const spec = loadRolePermissionMatrix();
  const rows: MatrixRow[] = [];

  for (const entry of spine.values()) {
    if (!entry.handlerPath) continue;
    const extracted = extractForOperation(entry.handlerPath, entry.operationId);
    if (extracted === 'unresolved') continue;
    const code = extracted;
    // Only include operations that actually have a role gate OR appear in the
    // spec matrix (so a spec'd op whose code lost its gate still surfaces).
    const specAllow = spec.get(entry.operationId);
    if (code === null && !specAllow) continue;

    rows.push({
      operationId: entry.operationId,
      method: entry.method,
      path: entry.path,
      module: entry.module,
      codeAllowedRoles: code,
      specAllowedRoles: specAllow ? specAllow.roles : null,
      specConditionalRoles: specAllow?.hasConditional ? specAllow.conditional : undefined,
      drift: diffRoles(code, specAllow),
    });
  }

  rows.sort((a, b) => a.operationId.localeCompare(b.operationId));
  return rows;
}

function fmtCode(c: CodeAllowed): string {
  if (c === null) return '—';
  if (c === 'dynamic') return '_dynamic_';
  return c.length ? c.join(', ') : '(none)';
}

function fmtSpec(row: MatrixRow): string {
  if (row.specAllowedRoles === null) return '— (unmapped)';
  const parts = [...row.specAllowedRoles];
  if (row.specConditionalRoles?.length) {
    parts.push(...row.specConditionalRoles.map((r) => `${r}ᴴ`));
  }
  return parts.length ? parts.join(', ') : '(none)';
}

function renderMd(rows: MatrixRow[]): string {
  const gated = rows.filter((r) => r.codeAllowedRoles !== null);
  const joined = rows.filter((r) => r.specAllowedRoles !== null);
  const drifted = rows.filter((r) => r.drift);
  const dynamic = rows.filter((r) => r.codeAllowedRoles === 'dynamic');
  const unmapped = gated.filter((r) => r.specAllowedRoles === null);

  const lines: string[] = [];
  lines.push('<!-- GENERATED by scripts/coverage/role-op-matrix.ts — do not edit by hand. -->');
  lines.push('');
  lines.push('# Role × Operation Drift Matrix');
  lines.push('');
  lines.push(
    'Computed comparison of what each handler *enforces* via `assertBranchRole(...)` ' +
      'against what `docs/product/ROLE_PERMISSION_MATRIX.md` *intends*. Drift in this ' +
      'table is the latent broken-authorization / PHI-leak bug class.',
  );
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|------:|');
  lines.push(`| Operations with a role gate | ${gated.length} |`);
  lines.push(`| Joined to the spec matrix | ${joined.length} |`);
  lines.push(`| **Drift (code ≠ spec)** | **${drifted.length}** |`);
  lines.push(`| Dynamic (computed) gates | ${dynamic.length} |`);
  lines.push(`| Gated but unmapped to spec | ${unmapped.length} |`);
  lines.push('');

  lines.push('## DRIFT');
  lines.push('');
  if (drifted.length === 0) {
    lines.push('_No drift detected._');
  } else {
    lines.push('| operationId | method | path | code allows | spec allows |');
    lines.push('|-------------|--------|------|-------------|-------------|');
    for (const r of drifted) {
      lines.push(
        `| \`${r.operationId}\` | ${r.method} | \`${r.path}\` | ${fmtCode(r.codeAllowedRoles)} | ${fmtSpec(r)} |`,
      );
    }
  }
  lines.push('');

  lines.push('## All gated operations');
  lines.push('');
  lines.push('| operationId | module | method | path | code allows | spec allows | drift |');
  lines.push('|-------------|--------|--------|------|-------------|-------------|:-----:|');
  for (const r of rows) {
    lines.push(
      `| \`${r.operationId}\` | ${r.module ?? '—'} | ${r.method} | \`${r.path}\` | ${fmtCode(r.codeAllowedRoles)} | ${fmtSpec(r)} | ${r.drift ? '⚠️' : ''} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

function main(): void {
  const rows = build();

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(rows, null, 2) + '\n');
  writeFileSync(OUT_MD, renderMd(rows));

  const drifted = rows.filter((r) => r.drift);
  const dynamic = rows.filter((r) => r.codeAllowedRoles === 'dynamic');
  const joined = rows.filter((r) => r.specAllowedRoles !== null);
  console.log(
    `role-op-matrix: ${rows.length} gated ops, ${joined.length} joined to spec, ` +
      `${drifted.length} drift, ${dynamic.length} dynamic. ` +
      `Wrote ${OUT_JSON} + ${OUT_MD}`,
  );

  // --check (gate mode): role↔spec drift is the latent broken-authz / PHI-leak
  // class and is NEVER allowlisted — any drift fails. Fix the handler or the spec.
  if (process.argv.includes('--check') && drifted.length > 0) {
    console.error(`\n✗ role↔spec DRIFT (${drifted.length}) — code-enforced roles diverge from the spec:`);
    for (const r of drifted) {
      console.error(`  ${r.operationId}: code=${JSON.stringify(r.codeAllowedRoles)} spec=${JSON.stringify(r.specAllowedRoles)}`);
    }
    process.exit(1);
  }
}

// Only run generation when invoked directly (not when imported by the test).
if (import.meta.main) main();
