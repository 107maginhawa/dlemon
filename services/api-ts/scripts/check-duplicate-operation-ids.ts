#!/usr/bin/env bun
/**
 * check-duplicate-operation-ids.ts — fails if routes.ts registers the same
 * operationId or HTTP method+path pair more than once.
 *
 * Background: the generator produces one `// operationId` comment block per
 * route. If a spec change causes two handlers to share an operationId comment,
 * or the same HTTP method+path to appear twice, this script fails CI so the
 * duplication is caught before it reaches production.
 *
 * Guards against duplicate operationIds across TypeSpec modules.
 *
 * Two checks:
 *   1. No operationId comment (`  // identifier`) appears more than once.
 *   2. No HTTP method+path pair (e.g. `post /dental/org/members`) appears
 *      more than once.
 */

import { readFileSync } from "fs";
import { join } from "path";

const ROUTES_FILE = join(
  import.meta.dir,
  "../src/generated/openapi/routes.ts",
);

const src = readFileSync(ROUTES_FILE, "utf8");
const lines = src.split("\n");

let exitCode = 0;

// ── Check 1: duplicate operationId comment blocks ─────────────────────────

const opIdPattern = /^\s{2}\/\/ ([a-zA-Z][a-zA-Z0-9_]*)$/;
const opIdCounts: Record<string, number> = {};

for (const line of lines) {
  const m = line.match(opIdPattern);
  if (m) {
    const id = m[1];
    opIdCounts[id] = (opIdCounts[id] ?? 0) + 1;
  }
}

const dupOpIds = Object.entries(opIdCounts).filter(([, count]) => count > 1);

if (dupOpIds.length > 0) {
  console.error("❌ Duplicate operationId comment blocks in routes.ts:");
  for (const [id, count] of dupOpIds) {
    console.error(`   '${id}' appears ${count} times`);
  }
  exitCode = 1;
} else {
  console.log(
    `✅ operationId check passed — ${Object.keys(opIdCounts).length} unique operationIds`,
  );
}

// ── Check 2: duplicate HTTP method+path pairs ─────────────────────────────

// Matches: app.METHOD('path', or app.METHOD('/path',
const routePattern = /app\.(get|post|put|patch|delete|options)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

const routeCounts: Record<string, number> = {};
let routeMatch: RegExpExecArray | null;

while ((routeMatch = routePattern.exec(src)) !== null) {
  const key = `${routeMatch[1].toLowerCase()} ${routeMatch[2]}`;
  routeCounts[key] = (routeCounts[key] ?? 0) + 1;
}

const dupRoutes = Object.entries(routeCounts).filter(([, count]) => count > 1);

if (dupRoutes.length > 0) {
  console.error("❌ Duplicate HTTP method+path registrations in routes.ts:");
  for (const [route, count] of dupRoutes) {
    console.error(`   '${route}' registered ${count} times`);
  }
  exitCode = 1;
} else {
  console.log(
    `✅ route-path check passed — ${Object.keys(routeCounts).length} unique method+path pairs`,
  );
}

process.exit(exitCode);
