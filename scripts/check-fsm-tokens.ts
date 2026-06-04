#!/usr/bin/env bun
/**
 * check-fsm-tokens.ts — FSM state-machine token drift guard (recurring finding F-044)
 *
 * Retired finite-state-machine (FSM) tokens (e.g. invoice `sent` instead of the
 * canonical `issued`, or `void` instead of `voided`) tend to leak into the prose
 * state-machine sections of docs/product/DOMAIN_MODEL.md and WORKFLOW_MAP.md while
 * the Drizzle `pgEnum` definitions in code stay correct.
 *
 * This script reads the canonical status enums straight from the Drizzle schemas
 * (services/api-ts/src/handlers/<module>/repos/*.schema.ts) and asserts that the
 * FSM tokens referenced in each doc's labelled state-machine block are a SUBSET of
 * the corresponding code enum tokens. On drift it prints the offending token + the
 * file/line and exits non-zero.
 *
 * Scope: the four product FSMs called out in DOMAIN_MODEL §6 (Visit, Treatment,
 * Invoice, Appointment). Each doc block is matched by an explicit heading/label so
 * a token legitimately belonging to one FSM (e.g. LabOrder's `sent`) is never
 * cross-checked against another FSM's enum.
 *
 * Usage:  bun run check:fsm-tokens
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const SCHEMA_DIR = join(ROOT, 'services/api-ts/src/handlers');

interface FsmDef {
  /** Human label used in messages. */
  name: string;
  /** Path to the Drizzle schema file, relative to SCHEMA_DIR. */
  schema: string;
  /** The exported pgEnum SQL name whose token array is the source of truth. */
  pgEnumName: string;
  /**
   * Tokens intentionally documented but absent from the enum (deferred / 501-stub
   * features). They are allowed in docs without being in the code enum.
   */
  deferred: string[];
  /**
   * Section labels (exact line, trimmed) in each doc whose subsequent ``` fenced
   * block(s) + immediately-following markdown tables are this FSM's state machine.
   * A block is collected until the next `###`/`##` heading.
   */
  docSections: { domainModel: string[]; workflowMap: string[] };
}

const FSMS: FsmDef[] = [
  {
    name: 'Invoice',
    schema: 'dental-billing/repos/dental-invoice.schema.ts',
    pgEnumName: 'dental_invoice_status',
    deferred: ['uncollectible'], // BR-013 — 501 stub, feature-flag off
    docSections: {
      domainModel: ['### SM-INVOICE: Invoice Lifecycle'],
      workflowMap: ['### Invoice State Machine'],
    },
  },
  {
    name: 'Visit',
    schema: 'dental-visit/repos/visit.schema.ts',
    pgEnumName: 'dental_visit_status',
    deferred: [],
    docSections: {
      domainModel: ['### SM-VISIT: Visit Lifecycle'],
      workflowMap: ['### Visit State Machine'],
    },
  },
  {
    name: 'Treatment',
    schema: 'dental-visit/repos/treatment.schema.ts',
    pgEnumName: 'dental_treatment_status',
    deferred: [],
    docSections: {
      domainModel: ['### SM-TREATMENT: Treatment Lifecycle'],
      workflowMap: ['### Treatment State Machine'],
    },
  },
  {
    name: 'Appointment',
    schema: 'dental-scheduling/repos/dental-appointment.schema.ts',
    pgEnumName: 'appointment_status',
    deferred: [],
    docSections: {
      domainModel: ['### SM-APPOINTMENT: Appointment Lifecycle'],
      workflowMap: ['### Appointment State Machine'],
    },
  },
];

const DOCS = {
  domainModel: join(ROOT, 'docs/product/DOMAIN_MODEL.md'),
  workflowMap: join(ROOT, 'docs/product/WORKFLOW_MAP.md'),
};

/** Read a pgEnum('<name>', [ ...tokens ]) token array from a schema file. */
function readEnumTokens(schemaRel: string, pgEnumName: string): Set<string> {
  const file = join(SCHEMA_DIR, schemaRel);
  const src = readFileSync(file, 'utf8');
  // Match: pgEnum('<name>', [ ... ])  — array may span multiple lines.
  const re = new RegExp(`pgEnum\\(\\s*['"]${pgEnumName}['"]\\s*,\\s*\\[([\\s\\S]*?)\\]`, 'm');
  const m = src.match(re);
  if (!m) {
    throw new Error(`Could not find pgEnum('${pgEnumName}', [...]) in ${schemaRel}`);
  }
  const tokens = [...m[1].matchAll(/['"]([a-z0-9_]+)['"]/gi)].map((t) => t[1]);
  if (tokens.length === 0) {
    throw new Error(`pgEnum('${pgEnumName}') in ${schemaRel} yielded no tokens`);
  }
  return new Set(tokens);
}

/**
 * Collect the lines of every state-machine block for a section label: starting at
 * the label line, up to (but excluding) the next `##`/`###` heading. Returns the
 * raw block text plus the absolute starting line number for diagnostics.
 */
function collectSectionBlocks(
  docText: string,
  labels: string[],
): { text: string; startLine: number }[] {
  const lines = docText.split('\n');
  const blocks: { text: string; startLine: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!labels.includes(lines[i].trim())) continue;
    const start = i + 1;
    const collected: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^#{2,3}\s/.test(lines[j])) break;
      collected.push(lines[j]);
    }
    blocks.push({ text: collected.join('\n'), startLine: start });
  }
  return blocks;
}

/**
 * Pull candidate FSM *state* tokens out of a doc block. To stay robust against
 * prose noise we only mine tokens that sit DIRECTLY adjacent to a transition
 * arrow — either inside a ``` fenced ASCII diagram or in a `From | To` transition
 * table row. State names are always the words immediately before/after an arrow
 * glyph (──►, ►, →, -->, ->). Prose like "paid (via payment plan)" never sits on
 * an arrow boundary, so `via`/`payment`/`plan` are not extracted.
 *
 * Arrow-boundary words like `draft/sent` (slash-joined alternatives) are split.
 */
const ARROW_RE = /(?:─*►|→|-{1,2}>|├──►|└──►|┴──►|┌──►)/g;

function arrowAdjacentTokens(line: string): string[] {
  const out: string[] = [];
  // Replace arrows with a sentinel and split, then take the trailing word of the
  // left fragment and the leading word of the right fragment around each arrow.
  const parts = line.split(ARROW_RE);
  if (parts.length < 2) return out;
  for (let i = 0; i < parts.length; i++) {
    const frag = parts[i];
    // leading word(s) of fragment (state arrived at) when there is an arrow before
    if (i > 0) {
      const lead = frag.match(/^[\s│]*([a-z][a-z0-9_/]*)/);
      if (lead) out.push(...lead[1].split('/'));
    }
    // trailing word of fragment (state departed from) when there is an arrow after
    if (i < parts.length - 1) {
      const tail = frag.match(/([a-z][a-z0-9_/]*)[\s│]*$/);
      if (tail) out.push(...tail[1].split('/'));
    }
  }
  return out;
}

function extractTokens(blockText: string): { token: string; line: number }[] {
  const out: { token: string; line: number }[] = [];
  const lines = blockText.split('\n');
  let inFence = false;
  let sawHeaderRow = false;
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    const isTransitionHeader = /^\|\s*From\b/i.test(line);
    if (isTransitionHeader) {
      sawHeaderRow = true;
      continue;
    }

    if (inFence) {
      // ASCII diagram line: mine words adjacent to arrows.
      for (const tok of arrowAdjacentTokens(line)) {
        if (tok) out.push({ token: tok, line: idx });
      }
    } else if (sawHeaderRow && /^\|/.test(line) && !/^\|\s*-+/.test(line)) {
      // Transition-table data row: first two cells are From | To states.
      const cells = line.split('|').map((c) => c.trim());
      for (const cell of cells.slice(1, 3)) {
        for (const m of cell.matchAll(/\b([a-z][a-z0-9_]*)\b/g)) {
          out.push({ token: m[1], line: idx });
        }
      }
    } else if (!/^\|/.test(line)) {
      sawHeaderRow = false; // table ended
    }
  }
  return out;
}

/** Words that legitimately appear as From/To cell values but are not states. */
const NON_STATE_WORDS = new Set(['any', 'completed_visit']);

let failed = false;
const failures: string[] = [];

for (const fsm of FSMS) {
  const enumTokens = readEnumTokens(fsm.schema, fsm.pgEnumName);
  const allowed = new Set([...enumTokens, ...fsm.deferred]);

  for (const [docKey, docPath] of Object.entries(DOCS) as [keyof typeof DOCS, string][]) {
    const docText = readFileSync(docPath, 'utf8');
    const labels = fsm.docSections[docKey];
    const blocks = collectSectionBlocks(docText, labels);
    if (blocks.length === 0) continue; // section not present in this doc — fine

    for (const block of blocks) {
      for (const { token, line } of extractTokens(block.text)) {
        if (NON_STATE_WORDS.has(token)) continue;
        if (allowed.has(token)) continue;
        const absLine = block.startLine + line;
        const rel = docPath.replace(`${ROOT}/`, '');
        failures.push(
          `  [${fsm.name}] retired/unknown token "${token}" in ${rel}:${absLine} ` +
            `(allowed: ${[...allowed].sort().join(', ')})`,
        );
        failed = true;
      }
    }
  }
}

// De-duplicate identical (token,file,line) findings.
const uniqueFailures = [...new Set(failures)];

if (failed) {
  console.error('✖ FSM token drift detected (finding F-044):\n');
  console.error(uniqueFailures.join('\n'));
  console.error(
    '\nFix the doc token to match the canonical code enum, or add it to the ' +
      "FSM's `deferred` list in scripts/check-fsm-tokens.ts if it is an " +
      'intentional 501-stub / feature-flagged state.',
  );
  process.exit(1);
}

console.log('✓ FSM tokens in DOMAIN_MODEL.md + WORKFLOW_MAP.md match code enums (Invoice, Visit, Treatment, Appointment).');
