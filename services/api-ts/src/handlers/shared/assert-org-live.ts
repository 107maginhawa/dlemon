/**
 * Provisional-org PHI write gate (decision C-1 / ADR-007 fast-follow).
 *
 * Self-service onboarding sets dental_organization.status = 'provisional'. Until
 * the owner activates the clinic (POST /dental/organizations/{id}/activate →
 * status 'live', representing terms/BAA acceptance), PHI writes for that org must
 * be blocked.
 *
 * PRODUCTION-ONLY by design. This is the direct sibling of createOnboarding's
 * verified-email and rate-limit guardrails, which are likewise production-only so
 * local/CI/seed flows keep working without ceremony (ADR-007: "Relaxed in dev/test
 * so local/CI signups onboard"). The compliance hole C-1 targets is PRODUCTION PHI;
 * dev/test/seed have no real PHI. Enforcement is exercised by a unit test that runs
 * this gate under NODE_ENV=production (see provisional-org-phi-gate.test.ts).
 *
 * Call this AFTER the branch-role authorization check in PHI-root write handlers
 * (patient + visit creation). Clinical/imaging/billing PHI all require an existing
 * patient/visit, so a provisional org that cannot create either is transitively
 * blocked from accumulating any PHI.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { ForbiddenError } from '@/core/errors';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';

export async function assertOrgLive(db: DatabaseInstance, branchId: string): Promise<void> {
  // Production-only enforcement (see file header / ADR-007).
  if (process.env['NODE_ENV'] !== 'production') return;

  const [row] = await db
    .select({ status: dentalOrganizations.status })
    .from(dentalBranches)
    .innerJoin(dentalOrganizations, eq(dentalBranches.organizationId, dentalOrganizations.id))
    .where(eq(dentalBranches.id, branchId))
    .limit(1);

  // Fail closed: a branch with no resolvable org cannot be a valid PHI target.
  if (!row || row.status !== 'live') {
    throw new ForbiddenError(
      'This clinic must be activated before patient records can be created',
      'ORG_NOT_LIVE',
    );
  }
}
