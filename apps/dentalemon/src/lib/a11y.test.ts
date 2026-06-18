/**
 * a11y helpers — unit tests.
 */
import { describe, test, expect } from 'bun:test';
import { activateOnKey } from './a11y';

function fakeKey(key: string, repeat = false) {
  let prevented = false;
  return {
    event: { key, repeat, preventDefault: () => { prevented = true; } } as unknown as React.KeyboardEvent,
    wasPrevented: () => prevented,
  };
}

describe('activateOnKey', () => {
  test('Enter triggers the handler and prevents default', () => {
    let called = 0;
    const onKeyDown = activateOnKey(() => { called++; });
    const k = fakeKey('Enter');
    onKeyDown(k.event);
    expect(called).toBe(1);
    expect(k.wasPrevented()).toBe(true);
  });

  test('Space triggers the handler and prevents default (avoids page scroll)', () => {
    let called = 0;
    const onKeyDown = activateOnKey(() => { called++; });
    const k = fakeKey(' ');
    onKeyDown(k.event);
    expect(called).toBe(1);
    expect(k.wasPrevented()).toBe(true);
  });

  test('auto-repeat (held key) does not re-fire the handler — matches native button', () => {
    let called = 0;
    const onKeyDown = activateOnKey(() => { called++; });
    onKeyDown(fakeKey('Enter', true).event);
    expect(called).toBe(0);
  });

  test('other keys (Tab) do not trigger the handler and do not prevent default', () => {
    let called = 0;
    const onKeyDown = activateOnKey(() => { called++; });
    const k = fakeKey('Tab');
    onKeyDown(k.event);
    expect(called).toBe(0);
    expect(k.wasPrevented()).toBe(false);
  });
});
