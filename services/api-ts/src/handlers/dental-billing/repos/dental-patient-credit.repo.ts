/**
 * DentalPatientCreditRepository — patient credit ledger (BR-052).
 *
 * Append-only. `getBalance` is the authoritative available-credit figure
 * (SUM of the signed ledger); apply-credit reads it inside the SAME transaction
 * it writes the consuming row, so the balance can never be over-drawn.
 */

import { eq, desc, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalPatientCredits,
  type DentalPatientCredit,
  type NewDentalPatientCredit,
} from './dental-patient-credit.schema';

export class DentalPatientCreditRepository {
  constructor(private readonly db: DatabaseInstance) {}

  async create(input: NewDentalPatientCredit): Promise<DentalPatientCredit> {
    const [row] = await this.db.insert(dentalPatientCredits).values(input).returning();
    return row!;
  }

  async listByPatient(patientId: string): Promise<DentalPatientCredit[]> {
    return this.db
      .select()
      .from(dentalPatientCredits)
      .where(eq(dentalPatientCredits.patientId, patientId))
      .orderBy(desc(dentalPatientCredits.createdAt));
  }

  /** Available credit = SUM of the signed ledger (>= 0 by construction). */
  async getBalance(patientId: string): Promise<number> {
    const [row] = await this.db
      .select({ balance: sql<number>`COALESCE(SUM(${dentalPatientCredits.amountCents}), 0)` })
      .from(dentalPatientCredits)
      .where(eq(dentalPatientCredits.patientId, patientId));
    return Number(row?.balance ?? 0);
  }
}
