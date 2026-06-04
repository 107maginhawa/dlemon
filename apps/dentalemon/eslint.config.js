import config from '@monobase/eslint-config/react';

// Prevent pillar (oli QA_ESCAPES §6 / GAP-D): ban the double type-assertion
// `x as unknown as T` on API data at the data-hook boundary. That cast disables
// TypeScript exactly where FE meets the generated SDK, which is how the QA-002..006
// contract-drift bugs shipped past a green build. Scoped to feature hooks and set to
// `warn` so it surfaces the existing debt without breaking CI; consume the generated
// SDK type instead (intersect it for documented backend enrichments — see use-invoices.ts).
export default [
  ...config,
  {
    files: ['src/features/**/hooks/**/*.ts', 'src/features/**/hooks/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'TSAsExpression > TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]',
          message:
            'Do not `as unknown as` API response data — it disables type-checking at the FE↔BE boundary and hides contract drift (see oli QA_ESCAPES §6 / GAP-D). Consume the generated SDK type; intersect it for documented enrichments.',
        },
      ],
    },
  },
];
