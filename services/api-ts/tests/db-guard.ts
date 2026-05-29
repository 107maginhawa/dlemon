// Refuses to run the test suite against a non-test database.
// 20+ dental-org/dental-clinical tests TRUNCATE dental_membership, dental_branch,
// dental_organization in afterEach against a hard-coded monobase URL. Running them
// against the dev DB nukes the demo seed. This preload (bunfig.toml [test].preload)
// aborts the run early unless the URL clearly points at a test DB.
const url = process.env.DATABASE_URL ?? 'postgres://postgres:password@localhost:5432/monobase';
// Allow the canonical test DB (`monobase_test`) and per-file template clones
// (`monobase_test_<tag>`) minted by scripts/test-with-db.ts for isolation.
// Still refuses the dev DB (`monobase`) and anything else.
const isTestDb = /\/monobase_test(_[a-z0-9_]+)?(\?|$)/.test(url) || process.env.ALLOW_NON_TEST_DB === '1';
if (!isTestDb) {
  console.error('[db-guard] REFUSING to run tests against:', url);
  console.error('[db-guard] Tests TRUNCATE dental_membership/branch/organization in afterEach.');
  console.error('[db-guard] This nukes the demo seed. Use a test DB instead:');
  console.error('[db-guard]   cd services/api-ts && bun run db:setup:test');
  console.error('[db-guard] Override (destructive!): ALLOW_NON_TEST_DB=1 bun test');
  process.exit(1);
}
