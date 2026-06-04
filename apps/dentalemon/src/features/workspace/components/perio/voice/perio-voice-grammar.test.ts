/**
 * Tier 1 — parseUtterance grammar tests (the bulk of the voice logic).
 *
 * Pure string → ParsedCommand[]: digit words & numerals, the "three two three"
 * triple cadence → 3 depths, signed recession, keyword flags, grades + furcation
 * soft-gate, navigation words, homophone normalization, range rejection, and
 * ambiguity/low-confidence flagging. No DOM, no engine, no network.
 */

import { describe, test, expect } from 'bun:test';
import {
  parseUtterance,
  normalizeTranscript,
  HOMOPHONE_TABLE,
  type ParsedCommand,
} from './perio-voice-grammar';

function depthValues(cmds: ParsedCommand[]): number[] | null {
  const d = cmds.find((c) => c.kind === 'depth');
  return d && d.kind === 'depth' ? d.values : null;
}

describe('normalizeTranscript', () => {
  test('lower-cases, strips punctuation, splits on whitespace (number words kept for the parser)', () => {
    expect(normalizeTranscript('Three, Two. Three!')).toEqual(['three', 'two', 'three']);
    expect(normalizeTranscript('3, 2. 3!')).toEqual(['3', '2', '3']);
  });

  test('applies the homophone table (to/too/two, for/four, tree, ate, won)', () => {
    expect(normalizeTranscript('to')).toEqual(['2']);
    expect(normalizeTranscript('too')).toEqual(['2']);
    expect(normalizeTranscript('for')).toEqual(['4']);
    expect(normalizeTranscript('tree')).toEqual(['3']);
    expect(normalizeTranscript('ate')).toEqual(['8']);
    expect(normalizeTranscript('won')).toEqual(['1']);
  });

  test('drops unit-noise tokens (millimeters / mil / mm)', () => {
    // number WORDS are kept for the parser; unit noise is removed.
    expect(normalizeTranscript('three millimeters')).toEqual(['three']);
    expect(normalizeTranscript('4 mm')).toEqual(['4']);
  });

  test('the homophone table is the documented, table-driven source', () => {
    expect(HOMOPHONE_TABLE.tree).toBe('3');
    expect(HOMOPHONE_TABLE.ate).toBe('8');
  });
});

describe('parseUtterance — depths', () => {
  test('single digit numeral', () => {
    expect(depthValues(parseUtterance('3'))).toEqual([3]);
  });

  test('single number word', () => {
    expect(depthValues(parseUtterance('three'))).toEqual([3]);
  });

  test('triple cadence "three two three" → three depths', () => {
    expect(depthValues(parseUtterance('three two three'))).toEqual([3, 2, 3]);
  });

  test('triple cadence with numerals "3 2 3"', () => {
    expect(depthValues(parseUtterance('3 2 3'))).toEqual([3, 2, 3]);
  });

  test('homophones inside a cadence ("tree two tree")', () => {
    expect(depthValues(parseUtterance('tree two tree'))).toEqual([3, 2, 3]);
  });

  test('depth >20 is flagged out-of-range (not silently written)', () => {
    const cmds = parseUtterance('25');
    const d = cmds.find((c) => c.kind === 'depth');
    expect(d?.kind === 'depth' && d.outOfRange).toBe(true);
  });

  test('boundary depths 0 and 20 are in range', () => {
    expect(parseUtterance('0').some((c) => c.kind === 'depth' && !c.outOfRange)).toBe(true);
    expect(parseUtterance('20').some((c) => c.kind === 'depth' && !c.outOfRange)).toBe(true);
  });
});

describe('parseUtterance — recession / gingival margin', () => {
  test('"recession three" → +3', () => {
    const c = parseUtterance('recession three').find((x) => x.kind === 'recession');
    expect(c?.kind === 'recession' && c.value).toBe(3);
  });

  test('"minus two" → -2 recession', () => {
    const c = parseUtterance('minus two').find((x) => x.kind === 'recession');
    expect(c?.kind === 'recession' && c.value).toBe(-2);
  });

  test('"gum margin minus one" → -1', () => {
    const c = parseUtterance('gum margin minus one').find((x) => x.kind === 'recession');
    expect(c?.kind === 'recession' && c.value).toBe(-1);
  });

  test('recession below -5 is out of range', () => {
    const c = parseUtterance('minus six').find((x) => x.kind === 'recession');
    expect(c?.kind === 'recession' && c.outOfRange).toBe(true);
  });

  test('boundary margins -5 and 20 are in range', () => {
    const lo = parseUtterance('recession minus five').find((x) => x.kind === 'recession');
    expect(lo?.kind === 'recession' && lo.outOfRange).toBeFalsy();
    const hi = parseUtterance('recession twenty').find((x) => x.kind === 'recession');
    expect(hi?.kind === 'recession' && hi.outOfRange).toBeFalsy();
  });
});

describe('parseUtterance — flags', () => {
  test('"bleeding" / "BOP" → bleeding flag', () => {
    expect(parseUtterance('bleeding')[0]).toMatchObject({ kind: 'flag', flag: 'bleeding' });
    expect(parseUtterance('BOP')[0]).toMatchObject({ kind: 'flag', flag: 'bleeding' });
  });

  test('"pus" / "suppuration" → suppuration flag', () => {
    expect(parseUtterance('pus')[0]).toMatchObject({ kind: 'flag', flag: 'suppuration' });
    expect(parseUtterance('suppuration')[0]).toMatchObject({ kind: 'flag', flag: 'suppuration' });
  });

  test('"plaque" → plaque flag', () => {
    expect(parseUtterance('plaque')[0]).toMatchObject({ kind: 'flag', flag: 'plaque' });
  });

  test('a depth then a flag yields two commands in order', () => {
    const cmds = parseUtterance('three bleeding');
    expect(cmds[0].kind).toBe('depth');
    expect(cmds[1]).toMatchObject({ kind: 'flag', flag: 'bleeding' });
  });
});

describe('parseUtterance — grades', () => {
  test('"mobility two" → mobility 2', () => {
    expect(parseUtterance('mobility two')[0]).toMatchObject({ kind: 'grade', grade: 'mobility', value: 2 });
  });

  test('"furcation grade three" → furcation 3 (multi-rooted molar 16)', () => {
    expect(parseUtterance('furcation grade three', { currentTooth: 16 })[0]).toMatchObject({
      kind: 'grade',
      grade: 'furcation',
      value: 3,
    });
  });

  test('grade >3 is out of range', () => {
    const c = parseUtterance('mobility four')[0];
    expect(c.kind === 'grade' && c.outOfRange).toBe(true);
  });

  test('furcation on a single-rooted tooth (incisor 11) is ignored (soft-gate)', () => {
    const c = parseUtterance('furcation two', { currentTooth: 11 })[0];
    expect(c.kind === 'grade' && c.ignored).toBe(true);
  });

  test('furcation with no current tooth is NOT ignored', () => {
    const c = parseUtterance('furcation two')[0];
    expect(c.kind === 'grade' && c.ignored).toBeFalsy();
  });
});

describe('parseUtterance — navigation', () => {
  const cases: Array<[string, string]> = [
    ['next tooth', 'next'],
    ['back', 'back'],
    ['previous', 'back'],
    ['skip', 'skip'],
    ['missing', 'missing'],
    ['redo', 'redo'],
    ['correct', 'correct'],
    ['stop', 'stop'],
    ['pause', 'stop'],
  ];
  for (const [phrase, nav] of cases) {
    test(`"${phrase}" → nav ${nav}`, () => {
      expect(parseUtterance(phrase).some((c) => c.kind === 'nav' && c.nav === nav)).toBe(true);
    });
  }

  test('"go to tooth twenty six" → jump 26', () => {
    expect(parseUtterance('go to tooth twenty')[0]).toMatchObject({ kind: 'jump', tooth: 20 });
    expect(parseUtterance('tooth 26')[0]).toMatchObject({ kind: 'jump', tooth: 26 });
  });
});

describe('parseUtterance — confidence + ambiguity', () => {
  test('confidence is carried onto every command', () => {
    const cmds = parseUtterance('three', { confidence: 0.42 });
    expect(cmds[0].confidence).toBe(0.42);
  });

  test('"recession" with no number is ambiguous', () => {
    const c = parseUtterance('recession').find((x) => x.kind === 'recession');
    expect(c?.ambiguous).toBe(true);
  });

  test('"mobility" with no number is ambiguous', () => {
    const c = parseUtterance('mobility')[0];
    expect(c.kind === 'grade' && c.ambiguous).toBe(true);
  });

  test('unrecognized speech yields no commands', () => {
    expect(parseUtterance('the quick brown fox')).toEqual([]);
  });
});
