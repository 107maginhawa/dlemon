import { describe, test, expect } from 'bun:test';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DaySchedule {
  open: boolean;
  start: string; // "HH:mm"
  end: string;
}

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

type WorkingHoursMap = Record<DayOfWeek, DaySchedule>;

/* ------------------------------------------------------------------ */
/*  Pure helpers (same logic the component will export)                 */
/* ------------------------------------------------------------------ */

const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function defaultWorkingHours(): WorkingHoursMap {
  const base: WorkingHoursMap = {} as WorkingHoursMap;
  for (const day of DAYS) {
    base[day] = { open: day !== 'sunday', start: '09:00', end: '17:00' };
  }
  return base;
}

function parseWorkingHours(raw: string | undefined | null): WorkingHoursMap {
  if (!raw) return defaultWorkingHours();
  try {
    const parsed = JSON.parse(raw);
    const result = defaultWorkingHours();
    for (const day of DAYS) {
      if (parsed[day]) {
        result[day] = {
          open: typeof parsed[day].open === 'boolean' ? parsed[day].open : result[day].open,
          start: typeof parsed[day].start === 'string' ? parsed[day].start : result[day].start,
          end: typeof parsed[day].end === 'string' ? parsed[day].end : result[day].end,
        };
      }
    }
    return result;
  } catch {
    return defaultWorkingHours();
  }
}

function serializeWorkingHours(hours: WorkingHoursMap): string {
  return JSON.stringify(hours);
}

function toggleDay(hours: WorkingHoursMap, day: DayOfWeek): WorkingHoursMap {
  return { ...hours, [day]: { ...hours[day], open: !hours[day].open } };
}

function setTime(hours: WorkingHoursMap, day: DayOfWeek, field: 'start' | 'end', value: string): WorkingHoursMap {
  return { ...hours, [day]: { ...hours[day], [field]: value } };
}

function validateWorkingHours(hours: WorkingHoursMap): string[] {
  const errors: string[] = [];
  for (const day of DAYS) {
    const d = hours[day];
    if (!d.open) continue;
    if (!/^\d{2}:\d{2}$/.test(d.start)) { errors.push(`${day}: invalid start time`); continue; }
    if (!/^\d{2}:\d{2}$/.test(d.end)) { errors.push(`${day}: invalid end time`); continue; }
    if (d.start >= d.end) errors.push(`${day}: start must be before end`);
  }
  return errors;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('Working Hours — defaultWorkingHours', () => {
  test('returns 7 days', () => {
    const wh = defaultWorkingHours();
    expect(Object.keys(wh)).toHaveLength(7);
  });

  test('weekdays are open by default', () => {
    const wh = defaultWorkingHours();
    expect(wh.monday.open).toBe(true);
    expect(wh.friday.open).toBe(true);
  });

  test('sunday is closed by default', () => {
    expect(defaultWorkingHours().sunday.open).toBe(false);
  });

  test('default times are 09:00–17:00', () => {
    const wh = defaultWorkingHours();
    expect(wh.monday.start).toBe('09:00');
    expect(wh.monday.end).toBe('17:00');
  });
});

describe('Working Hours — parseWorkingHours', () => {
  test('null/undefined → defaults', () => {
    expect(parseWorkingHours(null)).toEqual(defaultWorkingHours());
    expect(parseWorkingHours(undefined)).toEqual(defaultWorkingHours());
  });

  test('invalid JSON → defaults', () => {
    expect(parseWorkingHours('not-json')).toEqual(defaultWorkingHours());
  });

  test('partial JSON merges with defaults', () => {
    const partial = JSON.stringify({ monday: { open: false, start: '10:00', end: '18:00' } });
    const wh = parseWorkingHours(partial);
    expect(wh.monday.open).toBe(false);
    expect(wh.monday.start).toBe('10:00');
    expect(wh.tuesday.open).toBe(true); // default preserved
  });
});

describe('Working Hours — serializeWorkingHours', () => {
  test('round-trips correctly', () => {
    const wh = defaultWorkingHours();
    expect(parseWorkingHours(serializeWorkingHours(wh))).toEqual(wh);
  });
});

describe('Working Hours — toggleDay', () => {
  test('toggles open→closed', () => {
    const wh = defaultWorkingHours();
    const updated = toggleDay(wh, 'monday');
    expect(updated.monday.open).toBe(false);
  });

  test('toggles closed→open', () => {
    const wh = defaultWorkingHours();
    const updated = toggleDay(wh, 'sunday');
    expect(updated.sunday.open).toBe(true);
  });

  test('does not mutate original', () => {
    const wh = defaultWorkingHours();
    toggleDay(wh, 'monday');
    expect(wh.monday.open).toBe(true);
  });
});

describe('Working Hours — setTime', () => {
  test('updates start time', () => {
    const wh = defaultWorkingHours();
    const updated = setTime(wh, 'monday', 'start', '08:00');
    expect(updated.monday.start).toBe('08:00');
    expect(updated.monday.end).toBe('17:00'); // unchanged
  });

  test('updates end time', () => {
    const wh = defaultWorkingHours();
    const updated = setTime(wh, 'friday', 'end', '20:00');
    expect(updated.friday.end).toBe('20:00');
  });

  test('does not mutate original', () => {
    const wh = defaultWorkingHours();
    setTime(wh, 'monday', 'start', '08:00');
    expect(wh.monday.start).toBe('09:00');
  });
});

describe('Working Hours — validateWorkingHours', () => {
  test('valid schedule → no errors', () => {
    expect(validateWorkingHours(defaultWorkingHours())).toHaveLength(0);
  });

  test('start >= end → error', () => {
    const wh = defaultWorkingHours();
    wh.monday = { open: true, start: '17:00', end: '09:00' };
    const errors = validateWorkingHours(wh);
    expect(errors).toContain('monday: start must be before end');
  });

  test('closed day with bad times → no error (skipped)', () => {
    const wh = defaultWorkingHours();
    wh.sunday = { open: false, start: '25:00', end: '00:00' };
    expect(validateWorkingHours(wh)).toHaveLength(0);
  });

  test('invalid time format → error', () => {
    const wh = defaultWorkingHours();
    wh.tuesday = { open: true, start: 'abc', end: '17:00' };
    const errors = validateWorkingHours(wh);
    expect(errors).toContain('tuesday: invalid start time');
  });
});
