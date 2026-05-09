/**
 * PMDImport component tests — pure logic helpers
 */

import { describe, test, expect } from 'bun:test';

interface ImportPMDForm {
  sourceFacility: string;
  sourceReference: string;
  content: string;
}

function validateImportForm(form: ImportPMDForm): string[] {
  const errors: string[] = [];
  if (!form.sourceFacility.trim()) errors.push('Source facility is required');
  if (!form.content.trim()) errors.push('PMD content is required');
  // Try to parse content as JSON
  if (form.content.trim()) {
    try {
      JSON.parse(form.content);
    } catch {
      errors.push('PMD content must be valid JSON');
    }
  }
  return errors;
}

interface SafetyFloorMergePreview {
  conditions: string[];
  medications: string[];
  allergies: string[];
}

function extractSafetyFloorPreview(content: string): SafetyFloorMergePreview {
  try {
    const data = JSON.parse(content);
    return {
      conditions: Array.isArray(data.conditions) ? data.conditions : [],
      medications: Array.isArray(data.medications) ? data.medications : [],
      allergies: Array.isArray(data.allergies) ? data.allergies : [],
    };
  } catch {
    return { conditions: [], medications: [], allergies: [] };
  }
}

describe('PMDImport — form validation', () => {
  const valid: ImportPMDForm = {
    sourceFacility: 'City Dental Clinic',
    sourceReference: 'REF-001',
    content: '{"conditions":["I10"],"medications":["Amoxicillin"]}',
  };

  test('valid form produces no errors', () => {
    expect(validateImportForm(valid)).toHaveLength(0);
  });

  test('missing sourceFacility produces error', () => {
    const errors = validateImportForm({ ...valid, sourceFacility: '' });
    expect(errors).toContain('Source facility is required');
  });

  test('missing content produces error', () => {
    const errors = validateImportForm({ ...valid, content: '' });
    expect(errors).toContain('PMD content is required');
  });

  test('invalid JSON content produces error', () => {
    const errors = validateImportForm({ ...valid, content: 'not-valid-json' });
    expect(errors).toContain('PMD content must be valid JSON');
  });

  test('sourceReference is optional', () => {
    const errors = validateImportForm({ ...valid, sourceReference: '' });
    expect(errors).toHaveLength(0);
  });
});

describe('PMDImport — Safety Floor preview', () => {
  test('extracts conditions from content', () => {
    const preview = extractSafetyFloorPreview('{"conditions":["I10","K02"],"medications":[]}');
    expect(preview.conditions).toEqual(['I10', 'K02']);
  });

  test('extracts medications from content', () => {
    const preview = extractSafetyFloorPreview('{"medications":["Amoxicillin","Metformin"]}');
    expect(preview.medications).toEqual(['Amoxicillin', 'Metformin']);
  });

  test('extracts allergies from content', () => {
    const preview = extractSafetyFloorPreview('{"allergies":["Penicillin"]}');
    expect(preview.allergies).toEqual(['Penicillin']);
  });

  test('returns empty arrays for invalid JSON', () => {
    const preview = extractSafetyFloorPreview('bad-json');
    expect(preview.conditions).toHaveLength(0);
    expect(preview.medications).toHaveLength(0);
    expect(preview.allergies).toHaveLength(0);
  });

  test('returns empty arrays for missing fields', () => {
    const preview = extractSafetyFloorPreview('{}');
    expect(preview.conditions).toHaveLength(0);
    expect(preview.medications).toHaveLength(0);
  });
});
