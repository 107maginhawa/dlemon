import config from '@monobase/eslint-config/base';

/**
 * Module boundary rule: handler files must not directly import another module's
 * repos/. Use or create a *.facade.ts in the target module's repos/ directory.
 *
 * Excluded from the rule:
 *   - Test files (*.test.ts) — need schema access for test setup/teardown
 *   - Schema files (repos/*.schema.ts) — Drizzle FK references are DB-layer coupling, not code-layer
 *   - Facade files (repos/*.facade.ts) — these ARE the approved cross-module bridge
 */
const boundaryRule = {
  files: ['src/handlers/**/*.ts'],
  ignores: [
    'src/handlers/**/*.test.ts',
    'src/handlers/**/*.test-*.ts',
    'src/handlers/**/repos/*.schema.ts',
    'src/handlers/**/repos/*.facade.ts',
  ],
  rules: {
    // Migration complete (2026-06-04): every cross-module repo reach-in now
    // routes through a *.facade.ts, so this is enforced as an error to keep the
    // boundary at zero. Add a facade in the target/owning module to fix a hit.
    'no-restricted-imports': ['error', {
      patterns: [
        {
          // Relative cross-module: ../other-module/repos/ or ../../other-module/repos/
          // The (?!.*\.facade) lookahead exempts *.facade imports — these ARE the
          // approved cross-module bridge (mirrors check-module-boundaries.ts, which
          // skips .facade paths). Without it, already-migrated facade consumers
          // (e.g. emr/*) are flagged as false-positive violations.
          regex: '\\.\\./[a-zA-Z][a-zA-Z0-9-]*/repos/(?!.*\\.facade)',
          message: 'Cross-module repo import. Add a *.facade.ts in the target module\'s repos/ directory instead.',
        },
      ],
    }],
  },
};

/**
 * Test-file `any` policy (api-ts only — does NOT touch the frontend, which
 * consumes the shared base config directly).
 *
 * `@typescript-eslint/no-explicit-any` is a `warn` in the shared base. In this
 * service ~85% of `any` usages live in `*.test.ts` (mock bodies, fixture
 * builders, type-shims) where strict typing adds noise, not safety. Silencing
 * the rule in tests turns a ~4,479-warning firehose into the ~566 *production*
 * occurrences — a trackable signal instead of alarm fatigue.
 *
 * Production stance (hard ratchet as of 2026-06-07): the ~513 production `any`
 * occurrences were burned down to a small, fully-suppressed residue, so the rule
 * is now an `error` for non-test source. New production `any` is blocked at the
 * gate; the only escape is an explicit, reasoned `// eslint-disable-next-line`
 * (see prodAnyError below). `generated/` and `*.d.ts` are exempt via the shared
 * base `ignores`, so the count can only go down.
 */
const prodAnyError = {
  files: ['src/**/*.ts'],
  ignores: ['src/**/*.test.ts', 'src/**/*.test-*.ts', 'src/generated/**'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
  },
};

/**
 * Test files keep `any` off entirely — mock bodies, fixture builders, and
 * type-shims are where strict typing adds noise, not safety. This override comes
 * AFTER prodAnyError so tests win (flat-config: later wins).
 */
const testAnyOverride = {
  files: ['**/*.test.ts', '**/*.test-*.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
};

/**
 * No raw `console` in handlers (PHI guard). Handler code touches patient PHI;
 * the Pino logger (`core/logger.ts`) recursively redacts PHI field names at any
 * depth, but a stray `console.log(patient)` bypasses that entirely and leaks the
 * raw object. Handlers have zero console usage today, so this is a zero-churn
 * ratchet that keeps PHI flowing only through the redacting logger. Bootstrap
 * `console` (core/*: openapi/config/database, pre-logger) is out of scope here.
 * Test files are exempt — debug logging in tests carries no production PHI.
 */
const noConsoleInHandlers = {
  files: ['src/handlers/**/*.ts'],
  ignores: ['src/handlers/**/*.test.ts', 'src/handlers/**/*.test-*.ts'],
  rules: {
    // Passing an explicit options object replaces the base allow-list
    // (warn/error/info): in handlers EVERY console method leaks raw PHI, so all
    // are blocked (the rule default allows none). Use the redacting logger.
    'no-console': ['error', {}],
  },
};

export default [...config, boundaryRule, prodAnyError, testAnyOverride, noConsoleInHandlers];
