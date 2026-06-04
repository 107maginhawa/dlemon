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

export default [...config, boundaryRule];
