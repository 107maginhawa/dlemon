import config from '@monobase/eslint-config/react';

// Prevent pillar (oli QA_ESCAPES §6 / GAP-D): ban the double type-assertion
// `x as unknown as T` on API data at the data-hook boundary. That cast disables
// TypeScript exactly where FE meets the generated SDK, which is how the QA-002..008
// contract-drift bugs shipped past a green build. Now set to `error`: the entire
// `src/features/**/hooks` production surface has been migrated to consume the
// generated SDK types (intersect/override for documented enrichments + stale-spec
// dates — see use-invoices.ts / use-insurance-claims.ts), so the rule holds the
// line. Test files are excluded — they legitimately cast when constructing mock
// Response objects, which is not a contract-drift boundary.
const GAP_D_SELECTOR = 'TSAsExpression > TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]';
const GAP_D_MESSAGE =
  'Do not `as unknown as` API response data — it disables type-checking at the FE↔BE boundary and hides contract drift (see oli QA_ESCAPES §6 / GAP-D). Consume the generated SDK type; intersect it for documented enrichments.';

export default [
  ...config,
  {
    files: ['src/features/**/hooks/**/*.ts', 'src/features/**/hooks/**/*.tsx'],
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': ['error', { selector: GAP_D_SELECTOR, message: GAP_D_MESSAGE }],
    },
  },
];
