/**
 * addFollowUpNote — POST /dental/patients/:id/follow-up-notes
 *
 * FR2.12: Add a follow-up note to a patient.
 *
 * Re-export of the canonical implementation in followUpNotes.ts. This module
 * exists only as the import target for the generated OpenAPI registry
 * (registry.ts). It MUST NOT carry a divergent copy of the handler — a prior
 * duplicate here silently dropped the EM-PAT-009 archived-patient write-block
 * (the unit suite tested followUpNotes.ts while production wired this file).
 */

export { addFollowUpNote } from './followUpNotes';
