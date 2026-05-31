#!/usr/bin/env bun
/**
 * seed-retention-policies.ts — seed default data-retention policies (V-DG-001).
 *
 * Idempotent: re-running inserts only the policies a tenant is missing. Seeds
 * one tenant-wide (branch = NULL) policy set per organization found in the DB.
 *
 * Usage:
 *   cd services/api-ts && bun scripts/seed-retention-policies.ts
 *
 * Safe by default: seeded policies do nothing until the scheduled job runs, and
 * even then the job is DRY-RUN unless RETENTION_ENFORCEMENT_ENABLED="true".
 */

import { createDatabase } from '@/core/database';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { seedDefaultRetentionPolicies } from '@/handlers/retention/retention-defaults';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';
const db = createDatabase({ url: DATABASE_URL });

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  Default Retention Policy Seed (V-DG-001)     ║');
  console.log('╚══════════════════════════════════════════════╝');

  const branches = await db.select({ organizationId: dentalBranches.organizationId }).from(dentalBranches);
  const orgIds = [...new Set(branches.map((b) => b.organizationId))];
  if (orgIds.length === 0) {
    console.log('  No organizations found — run the clinical seed first. Nothing to do.');
    return;
  }

  let total = 0;
  for (const orgId of orgIds) {
    const inserted = await seedDefaultRetentionPolicies(db, orgId);
    total += inserted;
    console.log(`  ✓ org ${orgId}: ${inserted} default policy(ies) inserted`);
  }

  console.log(
    `\n✓ Retention policy seed complete: ${total} row(s) across ${orgIds.length} organization(s).` +
      '\n  All seeded policies are tagged "DEFAULT — review against your jurisdiction".\n',
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n✗ Retention policy seed failed:', err);
    process.exit(1);
  });
