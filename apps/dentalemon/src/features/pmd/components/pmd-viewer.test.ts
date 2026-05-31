/**
 * PMDViewer component tests
 *
 * Renders the SHIPPED PMDViewer (a presentational component) and asserts what it
 * actually shows for each PMD status and content shape. The previous version
 * asserted re-declared isPMDSigned / parsePMDContent / getStatusBadgeLabel
 * helpers that the component does not export — it never rendered anything.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { PMDViewer } from './pmd-viewer';
import type { PMDDocument } from '../types';

function makePMD(overrides: Partial<PMDDocument> = {}): PMDDocument {
  return {
    id: 'pmd-1',
    visitId: 'v-1',
    patientId: 'p-1',
    status: 'generated',
    content: '{"treatments":[],"prescriptions":[]}',
    checksum: 'abc123def456',
    createdAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(cleanup);

describe('PMDViewer — shipped component', () => {
  test('renders treatments and prescriptions parsed from content', () => {
    render(React.createElement(PMDViewer, {
      pmd: makePMD({
        content: JSON.stringify({
          treatments: [{ cdtCode: 'D2391', description: 'Composite Filling', toothNumber: 16, priceCents: 250000 }],
          prescriptions: [{ drugName: 'Amoxicillin', dosage: '500mg', frequency: 'TID', rxNormCode: '723' }],
        }),
      }),
    }));

    expect(screen.getByTestId('pmd-viewer')).not.toBeNull();
    expect(screen.getByText('D2391')).not.toBeNull();
    expect(screen.getByText('Composite Filling')).not.toBeNull();
    expect(screen.getByText('Amoxicillin')).not.toBeNull();
    expect(screen.getByText(/500mg · TID/)).not.toBeNull();
    expect(screen.getByText(/SHA: abc123def456/)).not.toBeNull();
    expect(screen.getByText('Generated')).not.toBeNull();
  });

  test('a signed PMD shows the Signed badge + signature banner', () => {
    render(React.createElement(PMDViewer, {
      pmd: makePMD({ status: 'signed', signature: 'base64sig==', signedAt: '2026-01-11T09:30:00.000Z' }),
    }));
    expect(screen.getByText('Signed')).not.toBeNull();
    expect(screen.getByText(/Digitally signed on/)).not.toBeNull();
  });

  test('a superseded PMD shows the supersession notice', () => {
    render(React.createElement(PMDViewer, { pmd: makePMD({ status: 'superseded' }) }));
    expect(screen.getByText('Superseded')).not.toBeNull();
    expect(screen.getByText(/superseded by a newer version/i)).not.toBeNull();
  });

  test('empty clinical content shows the no-data message', () => {
    render(React.createElement(PMDViewer, {
      pmd: makePMD({ content: '{"treatments":[],"prescriptions":[]}' }),
    }));
    expect(screen.getByText('No clinical data recorded.')).not.toBeNull();
  });

  test('invalid JSON content renders without crashing (treated as empty)', () => {
    render(React.createElement(PMDViewer, { pmd: makePMD({ content: 'not-json' }) }));
    // Component must still render its shell + checksum rather than throw.
    expect(screen.getByTestId('pmd-viewer')).not.toBeNull();
    expect(screen.getByText(/SHA: abc123def456/)).not.toBeNull();
  });
});
