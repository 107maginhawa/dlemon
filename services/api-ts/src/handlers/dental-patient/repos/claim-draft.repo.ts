import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalClaimDrafts,
  type DentalClaimDraft,
  type NewDentalClaimDraft,
  type ClaimDraftStatus,
} from './claim-draft.schema';

export class ClaimDraftRepository {
  constructor(
    private readonly db: DatabaseInstance,
    private readonly logger?: any,
  ) {}

  async findByPatientId(patientId: string): Promise<DentalClaimDraft[]> {
    return this.db
      .select()
      .from(dentalClaimDrafts)
      .where(eq(dentalClaimDrafts.patientId, patientId));
  }

  async findByPatientIdAndStatus(patientId: string, status: ClaimDraftStatus): Promise<DentalClaimDraft[]> {
    return this.db
      .select()
      .from(dentalClaimDrafts)
      .where(and(
        eq(dentalClaimDrafts.patientId, patientId),
        eq(dentalClaimDrafts.status, status),
      ));
  }

  async findOneById(id: string, patientId: string): Promise<DentalClaimDraft | null> {
    const [row] = await this.db
      .select()
      .from(dentalClaimDrafts)
      .where(and(
        eq(dentalClaimDrafts.id, id),
        eq(dentalClaimDrafts.patientId, patientId),
      ));
    return row ?? null;
  }

  async create(
    values: Omit<NewDentalClaimDraft, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<DentalClaimDraft> {
    const [row] = await this.db.insert(dentalClaimDrafts).values(values).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  async update(
    id: string,
    patientId: string,
    values: Partial<Pick<DentalClaimDraft, 'status' | 'submittedAt' | 'cdtCode' | 'icd10Code' | 'diagnosisDescription' | 'feeAmountCents' | 'notes'>>,
  ): Promise<DentalClaimDraft | null> {
    const [row] = await this.db
      .update(dentalClaimDrafts)
      .set({ ...values, updatedAt: new Date() })
      .where(and(
        eq(dentalClaimDrafts.id, id),
        eq(dentalClaimDrafts.patientId, patientId),
      ))
      .returning();
    return row ?? null;
  }
}
