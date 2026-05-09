/**
 * importPatients — FR7.2: CSV / JSON Data Import with validation and rollback
 *
 * POST /dental/patients/import
 *
 * Accepts JSON body: { patients: PatientRow[] }
 * Validates all rows up front — returns 422 with errors if any fail.
 * Batch-commits all patients in a transaction (all-or-nothing).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import type { User } from '@/types/auth';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { ImportPatientsBody } from '@/generated/openapi/validators';

export async function importPatients(
  ctx: ValidatedContext<ImportPatientsBody, never, never>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const body = ctx.req.valid('json');
  const rows = body.patients;

  if (!rows || rows.length === 0) throw new ValidationError('No rows to import');

  // Branch-level authorization: verify access to all unique branchIds
  const uniqueBranchIds = [...new Set(rows.map(r => r.branchId).filter(Boolean))] as string[];
  for (const branchId of uniqueBranchIds) {
    await assertBranchAccess(db, user.id, branchId);
  }

  // All-or-nothing transaction
  const imported: Array<{ id: string; personId: string; firstName: string; lastName?: string; branchId?: string }> = [];

  try {
    await db.transaction(async (tx) => {
      for (const row of rows) {
        const [person] = await tx.insert(persons).values({
          firstName: row.firstName,
          ...(row.lastName ? { lastName: row.lastName } : {}),
          ...(row.dateOfBirth ? { dateOfBirth: row.dateOfBirth } : {}),
          ...(row.gender ? { gender: row.gender as typeof persons.gender._.data } : {}),
          createdBy: user.id,
          updatedBy: user.id,
        }).returning();

        const [patient] = await tx.insert(patients).values({
          person: person!.id,
          preferredBranchId: row.branchId,
          createdBy: user.id,
          updatedBy: user.id,
        }).returning();

        imported.push({
          id: patient!.id,
          personId: person!.id,
          firstName: row.firstName,
          lastName: row.lastName,
          branchId: row.branchId,
        });
      }
    });
  } catch (err: any) {
    return ctx.json({
      success: false,
      errors: [`Import transaction failed: ${err.message}`],
      imported: 0,
      total: rows.length,
    }, 422);
  }

  return ctx.json({ success: true, imported: imported.length, total: rows.length, patients: imported }, 201);
}
