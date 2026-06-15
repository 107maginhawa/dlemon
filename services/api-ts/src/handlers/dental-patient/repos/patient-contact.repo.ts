import { eq, and, isNull } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import {
  dentalPatientContacts,
  type DentalPatientContact,
  type NewDentalPatientContact,
} from './patient-contact.schema';

export class PatientContactRepository {
  constructor(
    private readonly db: DatabaseInstance,
    private readonly logger?: Logger,
  ) {}

  async findByPatientId(patientId: string): Promise<DentalPatientContact[]> {
    return this.db
      .select()
      .from(dentalPatientContacts)
      .where(and(
        eq(dentalPatientContacts.patientId, patientId),
        isNull(dentalPatientContacts.deletedAt),
      ));
  }

  async findOneById(id: string): Promise<DentalPatientContact | null> {
    const [row] = await this.db
      .select()
      .from(dentalPatientContacts)
      .where(and(
        eq(dentalPatientContacts.id, id),
        isNull(dentalPatientContacts.deletedAt),
      ));
    return row ?? null;
  }

  async create(values: Omit<NewDentalPatientContact, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<DentalPatientContact> {
    const [row] = await this.db
      .insert(dentalPatientContacts)
      .values(values)
      .returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  // SECURITY (P0 IDOR): the WHERE keys on (patientId, id), never id alone — the
  // contact MUST belong to the patientId the caller authorized. Keying on id
  // alone let a caller who authorized their own patient mutate/soft-delete a
  // contact belonging to a patient in another branch (cross-tenant PHI write).
  async update(
    patientId: string,
    id: string,
    values: Partial<Pick<DentalPatientContact, 'name' | 'relationship' | 'phone' | 'email' | 'isGuardian' | 'isEmergencyContact' | 'notes'>>,
  ): Promise<DentalPatientContact | null> {
    const [row] = await this.db
      .update(dentalPatientContacts)
      .set({ ...values, updatedAt: new Date() })
      .where(and(
        eq(dentalPatientContacts.id, id),
        eq(dentalPatientContacts.patientId, patientId),
        isNull(dentalPatientContacts.deletedAt),
      ))
      .returning();
    return row ?? null;
  }

  async softDelete(patientId: string, id: string): Promise<boolean> {
    const result = await this.db
      .update(dentalPatientContacts)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(dentalPatientContacts.id, id),
        eq(dentalPatientContacts.patientId, patientId),
        isNull(dentalPatientContacts.deletedAt),
      ))
      .returning({ id: dentalPatientContacts.id });
    return result.length > 0;
  }
}
