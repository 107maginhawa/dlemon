#!/usr/bin/env bun
/**
 * Per-file isolated test runner.
 *
 * Two problems this script solves:
 *
 *  1. GLOB COVERAGE. The package.json script used to pass a recursive
 *     "src" + globstar + "test.ts" glob as an argument. Bun's shell (and bash
 *     with globstar off) expands the double-star as a single star, collapsing
 *     it to the two-level form — only the 23 files directly under src/<dir>/.
 *     The 152 deeper `src/handlers/MODULE/...test.ts` files never ran in CI,
 *     so a broken handler shipped green if its test wasn't in the glob.
 *     We now discover every recursive test file ourselves via Bun.Glob (which
 *     does support globstar), ignoring any pre-expanded glob args.
 *
 *  2. SHARED-DB CONTAMINATION. ~50 test files TRUNCATE shared tables
 *     (dental_membership/branch/organization, …) in afterEach against one
 *     shared `monobase_test` DB. Run together, files nuke each other.
 *     We give every test file its own database, cloned instantly from the
 *     fully-migrated `monobase_test` template via
 *     `CREATE DATABASE … TEMPLATE monobase_test`, run the file against the
 *     clone in its own `bun test` process, then drop the clone. Any per-test
 *     schemas a file leaks (tests/helpers/test-db.ts) die with the clone.
 *
 * Usage:
 *   bun run scripts/test-with-db.ts                 # run ALL src test files
 *   bun run scripts/test-with-db.ts --coverage      # … with coverage reporting
 *   bun run scripts/test-with-db.ts path/a.test.ts  # run only the given files
 *
 * Env:
 *   DATABASE_URL      base test DB url (defaults to local monobase_test)
 *   TEST_CONCURRENCY  parallel worker count (default min(8, cpus-3))
 */
import { Glob } from 'bun';
import { Client } from 'pg';
import { cpus } from 'os';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const DEFAULT_URL = 'postgresql://postgres:password@localhost:5432/monobase_test';
const baseUrl = process.env.DATABASE_URL ?? DEFAULT_URL;

// Parse the base url into pieces so we can mint clone urls and an admin url.
const parsed = new URL(baseUrl);
const TEMPLATE_DB = decodeURIComponent(parsed.pathname.replace(/^\//, '')) || 'monobase_test';
if (!/^monobase_test/.test(TEMPLATE_DB)) {
  console.error(`[test-runner] DATABASE_URL must point at a monobase_test* database, got "${TEMPLATE_DB}".`);
  console.error('[test-runner] Refusing to clone from a non-test database.');
  process.exit(1);
}
function urlForDb(dbName: string): string {
  const u = new URL(baseUrl);
  u.pathname = `/${dbName}`;
  return u.toString();
}
const ADMIN_URL = urlForDb('postgres');

const CONCURRENCY = Math.max(
  1,
  parseInt(process.env.TEST_CONCURRENCY ?? '', 10) || Math.min(8, Math.max(2, cpus().length - 3)),
);

// ---------------------------------------------------------------------------
// Argv: separate flags from positional file paths
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const passthroughFlags: string[] = [];
const positionals: string[] = [];
let coverage = false;
for (const arg of argv) {
  if (arg === '--coverage') {
    coverage = true;
    continue;
  }
  if (arg.startsWith('-')) {
    passthroughFlags.push(arg);
    continue;
  }
  positionals.push(arg);
}

// Positional args may be either explicit files the caller wants, OR the
// pre-expanded remnants of an `src/**/*.test.ts` glob. Treat them as an
// explicit selection ONLY when they are real, non-glob `.test.ts` paths AND
// they don't look like the default "run everything" two-level collapse.
// Heuristic: if a positional still contains a glob char, ignore positionals
// and discover everything ourselves.
const hasGlobChar = positionals.some((p) => /[*?[\]]/.test(p));
const explicitFiles = !hasGlobChar && positionals.length > 0 ? positionals : null;

async function discoverTestFiles(): Promise<string[]> {
  const glob = new Glob('src/**/*.test.ts');
  const files: string[] = [];
  for await (const file of glob.scan({ cwd: process.cwd(), onlyFiles: true })) {
    files.push(file);
  }
  files.sort();
  return files;
}

// ---------------------------------------------------------------------------
// Admin DB helpers (clone / drop / sweep)
// ---------------------------------------------------------------------------
async function withAdmin<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: ADMIN_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// Serialize CREATE DATABASE … TEMPLATE: Postgres locks the template and a
// concurrent clone from the same source errors ("source database is being
// accessed by other users"). The clone itself is ~0.1s on the lean template.
let cloneChain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = cloneChain.then(fn, fn);
  cloneChain = run.catch(() => {});
  return run;
}

async function createClone(cloneDb: string): Promise<void> {
  await serialize(() =>
    withAdmin(async (c) => {
      // ident is built from a controlled tag (see makeTag) — safe to interpolate.
      await c.query(`CREATE DATABASE "${cloneDb}" TEMPLATE "${TEMPLATE_DB}"`);
    }),
  );
}

async function dropClone(cloneDb: string): Promise<void> {
  try {
    await withAdmin((c) => c.query(`DROP DATABASE IF EXISTS "${cloneDb}" WITH (FORCE)`));
  } catch (err) {
    console.warn(`[test-runner] failed to drop clone ${cloneDb}:`, (err as Error).message);
  }
}

async function sweepOrphanClones(): Promise<number> {
  return withAdmin(async (c) => {
    const res = await c.query<{ datname: string }>(
      `SELECT datname FROM pg_database WHERE datname LIKE $1 ESCAPE '\\' AND datname <> $2`,
      [`${TEMPLATE_DB}\\_%`, TEMPLATE_DB],
    );
    for (const row of res.rows) {
      await c.query(`DROP DATABASE IF EXISTS "${row.datname}" WITH (FORCE)`);
    }
    return res.rows.length;
  });
}

const runId = Date.now().toString(36);
let tagCounter = 0;
function makeTag(): string {
  // Clone db name must match tests/db-guard.ts: /monobase_test(_[a-z0-9_]+)?/
  // and stay within Postgres's 63-char identifier limit.
  return `${TEMPLATE_DB}_${runId}_${(tagCounter++).toString(36)}`;
}

// ---------------------------------------------------------------------------
// Run a single test file against its own cloned DB
// ---------------------------------------------------------------------------
interface FileResult {
  file: string;
  pass: number;
  fail: number;
  errored: boolean;
  output: string;
}

async function runFile(file: string): Promise<FileResult> {
  const cloneDb = makeTag();
  try {
    await createClone(cloneDb);
  } catch (err) {
    return {
      file,
      pass: 0,
      fail: 0,
      errored: true,
      output: `[test-runner] failed to clone DB for ${file}: ${(err as Error).message}`,
    };
  }

  try {
    const args = ['test', ...passthroughFlags];
    if (coverage) args.push('--coverage');
    args.push(file);

    const proc = Bun.spawn(['bun', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: urlForDb(cloneDb) },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    const output = stdout + stderr;

    // Bun prints e.g. " 18 pass" / " 0 fail" (last occurrence is the summary).
    const passMatches = [...output.matchAll(/^\s*(\d+) pass\b/gm)];
    const failMatches = [...output.matchAll(/^\s*(\d+) fail\b/gm)];
    const pass = passMatches.length ? Number(passMatches[passMatches.length - 1][1]) : 0;
    const fail = failMatches.length ? Number(failMatches[failMatches.length - 1][1]) : 0;

    // A nonzero exit with no parsed counts means the file failed to load/run
    // (import error, syntax error, db-guard refusal, crash).
    const errored = exitCode !== 0 && passMatches.length === 0 && failMatches.length === 0;

    return { file, pass, fail, errored, output };
  } finally {
    await dropClone(cloneDb);
  }
}

// ---------------------------------------------------------------------------
// Worker pool
// ---------------------------------------------------------------------------
async function runPool(files: string[]): Promise<FileResult[]> {
  const results: FileResult[] = new Array(files.length);
  let next = 0;
  let done = 0;

  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= files.length) return;
      const file = files[i];
      const r = await runFile(file);
      results[i] = r;
      done++;

      const status = r.errored ? 'ERROR' : r.fail > 0 ? 'FAIL' : 'ok';
      const counts = r.errored ? '' : ` (${r.pass} pass, ${r.fail} fail)`;
      console.log(`[${done}/${files.length}] ${status.padEnd(5)} ${file}${counts}`);

      // Surface full output for anything that failed/errored so CI's
      // (fail)-line allow-list logic and humans can see what broke. In coverage
      // mode, forward every file's output so the per-file coverage tables land
      // in the CI coverage artifact.
      if (r.fail > 0 || r.errored || coverage) {
        process.stdout.write(r.output.endsWith('\n') ? r.output : r.output + '\n');
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const files = explicitFiles ?? (await discoverTestFiles());
  if (files.length === 0) {
    console.error('[test-runner] no test files found.');
    process.exit(1);
  }

  // Verify the template DB is reachable before doing anything destructive.
  try {
    await withAdmin(async (c) => {
      const res = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEMPLATE_DB]);
      if (res.rowCount === 0) {
        throw new Error(
          `template database "${TEMPLATE_DB}" does not exist — run \`bun run db:setup:test\` first.`,
        );
      }
    });
  } catch (err) {
    console.error(`[test-runner] cannot reach Postgres / template: ${(err as Error).message}`);
    process.exit(1);
  }

  const swept = await sweepOrphanClones();
  if (swept > 0) console.log(`[test-runner] swept ${swept} orphaned clone database(s) from a prior run.`);

  console.log(
    `[test-runner] running ${files.length} test file(s) across ${Math.min(CONCURRENCY, files.length)} worker(s), ` +
      `each in its own clone of "${TEMPLATE_DB}"${coverage ? ' (coverage on)' : ''}.`,
  );
  const started = Date.now();
  const results = await runPool(files);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  const totalPass = results.reduce((n, r) => n + r.pass, 0);
  const totalFail = results.reduce((n, r) => n + r.fail, 0);
  const failedFiles = results.filter((r) => r.fail > 0).map((r) => r.file);
  const erroredFiles = results.filter((r) => r.errored).map((r) => r.file);

  console.log('\n──────────────────────────────────────────────────────────');
  console.log(`[test-runner] ${files.length} files, ${totalPass} pass, ${totalFail} fail in ${elapsed}s`);
  if (failedFiles.length) {
    console.log(`[test-runner] files with failing tests (${failedFiles.length}):`);
    for (const f of failedFiles) console.log(`  FAIL  ${f}`);
  }
  if (erroredFiles.length) {
    console.log(`[test-runner] files that errored before running (${erroredFiles.length}):`);
    for (const f of erroredFiles) console.log(`  ERROR ${f}`);
  }
  console.log('──────────────────────────────────────────────────────────');

  process.exit(totalFail > 0 || erroredFiles.length > 0 ? 1 : 0);
}

await main();
