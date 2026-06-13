/**
 * PrintableDocument — shared print primitive contract tests (AHA FIX-008).
 *
 * This is the single print-view primitive that the billing receipt consumes
 * now, and the dental-patient statement + case-presentation estimate will
 * consume later. Its contract is pinned BEFORE those consumers exist so a
 * breaking change to it is caught. It is a thin component over the EXISTING
 * print stylesheet conventions in globals.css (.no-print / .print-receipt /
 * .print-a4) — not a new print framework.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { PrintableDocument } from './printable-document';

afterEach(cleanup);

describe('PrintableDocument — shared print primitive', () => {
  test('renders the document title (aria-label) and children', () => {
    render(
      React.createElement(PrintableDocument, { title: 'Test Doc', onPrint: () => {} },
        React.createElement('p', null, 'body content')),
    );
    expect(screen.getByText('body content')).toBeDefined();
    expect(screen.getByLabelText('Test Doc')).toBeDefined();
  });

  test('applies the receipt layout class when layout="receipt"', () => {
    render(
      React.createElement(PrintableDocument, { title: 'R', layout: 'receipt', onPrint: () => {} },
        React.createElement('span', null, 'x')),
    );
    expect(screen.getByLabelText('R').className).toContain('print-receipt');
  });

  test('marks the document region with .print-document (drives print isolation)', () => {
    render(
      React.createElement(PrintableDocument, { title: 'R', layout: 'receipt', onPrint: () => {} },
        React.createElement('span', null, 'x')),
    );
    // The globals.css :has(.print-document) isolation rule depends on this class.
    expect(screen.getByLabelText('R').className).toContain('print-document');
  });

  test('defaults to the a4 layout class', () => {
    render(
      React.createElement(PrintableDocument, { title: 'A', onPrint: () => {} },
        React.createElement('span', null, 'x')),
    );
    expect(screen.getByLabelText('A').className).toContain('print-a4');
  });

  test('the Print button is inside a .no-print region (it must not appear on paper)', () => {
    render(
      React.createElement(PrintableDocument, { title: 'A', onPrint: () => {} },
        React.createElement('span', null, 'x')),
    );
    const btn = screen.getByRole('button', { name: /print/i });
    expect(btn.closest('.no-print')).not.toBeNull();
  });

  test('clicking Print invokes the injected print handler (test seam over window.print)', () => {
    let printed = 0;
    render(
      React.createElement(PrintableDocument, { title: 'A', onPrint: () => { printed++; } },
        React.createElement('span', null, 'x')),
    );
    fireEvent.click(screen.getByRole('button', { name: /print/i }));
    expect(printed).toBe(1);
  });
});
