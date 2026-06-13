/**
 * logger tests — the single FE diagnostic-logging seam.
 *
 * This is NOT the user-facing error channel (that is error-toast.ts → sonner).
 * `logger` replaces scattered `console.*` calls so verbosity is gated by
 * environment and warn/error can later be forwarded to a telemetry sink. These
 * tests pin: scope-prefixed formatting, detail passthrough, level→console-method
 * mapping, prod suppression of debug/info, prod-only sink forwarding, and that a
 * throwing sink never reaches the caller.
 */
import { describe, test, expect, spyOn, beforeEach, afterEach } from 'bun:test';
import { logger, configureLogger, type LogLevel, type LogSink } from './logger';

let errorSpy: ReturnType<typeof spyOn>;
let warnSpy: ReturnType<typeof spyOn>;
let infoSpy: ReturnType<typeof spyOn>;
let debugSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
  infoSpy = spyOn(console, 'info').mockImplementation(() => {});
  debugSpy = spyOn(console, 'debug').mockImplementation(() => {});
  // Known baseline: dev mode, no telemetry sink.
  configureLogger({ dev: true, sink: null });
});

afterEach(() => {
  errorSpy.mockRestore();
  warnSpy.mockRestore();
  infoSpy.mockRestore();
  debugSpy.mockRestore();
  configureLogger({ dev: true, sink: null });
});

describe('logger — formatting', () => {
  test('error logs "[scope] message" to console.error', () => {
    logger.error('image-library', 'updateModality failed');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[image-library] updateModality failed');
  });

  test('passes the detail argument through to the console method', () => {
    const err = new Error('boom');
    logger.error('imaging-findings', 'create failed', err);
    expect(errorSpy).toHaveBeenCalledWith('[imaging-findings] create failed', err);
  });

  test('warn routes to console.warn, not console.error', () => {
    logger.warn('onesignal', 'App ID not configured');
    expect(warnSpy).toHaveBeenCalledWith('[onesignal] App ID not configured');
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('logger — environment gating', () => {
  test('in dev, debug and info print to the console', () => {
    configureLogger({ dev: true });
    logger.debug('x', 'd');
    logger.info('x', 'i');
    expect(debugSpy).toHaveBeenCalledWith('[x] d');
    expect(infoSpy).toHaveBeenCalledWith('[x] i');
  });

  test('in prod, debug and info are suppressed', () => {
    configureLogger({ dev: false });
    logger.debug('x', 'd');
    logger.info('x', 'i');
    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  test('in prod, warn and error still print (shipped issues stay diagnosable)', () => {
    configureLogger({ dev: false });
    logger.warn('x', 'w');
    logger.error('x', 'e');
    expect(warnSpy).toHaveBeenCalledWith('[x] w');
    expect(errorSpy).toHaveBeenCalledWith('[x] e');
  });
});

describe('logger — telemetry sink', () => {
  test('in prod, warn/error forward to the sink (debug/info do not)', () => {
    const calls: Array<[LogLevel, string, string, unknown]> = [];
    const sink: LogSink = (level, scope, message, detail) => {
      calls.push([level, scope, message, detail]);
    };
    configureLogger({ dev: false, sink });
    const detail = { id: 1 };
    logger.error('billing', 'invoice failed', detail);
    logger.warn('billing', 'low stock');
    logger.info('billing', 'noise');
    logger.debug('billing', 'noise');
    expect(calls).toEqual([
      ['error', 'billing', 'invoice failed', detail],
      ['warn', 'billing', 'low stock', undefined],
    ]);
  });

  test('in dev, the sink is not invoked (console only)', () => {
    let called = false;
    configureLogger({ dev: true, sink: () => { called = true; } });
    logger.error('x', 'e');
    expect(called).toBe(false);
  });

  test('a throwing sink never propagates into the caller', () => {
    configureLogger({ dev: false, sink: () => { throw new Error('sink down'); } });
    expect(() => logger.error('x', 'e')).not.toThrow();
    // console.error still ran despite the sink throwing
    expect(errorSpy).toHaveBeenCalledWith('[x] e');
  });
});
