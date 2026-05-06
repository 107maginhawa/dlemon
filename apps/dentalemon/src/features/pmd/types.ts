/**
 * Shared PMD types — exported as the public contract for the pmd feature module.
 * Import from here, not from component internals.
 */

export type PMDStatus = 'generated' | 'signed' | 'superseded';

export interface PMDTreatment {
  cdtCode: string;
  description: string;
  toothNumber?: number;
  priceCents?: number;
}

export interface PMDPrescription {
  drugName: string;
  rxNormCode?: string;
  dosage: string;
  frequency: string;
}

export interface PMDContent {
  visitDate?: string;
  treatments?: PMDTreatment[];
  prescriptions?: PMDPrescription[];
}

export interface PMDDocument {
  id: string;
  visitId: string;
  patientId: string;
  status: PMDStatus;
  content: string;
  signature?: string | null;
  signedAt?: string | null;
  supersedesId?: string | null;
  checksum: string;
  createdAt: string;
}
