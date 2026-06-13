/**
 * GAP-011: CHART-BR-002 — baseline immutability
 *
 * Existing/existing_other baseline entries must not be overwritten by
 * treatment_plan or condition entries from visit chart saves.
 */
import { describe, test, expect } from 'bun:test';
import { DentalChartBaselineRepository } from './repos/dental-chart-baseline.repo';

// Access private method via subclass for unit testing.
// SL-12: mergeTeeth now returns { merged, conflicts }; these BR-002 cases assert on
// the merged teeth array.
class TestableRepo extends DentalChartBaselineRepository {
  public testMerge(baseline: any[], incoming: any[]) {
    return (this as any).mergeTeeth(baseline, incoming).merged;
  }
}

const repo = new TestableRepo({} as any);

describe('GAP-011: CHART-BR-002 baseline immutability', () => {
  // CHART-BR-002: completed/treatment_plan must NOT overwrite existing baseline
  test('AC-001: treatment_plan entry does NOT overwrite existing baseline tooth', () => {
    const baseline = [{ toothNumber: 14, state: 'healthy', entryClassification: 'existing' }];
    const incoming = [{ toothNumber: 14, state: 'crown', entryClassification: 'treatment_plan' }];
    const result = repo.testMerge(baseline, incoming);
    const tooth14 = result.find((t: any) => t.toothNumber === 14);
    expect(tooth14?.entryClassification).toBe('existing');
    expect(tooth14?.state).toBe('healthy');
  });

  test('AC-002: condition entry does NOT overwrite existing_other baseline tooth', () => {
    const baseline = [{ toothNumber: 3, state: 'filled', entryClassification: 'existing_other' }];
    const incoming = [{ toothNumber: 3, state: 'caries', entryClassification: 'condition' }];
    const result = repo.testMerge(baseline, incoming);
    const tooth3 = result.find((t: any) => t.toothNumber === 3);
    expect(tooth3?.entryClassification).toBe('existing_other');
  });

  test('AC-003: existing entry CAN overwrite existing baseline (same tier)', () => {
    const baseline = [{ toothNumber: 7, state: 'healthy', entryClassification: 'existing' }];
    const incoming = [{ toothNumber: 7, state: 'extracted', entryClassification: 'existing' }];
    const result = repo.testMerge(baseline, incoming);
    const tooth7 = result.find((t: any) => t.toothNumber === 7);
    expect(tooth7?.state).toBe('extracted');
  });

  test('AC-004: new tooth (no baseline entry) is always added', () => {
    const baseline = [{ toothNumber: 1, state: 'healthy', entryClassification: 'existing' }];
    const incoming = [{ toothNumber: 2, state: 'crown', entryClassification: 'treatment_plan' }];
    const result = repo.testMerge(baseline, incoming);
    expect(result).toHaveLength(2);
  });
});
