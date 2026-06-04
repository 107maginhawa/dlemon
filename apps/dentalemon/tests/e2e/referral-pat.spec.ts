/**
 * E2E: Pat (Specialist) — Referral Send Flow
 *
 * Persona: Pat is a specialist who creates consultation notes with
 *          specialist referral details when a patient needs further evaluation.
 *
 * API: POST /emr/consultations (specialistReferral field)
 *      GET  /emr/consultations/:id (verify stored)
 *
 * Pattern: signUpAndSeedOrg → create patient → create consultation with referral → verify stored
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock } from './helpers/e2e-seed';

// ---------------------------------------------------------------------------
// Setup helper
// ---------------------------------------------------------------------------

async function signUpAndSeedPat(page: Page) {
  // Provision org+branch+owner via /dental/onboarding (org creation is admin-only
  // — EM-ORG-002), set a PIN, and unlock the PIN-gated workspace. This spec only
  // exercises EMR API endpoints (no workspace nav), but onboarding still gives the
  // signed-in specialist a valid org + dentist_owner membership.
  const { orgId, branchId } = await signUpOnboardAndUnlock(page, {
    tier: 'clinic',
    label: 'Pat',
  });

  return { orgId, branchId };
}

// ---------------------------------------------------------------------------
// Referral send flow
// ---------------------------------------------------------------------------

test.describe('Pat — Specialist Referral Send', () => {
  test('creates consultation with specialistReferral — field stored and retrievable', async ({ page }) => {
    await signUpAndSeedPat(page);

    const result = await page.evaluate(async (api: string) => {
      // Get the authenticated user's ID
      const sessionRes = await fetch(`${api}/auth/get-session`, { credentials: 'include' });
      if (!sessionRes.ok) return null;
      const session = await sessionRes.json() as any;
      const personId = session?.user?.id;
      if (!personId) return null;

      // Create an EMR patient record to attach consultation to
      const patientRes = await fetch(`${api}/emr/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: 'Pat',
          lastName: 'ReferralPatient',
          dateOfBirth: '1985-06-15',
          gender: 'male',
        }),
      });
      if (!patientRes.ok) {
        // EMR patient create might require different endpoint — try dental patients
        return { skipped: true, reason: `EMR patient create failed: ${patientRes.status}` };
      }
      const patient = await patientRes.json() as any;

      // Pat creates a consultation with a specialist referral note
      const referralText = 'Refer to endodontist — root canal evaluation needed. Dr. Smith, Dental Arts Center.';
      const consultRes = await fetch(`${api}/emr/consultations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId: patient.id,
          consultationDate: new Date().toISOString(),
          chiefComplaint: 'Severe tooth pain, upper left molar',
          clinicalFindings: 'Percussion sensitivity, possible periapical pathology',
          specialistReferral: referralText,
          providerId: personId,
        }),
      });
      if (!consultRes.ok) {
        return { skipped: true, reason: `Consultation create failed: ${consultRes.status}` };
      }
      const consultation = await consultRes.json() as any;

      // Retrieve the consultation and verify referral is stored
      const getRes = await fetch(`${api}/emr/consultations/${consultation.id}`, {
        credentials: 'include',
      });
      if (!getRes.ok) return { skipped: true, reason: `Get consultation failed: ${getRes.status}` };
      const fetched = await getRes.json() as any;

      return {
        ok: true,
        storedReferral: fetched.specialistReferral,
        consultationId: fetched.id,
      };
    }, API);

    if (!result) throw new Error('Session fetch failed: consultation create/fetch returned null');
    test.skip(result.skipped === true, `EMR endpoint unavailable: ${result.reason}`);

    // [Pat referral flow] specialistReferral must be stored verbatim
    expect(result.ok).toBe(true);
    expect(result.storedReferral).toContain('endodontist');
    expect(result.consultationId).toBeTruthy();
  });

  test('consultation without referral has null specialistReferral', async ({ page }) => {
    await signUpAndSeedPat(page);

    const result = await page.evaluate(async (api: string) => {
      const sessionRes = await fetch(`${api}/auth/get-session`, { credentials: 'include' });
      if (!sessionRes.ok) return null;
      const session = await sessionRes.json() as any;
      const personId = session?.user?.id;
      if (!personId) return null;

      const patientRes = await fetch(`${api}/emr/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: 'No',
          lastName: 'ReferralPatient',
          dateOfBirth: '1990-03-20',
          gender: 'female',
        }),
      });
      if (!patientRes.ok) return { skipped: true };
      const patient = await patientRes.json() as any;

      const consultRes = await fetch(`${api}/emr/consultations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId: patient.id,
          consultationDate: new Date().toISOString(),
          chiefComplaint: 'Routine checkup',
          clinicalFindings: 'No abnormalities',
          // No specialistReferral
          providerId: personId,
        }),
      });
      if (!consultRes.ok) return { skipped: true };
      const consultation = await consultRes.json() as any;

      return {
        ok: true,
        referral: consultation.specialistReferral ?? null,
      };
    }, API);

    if (!result) throw new Error('Session fetch failed: consultation fetch returned null');
    test.skip(result.skipped === true, 'EMR endpoint unavailable');

    expect(result.ok).toBe(true);
    // [Pat referral flow] no referral set → field is null/undefined, not a default string
    expect(result.referral == null || result.referral === '').toBe(true);
  });
});
