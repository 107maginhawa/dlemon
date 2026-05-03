/**
 * importPatients — FR7.2: CSV / JSON Data Import with validation and rollback
 *
 * POST /dental/patients/import
 *
 * Accepts JSON array or CSV body.
 * Validates all rows up front — returns 422 with errors if any fail.
 * Batch-commits all patients in a transaction (all-or-nothing).
 *
 * CSV columns (header required):
 *   firstName, lastName, dateOfBirth, gender, phone, email, branchId
 *
 * JSON: array of { firstName, lastName, dateOfBirth, branchId, gender?, phone?, email? }
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import type { User } from '@/types/auth';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

interface PatientRow {
  firstName: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  branchId: string;
}

function parseCSV(csv: string): { rows: PatientRow[]; errors: string[] } {
  const lines = csv.trim().split('\n').map(l => l.replace(/\r$/, ''));
  if (lines.length < 2) return { rows: [], errors: ['CSV must have a header and at least one data row'] };

  const headers = lines[0]!.split(',').map(h => h.trim().toLowerCase());
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => { colMap[h] = i; });

  const required = ['firstname', 'branchid'];
  const missing = required.filter(k => colMap[k] === undefined).map(k => `Missing required column: ${k}`);
  if (missing.length > 0) return { rows: [], errors: missing };

  const errors: string[] = [];
  const rows: PatientRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const cells = line.split(',').map(c => c.trim());
    const get = (key: string) => cells[colMap[key] ?? -1]?.trim() || '';

    const firstName = get('firstname');
    const branchId = get('branchid');

    if (!firstName) { errors.push(`Row ${i}: firstName is required`); continue; }
    if (!branchId)  { errors.push(`Row ${i}: branchId is required`);  continue; }

    rows.push({
      firstName,
      lastName: get('lastname') || undefined,
      dateOfBirth: get('dateofbirth') || undefined,
      gender: get('gender') || undefined,
      phone: get('phone') || undefined,
      email: get('email') || undefined,
      branchId,
    });
  }

  return { rows, errors };
}

function validateRows(items: any[]): { rows: PatientRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: PatientRow[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as any;
    if (!item.firstName?.trim()) { errors.push(`Item ${i}: firstName required`); continue; }
    if (!item.branchId?.trim())  { errors.push(`Item ${i}: branchId required`);  continue; }
    rows.push({
      firstName: item.firstName.trim(),
      lastName: item.lastName?.trim() || undefined,
      dateOfBirth: item.dateOfBirth?.trim() || undefined,
      gender: item.gender?.trim() || undefined,
      phone: item.phone?.trim() || undefined,
      email: item.email?.trim() || undefined,
      branchId: item.branchId.trim(),
    });
  }

  return { rows, errors };
}

export async function importPatients(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const contentType = ctx.req.header('Content-Type') ?? '';

  let rows: PatientRow[] = [];
  let parseErrors: string[] = [];

  if (contentType.includes('application/json')) {
    let body: any;
    try { body = await ctx.req.json(); } catch { throw new ValidationError('Invalid JSON'); }
    if (!Array.isArray(body)) throw new ValidationError('Body must be an array');
    const result = validateRows(body);
    rows = result.rows;
    parseErrors = result.errors;
  } else {
    const csvText = await ctx.req.text().catch(() => '');
    const result = parseCSV(csvText);
    rows = result.rows;
    parseErrors = result.errors;
  }

  // Fail-fast: rollback all if any validation errors
  if (parseErrors.length > 0) {
    return ctx.json({ success: false, errors: parseErrors, imported: 0, total: rows.length }, 422);
  }

  if (rows.length === 0) throw new ValidationError('No rows to import');

  // All-or-nothing transaction
  const imported: any[] = [];

  try {
    await (db as any).transaction(async (tx: any) => {
      for (const row of rows) {
        const [person] = await tx.insert(persons).values({
          firstName: row.firstName,
          ...(row.lastName ? { lastName: row.lastName } : {}),
          ...(row.dateOfBirth ? { dateOfBirth: row.dateOfBirth } : {}),
          ...(row.gender ? { gender: row.gender } : {}),
          ...(row.phone ? { phone: row.phone } : {}),
          ...(row.email ? { email: row.email } : {}),
          createdBy: user.id,
          updatedBy: user.id,
        }).returning();

        const [patient] = await tx.insert(patients).values({
          person: person.id,
          preferredBranchId: row.branchId,
          createdBy: user.id,
          updatedBy: user.id,
        }).returning();

        imported.push({
          id: patient.id,
          personId: person.id,
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
