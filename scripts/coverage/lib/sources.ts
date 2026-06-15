/**
 * sources.ts — typed loaders for the computed-verification "coverage" engine.
 *
 * This module holds the deterministic, side-effect-free loaders that read the
 * project's *truth sources* and normalise them into plain TypeScript shapes the
 * generators (role×operation drift, and — in a later task — broader coverage)
 * can diff against each other.
 *
 * THIS task builds only two loaders:
 *   1. loadContractSpine() — operationId → { handlerPath, method, path, module }
 *      from `.understand-anything/contract-spine.json` (the deterministic
 *      cross-layer wiring map produced by scripts/build-contract-spine.ts).
 *   2. loadRolePermissionMatrix() — operation → specAllowedRoles[] parsed from
 *      the ✅ / ❌ / ✅ᴴ grids in docs/product/ROLE_PERMISSION_MATRIX.md.
 *
 * A later task extends this file with additional loaders (e.g. journey/route
 * coverage); keep each loader pure and independently testable.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = join(import.meta.dir, '..', '..', '..');

export const CONTRACT_SPINE_PATH = join(ROOT, '.understand-anything/contract-spine.json');
export const ROLE_MATRIX_PATH = join(ROOT, 'docs/product/ROLE_PERMISSION_MATRIX.md');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Contract spine
// ─────────────────────────────────────────────────────────────────────────────

/** Raw shape of one operation entry in contract-spine.json (only fields we use). */
interface SpineRawEntry {
  operationId: string;
  method: string;
  path: string;
  handler: string | null;
}

export interface SpineEntry {
  operationId: string;
  method: string;
  /** API path template, e.g. /dental/visits/{id}. */
  path: string;
  /** Repo-relative handler file the codegen registry wires to this operation. */
  handlerPath: string | null;
  /**
   * Coarse module bucket derived from the handler path
   * (e.g. `dental-visit`, `dental-billing`). `null` when there is no handler
   * or the path is shaped unexpectedly.
   */
  module: string | null;
}

/**
 * Derive the module bucket from a repo-relative handler path.
 * `services/api-ts/src/handlers/dental-visit/visits/createDentalVisit.ts`
 *   → `dental-visit`.
 */
export function moduleFromHandlerPath(handlerPath: string | null): string | null {
  if (!handlerPath) return null;
  const marker = 'src/handlers/';
  const idx = handlerPath.indexOf(marker);
  if (idx === -1) return null;
  const rest = handlerPath.slice(idx + marker.length);
  const first = rest.split('/')[0];
  return first && first.endsWith('.ts') === false ? first : (first ?? null);
}

/**
 * Load contract-spine.json → Map<operationId, SpineEntry>.
 * Pure: pass an explicit `path` (defaults to the repo file) for testability.
 */
export function loadContractSpine(path: string = CONTRACT_SPINE_PATH): Map<string, SpineEntry> {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { operations?: SpineRawEntry[] };
  const out = new Map<string, SpineEntry>();
  for (const op of raw.operations ?? []) {
    if (!op || !op.operationId) continue;
    out.set(op.operationId, {
      operationId: op.operationId,
      method: op.method,
      path: op.path,
      handlerPath: op.handler ?? null,
      module: moduleFromHandlerPath(op.handler ?? null),
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Role permission matrix
// ─────────────────────────────────────────────────────────────────────────────

/** The ten canonical context (membership) roles — mirror of member_role enum. */
export const CANONICAL_ROLES = [
  'dentist_owner',
  'dentist_associate',
  'hygienist',
  'staff_full',
  'staff_scheduling',
  'dental_assistant',
  'front_desk',
  'billing_staff',
  'treatment_coordinator',
  'read_only',
] as const;
export type CanonicalRole = (typeof CANONICAL_ROLES)[number];

/**
 * The spec's view of who may perform an operation.
 *
 * `roles`     — roles granted an unconditional ✅.
 * `conditional` — roles granted only conditionally (✅ᴴ = hygiene-visit-scoped).
 *   These are NOT folded into `roles`: the code gate for these operations is
 *   itself conditional (`codeAllowedRoles: 'dynamic'`), so the drift comparison
 *   treats a conditional spec the same way — as `dynamic` — rather than a flat
 *   allow-list. Keeping them separate lets a later consumer reason about the
 *   condition without re-parsing the matrix.
 */
export interface SpecAllow {
  /** Unconditionally allowed roles (✅). */
  roles: CanonicalRole[];
  /** Conditionally allowed roles (✅ᴴ → hygiene-typed visits only). */
  conditional: CanonicalRole[];
  /** True when any cell in the row carried a conditional (✅ᴴ) marker. */
  hasConditional: boolean;
}

/**
 * Explicit, documented mapping from a matrix ROW LABEL (the human "Operation"
 * cell in a detailed permission table) to the OpenAPI operationId(s) it governs.
 *
 * WHY a hand-maintained table: the matrix rows are written for humans ("Create
 * invoice", "Void invoice") and do not carry operationIds. The operationIds on
 * the right are all verified to exist in contract-spine.json. A row may govern
 * several operationIds (e.g. "Create/edit visit" covers both create and the
 * visit-derived check-in). When a row is intentionally NOT joined to any
 * operation (e.g. coarse PRD-module rows), it is simply absent here.
 *
 * Keys are lower-cased, whitespace-collapsed row labels (see normRowLabel()).
 */
export const MATRIX_ROW_TO_OPERATIONS: Record<string, string[]> = {
  // ── Clinical Write Operations ──────────────────────────────────────────────
  'create/edit visit': ['createDentalVisit'],
  'add treatment': ['createDentalTreatment'],
  'update treatment status': ['updateDentalTreatment'],
  'write prescription': ['createPrescription'],
  'create lab order': ['createLabOrder'],
  'draft visit notes': ['upsertVisitNotes'],
  'sign visit notes': ['signVisitNotes'],
  'create consent form': ['createConsentForm'],
  'upload attachment': ['createAttachment'],
  'capture imaging study': ['ImagingMgmt_createImagingStudy'],
  'upsert full chart (conditions)': ['upsertDentalChart'],
  'update single tooth / init dentition': ['updateTooth', 'initializeDentition'],
  'present case / treatment plan': ['createCasePresentation'],
  'create amendment': ['createAmendment'],

  // ── Billing Write Operations ───────────────────────────────────────────────
  'create invoice': ['createDentalInvoice'],
  'issue invoice': ['issueDentalInvoice'],
  'record payment': ['recordDentalPayment'],
  'void invoice': ['voidDentalInvoice'],
  'create payment plan': ['createDentalPaymentPlan'],

  // ── Scheduling Write Operations ────────────────────────────────────────────
  'book appointment': ['createAppointment'],
  'reschedule appointment': ['updateAppointment'],
  'cancel appointment': ['cancelAppointment'],
  'check-in (creates visit)': ['checkInAppointment'],

  // ── Administrative Operations ──────────────────────────────────────────────
  'create/edit staff': ['createMember'],
  'view audit log': ['getAuditEvents'],
  'configure fee schedule': ['updateFeeScheduleEntry'],
  'generate pmd': ['generatePMD'],
};

/**
 * Prose-documented role grants that the lossy summary TABLES cannot express but
 * the AUTHORITATIVE PROSE of ROLE_PERMISSION_MATRIX.md explicitly states.
 *
 * WHY this exists: the detailed permission tables only carry a fixed set of role
 * COLUMNS. When the spec grants a role that the table has no column for, the
 * grant lives only in prose — the table is silent, not denying. Modelling those
 * grants here completes the spec-truth so the code (which DOES honor the prose)
 * stops reading as drift. This is NOT an allowlist of accepted drift: each entry
 * encodes a real, cited spec grant, and the diff still flags any code that
 * diverges from the COMPLETED spec.
 *
 * Each entry is keyed by operationId and may add:
 *   - `addRoles`        — extra UNCONDITIONAL (✅) roles, merged into SpecAllow.roles
 *   - `addConditional`  — extra CONDITIONAL (✅ᴴ) roles, merged into SpecAllow.conditional
 *                         (which also flips hasConditional → true)
 * and MUST cite the exact prose line(s) it derives from in `sourceCitation`.
 */
export interface ProseGrant {
  addRoles?: CanonicalRole[];
  addConditional?: CanonicalRole[];
  /** Human-readable citation: the doc + exact line(s) the grant is read from. */
  sourceCitation: string;
}

export const PROSE_DOCUMENTED_GRANTS: Record<string, ProseGrant> = {
  // The Clinical Write table has NO treatment_coordinator column (it is a
  // non-clinical role, ❌ for every clinical write). The single exception is
  // case-presentation create/present, granted explicitly in prose.
  createCasePresentation: {
    addRoles: ['treatment_coordinator'],
    sourceCitation:
      'docs/product/ROLE_PERMISSION_MATRIX.md line 142: "treatment_coordinator: ' +
      'case-presentation create/present is owner/associate/treatment_coordinator ✅".',
  },

  // The Scheduling Write table has NO hygienist column, so the "Check-in (creates
  // visit)" row cannot carry a ✅ᴴ. Prose puts checkInAppointment in the E3
  // hygiene-conditional set: check-in creates a visit, and the Clinical
  // "Create/edit visit" row IS ✅ᴴ for the same E3 logic. Modelling hygienist as
  // a CONDITIONAL grant makes the dynamic code gate resolve to non-drift exactly
  // like createDentalVisit / upsertVisitNotes / signVisitNotes already do.
  checkInAppointment: {
    addConditional: ['hygienist'],
    sourceCitation:
      'docs/product/ROLE_PERMISSION_MATRIX.md line 131 (E3 conditional set names ' +
      '`checkInAppointment`) + lines 171-175 ("hygienist MAY check in a `hygiene` ' +
      'appointment"); mirrors the ✅ᴴ on the Clinical "Create/edit visit" row (line 112).',
  },
};

/** Merge a prose grant into an existing SpecAllow, de-duplicating roles. */
function applyProseGrant(base: SpecAllow, grant: ProseGrant): SpecAllow {
  const roles = Array.from(new Set([...base.roles, ...(grant.addRoles ?? [])]));
  const conditional = Array.from(
    new Set([...base.conditional, ...(grant.addConditional ?? [])]),
  );
  return { roles, conditional, hasConditional: conditional.length > 0 };
}

/** Header labels in the detailed tables → canonical role tokens. */
const HEADER_TO_ROLE: Record<string, CanonicalRole> = {
  dentist_owner: 'dentist_owner',
  dentist_associate: 'dentist_associate',
  staff_full: 'staff_full',
  staff_scheduling: 'staff_scheduling',
  hygienist: 'hygienist',
  dental_assistant: 'dental_assistant',
  front_desk: 'front_desk',
  billing_staff: 'billing_staff',
  treatment_coordinator: 'treatment_coordinator',
  read_only: 'read_only',
};

function normRowLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Split a markdown table row `| a | b | c |` into trimmed cells. */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return [];
  // Drop the leading and trailing pipe, then split.
  return trimmed
    .replace(/^\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c));
}

/**
 * Classify one role-column cell.
 *   ✅  → allow
 *   ✅ᴴ → conditional (hygiene-typed only)
 *   ❌  → deny
 *   anything else (e.g. "Own patients only") → treated as a (non-conditional)
 *         allow when it begins with ✅, otherwise deny. We deliberately do NOT
 *         try to encode "own patients only" nuance here — that is a per-row
 *         scoping note the code cannot express as a flat role gate either.
 */
type CellVerdict = 'allow' | 'conditional' | 'deny';
function classifyCell(cell: string): CellVerdict {
  const c = cell.trim();
  if (c.includes('✅ᴴ')) return 'conditional';
  if (c.startsWith('✅') || c.startsWith('Own')) return 'allow';
  return 'deny';
}

/**
 * Parse ROLE_PERMISSION_MATRIX.md detailed tables into
 * `operationId → SpecAllow`.
 *
 * Only the detailed permission tables (those whose header's first column is
 * exactly "Operation") are parsed. Each data row is matched against
 * MATRIX_ROW_TO_OPERATIONS; rows with no mapping are skipped (they are coarse
 * PRD-module rows or descriptive sub-notes). A given operationId is keyed once;
 * if it appears in more than one row the first wins (none do today).
 */
export function loadRolePermissionMatrix(
  path: string = ROLE_MATRIX_PATH,
): Map<string, SpecAllow> {
  const text = readFileSync(path, 'utf8');
  return parseRolePermissionMatrix(text);
}

/** Pure string → map parser, exposed for unit tests with inline fixtures. */
export function parseRolePermissionMatrix(text: string): Map<string, SpecAllow> {
  const out = new Map<string, SpecAllow>();
  const lines = text.split('\n');

  let activeColumns: CanonicalRole[] | null = null;

  for (const line of lines) {
    const cells = splitTableRow(line);
    if (cells.length === 0) continue;
    if (isSeparatorRow(cells)) continue;

    const first = cells[0]?.trim() ?? '';

    // A detailed permission table opens with a header whose first cell is
    // "Operation". Capture its role columns and start parsing rows.
    if (first === 'Operation') {
      const cols: CanonicalRole[] = [];
      let valid = true;
      for (let i = 1; i < cells.length; i++) {
        const role = HEADER_TO_ROLE[cells[i]!.trim()];
        if (!role) {
          valid = false;
          break;
        }
        cols.push(role);
      }
      activeColumns = valid && cols.length > 0 ? cols : null;
      continue;
    }

    // If we are not inside a recognised table, this is some other markdown table
    // (e.g. Actors) — ignore until the next "Operation" header.
    if (!activeColumns) continue;

    const rowLabel = normRowLabel(first);
    const opIds = MATRIX_ROW_TO_OPERATIONS[rowLabel];
    if (!opIds) continue; // unmapped row — coarse / descriptive

    const roleCells = cells.slice(1);
    const roles: CanonicalRole[] = [];
    const conditional: CanonicalRole[] = [];
    for (let i = 0; i < activeColumns.length; i++) {
      const role = activeColumns[i]!;
      const verdict = classifyCell(roleCells[i] ?? '');
      if (verdict === 'allow') roles.push(role);
      else if (verdict === 'conditional') conditional.push(role);
    }

    const allow: SpecAllow = {
      roles,
      conditional,
      hasConditional: conditional.length > 0,
    };
    for (const opId of opIds) {
      if (!out.has(opId)) out.set(opId, allow);
    }
  }

  // Merge prose-documented grants the lossy tables cannot express. An entry may
  // augment an op that already has a table row (the common case) or, defensively,
  // seed one for an op the tables never mention.
  for (const [opId, grant] of Object.entries(PROSE_DOCUMENTED_GRANTS)) {
    const base = out.get(opId) ?? { roles: [], conditional: [], hasConditional: false };
    out.set(opId, applyProseGrant(base, grant));
  }

  return out;
}
