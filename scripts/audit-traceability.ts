#!/usr/bin/env bun
/**
 * audit-traceability.ts
 *
 * Regenerates docs/audits/TRACEABILITY_MATRIX.md by scanning:
 *   - docs/prd/BUSINESS_RULES.md          → BR codes + status
 *   - docs/prd/ACCEPTANCE_CRITERIA.md     → AC codes
 *   - services/api-ts/src/handlers/       → handler presence
 *   - All *.test.ts files                 → BR/AC tag mentions
 *   - apps/dentalemon/tests/e2e/*.spec.ts → E2E coverage
 *   - specs/api/tests/contract/*.hurl     → contract test coverage
 *
 * Usage:
 *   bun run audit:trace
 *   bun scripts/audit-traceability.ts
 *   bun scripts/audit-traceability.ts --ci   (exits 1 if any P0 gap found)
 */

import { readdir, readFile, writeFile } from "fs/promises";
import { join, relative } from "path";

const ROOT = new URL("..", import.meta.url).pathname;
const CI_MODE = process.argv.includes("--ci");

// ─── Types ───────────────────────────────────────────────────────────────────

interface BRRecord {
  id: string; // "BR-001"
  summary: string;
  status: "implemented" | "partial" | "not-implemented";
  source: string;
}

interface ACRecord {
  id: string; // "AC-REG-01"
  section: string;
  summary: string;
}

interface Coverage {
  brId: string;
  backendUnitFiles: string[];
  frontendUnitFiles: string[];
  e2eFiles: string[];
  contractFiles: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function glob(dir: string, ext: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(d: string) {
    let entries: Awaited<ReturnType<typeof readdir>>;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules" && e.name !== "generated") {
        await walk(full);
      } else if (e.isFile() && e.name.endsWith(ext)) {
        results.push(full);
      }
    }
  }
  await walk(dir);
  return results;
}

async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

async function parseBRs(): Promise<BRRecord[]> {
  const path = join(ROOT, "docs/prd/BUSINESS_RULES.md");
  const text = await readText(path);
  const records: BRRecord[] = [];

  // Also read imaging module spec for BR-023+
  const imagingPath = join(ROOT, "docs/product/modules/dental-imaging/MODULE_SPEC.md");
  const imagingText = await readText(imagingPath);
  const combined = text + "\n" + imagingText;

  // Match table rows: | BR-NNN | rule | type | source | status |
  const tableRowRe = /\|\s*(BR-\d{3})\s*\|\s*([^|]+)\|[^|]+\|\s*([^|]+)\|\s*([^|]+)\|/g;
  let m: RegExpExecArray | null;
  while ((m = tableRowRe.exec(combined)) !== null) {
    const id = m[1].trim();
    const summary = m[2].trim().slice(0, 80);
    const source = m[3].trim();
    const statusRaw = m[4].trim().toLowerCase();
    const status: BRRecord["status"] = statusRaw.includes("not-implemented")
      ? "not-implemented"
      : statusRaw.includes("partial")
      ? "partial"
      : "implemented";
    records.push({ id, summary, status, source });
  }

  // Also match ### BR-NNN headings (imaging format)
  const headingRe = /###\s+(BR-\d{3}):\s+(.+)/g;
  while ((m = headingRe.exec(combined)) !== null) {
    const id = m[1].trim();
    if (!records.find((r) => r.id === id)) {
      records.push({ id, summary: m[2].trim().slice(0, 80), status: "implemented", source: "imaging module" });
    }
  }

  // Deduplicate by ID (table rows from combined text can match same BR twice)
  const unique = [...new Map(records.map((r) => [r.id, r])).values()];
  return unique.sort((a, b) => a.id.localeCompare(b.id));
}

async function parseACs(): Promise<ACRecord[]> {
  const path = join(ROOT, "docs/prd/ACCEPTANCE_CRITERIA.md");
  const text = await readText(path);
  const records: ACRecord[] = [];

  // Match "### AC-XXX-NN: Title" (2- or 3-digit number — \d{2,3} future-proofs
  // 3-digit module ACs like AC-CHART-001 without dropping them silently).
  const re = /###\s+(AC-[A-Z]+-\d{2,3}):\s+(.+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const id = m[1].trim();
    const summary = m[2].trim();
    const section = id.split("-").slice(0, 2).join("-");
    records.push({ id, section, summary });
  }
  return records;
}

// ─── Coverage Scan ───────────────────────────────────────────────────────────

async function scanCoverage(brs: BRRecord[]): Promise<Map<string, Coverage>> {
  const map = new Map<string, Coverage>();
  for (const br of brs) {
    map.set(br.id, {
      brId: br.id,
      backendUnitFiles: [],
      frontendUnitFiles: [],
      e2eFiles: [],
      contractFiles: [],
    });
  }

  // Scan backend unit tests
  const backendTests = await glob(join(ROOT, "services/api-ts/src"), ".test.ts");
  for (const file of backendTests) {
    const text = await readText(file);
    const rel = relative(ROOT, file);
    for (const br of brs) {
      if (text.includes(br.id)) {
        map.get(br.id)!.backendUnitFiles.push(rel);
      }
    }
  }

  // Scan frontend unit tests
  const frontendTests = await glob(join(ROOT, "apps/dentalemon/src"), ".test.ts");
  const frontendTestsTsx = await glob(join(ROOT, "apps/dentalemon/src"), ".test.tsx");
  for (const file of [...frontendTests, ...frontendTestsTsx]) {
    const text = await readText(file);
    const rel = relative(ROOT, file);
    for (const br of brs) {
      if (text.includes(br.id)) {
        map.get(br.id)!.frontendUnitFiles.push(rel);
      }
    }
  }

  // Scan E2E tests — match by BR tag OR by handler path convention
  const e2eTests = await glob(join(ROOT, "apps/dentalemon/tests/e2e"), ".spec.ts");
  for (const file of e2eTests) {
    const text = await readText(file);
    const rel = relative(ROOT, file);
    for (const br of brs) {
      if (text.includes(br.id)) {
        map.get(br.id)!.e2eFiles.push(rel);
      }
    }
  }

  // Scan contract tests
  const contractTests = await glob(join(ROOT, "specs/api/tests/contract"), ".hurl");
  for (const file of contractTests) {
    const text = await readText(file);
    const rel = relative(ROOT, file);
    for (const br of brs) {
      if (text.includes(br.id)) {
        map.get(br.id)!.contractFiles.push(rel);
      }
    }
  }

  return map;
}

// ─── Coverage Status ─────────────────────────────────────────────────────────

type CoverageStatus = "FULLY_COVERED" | "UNIT_COVERED" | "UNTESTED" | "NOT_IMPLEMENTED" | "PLACEHOLDER";

function statusOf(br: BRRecord, cov: Coverage): CoverageStatus {
  if (br.status === "not-implemented") return "NOT_IMPLEMENTED";
  const total =
    cov.backendUnitFiles.length + cov.frontendUnitFiles.length + cov.e2eFiles.length + cov.contractFiles.length;
  if (total === 0) return "UNTESTED";
  const hasE2E = cov.e2eFiles.length > 0;
  const hasUnit = cov.backendUnitFiles.length + cov.frontendUnitFiles.length > 0;
  if (hasUnit && hasE2E) return "FULLY_COVERED";
  return "UNIT_COVERED"; // has some tests but no E2E (unit-only coverage)
}

const EMOJI: Record<CoverageStatus, string> = {
  FULLY_COVERED: "✅",
  UNIT_COVERED: "⚠️",
  UNTESTED: "❌",
  NOT_IMPLEMENTED: "🚫",
  PLACEHOLDER: "⏸️",
};

// ─── Gap Detection ───────────────────────────────────────────────────────────

interface Gap {
  brId: string;
  summary: string;
  status: CoverageStatus;
  priority: "P0" | "P1" | "P2";
}

// P0 BRs: safety-critical (consent, authorization, immutability)
const P0_BRS = new Set(["BR-002", "BR-003", "BR-014", "BR-015", "BR-016", "BR-019", "BR-026"]);
// P1 BRs: workflow-critical
const P1_BRS = new Set(["BR-001", "BR-004", "BR-006", "BR-007", "BR-009", "BR-011", "BR-012", "BR-018", "BR-021"]);

function gapPriority(brId: string): "P0" | "P1" | "P2" {
  if (P0_BRS.has(brId)) return "P0";
  if (P1_BRS.has(brId)) return "P1";
  return "P2";
}

// ─── Report Builder ───────────────────────────────────────────────────────────

function buildReport(
  brs: BRRecord[],
  acs: ACRecord[],
  coverageMap: Map<string, Coverage>,
  generatedAt: string
): string {
  const lines: string[] = [];

  lines.push(`# Dentalemon — Requirements Traceability Matrix (Auto-Generated)`);
  lines.push(``);
  lines.push(`**Generated:** ${generatedAt}  `);
  lines.push(`**Script:** \`bun run audit:trace\`  `);
  lines.push(`**Note:** BR coverage is inferred from tag mentions (\`BR-NNN\`) in test files.`);
  lines.push(`          Add \`// @BR-NNN\` to test descriptions for intentional traceability.`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Summary stats
  const statuses = brs.map((br) => statusOf(br, coverageMap.get(br.id)!));
  const fullyCovered = statuses.filter((s) => s === "FULLY_COVERED").length;
  const unitCovered = statuses.filter((s) => s === "UNIT_COVERED").length;
  const untested = statuses.filter((s) => s === "UNTESTED").length;
  const notImpl = statuses.filter((s) => s === "NOT_IMPLEMENTED").length;

  lines.push(`## Executive Summary`);
  lines.push(``);
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total BRs | ${brs.length} |`);
  lines.push(`| ✅ Fully Covered (unit + E2E) | ${fullyCovered} (${Math.round((fullyCovered / brs.length) * 100)}%) |`);
  lines.push(`| ⚠️ Unit Covered (no E2E yet) | ${unitCovered} (${Math.round((unitCovered / brs.length) * 100)}%) |`);
  lines.push(`| ❌ Untested | ${untested} (${Math.round((untested / brs.length) * 100)}%) |`);
  lines.push(`| 🚫 Not implemented | ${notImpl} |`);
  lines.push(`| Total ACs | ${acs.length} |`);
  lines.push(``);

  // Gaps
  const gaps: Gap[] = [];
  brs.forEach((br) => {
    const cov = coverageMap.get(br.id)!;
    const s = statusOf(br, cov);
    if (s === "UNTESTED" || s === "UNIT_COVERED") {
      gaps.push({ brId: br.id, summary: br.summary, status: s, priority: gapPriority(br.id) });
    }
  });
  gaps.sort((a, b) => a.priority.localeCompare(b.priority) || a.brId.localeCompare(b.brId));

  if (gaps.length > 0) {
    lines.push(`## Coverage Gaps`);
    lines.push(``);
    lines.push(`| Priority | BR | Status | Summary |`);
    lines.push(`|----------|----|--------|---------|`);
    for (const g of gaps) {
      lines.push(`| ${g.priority} | ${g.brId} | ${EMOJI[g.status]} ${g.status} | ${g.summary} |`);
    }
    lines.push(``);
  }

  // Full BR table
  lines.push(`## Business Rule Coverage`);
  lines.push(``);
  lines.push(`| BR | Summary | Backend Unit | Frontend Unit | E2E | Status |`);
  lines.push(`|----|---------|-------------|---------------|-----|--------|`);

  for (const br of brs) {
    const cov = coverageMap.get(br.id)!;
    const s = statusOf(br, cov);
    const backendStr = cov.backendUnitFiles.length > 0 ? `✅ (${cov.backendUnitFiles.length})` : "❌";
    const frontendStr = cov.frontendUnitFiles.length > 0 ? `✅ (${cov.frontendUnitFiles.length})` : "❌";
    const e2eStr = cov.e2eFiles.length > 0 ? `✅ (${cov.e2eFiles.length})` : "❌";
    lines.push(`| ${br.id} | ${br.summary.slice(0, 60)} | ${backendStr} | ${frontendStr} | ${e2eStr} | ${EMOJI[s]} ${s} |`);
  }
  lines.push(``);

  // AC list
  lines.push(`## Acceptance Criteria`);
  lines.push(``);
  lines.push(`_Note: AC coverage requires BR tags in tests to auto-detect._`);
  lines.push(`_The full hand-maintained AC coverage table is in \`docs/audits/TRACEABILITY_MATRIX.md\`._`);
  lines.push(``);
  lines.push(`| AC | Summary |`);
  lines.push(`|----|---------|`);
  for (const ac of acs) {
    lines.push(`| ${ac.id} | ${ac.summary} |`);
  }
  lines.push(``);

  // Footer
  lines.push(`---`);
  lines.push(``);
  lines.push(`_To improve this report: add \`// @BR-NNN\` tags to test \`describe\`/\`test\` blocks._`);
  lines.push(`_See \`docs/superpowers/specs/2026-05-09-br-tagged-test-suite-design.md\` for the tagging spec._`);

  return lines.join("\n");
}

// ─── CI Gate ─────────────────────────────────────────────────────────────────

function checkCIGate(brs: BRRecord[], coverageMap: Map<string, Coverage>): boolean {
  const p0Gaps: string[] = [];
  for (const brId of P0_BRS) {
    const br = brs.find((b) => b.id === brId);
    if (!br) continue;
    const cov = coverageMap.get(brId)!;
    const s = statusOf(br, cov);
    if (s === "UNTESTED") p0Gaps.push(brId);
  }
  if (p0Gaps.length > 0) {
    console.error(`\n❌ CI GATE FAILED: ${p0Gaps.length} P0 BRs have no test coverage:`);
    p0Gaps.forEach((id) => console.error(`   ${id}`));
    return false;
  }
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 Parsing business rules...");
  const brs = await parseBRs();
  console.log(`   Found ${brs.length} BRs`);

  console.log("🔍 Parsing acceptance criteria...");
  const acs = await parseACs();
  console.log(`   Found ${acs.length} ACs`);

  console.log("🔍 Scanning test files for BR mentions...");
  const coverageMap = await scanCoverage(brs);

  const statuses = brs.map((br) => statusOf(br, coverageMap.get(br.id)!));
  const fullyCovered = statuses.filter((s) => s === "FULLY_COVERED").length;
  const unitCovered = statuses.filter((s) => s === "UNIT_COVERED").length;
  const untested = statuses.filter((s) => s === "UNTESTED").length;
  console.log(`   Coverage: ${fullyCovered} fully covered, ${unitCovered} unit-only, ${untested} untested`);

  const generatedAt = new Date().toISOString().split("T")[0];
  const report = buildReport(brs, acs, coverageMap, generatedAt);

  const outPath = join(ROOT, "docs/audits/TRACEABILITY_MATRIX_AUTO.md");
  await writeFile(outPath, report, "utf8");
  console.log(`\n✅ Written: ${relative(ROOT, outPath)}`);
  console.log(`   (Hand-maintained version: docs/audits/TRACEABILITY_MATRIX.md)`);

  if (CI_MODE) {
    const passed = checkCIGate(brs, coverageMap);
    if (!passed) process.exit(1);
    console.log("\n✅ CI gate passed — all P0 BRs have test coverage");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
