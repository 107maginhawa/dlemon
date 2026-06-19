/**
 * Proves the P6 spec-request-validator (VERIFICATION_HARDENING.md): a request BODY
 * that violates the OpenAPI contract FAILS a unit test, GRADED BY THE SPEC rather than
 * by a hand-authored mock. This exercises the pure core (`validateRequestBody`) — the
 * same function the SDK request interceptor (`installSpecRequestValidator`) uses — so
 * the proof has zero global side effects.
 *
 * If the OpenAPI build artifact is absent (spec not built in this environment) the
 * validator degrades to a no-op; these proofs then skip so the rest of the suite is
 * unaffected. Locally (and after `cd specs/api && bun run build`) it is active.
 */
import { describe, test, expect } from 'bun:test'
import { validateRequestBody, isSpecRequestValidatorActive } from './spec-request-validator'

// Shape-valid CreateDentalVisitRequest (uuid format is not enforced; values are strings).
const VALID_BODY = {
  patientId: '11111111-1111-1111-1111-111111111111',
  branchId: '22222222-2222-2222-2222-222222222222',
  dentistMemberId: '33333333-3333-3333-3333-333333333333',
}

const guard = isSpecRequestValidatorActive() ? test : test.skip

describe('P6 spec-request-validator', () => {
  guard('a missing REQUIRED field is rejected by the spec', () => {
    // Omit dentistMemberId (required by CreateDentalVisitRequest).
    const r = validateRequestBody('post', '/dental/visits', {
      patientId: VALID_BODY.patientId,
      branchId: VALID_BODY.branchId,
    })
    expect(r.ok, `expected rejection, got: ${r.errors}`).toBe(false)
    expect(r.errors).toMatch(/dentistMemberId|required/i)
  })

  guard('an invalid ENUM value (visitType) is rejected by the spec', () => {
    const r = validateRequestBody('post', '/dental/visits', { ...VALID_BODY, visitType: 'BOGUS' })
    expect(r.ok, `expected enum rejection, got: ${r.errors}`).toBe(false)
  })

  guard('a wrong scalar TYPE is rejected by the spec', () => {
    const r = validateRequestBody('post', '/dental/visits', { ...VALID_BODY, chiefComplaint: 123 })
    expect(r.ok, `expected type rejection, got: ${r.errors}`).toBe(false)
  })

  guard('a spec-VALID request body passes', () => {
    const r = validateRequestBody('post', '/dental/visits', VALID_BODY)
    expect(r.ok, `expected pass, got: ${r.errors}`).toBe(true)
  })

  guard('an operation with no JSON request body is not graded (no false negative)', () => {
    // A bodyless GET operation has no requestBody schema → never fails.
    expect(validateRequestBody('get', '/dental/visits', undefined).ok).toBe(true)
  })
})
