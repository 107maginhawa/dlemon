/**
 * PMDViewer component tests — pure logic helpers
 */

import { describe, test, expect } from 'bun:test';

type PMDStatus = 'generated' | 'signed' | 'superseded';

interface PMDDocument {
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

function isPMDSigned(pmd: PMDDocument): boolean {
  return pmd.status === 'signed' && !!pmd.signature;
}

function isPMDSuperseded(pmd: PMDDocument): boolean {
  return pmd.status === 'superseded';
}

function parsePMDContent(pmd: PMDDocument): Record<string, unknown> {
  try {
    return JSON.parse(pmd.content);
  } catch {
    return {};
  }
}

function getStatusBadgeLabel(status: PMDStatus): string {
  switch (status) {
    case 'generated': return 'Generated';
    case 'signed': return 'Signed';
    case 'superseded': return 'Superseded';
  }
}

describe('PMDViewer — status helpers', () => {
  const basePMD: PMDDocument = {
    id: 'pmd-1',
    visitId: 'v-1',
    patientId: 'p-1',
    status: 'generated',
    content: '{"treatments":[],"prescriptions":[]}',
    checksum: 'abc',
    createdAt: '2025-01-01T00:00:00Z',
  };

  test('unsigned PMD is not signed', () => {
    expect(isPMDSigned(basePMD)).toBe(false);
  });

  test('signed PMD with signature is signed', () => {
    const signed = { ...basePMD, status: 'signed' as PMDStatus, signature: 'base64data==' };
    expect(isPMDSigned(signed)).toBe(true);
  });

  test('superseded PMD is superseded', () => {
    const sup = { ...basePMD, status: 'superseded' as PMDStatus };
    expect(isPMDSuperseded(sup)).toBe(true);
  });

  test('generated PMD is not superseded', () => {
    expect(isPMDSuperseded(basePMD)).toBe(false);
  });
});

describe('PMDViewer — content parsing', () => {
  const basePMD: PMDDocument = {
    id: 'pmd-1',
    visitId: 'v-1',
    patientId: 'p-1',
    status: 'generated',
    content: '{"treatments":[{"cdtCode":"D2391"}],"prescriptions":[]}',
    checksum: 'abc',
    createdAt: '2025-01-01T00:00:00Z',
  };

  test('parses valid JSON content', () => {
    const data = parsePMDContent(basePMD);
    expect(Array.isArray((data as any).treatments)).toBe(true);
    expect((data as any).treatments).toHaveLength(1);
  });

  test('returns empty object for invalid JSON', () => {
    const bad = { ...basePMD, content: 'not-json' };
    const data = parsePMDContent(bad);
    expect(data).toEqual({});
  });
});

describe('PMDViewer — status labels', () => {
  test('generated label', () => expect(getStatusBadgeLabel('generated')).toBe('Generated'));
  test('signed label', () => expect(getStatusBadgeLabel('signed')).toBe('Signed'));
  test('superseded label', () => expect(getStatusBadgeLabel('superseded')).toBe('Superseded'));
});
