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
const GAP_D_RULE = { selector: GAP_D_SELECTOR, message: GAP_D_MESSAGE };

// Architecture invariant — SDK-only data access. Feature code must consume the
// generated @monobase/sdk-ts TanStack Query hooks, never raw `fetch()`. A raw
// fetch hard-codes a URL/method/headers the OpenAPI contract can change underneath
// — the exact contract-drift class the SDK migration eliminated. The only
// sanctioned exceptions are non-API transfers (presigned S3 PUTs, binary blob
// downloads, static public assets); each carries an inline
// `// eslint-disable-next-line no-restricted-syntax -- <reason>`.
const NO_RAW_FETCH_MESSAGE =
  'No raw fetch() in features — use a generated @monobase/sdk-ts hook so the OpenAPI contract stays the source of truth (architecture invariant: SDK-only data access). Sanctioned non-API transfers (presigned S3 PUT, blob download, static asset) must carry an inline eslint-disable with a reason.';
const NO_RAW_FETCH_RULES = [
  { selector: 'CallExpression[callee.name="fetch"]', message: NO_RAW_FETCH_MESSAGE },
  { selector: 'CallExpression[callee.property.name="fetch"]', message: NO_RAW_FETCH_MESSAGE },
];

export default [
  ...config,
  {
    // SDK-only data access across the whole feature surface (hooks + components).
    // Ordered BEFORE the hooks block so the more-specific hooks block below can
    // layer GAP-D on top without dropping this rule (flat-config: last matching
    // config wins the rule key entirely, so the specific block must repeat it).
    files: ['src/features/**/*.ts', 'src/features/**/*.tsx'],
    ignores: [
      '**/*.test.ts',
      '**/*.test.tsx',
      // Pre-existing migratable raw fetch carried on a separate change set; drop
      // this exclusion once revenue-report is moved onto listDentalInvoices.
      'src/features/reports/components/revenue-report.tsx',
    ],
    rules: {
      'no-restricted-syntax': ['error', ...NO_RAW_FETCH_RULES],
    },
  },
  {
    // Data-hook boundary (feature hooks + the top-level src/hooks dir — QA-010's
    // latent balanceCents drift lived in src/hooks/use-patient-profile.ts): GAP-D
    // AND the fetch ban. Repeats NO_RAW_FETCH because this block overrides the one
    // above for the files it matches.
    files: ['src/features/**/hooks/**/*.ts', 'src/features/**/hooks/**/*.tsx', 'src/hooks/**/*.ts', 'src/hooks/**/*.tsx'],
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': ['error', GAP_D_RULE, ...NO_RAW_FETCH_RULES],
    },
  },
];
