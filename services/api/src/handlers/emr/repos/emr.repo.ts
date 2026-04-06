/**
 * ConsultationNoteRepository - Data access layer for consultation notes
 * Handles EMR documentation, status transitions, and clinical workflows
 */

import { eq, and, or, desc, inArray, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository, type PaginationOptions } from '@/core/database.repo';
import { shouldExpand } from '@/utils/query';
import { 
  consultationNotes,
  type ConsultationNote,
  type NewConsultationNote,
  type ConsultationStatus,
  type ConsultationNoteWithDetails
} from './emr.schema';
import { patients } from '../../patient/repos/patient.schema';
import { providers } from '../../provider/repos/provider.schema';
import { persons } from '../../person/repos/person.schema';

export interface ConsultationNoteFilters {
  context?: string;         // Context filter per TypeSpec
  patient?: string;         // Patient filter per TypeSpec
  provider?: string;        // Provider filter (used for role-based access)
  status?: ConsultationStatus; // Status filter per TypeSpec
  dateRange?: { start: string; end: string };
  q?: string; // General search query
}

export interface ExpansionOptions {
  patient?: boolean;
  provider?: boolean;
  person?: boolean; // For patient/provider person expansion
}

export class ConsultationNoteRepository extends DatabaseRepository<
  ConsultationNote, 
  NewConsultationNote, 
  ConsultationNoteFilters
> {
  constructor(
    db: DatabaseInstance,
    logger?: any
  ) {
    super(db, consultationNotes, logger);
  }

  /**
   * Build where conditions for consultation note filtering
   */
  protected buildWhereConditions(filters?: ConsultationNoteFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.context) {
      conditions.push(eq(consultationNotes.context, filters.context));
    }

    if (filters.patient) {
      conditions.push(eq(consultationNotes.patient, filters.patient));
    }

    if (filters.provider) {
      conditions.push(eq(consultationNotes.provider, filters.provider));
    }

    if (filters.status) {
      conditions.push(eq(consultationNotes.status, filters.status));
    }

    if (filters.dateRange) {
      conditions.push(
        and(
          sql`${consultationNotes.createdAt} >= ${filters.dateRange.start}::timestamp`,
          sql`${consultationNotes.createdAt} <= ${filters.dateRange.end}::timestamp`
        )
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Find consultation notes by patient ID
   */
  async findByPatient(
    patientId: string,
    options?: { pagination?: PaginationOptions; status?: ConsultationStatus }
  ): Promise<ConsultationNote[]> {
    this.logger?.debug({ patientId, options }, 'Finding consultation notes by patient');
    
    const filters: ConsultationNoteFilters = { patient: patientId };
    if (options?.status) {
      filters.status = options.status;
    }
    
    const notes = await this.findMany(filters, {
      pagination: options?.pagination,
      orderBy: desc(consultationNotes.createdAt)
    });
    
    this.logger?.debug({ 
      patientId, 
      noteCount: notes.length 
    }, 'Consultation notes by patient retrieved');
    
    return notes;
  }

  /**
   * Find consultation notes by provider ID
   */
  async findByProvider(
    providerId: string,
    options?: { pagination?: PaginationOptions; status?: ConsultationStatus }
  ): Promise<ConsultationNote[]> {
    this.logger?.debug({ providerId, options }, 'Finding consultation notes by provider');
    
    const filters: ConsultationNoteFilters = { provider: providerId };
    if (options?.status) {
      filters.status = options.status;
    }
    
    const notes = await this.findMany(filters, {
      pagination: options?.pagination,
      orderBy: desc(consultationNotes.createdAt)
    });
    
    this.logger?.debug({ 
      providerId, 
      noteCount: notes.length 
    }, 'Consultation notes by provider retrieved');
    
    return notes;
  }

  /**
   * Find consultation note with expanded details (patient, provider)
   */
  async findOneWithDetails(
    noteId: string, 
    expand?: ExpansionOptions
  ): Promise<ConsultationNoteWithDetails | null> {
    this.logger?.debug({ noteId, expand }, 'Finding consultation note with details');
    
    // Base query for consultation note
    const baseResult = await this.findOneById(noteId);
    if (!baseResult) {
      return null;
    }
    
    let result: ConsultationNoteWithDetails = { ...baseResult };
    
    // Conditional expansion using ternary pattern from existing repos
    const [patientData, providerData] = await Promise.all([
      expand?.patient 
        ? (expand?.person
            ? this.db
                .select({
                  patient: patients,
                  person: persons
                })
                .from(patients)
                .innerJoin(persons, eq(patients.person, persons.id))
                .where(eq(patients.id, baseResult.patient))
                .limit(1)
            : this.db
                .select()
                .from(patients)
                .where(eq(patients.id, baseResult.patient))
                .limit(1))
        : null,
        
      expand?.provider 
        ? (expand?.person
            ? this.db
                .select({
                  provider: providers,
                  person: persons
                })
                .from(providers)
                .innerJoin(persons, eq(providers.person, persons.id))
                .where(eq(providers.id, baseResult.provider))
                .limit(1)
            : this.db
                .select()
                .from(providers)
                .where(eq(providers.id, baseResult.provider))
                .limit(1))
        : null
    ]);
    
    // Attach expanded data
    if (patientData && patientData.length > 0) {
      if (expand?.person && 'patient' in patientData[0]) {
        // Include person data in patient object
        result.patient = {
          ...patientData[0].patient,
          person: patientData[0].person
        };
      } else {
        result.patient = patientData[0];
      }
    }
    
    if (providerData && providerData.length > 0) {
      if (expand?.person && 'provider' in providerData[0]) {
        // Include person data in provider object
        result.provider = {
          ...providerData[0].provider,
          person: providerData[0].person
        };
      } else {
        result.provider = providerData[0];
      }
    }
    
    this.logger?.debug({ 
      noteId, 
      found: true,
      expandedFields: Object.keys(expand || {}).filter(key => expand?.[key as keyof ExpansionOptions])
    }, 'Consultation note with details retrieved');
    
    return result;
  }

  /**
   * Find consultation notes with expanded details (supports multiple records)
   */
  async findManyWithDetails(
    filters?: ConsultationNoteFilters,
    expand?: ExpansionOptions,
    options?: { pagination?: PaginationOptions }
  ): Promise<ConsultationNoteWithDetails[]> {
    this.logger?.debug({ filters, expand, options }, 'Finding consultation notes with details');
    
    // Get base consultation notes
    const notes = await this.findMany(filters, {
      ...options,
      orderBy: desc(consultationNotes.createdAt)
    });
    
    if (notes.length === 0) {
      return [];
    }
    
    // For now, return notes without full expansion for multiple records
    // This would need proper implementation of IN queries for full expansion support
    this.logger?.debug({ 
      noteCount: notes.length,
      message: 'Returning consultation notes without full expansion (IN query support needed)'
    }, 'Consultation notes with details retrieved');
    
    return notes.map(note => ({ ...note }));
  }

  /**
   * Update consultation status with business logic
   */
  async updateStatus(
    noteId: string,
    status: ConsultationStatus
  ): Promise<ConsultationNote> {
    this.logger?.debug({ noteId, status }, 'Updating consultation status');
    
    const note = await this.findOneById(noteId);
    if (!note) {
      throw new Error(`Consultation note ${noteId} not found`);
    }
    
    // Validate status transition
    this.validateStatusTransition(note.status, status);
    
    const updateData: Partial<ConsultationNote> = {
      status
    };
    
    // Set finalizedAt timestamp when finalizing
    if (status === 'finalized') {
      updateData.finalizedAt = new Date();
    }
    
    const updated = await this.updateOneById(noteId, updateData);
    
    this.logger?.info({ 
      noteId, 
      oldStatus: note.status,
      newStatus: status,
      finalizedAt: updated.finalizedAt
    }, 'Consultation status updated');
    
    return updated;
  }

  /**
   * Mark consultation as finalized
   */
  async markFinalized(noteId: string): Promise<ConsultationNote> {
    this.logger?.debug({ noteId }, 'Marking consultation as finalized');
    
    return await this.updateStatus(noteId, 'finalized');
  }

  /**
   * Validate status transition logic
   */
  private validateStatusTransition(currentStatus: ConsultationStatus, newStatus: ConsultationStatus): void {
    const validTransitions: Record<ConsultationStatus, ConsultationStatus[]> = {
      draft: ['finalized'],
      finalized: ['amended'],
      amended: ['finalized'] // Can be re-finalized after amendments
    };
    
    const allowedStatuses = validTransitions[currentStatus] || [];
    
    if (!allowedStatuses.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}. ` +
        `Allowed transitions: ${allowedStatuses.join(', ')}`
      );
    }
  }

  /**
   * Search consultation notes with text search across clinical fields
   */
  async searchNotes(
    searchQuery: string,
    filters?: Omit<ConsultationNoteFilters, 'q'>,
    options?: { pagination?: PaginationOptions }
  ): Promise<ConsultationNote[]> {
    this.logger?.debug({ searchQuery, filters, options }, 'Searching consultation notes');
    
    if (!searchQuery || searchQuery.trim().length === 0) {
      return await this.findMany(filters, options);
    }
    
    // Build search conditions across clinical text fields
    const searchConditions = or(
      sql`${consultationNotes.chiefComplaint} ILIKE ${`%${searchQuery}%`}`,
      sql`${consultationNotes.assessment} ILIKE ${`%${searchQuery}%`}`,
      sql`${consultationNotes.plan} ILIKE ${`%${searchQuery}%`}`
    );
    
    const baseConditions = this.buildWhereConditions(filters);
    const whereClause = baseConditions 
      ? and(baseConditions, searchConditions)
      : searchConditions;
    
    const query = this.db
      .select()
      .from(consultationNotes)
      .where(whereClause)
      .orderBy(desc(consultationNotes.createdAt))
      .$dynamic();
    
    // Apply pagination
    if (options?.pagination) {
      query.limit(options.pagination.limit);
      query.offset(options.pagination.offset);
    }
    
    const results = await query;
    
    this.logger?.debug({ 
      searchQuery, 
      resultCount: results.length 
    }, 'Consultation note search completed');
    
    return results as ConsultationNote[];
  }

  /**
   * Get consultation statistics for a patient or provider
   */
  async getConsultationStats(
    entityId: string,
    entityType: 'patient' | 'provider',
    dateRange?: { start: string; end: string }
  ): Promise<{
    totalConsultations: number;
    draftConsultations: number;
    finalizedConsultations: number;
    amendedConsultations: number;
    recentConsultationDate?: Date;
  }> {
    this.logger?.debug({ entityId, entityType, dateRange }, 'Getting consultation statistics');
    
    const filters: ConsultationNoteFilters = {};
    filters[entityType] = entityId;
    
    if (dateRange) {
      filters.dateRange = dateRange;
    }
    
    const allNotes = await this.findMany(filters);
    
    const stats = {
      totalConsultations: allNotes.length,
      draftConsultations: allNotes.filter(note => note.status === 'draft').length,
      finalizedConsultations: allNotes.filter(note => note.status === 'finalized').length,
      amendedConsultations: allNotes.filter(note => note.status === 'amended').length,
      recentConsultationDate: allNotes.length > 0 ? allNotes[0].createdAt : undefined
    };
    
    this.logger?.debug({ 
      entityId, 
      entityType, 
      stats 
    }, 'Consultation statistics calculated');
    
    return stats;
  }

  /**
   * Get patient health summary with recent consultations and prescriptions
   */
  async getPatientHealthSummary(patientId: string): Promise<{
    recentConsultations: number;
    lastConsultation?: Date;
    activePrescriptions: Array<{
      medication: string;
      prescribedDate: Date;
      consultation: string;
    }>;
  }> {
    this.logger?.debug({ patientId }, 'Getting patient health summary');
    
    const recentNotes = await this.findByPatient(patientId, {
      pagination: { limit: 10, offset: 0 },
      status: 'finalized'
    });
    
    // Extract active prescriptions from recent finalized consultations
    const activePrescriptions: Array<{
      medication: string;
      prescribedDate: Date;
      consultation: string;
    }> = [];
    
    recentNotes.forEach(note => {
      if (note.prescriptions && Array.isArray(note.prescriptions)) {
        note.prescriptions.forEach(prescription => {
          activePrescriptions.push({
            medication: prescription.medication,
            prescribedDate: note.createdAt,
            consultation: note.id
          });
        });
      }
    });
    
    const summary = {
      recentConsultations: recentNotes.length,
      lastConsultation: recentNotes.length > 0 ? recentNotes[0].createdAt : undefined,
      activePrescriptions: activePrescriptions.slice(0, 10) // Limit to 10 most recent
    };
    
    this.logger?.debug({
      patientId,
      summary: {
        ...summary,
        activePrescriptions: summary.activePrescriptions.length
      }
    }, 'Patient health summary generated');

    return summary;
  }

  /**
   * Create consultation note directly (TypeSpec pattern)
   */
  async createDirect(
    consultationData: {
      patient: string;
      provider: string;
      context?: string;
      chiefComplaint?: string;
      assessment?: string;
      plan?: string;
      vitals?: any;
      symptoms?: any;
      prescriptions?: any[];
      followUp?: any;
      externalDocumentation?: Record<string, any>;
    }
  ): Promise<ConsultationNote> {
    this.logger?.debug({ consultationData }, 'Creating consultation note directly');

    // Check for context-based duplicate if context provided
    if (consultationData.context) {
      const existing = await this.findByContext(consultationData.context);
      if (existing) {
        throw new Error(`Consultation with context '${consultationData.context}' already exists`);
      }
    }

    const noteData: NewConsultationNote = {
      patient: consultationData.patient,
      provider: consultationData.provider,
      context: consultationData.context || undefined,
      chiefComplaint: consultationData.chiefComplaint || null,
      assessment: consultationData.assessment || null,
      plan: consultationData.plan || null,
      vitals: consultationData.vitals || null,
      symptoms: consultationData.symptoms || null,
      prescriptions: consultationData.prescriptions || null,
      followUp: consultationData.followUp || null,
      externalDocumentation: consultationData.externalDocumentation || null,
      status: 'draft'
    };

    const created = await this.createOne(noteData);

    this.logger?.info({
      consultationId: created.id,
      context: consultationData.context,
      patientId: consultationData.patient,
      providerId: consultationData.provider,
      status: created.status
    }, 'Consultation note created directly');

    return created;
  }

  /**
   * Find consultation note by context
   */
  async findByContext(context: string): Promise<ConsultationNote | null> {
    this.logger?.debug({ context }, 'Finding consultation note by context');

    const note = await this.findOne({ context });

    this.logger?.debug({ context, found: !!note }, 'Consultation note context lookup completed');

    return note;
  }

  /**
   * Finalize consultation note
   */
  async finalizeNote(noteId: string, finalizedBy: string): Promise<ConsultationNote> {
    this.logger?.debug({ noteId, finalizedBy }, 'Finalizing consultation note');

    const updated = await this.updateOneById(noteId, {
      status: 'finalized',
      finalizedAt: new Date(),
      finalizedBy: finalizedBy,
      updatedAt: new Date()
    });

    this.logger?.info({
      consultationId: noteId,
      finalizedBy,
      finalizedAt: updated.finalizedAt
    }, 'Consultation note finalized');

    return updated;
  }

  /**
   * Update consultation note with explicit null support (TypeSpec pattern)
   */
  async updateWithNulls(
    noteId: string,
    updates: {
      chiefComplaint?: string | null;
      assessment?: string | null;
      plan?: string | null;
      vitals?: any | null;
      symptoms?: any | null;
      prescriptions?: any[] | null;
      followUp?: any | null;
      externalDocumentation?: Record<string, any> | null;
    }
  ): Promise<ConsultationNote> {
    this.logger?.debug({ noteId, updates }, 'Updating consultation note with nulls');

    // Convert undefined values to explicit null for clearing fields
    const updateData: Partial<ConsultationNote> = {};

    if (updates.chiefComplaint !== undefined) {
      updateData.chiefComplaint = updates.chiefComplaint;
    }
    if (updates.assessment !== undefined) {
      updateData.assessment = updates.assessment;
    }
    if (updates.plan !== undefined) {
      updateData.plan = updates.plan;
    }
    if (updates.vitals !== undefined) {
      updateData.vitals = updates.vitals;
    }
    if (updates.symptoms !== undefined) {
      updateData.symptoms = updates.symptoms;
    }
    if (updates.prescriptions !== undefined) {
      updateData.prescriptions = updates.prescriptions;
    }
    if (updates.followUp !== undefined) {
      updateData.followUp = updates.followUp;
    }
    if (updates.externalDocumentation !== undefined) {
      updateData.externalDocumentation = updates.externalDocumentation;
    }

    updateData.updatedAt = new Date();

    const updated = await this.updateOneById(noteId, updateData);

    this.logger?.info({
      consultationId: noteId,
      updatedFields: Object.keys(updateData)
    }, 'Consultation note updated with nulls');

    return updated;
  }
}

/**
 * Default consultation note repository instance
 */
export const consultationNoteRepo = ConsultationNoteRepository;
