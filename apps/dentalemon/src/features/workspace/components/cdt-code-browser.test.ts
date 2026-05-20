/**
 * CdtCodeBrowser — unit tests for pure logic
 *
 * Tests filtering, specialty tabs, and localStorage favorites/recents logic.
 * Component rendering is covered by integration tests; here we focus on
 * the data transformations used by the component.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import cdtCodes from '@/data/cdt-codes.json';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CdtCodeEntry {
  code: string;
  description: string;
  category: string;
  specialty: string;
  defaultPriceCents: number;
}

const ALL_CODES = cdtCodes as CdtCodeEntry[];

// ─── Filtering helpers (mirrors component logic) ──────────────────────────────

function filterCodes(codes: CdtCodeEntry[], search: string, specialty: string): CdtCodeEntry[] {
  const q = search.trim().toLowerCase();
  return codes.filter(c => {
    const matchesSpecialty = specialty === 'All' || c.specialty === specialty;
    const matchesSearch = !q || c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    return matchesSpecialty && matchesSearch;
  });
}

// ─── localStorage helpers (mirrors component logic) ───────────────────────────

const MAX_FAVORITES = 20;
const MAX_RECENTS = 10;

function favKey(memberId: string) { return `dentalemon:cdt-favorites:${memberId}`; }
function recentKey(memberId: string) { return `dentalemon:cdt-recents:${memberId}`; }

function readJsonArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeJsonArray(key: string, arr: string[]) {
  localStorage.setItem(key, JSON.stringify(arr));
}

function toggleFavorite(memberId: string, code: string): string[] {
  const prev = readJsonArray(favKey(memberId));
  const next = prev.includes(code)
    ? prev.filter(c => c !== code)
    : [code, ...prev].slice(0, MAX_FAVORITES);
  writeJsonArray(favKey(memberId), next);
  return next;
}

function addRecent(memberId: string, code: string): string[] {
  const prev = readJsonArray(recentKey(memberId));
  const deduped = [code, ...prev.filter(c => c !== code)].slice(0, MAX_RECENTS);
  writeJsonArray(recentKey(memberId), deduped);
  return deduped;
}

// ─── CDT catalog integrity ────────────────────────────────────────────────────

describe('cdt-codes.json catalog', () => {
  test('catalog has at least 80 entries', () => {
    expect(ALL_CODES.length).toBeGreaterThanOrEqual(80);
  });

  test('every entry has required fields', () => {
    for (const entry of ALL_CODES) {
      expect(typeof entry.code).toBe('string');
      expect(entry.code.length).toBeGreaterThan(0);
      expect(typeof entry.description).toBe('string');
      expect(entry.description.length).toBeGreaterThan(0);
      expect(typeof entry.specialty).toBe('string');
      expect(typeof entry.defaultPriceCents).toBe('number');
      expect(entry.defaultPriceCents).toBeGreaterThanOrEqual(0);
    }
  });

  test('CDT codes start with D followed by digits', () => {
    for (const entry of ALL_CODES) {
      expect(entry.code).toMatch(/^D\d+$/);
    }
  });

  test('all 8 specialties have at least 5 entries each', () => {
    const specialties = ['General', 'Endo', 'Perio', 'Prostho', 'OralSurgery', 'Ortho', 'Pedia', 'Cosmetic'];
    for (const specialty of specialties) {
      const count = ALL_CODES.filter(c => c.specialty === specialty).length;
      expect(count).toBeGreaterThanOrEqual(5);
    }
  });
});

// ─── Search filtering ─────────────────────────────────────────────────────────

describe('filterCodes — search', () => {
  test('empty search returns all codes', () => {
    const result = filterCodes(ALL_CODES, '', 'All');
    expect(result.length).toBe(ALL_CODES.length);
  });

  test('matches code prefix case-insensitively', () => {
    const result = filterCodes(ALL_CODES, 'd2140', 'All');
    expect(result.some(c => c.code === 'D2140')).toBe(true);
  });

  test('matches description substring case-insensitively', () => {
    const result = filterCodes(ALL_CODES, 'amalgam', 'All');
    expect(result.length).toBeGreaterThan(0);
    for (const c of result) {
      expect(c.description.toLowerCase()).toContain('amalgam');
    }
  });

  test('returns empty when no match', () => {
    const result = filterCodes(ALL_CODES, 'xyznotexist123', 'All');
    expect(result.length).toBe(0);
  });

  test('whitespace is trimmed before matching', () => {
    const trimmed = filterCodes(ALL_CODES, '  D0120  ', 'All');
    const exact = filterCodes(ALL_CODES, 'D0120', 'All');
    expect(trimmed.length).toBe(exact.length);
  });
});

// ─── Specialty tab filtering ──────────────────────────────────────────────────

describe('filterCodes — specialty', () => {
  test('"All" returns codes from all specialties', () => {
    const result = filterCodes(ALL_CODES, '', 'All');
    const specialties = new Set(result.map(c => c.specialty));
    expect(specialties.size).toBeGreaterThan(1);
  });

  test('filtering by "Endo" returns only Endo codes', () => {
    const result = filterCodes(ALL_CODES, '', 'Endo');
    expect(result.length).toBeGreaterThan(0);
    for (const c of result) {
      expect(c.specialty).toBe('Endo');
    }
  });

  test('specialty + search compound filter works', () => {
    // Search for root canal within Endo only
    const result = filterCodes(ALL_CODES, 'root canal', 'Endo');
    for (const c of result) {
      expect(c.specialty).toBe('Endo');
      expect(c.description.toLowerCase()).toContain('root canal');
    }
  });

  test('specialty filter returns 0 for non-matching search', () => {
    const result = filterCodes(ALL_CODES, 'orthodontic', 'Endo');
    expect(result.length).toBe(0);
  });
});

// ─── Favorites ────────────────────────────────────────────────────────────────

describe('favorites — localStorage', () => {
  const memberId = 'test-member-1';

  beforeEach(() => {
    localStorage.removeItem(favKey(memberId));
  });

  test('starts empty', () => {
    expect(readJsonArray(favKey(memberId))).toEqual([]);
  });

  test('adding a favorite stores it', () => {
    const result = toggleFavorite(memberId, 'D2140');
    expect(result).toContain('D2140');
    expect(readJsonArray(favKey(memberId))).toContain('D2140');
  });

  test('adding same code twice removes it (toggle off)', () => {
    toggleFavorite(memberId, 'D2140');
    const result = toggleFavorite(memberId, 'D2140');
    expect(result).not.toContain('D2140');
  });

  test('most recently favorited code is first', () => {
    toggleFavorite(memberId, 'D0120');
    const result = toggleFavorite(memberId, 'D2140');
    expect(result[0]).toBe('D2140');
  });

  test('capped at MAX_FAVORITES (20)', () => {
    for (let i = 0; i < 25; i++) {
      toggleFavorite(memberId, `D${String(i).padStart(4, '0')}`);
    }
    expect(readJsonArray(favKey(memberId)).length).toBeLessThanOrEqual(MAX_FAVORITES);
  });

  test('different memberIds are isolated', () => {
    const other = 'test-member-2';
    localStorage.removeItem(favKey(other));

    toggleFavorite(memberId, 'D2140');
    const otherFavs = readJsonArray(favKey(other));
    expect(otherFavs).not.toContain('D2140');

    localStorage.removeItem(favKey(other));
  });
});

// ─── Recents ─────────────────────────────────────────────────────────────────

describe('recents — localStorage', () => {
  const memberId = 'test-member-recents';

  beforeEach(() => {
    localStorage.removeItem(recentKey(memberId));
  });

  test('starts empty', () => {
    expect(readJsonArray(recentKey(memberId))).toEqual([]);
  });

  test('adds code to front', () => {
    const result = addRecent(memberId, 'D0120');
    expect(result[0]).toBe('D0120');
  });

  test('deduplicates — re-selecting moves code to front', () => {
    addRecent(memberId, 'D0120');
    addRecent(memberId, 'D2140');
    const result = addRecent(memberId, 'D0120');
    expect(result[0]).toBe('D0120');
    expect(result.filter(c => c === 'D0120').length).toBe(1);
  });

  test('capped at MAX_RECENTS (10), FIFO eviction', () => {
    for (let i = 0; i < 15; i++) {
      addRecent(memberId, `D${String(i).padStart(4, '0')}`);
    }
    const stored = readJsonArray(recentKey(memberId));
    expect(stored.length).toBeLessThanOrEqual(MAX_RECENTS);
    // Last added should be first
    expect(stored[0]).toBe('D0014');
  });
});
