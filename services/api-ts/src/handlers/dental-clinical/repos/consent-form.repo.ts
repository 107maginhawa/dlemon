/**
 * ConsentFormRepository — data access for consent forms
 *
 * Forms are immutable after signing: once signed=true, no further mutations allowed.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { consentForms, type ConsentForm, type NewConsentForm } from './consent-form.schema';
import type { Logger } from '@/types/logger';

export interface ConsentFormFilters {
  visitId?: string;
  patientId?: string;
}

export class ConsentFormRepository extends DatabaseRepository<ConsentForm, NewConsentForm, ConsentFormFilters> {
  constructor(db: DatabaseInstance, logger?: Logger) {
    super(db, consentForms, logger);
  }

  protected buildWhereConditions(filters?: ConsentFormFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.visitId) conditions.push(eq(consentForms.visitId, filters.visitId));
    if (filters.patientId) conditions.push(eq(consentForms.patientId, filters.patientId));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  override async findOneById(id: string): Promise<ConsentForm | null> {
    const [row] = await this.db.select().from(consentForms).where(eq(consentForms.id, id));
    return row ?? null;
  }

  async sign(id: string, signatureData: string): Promise<ConsentForm | null> {
    const [updated] = await this.db
      .update(consentForms)
      .set({
        signed: true,
        signedAt: new Date(),
        signatureData,
        updatedAt: new Date(),
      })
      // V-CLN-010: never sign a revoked form (symmetric with revoke's signed guard).
      .where(and(eq(consentForms.id, id), eq(consentForms.signed, false), eq(consentForms.revoked, false)))
      .returning();
    return updated ?? null;
  }

  /** DE-013: Revoke a consent form. Returns null if already revoked or signed. */
  async revoke(id: string, revokedBy: string): Promise<ConsentForm | null> {
    const [updated] = await this.db
      .update(consentForms)
      .set({
        revoked: true,
        revokedAt: new Date(),
        revokedBy,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(consentForms.id, id),
          eq(consentForms.revoked, false),
          eq(consentForms.signed, false),
        ),
      )
      .returning();
    return updated ?? null;
  }
}
