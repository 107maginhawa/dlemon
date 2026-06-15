/**
 * scan-tests.ts — reusable test-corpus scanning for the coverage engine.
 *
 * Generalised from the glob+read machinery in `scripts/audit-traceability.ts`
 * (which walked the test tree by hand and substring-scanned each file for
 * `BR-NNN` tags). The five coverage matrix generators all need the same
 * primitive: "find every test line that references token X" — where X is a
 * BR code, an operationId, an HTTP status token, a journey id, etc. This
 * module provides that as a shared, cached, documented API so each generator
 * does not re-implement (and subtly diverge on) the corpus definitions.
 *
 * Pure-ish: the only side effect is reading files off disk; results for a given
 * corpus/file are memoised for the lifetime of the process so the generators —
 * which scan the same corpora repeatedly — pay the read cost once.
 *
 * Run-from-root friendly: paths are resolved against `ROOT` from `./sources`,
 * and every returned `file` is repo-relative with forward slashes regardless of
 * the OS path separator.
 */

import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { ROOT } from './sources';

// ─────────────────────────────────────────────────────────────────────────────
// Corpora
// ─────────────────────────────────────────────────────────────────────────────

/** The stable identifiers for the five scannable test corpora. */
export type CorpusName = 'api-unit' | 'app-unit' | 'e2e' | 'journeys' | 'hurl';

export interface Corpus {
  /** Stable id used by the scan APIs and reported on every match. */
  name: CorpusName;
  /** Human-readable description of what the corpus contains. */
  description: string;
  /**
   * Directory the glob is scanned from, repo-relative (POSIX separators).
   * Returned match `file` paths are `${root}/${matched}` so they are always
   * repo-relative.
   */
  root: string;
  /** Glob pattern (Bun.Glob syntax) evaluated with `cwd = ROOT/root`. */
  glob: string;
}

/**
 * The five corpora the coverage generators scan.
 *
 * `journeys` is intentionally a SUBSET of `e2e` (journey specs live under
 * `tests/e2e/journeys/` and also match the broad `e2e` `**\/*.spec.ts` glob).
 * They are kept separate because some generators care specifically about the
 * journey lock (J-NN ids) and need to list/scan only that slice.
 */
export const TEST_CORPORA: readonly Corpus[] = [
  {
    name: 'api-unit',
    description: 'api-ts backend unit tests (Bun test)',
    root: 'services/api-ts/src',
    glob: '**/*.test.ts',
  },
  {
    name: 'app-unit',
    description: 'dentalemon frontend unit tests (Bun test)',
    root: 'apps/dentalemon/src',
    glob: '**/*.test.{ts,tsx}',
  },
  {
    name: 'e2e',
    description: 'dentalemon Playwright E2E specs (includes journeys)',
    root: 'apps/dentalemon/tests/e2e',
    glob: '**/*.spec.ts',
  },
  {
    name: 'journeys',
    description: 'dentalemon journey-lock specs',
    root: 'apps/dentalemon/tests/e2e/journeys',
    glob: '**/*.ts',
  },
  {
    name: 'hurl',
    description: 'API contract tests (Hurl)',
    root: 'specs/api/tests/contract',
    glob: '**/*.hurl',
  },
] as const;

const CORPUS_BY_NAME: ReadonlyMap<CorpusName, Corpus> = new Map(
  TEST_CORPORA.map((c) => [c.name, c]),
);

/** Look up a corpus definition by name, throwing on an unknown id. */
export function getCorpus(name: CorpusName): Corpus {
  const c = CORPUS_BY_NAME.get(name);
  if (!c) throw new Error(`Unknown corpus: ${name}`);
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// Match shape
// ─────────────────────────────────────────────────────────────────────────────

export interface ScanMatch {
  /** Which corpus the match came from. */
  corpus: CorpusName;
  /** Repo-relative file path (POSIX separators). */
  file: string;
  /** 1-based line number of the match. */
  line: number;
  /** The full text of the matched line (trailing newline stripped). */
  text: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Caches (process-lifetime)
// ─────────────────────────────────────────────────────────────────────────────

/** corpus name → repo-relative file list (sorted, POSIX separators). */
const fileListCache = new Map<CorpusName, string[]>();
/** repo-relative file path → array of line texts (split on \n). */
const fileLinesCache = new Map<string, string[]>();

/** Normalise an OS path to POSIX separators (no-op on POSIX hosts). */
function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}

/**
 * Reset the in-process caches. Primarily for tests that mutate the corpus on
 * disk between assertions; production callers never need this.
 */
export function clearScanCache(): void {
  fileListCache.clear();
  fileLinesCache.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// File enumeration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List the files in a corpus as repo-relative POSIX paths (sorted, cached).
 * Used for "does this journey/spec file exist" checks.
 */
export function listFiles(corpus: CorpusName): string[] {
  const cached = fileListCache.get(corpus);
  if (cached) return cached;

  const def = getCorpus(corpus);
  const cwd = join(ROOT, def.root);
  const g = new Bun.Glob(def.glob);
  const out: string[] = [];
  for (const rel of g.scanSync({ cwd, onlyFiles: true })) {
    out.push(`${def.root}/${toPosix(rel)}`);
  }
  out.sort();
  fileListCache.set(corpus, out);
  return out;
}

/** Read a repo-relative file into its line array (cached). */
function linesOf(repoRelFile: string): string[] {
  const cached = fileLinesCache.get(repoRelFile);
  if (cached) return cached;
  let lines: string[];
  try {
    lines = readFileSync(join(ROOT, repoRelFile), 'utf8').split('\n');
  } catch {
    lines = [];
  }
  fileLinesCache.set(repoRelFile, lines);
  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scanning
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve a (possibly partial) corpus selection to concrete definitions. */
function resolveCorpora(corpora?: readonly CorpusName[]): Corpus[] {
  if (!corpora) return [...TEST_CORPORA];
  return corpora.map(getCorpus);
}

/**
 * Core line scanner: walks the chosen corpora and yields a match for every line
 * for which `predicate(line)` is true. Both `scanForToken` and `scanForRegex`
 * are thin wrappers over this so caching/iteration logic lives in one place.
 */
function scanLines(
  predicate: (line: string) => boolean,
  corpora?: readonly CorpusName[],
): ScanMatch[] {
  const out: ScanMatch[] = [];
  for (const def of resolveCorpora(corpora)) {
    for (const file of listFiles(def.name)) {
      const lines = linesOf(file);
      for (let i = 0; i < lines.length; i++) {
        const text = lines[i]!;
        if (predicate(text)) {
          out.push({ corpus: def.name, file, line: i + 1, text });
        }
      }
    }
  }
  return out;
}

/**
 * Find every line across the chosen corpora that contains `token` as a literal
 * (case-sensitive) substring. Returns one match per matching line.
 *
 * Used for "is BR-NNN / this operationId / this status token referenced in a
 * test?". When `corpora` is omitted, all five corpora are scanned.
 */
export function scanForToken(
  token: string,
  corpora?: readonly CorpusName[],
): ScanMatch[] {
  if (token.length === 0) return [];
  return scanLines((line) => line.includes(token), corpora);
}

/**
 * Find every line across the chosen corpora matching `re`. Use for structural
 * detection like negative-path assertions (`/\b(403|409|422)\b/`).
 *
 * The regex is tested per line; if you pass a `/g` regex its `lastIndex` is
 * reset before each test so global flags do not skip lines. When `corpora` is
 * omitted, all five corpora are scanned.
 */
export function scanForRegex(
  re: RegExp,
  corpora?: readonly CorpusName[],
): ScanMatch[] {
  return scanLines((line) => {
    re.lastIndex = 0;
    return re.test(line);
  }, corpora);
}
