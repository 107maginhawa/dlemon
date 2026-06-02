/**
 * perio-voice-grammar.ts — Phase A pure core #1.
 *
 * `parseUtterance(transcript, ctx) → ParsedCommand[]`: turns a normalized
 * spoken transcript into zero or more structured perio commands. NO DOM, NO
 * network, NO speech engine — just string → command. This is the heart of the
 * voice feature's test plan (plan 09 §3.2 / §4 Tier 1).
 *
 * Value bounds are kept in EXACT parity with the backend validators so voice can
 * never produce a body the API will 422:
 *   - depths            0–20   (assertValidDepths, perio-validation.ts)
 *   - recession / GM    −5..20 (assertValidGingivalMargins / recession bound)
 *   - mobility/furcation 0–3   (assertValidGrades)
 * (plan 09 §4 "Value-bounds parity tests".)
 *
 * Furcation is soft-gated to multi-rooted teeth (reuses `isSingleRooted` from
 * perio-types) — on a single-rooted tooth a furcation command is rejected with
 * an `ignored` reason rather than written, mirroring the grid soft-gate.
 */

import { isSingleRooted } from '../perio-types';

// ---------------------------------------------------------------------------
// Bounds — MUST match services/api-ts/.../perio-validation.ts exactly.
// ---------------------------------------------------------------------------

export const VOICE_DEPTH_MIN = 0;
export const VOICE_DEPTH_MAX = 20;
export const VOICE_MARGIN_MIN = -5; // recession / gingival margin lower bound
export const VOICE_MARGIN_MAX = 20;
export const VOICE_GRADE_MIN = 0;
export const VOICE_GRADE_MAX = 3;

export function isDepthInRange(n: number): boolean {
  return Number.isInteger(n) && n >= VOICE_DEPTH_MIN && n <= VOICE_DEPTH_MAX;
}
export function isMarginInRange(n: number): boolean {
  return Number.isInteger(n) && n >= VOICE_MARGIN_MIN && n <= VOICE_MARGIN_MAX;
}
export function isGradeInRange(n: number): boolean {
  return Number.isInteger(n) && n >= VOICE_GRADE_MIN && n <= VOICE_GRADE_MAX;
}

// ---------------------------------------------------------------------------
// Parsed command model.
// ---------------------------------------------------------------------------

export type NavCommand =
  | 'next' // next tooth
  | 'back' // one site/field back
  | 'skip' // leave current site null, advance
  | 'missing' // mark current tooth missing, jump to next
  | 'redo' // re-enter the just-spoken value (clear current, stay)
  | 'correct' // correction marker ("correct, four")
  | 'stop'; // pause the mic

export type ParsedCommand =
  | {
      kind: 'depth';
      /** One or more sequential depths (triple cadence "three two three" → 3). */
      values: number[];
      confidence: number;
      ambiguous: boolean;
      /** Set when a spoken value was out of range (caller routes to confirm UX). */
      outOfRange?: boolean;
    }
  | {
      kind: 'recession';
      value: number;
      confidence: number;
      ambiguous: boolean;
      outOfRange?: boolean;
    }
  | {
      kind: 'flag';
      flag: 'bleeding' | 'suppuration' | 'plaque';
      confidence: number;
      ambiguous: boolean;
    }
  | {
      kind: 'grade';
      grade: 'mobility' | 'furcation';
      value: number;
      confidence: number;
      ambiguous: boolean;
      outOfRange?: boolean;
      /** Furcation on a single-rooted tooth → ignored (soft-gate). */
      ignored?: boolean;
    }
  | {
      kind: 'nav';
      nav: NavCommand;
      confidence: number;
      ambiguous: boolean;
    }
  | {
      kind: 'jump';
      tooth: number;
      confidence: number;
      ambiguous: boolean;
    };

export interface ParseContext {
  /** Recognizer confidence 0..1 for the whole utterance. */
  confidence?: number;
  /** The tooth the sequencer is currently on (for furcation soft-gate). */
  currentTooth?: number;
}

// ---------------------------------------------------------------------------
// Homophone / mishear + word→digit normalization (table-driven, extensible).
// Applied BEFORE tokenizing. Lower-cased input.
// ---------------------------------------------------------------------------

/** Common digit mishears the recognizer emits for spoken numerals. */
export const HOMOPHONE_TABLE: Record<string, string> = {
  // misheard digits
  to: '2',
  too: '2',
  for: '4',
  fore: '4',
  tree: '3',
  ate: '8',
  won: '1',
  // unit noise that should be dropped (mapped to empty later)
  millimeters: '',
  millimeter: '',
  mil: '',
  mils: '',
  mm: '',
};

/** Spoken number words → integer string. zero..twenty (depths cap at 20). */
const NUMBER_WORDS: Record<string, string> = {
  zero: '0',
  oh: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20',
};

/** Negation markers preceding a number → signed value. */
const NEGATION_WORDS = new Set(['minus', 'negative']);

/** Keyword → command flag synonyms. */
const FLAG_WORDS: Record<string, 'bleeding' | 'suppuration' | 'plaque'> = {
  bleeding: 'bleeding',
  bleed: 'bleeding',
  bop: 'bleeding',
  pus: 'suppuration',
  suppuration: 'suppuration',
  plaque: 'plaque',
};

/** Navigation keyword synonyms. */
const NAV_WORDS: Record<string, NavCommand> = {
  next: 'next',
  back: 'back',
  previous: 'back',
  skip: 'skip',
  missing: 'missing',
  redo: 'redo',
  correct: 'correct',
  correction: 'correct',
  stop: 'stop',
  pause: 'stop',
};

/**
 * Normalize a raw transcript to a clean lower-case token list. Applies the
 * homophone table and drops unit-noise tokens, but keeps number WORDS as-is so
 * the parser can still distinguish "minus three" cadence etc.
 */
export function normalizeTranscript(transcript: string): string[] {
  return transcript
    .toLowerCase()
    .replace(/[.,!?;:]/g, ' ')
    // Collapse the navigation phrase "go to" so the preposition "to" is never
    // mis-read as the digit homophone "to"→2 (e.g. "go to tooth 26").
    .replace(/\bgo\s+to\b/g, 'goto')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t in HOMOPHONE_TABLE ? (HOMOPHONE_TABLE[t] as string) : t))
    .filter((t) => t !== '');
}

/** Convert a single token to an integer if it is a numeral or number word. */
function tokenToNumber(token: string | undefined): number | null {
  if (token === undefined) return null;
  if (/^-?\d+$/.test(token)) return Number(token);
  if (token in NUMBER_WORDS) return Number(NUMBER_WORDS[token]);
  return null;
}

const DEFAULT_CONFIDENCE = 1;

// ---------------------------------------------------------------------------
// parseUtterance — the pure entry point.
// ---------------------------------------------------------------------------

/**
 * Parse a (possibly multi-command) utterance into structured commands.
 * Returns [] when nothing recognizable is found (caller shows a no-match state).
 */
export function parseUtterance(transcript: string, ctx: ParseContext = {}): ParsedCommand[] {
  const confidence = ctx.confidence ?? DEFAULT_CONFIDENCE;
  const tokens = normalizeTranscript(transcript);
  const commands: ParsedCommand[] = [];

  // A bare run of numbers ("three two three") is the depth triple cadence; we
  // only collapse a leading run of bare numbers into ONE depth command. Keyword
  // prefixes ("recession", "mobility", …) consume the number that follows.
  let i = 0;
  let pendingDepths: number[] = [];

  function flushDepths() {
    if (pendingDepths.length === 0) return;
    const outOfRange = pendingDepths.some((v) => !isDepthInRange(v));
    commands.push({
      kind: 'depth',
      values: pendingDepths,
      confidence,
      ambiguous: false,
      ...(outOfRange ? { outOfRange: true } : {}),
    });
    pendingDepths = [];
  }

  while (i < tokens.length) {
    const token = tokens[i];
    if (token === undefined) {
      i += 1;
      continue;
    }

    // Flags (bleeding / pus / plaque) — attach to the current site.
    const flag = FLAG_WORDS[token];
    if (flag) {
      flushDepths();
      commands.push({ kind: 'flag', flag, confidence, ambiguous: false });
      i += 1;
      continue;
    }

    // Navigation.
    const nav = NAV_WORDS[token];
    if (nav) {
      flushDepths();
      // "go to tooth 26" — `tooth`/`go to` prefixes are handled below; bare nav here.
      commands.push({ kind: 'nav', nav, confidence, ambiguous: false });
      i += 1;
      continue;
    }

    // Jump: "tooth 26" / "go to tooth twenty six". Triggers on the `tooth`
    // keyword and reads the number that FOLLOWS it (so a stray "to"→2 homophone
    // earlier in "go to tooth …" never leaks into the jump target).
    if (token === 'tooth') {
      flushDepths();
      let j = i + 1;
      while (j < tokens.length && tokenToNumber(tokens[j]) === null) j += 1;
      const num = j < tokens.length ? tokenToNumber(tokens[j]) : null;
      if (num !== null) {
        commands.push({ kind: 'jump', tooth: num, confidence, ambiguous: false });
        i = j + 1;
        continue;
      }
      i += 1;
      continue;
    }

    // Recession / gingival margin: "recession three", "gum margin minus one".
    if (token === 'recession' || token === 'gum' || token === 'margin') {
      flushDepths();
      // skip filler words up to a (optionally negated) number
      let j = i + 1;
      let sign = 1;
      while (j < tokens.length) {
        const tj = tokens[j];
        if (tj !== undefined && NEGATION_WORDS.has(tj)) {
          sign = -1;
          j += 1;
          continue;
        }
        const n = tokenToNumber(tj);
        if (n !== null) {
          const value = sign * n;
          const outOfRange = !isMarginInRange(value);
          commands.push({
            kind: 'recession',
            value,
            confidence,
            ambiguous: false,
            ...(outOfRange ? { outOfRange: true } : {}),
          });
          i = j + 1;
          break;
        }
        // a non-number, non-filler token ends the recession scan
        if (tj === 'recession' || tj === 'margin' || tj === 'gum') {
          j += 1;
          continue;
        }
        break;
      }
      if (j >= tokens.length || commands[commands.length - 1]?.kind !== 'recession') {
        // no number followed — treat as ambiguous so it routes to confirm UX
        if (commands[commands.length - 1]?.kind !== 'recession') {
          commands.push({ kind: 'recession', value: NaN, confidence, ambiguous: true });
        }
      }
      i = Math.max(i + 1, j);
      continue;
    }

    // Grades: "mobility two", "furcation grade three".
    if (token === 'mobility' || token === 'furcation') {
      flushDepths();
      const grade = token as 'mobility' | 'furcation';
      let j = i + 1;
      while (j < tokens.length && tokenToNumber(tokens[j]) === null) {
        // allow the filler word "grade"
        if (tokens[j] === 'grade') {
          j += 1;
          continue;
        }
        break;
      }
      const n = j < tokens.length ? tokenToNumber(tokens[j]) : null;
      if (n === null) {
        commands.push({ kind: 'grade', grade, value: NaN, confidence, ambiguous: true });
        i += 1;
        continue;
      }
      const outOfRange = !isGradeInRange(n);
      // Furcation soft-gate: meaningless on single-rooted teeth.
      const ignored =
        grade === 'furcation' &&
        typeof ctx.currentTooth === 'number' &&
        isSingleRooted(ctx.currentTooth);
      commands.push({
        kind: 'grade',
        grade,
        value: n,
        confidence,
        ambiguous: false,
        ...(outOfRange ? { outOfRange: true } : {}),
        ...(ignored ? { ignored: true } : {}),
      });
      i = j + 1;
      continue;
    }

    // Negated bare number → signed depth is NOT valid (depths unsigned); treat a
    // leading "minus N" as a recession value for convenience.
    if (NEGATION_WORDS.has(token)) {
      flushDepths();
      const n = i + 1 < tokens.length ? tokenToNumber(tokens[i + 1]) : null;
      if (n !== null) {
        const value = -n;
        const outOfRange = !isMarginInRange(value);
        commands.push({
          kind: 'recession',
          value,
          confidence,
          ambiguous: false,
          ...(outOfRange ? { outOfRange: true } : {}),
        });
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    // Bare number → accumulate into the depth triple cadence.
    const num = tokenToNumber(token);
    if (num !== null) {
      pendingDepths.push(num);
      i += 1;
      continue;
    }

    // Unrecognized token — ignore (no-match contributes nothing).
    i += 1;
  }

  flushDepths();
  return commands;
}
