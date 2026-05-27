#!/usr/bin/env bun
/**
 * verify-registry-uniqueness.ts — fails if registry.ts imports the same
 * operationId more than once, or if the registry object exports a key more
 * than once.
 *
 * Run automatically after `bun run generate` (chained in package.json).
 *
 * Two checks:
 *   1. No `import { X }` line duplicates the same identifier.
 *   2. No key in the `export const registry = { ... }` block appears twice.
 *
 * Background: the generator builds registry.ts by iterating over OpenAPI
 * paths. If the same operationId appears under multiple paths (dual-
 * registration bug), the generated file will have two identical import lines
 * and two identical registry entries, causing a TypeScript error that is hard
 * to trace back to the spec. This script surfaces the problem immediately
 * after generation with a clear message.
 *
 * See: docs/development/CONTRIBUTING_API.md § "OperationId Naming Convention"
 */

import { readFileSync } from "fs";
import { join } from "path";

const REGISTRY_FILE = join(
  import.meta.dir,
  "../src/generated/openapi/registry.ts",
);

const src = readFileSync(REGISTRY_FILE, "utf8");
const lines = src.split("\n");

let exitCode = 0;

// ── Check 1: duplicate import identifiers ────────────────────────────────
// Matches: import { createFinding } from '../../handlers/...'
const importPattern = /^import\s*\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\s*from\s*['"`]/;

const importCounts: Record<string, number> = {};
for (const line of lines) {
  const m = line.match(importPattern);
  if (m) {
    const id = m[1];
    importCounts[id] = (importCounts[id] ?? 0) + 1;
  }
}

const dupImports = Object.entries(importCounts).filter(([, count]) => count > 1);

if (dupImports.length > 0) {
  console.error("❌ Duplicate import identifiers in registry.ts:");
  for (const [id, count] of dupImports) {
    console.error(`   '${id}' imported ${count} times`);
  }
  console.error(
    "\n   Root cause: two TypeSpec operations share the same operationId.",
    "\n   Fix: ensure every @operationId in specs/api/src/ is unique,",
    "\n   then re-run: cd specs/api && bun run build && cd ../services/api-ts && bun run generate",
  );
  exitCode = 1;
} else {
  console.log(
    `✅ registry import check passed — ${Object.keys(importCounts).length} unique imports`,
  );
}

// ── Check 2: duplicate registry object keys ──────────────────────────────
// Matches lines inside `export const registry = { ... }`:
//   "  createFinding,"  or  "  createFinding: createFinding,"
const registryKeyPattern = /^\s{2}([a-zA-Z][a-zA-Z0-9_]*)(?:\s*[:,]|,\s*$)/;

// Only scan lines inside the registry block
let inRegistry = false;
const keyCounts: Record<string, number> = {};

for (const line of lines) {
  if (/export const registry\s*=\s*\{/.test(line)) {
    inRegistry = true;
    continue;
  }
  if (inRegistry && line.trim() === "};") {
    inRegistry = false;
    continue;
  }
  if (inRegistry) {
    const m = line.match(registryKeyPattern);
    if (m) {
      const key = m[1];
      keyCounts[key] = (keyCounts[key] ?? 0) + 1;
    }
  }
}

const dupKeys = Object.entries(keyCounts).filter(([, count]) => count > 1);

if (dupKeys.length > 0) {
  console.error("❌ Duplicate registry keys in registry.ts:");
  for (const [key, count] of dupKeys) {
    console.error(`   '${key}' appears ${count} times in registry object`);
  }
  exitCode = 1;
} else {
  console.log(
    `✅ registry key check passed — ${Object.keys(keyCounts).length} unique registry entries`,
  );
}

process.exit(exitCode);
