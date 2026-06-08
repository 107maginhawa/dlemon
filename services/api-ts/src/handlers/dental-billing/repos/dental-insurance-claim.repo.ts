/**
 * DentalInsuranceClaimRepository — invoice-anchored multi-line HMO claims (P1-26).
 */

import { randomUUID } from 'node:crypto';
import { eq, and, desc, inArray, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import {
  dentalInsuranceClaims,
  dentalInsuranceClaimLines,
  type DentalInsuranceClaim,
  type NewDentalInsuranceClaim,
  type DentalInsuranceClaimLine,
  type NewDentalInsuranceClaimLine,
} from './dental-insurance-claim.schema';

export interface ClaimFilters {
  branchId?: string;
  patientId?: string;
  status?: DentalInsuranceClaim['status'];
  insuranceProfileId?: string;
  /**
   * EM-BIL-002: caller's accessible branches. Applied only when no specific
   * `branchId` is supplied, to scope the claim worklist / payer-aging to the
   * caller's own branches instead of every org's claims. An empty array means
   * "caller belongs to no branch" → zero rows (never the whole DB).
   */
  allowedBranchIds?: string[];
}

export class DentalInsuranceClaimRepository {
  constructor(private db: DatabaseInstance, private logger?: Logger) {}

  /** Clinic-generated claim number: CLM-{year}-{8-char UUID slice}. */
  generateClaimNumber(): string {
    const year = new Date().getFullYear();
    const id = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    return `CLM-${year}-${id}`;
  }

  async createOne(data: NewDentalInsuranceClaim): Promise<DentalInsuranceClaim> {
    const [row] = await this.db.insert(dentalInsuranceClaims).values(data).returning();
    return row!;
  }

  async createLines(items: NewDentalInsuranceClaimLine[]): Promise<DentalInsuranceClaimLine[]> {
    if (items.length === 0) return [];
    return this.db.insert(dentalInsuranceClaimLines).values(items).returning();
  }

  async findOneById(id: string): Promise<DentalInsuranceClaim | null> {
    const [row] = await this.db.select().from(dentalInsuranceClaims).where(eq(dentalInsuranceClaims.id, id));
    return row ?? null;
  }

  async findLines(claimId: string): Promise<DentalInsuranceClaimLine[]> {
    return this.db
      .select()
      .from(dentalInsuranceClaimLines)
      .where(eq(dentalInsuranceClaimLines.claimId, claimId));
  }

  async findWithLines(
    claimId: string,
  ): Promise<{ claim: DentalInsuranceClaim; lines: DentalInsuranceClaimLine[] } | null> {
    const claim = await this.findOneById(claimId);
    if (!claim) return null;
    const lines = await this.findLines(claimId);
    return { claim, lines };
  }

  async findMany(filters?: ClaimFilters): Promise<DentalInsuranceClaim[]> {
    const conditions: SQL[] = [];
    if (filters?.branchId) {
      conditions.push(eq(dentalInsuranceClaims.branchId, filters.branchId));
    } else if (filters?.allowedBranchIds) {
      conditions.push(
        filters.allowedBranchIds.length > 0
          ? inArray(dentalInsuranceClaims.branchId, filters.allowedBranchIds)
          : sql`false`,
      );
    }
    if (filters?.patientId) conditions.push(eq(dentalInsuranceClaims.patientId, filters.patientId));
    if (filters?.status) conditions.push(eq(dentalInsuranceClaims.status, filters.status));
    if (filters?.insuranceProfileId) conditions.push(eq(dentalInsuranceClaims.insuranceProfileId, filters.insuranceProfileId));

    const q = this.db.select().from(dentalInsuranceClaims);
    const rows = conditions.length > 0
      ? await q.where(and(...conditions)).orderBy(desc(dentalInsuranceClaims.createdAt))
      : await q.orderBy(desc(dentalInsuranceClaims.createdAt));
    return rows;
  }

  async addLine(data: NewDentalInsuranceClaimLine): Promise<DentalInsuranceClaimLine> {
    const [row] = await this.db.insert(dentalInsuranceClaimLines).values(data).returning();
    return row!;
  }

  async updateLine(
    lineId: string,
    claimId: string,
    values: Partial<Pick<DentalInsuranceClaimLine, 'approvedAmountCents' | 'paidAmountCents' | 'status' | 'description' | 'billedAmountCents'>>,
  ): Promise<DentalInsuranceClaimLine | null> {
    const [row] = await this.db
      .update(dentalInsuranceClaimLines)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(dentalInsuranceClaimLines.id, lineId), eq(dentalInsuranceClaimLines.claimId, claimId)))
      .returning();
    return row ?? null;
  }

  /** Recompute the claim's billed total + patient portion from its lines. */
  async recalculateBilled(claimId: string): Promise<DentalInsuranceClaim | null> {
    const lines = await this.findLines(claimId);
    const claim = await this.findOneById(claimId);
    if (!claim) return null;
    const billed = lines.reduce((s, l) => s + l.billedAmountCents, 0);
    const approved = lines.some((l) => l.approvedAmountCents != null)
      ? lines.reduce((s, l) => s + (l.approvedAmountCents ?? 0), 0)
      : claim.approvedAmountCents;
    const patientPortion = Math.max(0, billed - (claim.paidByPayerCents ?? 0) - (claim.disallowedCents ?? 0));
    const [row] = await this.db
      .update(dentalInsuranceClaims)
      .set({ billedAmountCents: billed, approvedAmountCents: approved ?? null, patientPortionCents: patientPortion, updatedAt: new Date() })
      .where(eq(dentalInsuranceClaims.id, claimId))
      .returning();
    return row ?? null;
  }

  async update(
    id: string,
    values: Partial<Pick<DentalInsuranceClaim,
      'status' | 'payerReference' | 'submissionChannel' | 'submittedAt' | 'decisionAt' | 'paidAt'
      | 'approvedAmountCents' | 'paidByPayerCents' | 'disallowedCents' | 'patientPortionCents'
      | 'denialReason' | 'updatedBy'>>,
  ): Promise<DentalInsuranceClaim | null> {
    const [row] = await this.db
      .update(dentalInsuranceClaims)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(dentalInsuranceClaims.id, id))
      .returning();
    return row ?? null;
  }

  /** Atomically add a payer payment + disallowance to the claim. */
  async applyRemittance(
    id: string,
    paidCents: number,
    disallowedCents: number,
  ): Promise<DentalInsuranceClaim | null> {
    const claim = await this.findOneById(id);
    if (!claim) return null;
    const newPaid = (claim.paidByPayerCents ?? 0) + paidCents;
    const newDisallowed = (claim.disallowedCents ?? 0) + disallowedCents;
    const patientPortion = Math.max(0, claim.billedAmountCents - newPaid - newDisallowed);
    const [row] = await this.db
      .update(dentalInsuranceClaims)
      .set({
        paidByPayerCents: newPaid,
        disallowedCents: newDisallowed,
        patientPortionCents: patientPortion,
        updatedAt: new Date(),
      })
      .where(eq(dentalInsuranceClaims.id, id))
      .returning();
    return row ?? null;
  }
}
