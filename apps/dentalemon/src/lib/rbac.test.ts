/**
 * RBAC utility tests
 *
 * Authority: docs/product/ROLE_PERMISSION_MATRIX.md
 *
 * Covers every (role x module) cell of ACCESS_MATRIX for all 9 context roles,
 * plus getDefaultRoute, canViewFinancials, canWriteBilling, canManageStaff,
 * canAccessReports.
 */

import { describe, test, expect } from 'bun:test';
import {
  canAccess,
  getDefaultRoute,
  canViewFinancials,
  canWriteBilling,
  canManageStaff,
  canAccessReports,
  canPresentCase,
  canCaptureImaging,
  canDraftNotes,
  canEditChart,
  canSignNotes,
  canAddTreatment,
  canPrescribe,
  canCaptureConsent,
  type DentalRole,
  type DentalModule,
} from './rbac';

// ---------------------------------------------------------------------------
// Full role x module truth table (authority: ROLE_PERMISSION_MATRIX.md)
// ---------------------------------------------------------------------------

const EXPECTED: Record<DentalRole, Record<DentalModule, boolean>> = {
  // PRD-defined roles (FR6.2)
  dentist_owner: {
    dashboard: true, workspace: true, patients: true, calendar: true,
    billing: true, reports: true, staff: true, settings: true,
  },
  dentist_associate: {
    dashboard: true, workspace: true, patients: true, calendar: true,
    billing: true, reports: false, staff: false, settings: false,
  },
  // staff_full: matrix grants "Record payments only" -> billing module reachable
  staff_full: {
    dashboard: true, workspace: true, patients: true, calendar: true,
    billing: true, reports: false, staff: false, settings: false,
  },
  staff_scheduling: {
    dashboard: false, workspace: false, patients: true, calendar: true,
    billing: false, reports: false, staff: false, settings: false,
  },
  // Extended staff roles (G8-S3)
  // hygienist: clinical R/W for hygiene (perio/prophy); no billing edits
  hygienist: {
    dashboard: true, workspace: true, patients: true, calendar: true,
    billing: false, reports: false, staff: false, settings: false,
  },
  // dental_assistant: chairside, chart updates under a dentist, imaging capture
  dental_assistant: {
    dashboard: true, workspace: true, patients: true, calendar: true,
    billing: false, reports: false, staff: false, settings: false,
  },
  // front_desk: check-in, scheduling, demographics; no clinical write, no billing
  front_desk: {
    dashboard: true, workspace: false, patients: true, calendar: true,
    billing: false, reports: false, staff: false, settings: false,
  },
  // billing_staff: invoices/payments/fee-schedule READ; patient read floor
  billing_staff: {
    dashboard: true, workspace: false, patients: true, calendar: false,
    billing: true, reports: false, staff: false, settings: false,
  },
  // treatment_coordinator: presents plans + financials → workspace + billing
  // reachable; no staff/reports/settings admin surface. (E1)
  treatment_coordinator: {
    dashboard: true, workspace: true, patients: true, calendar: true,
    billing: true, reports: false, staff: false, settings: false,
  },
  // read_only: read across granted modules (dashboard + patients + calendar).
  // reports stays false — owner-only module (see canAccessReports / Export reports).
  read_only: {
    dashboard: true, workspace: false, patients: true, calendar: true,
    billing: false, reports: false, staff: false, settings: false,
  },
};

const ALL_ROLES = Object.keys(EXPECTED) as DentalRole[];
const ALL_MODULES = Object.keys(EXPECTED.dentist_owner) as DentalModule[];

describe('canAccess — full role x module matrix', () => {
  for (const role of ALL_ROLES) {
    for (const mod of ALL_MODULES) {
      const want = EXPECTED[role][mod];
      test(`canAccess("${role}", "${mod}") === ${want}`, () => {
        expect(canAccess(role, mod)).toBe(want);
      });
    }
  }

  test('unknown role denied for any module', () => {
    expect(canAccess('nope' as DentalRole, 'dashboard')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getDefaultRoute — first accessible module in MODULE_ORDER
// ---------------------------------------------------------------------------

describe('getDefaultRoute', () => {
  test('dentist_owner -> /dashboard', () => {
    expect(getDefaultRoute('dentist_owner')).toBe('/dashboard');
  });

  // dashboard=false, workspace=false; patients (index 2) is first accessible
  test('staff_scheduling -> /patients', () => {
    expect(getDefaultRoute('staff_scheduling')).toBe('/patients');
  });

  test('billing_staff -> /dashboard', () => {
    expect(getDefaultRoute('billing_staff')).toBe('/dashboard');
  });

  test('front_desk -> /dashboard', () => {
    expect(getDefaultRoute('front_desk')).toBe('/dashboard');
  });

  test('read_only -> /dashboard', () => {
    expect(getDefaultRoute('read_only')).toBe('/dashboard');
  });
});

// ---------------------------------------------------------------------------
// canViewFinancials — DASHBOARD financial figures (matrix: staff_full = "no
// financials"). Distinct from billing-module access. Owner/associate only.
// ---------------------------------------------------------------------------

describe('canViewFinancials', () => {
  const expected: Record<DentalRole, boolean> = {
    dentist_owner: true,
    dentist_associate: true,
    staff_full: false,
    staff_scheduling: false,
    hygienist: false,
    dental_assistant: false,
    front_desk: false,
    billing_staff: false,
    treatment_coordinator: false,
    read_only: false,
  };
  for (const role of ALL_ROLES) {
    test(`canViewFinancials("${role}") === ${expected[role]}`, () => {
      expect(canViewFinancials(role)).toBe(expected[role]);
    });
  }

  test('staff_full: no dashboard financials, but CAN reach billing module', () => {
    expect(canViewFinancials('staff_full')).toBe(false);
    expect(canAccess('staff_full', 'billing')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canWriteBilling — issue/void/create-invoice actions (J-RBAC-001)
// Only owner + associate per Billing Write Operations table.
// staff_full can record payment but must NOT see issue/void/create.
// ---------------------------------------------------------------------------

describe('canWriteBilling', () => {
  const expected: Record<DentalRole, boolean> = {
    dentist_owner: true,
    dentist_associate: true,
    staff_full: false,
    staff_scheduling: false,
    hygienist: false,
    dental_assistant: false,
    front_desk: false,
    billing_staff: false,
    treatment_coordinator: false,
    read_only: false,
  };
  for (const role of ALL_ROLES) {
    test(`canWriteBilling("${role}") === ${expected[role]}`, () => {
      expect(canWriteBilling(role)).toBe(expected[role]);
    });
  }

  test('staff_full can reach billing but cannot write (issue/void)', () => {
    expect(canAccess('staff_full', 'billing')).toBe(true);
    expect(canWriteBilling('staff_full')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// canManageStaff
// ---------------------------------------------------------------------------

describe('canManageStaff', () => {
  test('dentist_owner === true', () => {
    expect(canManageStaff('dentist_owner')).toBe(true);
  });
  for (const role of ALL_ROLES.filter((r) => r !== 'dentist_owner')) {
    test(`${role} === false`, () => {
      expect(canManageStaff(role)).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// canAccessReports
// ---------------------------------------------------------------------------

describe('canAccessReports', () => {
  test('dentist_owner === true', () => {
    expect(canAccessReports('dentist_owner')).toBe(true);
  });
  test('dentist_associate === false', () => {
    expect(canAccessReports('dentist_associate')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// canPresentCase — treatment-presentation surface (E1)
// Clinicians + treatment_coordinator. Mirrors backend createCasePresentation gate.
// ---------------------------------------------------------------------------

describe('canPresentCase', () => {
  const expected: Record<DentalRole, boolean> = {
    dentist_owner: true,
    dentist_associate: true,
    treatment_coordinator: true,
    staff_full: false,
    staff_scheduling: false,
    hygienist: false,
    dental_assistant: false,
    front_desk: false,
    billing_staff: false,
    read_only: false,
  };
  for (const role of ALL_ROLES) {
    test(`canPresentCase("${role}") === ${expected[role]}`, () => {
      expect(canPresentCase(role)).toBe(expected[role]);
    });
  }
});

// ---------------------------------------------------------------------------
// E2: dental_assistant clinical-assist capability helpers.
// Each truth table mirrors the backend assertBranchRole gate for the operation.
// ---------------------------------------------------------------------------

const CLINICAL_CAPS: Record<
  string,
  { fn: (r: DentalRole) => boolean; expected: Record<DentalRole, boolean> }
> = {
  // ALLOW assistant — capture imaging (createImagingStudy)
  canCaptureImaging: {
    fn: canCaptureImaging,
    expected: {
      dentist_owner: true, dentist_associate: true, hygienist: true, dental_assistant: true,
      staff_full: false, staff_scheduling: false, treatment_coordinator: false,
      front_desk: false, billing_staff: false, read_only: false,
    },
  },
  // ALLOW assistant — draft notes (upsertVisitNotes)
  canDraftNotes: {
    fn: canDraftNotes,
    expected: {
      dentist_owner: true, dentist_associate: true, dental_assistant: true,
      hygienist: false, staff_full: false, staff_scheduling: false,
      treatment_coordinator: false, front_desk: false, billing_staff: false, read_only: false,
    },
  },
  // ALLOW assistant — chart-condition writes (upsertDentalChart/updateTooth/initializeDentition)
  canEditChart: {
    fn: canEditChart,
    expected: {
      dentist_owner: true, dentist_associate: true, hygienist: true, dental_assistant: true,
      staff_full: false, staff_scheduling: false, treatment_coordinator: false,
      front_desk: false, billing_staff: false, read_only: false,
    },
  },
  // DENY assistant — sign notes (signVisitNotes)
  canSignNotes: {
    fn: canSignNotes,
    expected: {
      dentist_owner: true, dentist_associate: true,
      dental_assistant: false, hygienist: false, staff_full: false, staff_scheduling: false,
      treatment_coordinator: false, front_desk: false, billing_staff: false, read_only: false,
    },
  },
  // DENY assistant — add/finalize treatment (createDentalTreatment)
  canAddTreatment: {
    fn: canAddTreatment,
    expected: {
      dentist_owner: true, dentist_associate: true,
      dental_assistant: false, hygienist: false, staff_full: false, staff_scheduling: false,
      treatment_coordinator: false, front_desk: false, billing_staff: false, read_only: false,
    },
  },
  // DENY assistant — prescribe (Rx)
  canPrescribe: {
    fn: canPrescribe,
    expected: {
      dentist_owner: true, dentist_associate: true,
      dental_assistant: false, hygienist: false, staff_full: false, staff_scheduling: false,
      treatment_coordinator: false, front_desk: false, billing_staff: false, read_only: false,
    },
  },
  // DENY assistant — capture consent (createConsentForm); dentists only
  canCaptureConsent: {
    fn: canCaptureConsent,
    expected: {
      dentist_owner: true, dentist_associate: true,
      dental_assistant: false, hygienist: false, staff_full: false, staff_scheduling: false,
      treatment_coordinator: false, front_desk: false, billing_staff: false, read_only: false,
    },
  },
};

for (const [name, { fn, expected }] of Object.entries(CLINICAL_CAPS)) {
  describe(name, () => {
    for (const role of ALL_ROLES) {
      test(`${name}("${role}") === ${expected[role]}`, () => {
        expect(fn(role)).toBe(expected[role]);
      });
    }
  });
}

// Explicit dental_assistant scope summary (the heart of E2).
describe('dental_assistant clinical-assist scope', () => {
  test('ALLOW: capture imaging, draft notes, edit chart conditions', () => {
    expect(canCaptureImaging('dental_assistant')).toBe(true);
    expect(canDraftNotes('dental_assistant')).toBe(true);
    expect(canEditChart('dental_assistant')).toBe(true);
  });
  test('DENY: sign notes, add treatment, prescribe, capture consent', () => {
    expect(canSignNotes('dental_assistant')).toBe(false);
    expect(canAddTreatment('dental_assistant')).toBe(false);
    expect(canPrescribe('dental_assistant')).toBe(false);
    expect(canCaptureConsent('dental_assistant')).toBe(false);
  });
});
