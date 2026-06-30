/**
 * audit-phi-sanitizer.test.ts — G-33 (prod-readiness audit)
 *
 * The audit before/after snapshot sanitizer stripped the exact key `address`, but a
 * person's address is stored as `primaryAddress` (jsonb) whose children are
 * street1/street2/city/state/postalCode — none blocklisted — so a person/patient
 * row snapshot retained the full street address (PHI) in the append-only audit log.
 * The blocklist must cover the address container + its components.
 */

import { describe, test, expect } from 'bun:test';
import { sanitizeAuditField } from './audit-phi-sanitizer';

describe('G-33: audit PHI sanitizer strips address PHI', () => {
  test('nested primaryAddress (the person/patient shape) is stripped', () => {
    const before = {
      id: 'p-1',
      status: 'active', // non-PHI structural field must survive
      firstName: 'Jane',
      primaryAddress: { street1: '12 Mabini St', street2: 'Unit 4', city: 'Manila', state: 'NCR', postalCode: '1000' },
    };
    const clean = sanitizeAuditField(before)!;
    expect(clean['id']).toBe('p-1');
    expect(clean['status']).toBe('active');
    expect(clean['firstName']).toBeUndefined(); // already blocklisted
    expect(clean['primaryAddress']).toBeUndefined(); // G-33: the whole address object gone
    // and no street fragment survives anywhere in the serialized snapshot
    expect(JSON.stringify(clean)).not.toContain('Mabini');
    expect(JSON.stringify(clean)).not.toContain('1000');
  });

  test('flattened address-component keys (an address PATCH body) are stripped', () => {
    const clean = sanitizeAuditField({
      street1: '99 Rizal Ave',
      city: 'Cebu',
      state: 'Cebu',
      postalCode: '6000',
      keptField: 'ok',
    })!;
    expect(clean['keptField']).toBe('ok');
    expect(JSON.stringify(clean)).not.toContain('Rizal');
    expect(JSON.stringify(clean)).not.toContain('6000');
  });
});
