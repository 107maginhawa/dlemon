#!/usr/bin/env bun
/**
 * lint-migrations.ts — checks SQL migration files for destructive or risky operations.
 *
 * Fails with exit code 1 if any unsafe pattern is found without a MIGRATION-SAFETY comment
 * on the immediately preceding line.
 *
 * Unsafe patterns checked:
 *   - DROP TABLE          — permanent data loss
 *   - DROP COLUMN         — permanent data loss
 *   - TRUNCATE            — permanent data loss
 *   - DELETE FROM         — permanent data loss
 *   - ALTER TYPE ADD VALUE — non-transactional in PG < 12 (project targets PG 16, but still flag)
 *   - ALTER TYPE RENAME VALUE — non-transactional in PG < 12
 *   - SET NOT NULL (on ALTER) — fails on non-empty tables without a prior backfill
 *   - ADD COLUMN ... NOT NULL without DEFAULT — fails on non-empty tables (PG 23502); this is
 *     the exact shape that shipped in 0069 and broke populated-DB upgrades. Add the column
 *     nullable, backfill, then SET NOT NULL (or give it a DEFAULT) instead.
 *
 * To acknowledge a finding, add on the line immediately before the flagged statement:
 *   -- MIGRATION-SAFETY: <justification>
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(import.meta.dir, "../src/generated/migrations");

interface UnsafePattern {
  pattern: RegExp;
  label: string;
}

const UNSAFE_PATTERNS: UnsafePattern[] = [
  { pattern: /\bDROP\s+TABLE\b/i, label: "DROP TABLE" },
  { pattern: /\bDROP\s+COLUMN\b/i, label: "DROP COLUMN" },
  { pattern: /\bTRUNCATE\b/i, label: "TRUNCATE" },
  { pattern: /\bDELETE\s+FROM\b/i, label: "DELETE FROM" },
  { pattern: /\bALTER\s+TYPE\b.*\bADD\s+VALUE\b/i, label: "ALTER TYPE ADD VALUE" },
  { pattern: /\bALTER\s+TYPE\b.*\bRENAME\s+VALUE\b/i, label: "ALTER TYPE RENAME VALUE" },
  // NOT NULL added via ALTER (not inside CREATE TABLE) without a DEFAULT on same line
  {
    pattern: /\bALTER\s+(?:TABLE|COLUMN)\b.*\bSET\s+NOT\s+NULL\b/i,
    label: "SET NOT NULL without DEFAULT",
  },
  // ADD COLUMN ... NOT NULL with NO DEFAULT in the same statement. Rejected by Postgres
  // (23502) on a populated table — this is the 0069 hazard. The negative lookahead skips
  // the safe forms `ADD COLUMN ... NOT NULL DEFAULT ...` / `... DEFAULT ... NOT NULL`.
  {
    pattern: /\bADD\s+COLUMN\b(?![^;]*\bDEFAULT\b)[^;]*\bNOT\s+NULL\b/i,
    label: "ADD COLUMN NOT NULL without DEFAULT",
  },
];

let exitCode = 0;
let filesChecked = 0;
let findingsTotal = 0;

let files: string[];
try {
  files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
} catch (err) {
  console.error(`❌ Cannot read migrations directory: ${MIGRATIONS_DIR}`);
  console.error(`   ${err}`);
  process.exit(1);
}

for (const file of files) {
  const filePath = join(MIGRATIONS_DIR, file);
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  filesChecked++;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank lines and pure comment lines
    if (trimmed === "" || trimmed.startsWith("--")) continue;

    for (const { pattern, label } of UNSAFE_PATTERNS) {
      if (pattern.test(trimmed)) {
        // Check if the immediately preceding non-blank line is a MIGRATION-SAFETY comment
        let hasSafetyComment = false;
        for (let j = i - 1; j >= 0; j--) {
          const prevTrimmed = lines[j].trim();
          if (prevTrimmed === "") continue; // skip blank lines between comment and statement
          if (prevTrimmed.includes("MIGRATION-SAFETY")) {
            hasSafetyComment = true;
          }
          break; // only check the nearest non-blank preceding line
        }

        if (!hasSafetyComment) {
          console.error(`\n❌ ${file}:${i + 1}: ${label} without MIGRATION-SAFETY comment`);
          console.error(`   ${trimmed}`);
          console.error(
            `   Fix: add "-- MIGRATION-SAFETY: <justification>" on the preceding line`,
          );
          exitCode = 1;
          findingsTotal++;
        }
      }
    }
  }
}

if (exitCode === 0) {
  console.log(`✅ ${filesChecked} migration file(s) checked — no unsafe operations found`);
} else {
  console.error(
    `\n${findingsTotal} unsafe operation(s) found across ${filesChecked} migration file(s).`,
  );
  console.error(
    `Each requires a "-- MIGRATION-SAFETY: <justification>" comment on the preceding line.`,
  );
}

process.exit(exitCode);
