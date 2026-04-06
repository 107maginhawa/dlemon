/**
 * EMR UI Component Types
 * 
 * These are UI-specific types that may differ from SDK types.
 * SDK types handle API contracts, while these handle presentation logic.
 */

/**
 * EMR Patient display information
 */
export interface EmrPatientDisplay {
  id: string
  name: string
  dateOfBirth: string
  age: number
  gender?: string
  email?: string
  phone?: string
  lastVisit?: string
  recordCount?: number
  consultationCount?: number
}

/**
 * Medical record display information
 */
export interface MedicalRecordDisplay {
  id: string
  type: 'consultation' | 'diagnosis' | 'prescription' | 'lab_result' | 'imaging' | 'note'
  title: string
  date: string
  providerName?: string
  summary?: string
}

/**
 * Consultation display information
 */
export interface ConsultationDisplay {
  id: string
  patientName: string
  date: string
  duration: number
  type: 'video' | 'phone' | 'in-person'
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  chiefComplaint?: string
}
