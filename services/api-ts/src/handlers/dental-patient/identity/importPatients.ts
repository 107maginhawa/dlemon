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
import { createPersonForDentalPatient } from '@/handlers/person/repos/person-dental-patient.facade';
import { insertPatientForImport } from '@/handlers/patient/repos/patient-dental-patient.facade';
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

/**
 * G3: RFC-4180-aware CSV tokenizer. A naive `line.split(',')` mis-splits quoted
 * fields containing commas (e.g. `"dela Cruz, Jr."`), silently corrupting the
 * field and shifting every column after it. This scans character-by-character,
 * honouring quoted fields, escaped double-quotes (`""` → `"`), and embedded
 * commas/newlines inside quotes.
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; }
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\r') { /* ignore — CRLF handled by the \n branch */ }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else { field += ch; }
  }
  // Flush the final field/row when the text has no trailing newline.
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function parseCSV(csvText: string): Record<string, string>[] {
  // Drop rows that are entirely empty (trailing newlines / blank lines).
  const rows = parseCsvRows(csvText).filter(
    (r) => !(r.length === 1 && r[0]!.trim() === ''),
  );
  if (rows.length < 2) return [];
  const headers = rows[0]!.map(h => h.trim());
  return rows.slice(1).map(values => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim(); });
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
    } else if (parsed && typeof parsed === 'object' && 'patients' in parsed && Array.isArray((parsed as { patients: unknown }).patients)) {
      rawRows = (parsed as { patients: Record<string, string | undefined>[] }).patients;
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

  // Branch-level authorization: verify access to all unique branchIds.
  // V-PAT-002/CONF-DP-001: API_CONTRACTS + ROLE_PERMISSION_MATRIX restrict bulk
  // import to dentist_owner only.
  const uniqueBranchIds = [...new Set(validRows.map(r => r.branchId))];
  for (const branchId of uniqueBranchIds) {
    await assertBranchRole(db, user.id, branchId, ['dentist_owner']);
  }

  // All-or-nothing transaction
  const imported: Array<{ id: string; personId: string; firstName: string; lastName?: string; branchId: string }> = [];

  try {
    await db.transaction(async (tx) => {
      for (const row of validRows) {
        const person = await createPersonForDentalPatient(
          tx as unknown as DatabaseInstance,
          {
            firstName: row.firstName,
            ...(row.lastName ? { lastName: row.lastName } : {}),
            ...(row.dateOfBirth ? { dateOfBirth: row.dateOfBirth } : {}),
            ...(row.gender ? { gender: row.gender } : {}),
          },
          user.id,
        );

        const patient = await insertPatientForImport(
          tx as unknown as DatabaseInstance,
          person.id,
          row.branchId,
          user.id,
        );

        imported.push({
          id: patient.id,
          personId: person.id,
          firstName: row.firstName,
          ...(row.lastName ? { lastName: row.lastName } : {}),
          branchId: row.branchId,
        });
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return ctx.json({
      success: false,
      errors: [`Import transaction failed: ${message}`],
      imported: 0,
      total: validRows.length,
    }, 422);
  }

  return ctx.json({ success: true, imported: imported.length, total: validRows.length, patients: imported }, 201);
}
