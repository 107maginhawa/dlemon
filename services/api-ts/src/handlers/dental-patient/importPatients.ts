/**
 * importPatients — FR7.2: CSV / JSON Data Import with validation and rollback
 *
 * POST /dental/patients/import
 *
 * Accepts:
 *   - application/json: JSON array of patient rows [ { firstName, lastName?, ... } ]
 *   - text/csv: CSV with headers firstName,lastName,dateOfBirth,branchId,...
 *
 * Validates all rows up front — returns 422 with errors if any fail.
 * Batch-commits all patients in a transaction (all-or-nothing).
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { User } from '@/types/auth';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';

interface PatientRow {
  firstName: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  branchId: string;
}

function validateRow(row: Record<string, string | undefined>, index: number): { valid: true; row: PatientRow } | { valid: false; error: string } {
  const firstName = row['firstName']?.trim();
  const branchId = row['branchId']?.trim();

  if (!firstName) {
    return { valid: false, error: `Row ${index + 1}: firstName is required` };
  }
  if (!branchId) {
    return { valid: false, error: `Row ${index + 1}: branchId is required` };
  }

  return {
    valid: true,
    row: {
      firstName,
      ...(row['lastName']?.trim() ? { lastName: row['lastName']!.trim() } : {}),
      ...(row['dateOfBirth']?.trim() ? { dateOfBirth: row['dateOfBirth']!.trim() } : {}),
      ...(row['gender']?.trim() ? { gender: row['gender']!.trim() } : {}),
      ...(row['phone']?.trim() ? { phone: row['phone']!.trim() } : {}),
      ...(row['email']?.trim() ? { email: row['email']!.trim() } : {}),
      branchId,
    },
  };
}

function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

export async function importPatients(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const contentType = ctx.req.header('content-type') ?? '';

  let rawRows: Record<string, string | undefined>[];

  if (contentType.includes('text/csv')) {
    const text = await ctx.req.text();
    rawRows = parseCSV(text);
    if (rawRows.length === 0) {
      return ctx.json({ success: false, errors: ['CSV has no data rows'], imported: 0, total: 0 }, 422);
    }
  } else {
    // JSON — accept array directly or wrapped { patients: [...] }
    let parsed: unknown;
    try {
      parsed = await ctx.req.json();
    } catch {
      return ctx.json({ success: false, errors: ['Invalid JSON body'], imported: 0, total: 0 }, 400);
    }

    if (Array.isArray(parsed)) {
      rawRows = parsed;
    } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).patients)) {
      rawRows = (parsed as any).patients;
    } else {
      return ctx.json({ success: false, errors: ['Body must be a JSON array or { patients: [...] }'], imported: 0, total: 0 }, 400);
    }

    if (rawRows.length === 0) {
      return ctx.json({ success: false, errors: ['No rows to import'], imported: 0, total: 0 }, 400);
    }
  }

  // Validate all rows up front
  const errors: string[] = [];
  const validRows: PatientRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const result = validateRow(rawRows[i]!, i);
    if (!result.valid) {
      errors.push(result.error);
    } else {
      validRows.push(result.row);
    }
  }

  if (errors.length > 0) {
    return ctx.json({ success: false, errors, imported: 0, total: rawRows.length }, 422);
  }

  // Branch-level authorization: verify access to all unique branchIds
  const uniqueBranchIds = [...new Set(validRows.map(r => r.branchId))];
  for (const branchId of uniqueBranchIds) {
    await assertBranchRole(db, user.id, branchId, ['dentist_owner', 'dentist_associate', 'staff_full']);
  }

  // All-or-nothing transaction
  const imported: Array<{ id: string; personId: string; firstName: string; lastName?: string; branchId: string }> = [];

  try {
    await db.transaction(async (tx) => {
      for (const row of validRows) {
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
          ...(row.lastName ? { lastName: row.lastName } : {}),
          branchId: row.branchId,
        });
      }
    });
  } catch (err: any) {
    return ctx.json({
      success: false,
      errors: [`Import transaction failed: ${err.message}`],
      imported: 0,
      total: validRows.length,
    }, 422);
  }

  return ctx.json({ success: true, imported: imported.length, total: validRows.length, patients: imported }, 201);
}
