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
 * Production stance (ratchet, not rewrite): no NEW prod `any`; burn down the
 * existing surface opportunistically when touching a file. The rule stays a
 * `warn` (not `error`) for prod so the gate isn't blocked on pre-existing usage.
 */
const testAnyOverride = {
  files: ['**/*.test.ts', '**/*.test-*.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
};

export default [...config, boundaryRule, testAnyOverride];
