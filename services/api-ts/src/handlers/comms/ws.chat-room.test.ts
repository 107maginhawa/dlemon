/**
 * Chat room WebSocket handler config tests
 *
 * Tests the exported config shape, path, and middleware requirements.
 */

import { describe, test, expect } from 'bun:test';
import { config } from './ws.chat-room';

describe('Chat room WebSocket config', () => {
  test('path matches expected pattern', () => {
    expect(config.path).toBe('/ws/comms/chat-rooms/:room');
  });

  test('has description', () => {
    expect(config.description!.length).toBeGreaterThan(0);
    expect(typeof config.description).toBe('string');
  });

  test('has middleware array', () => {
    expect(Array.isArray(config.middleware)).toBe(true);
    expect(config.middleware!.length).toBeGreaterThan(0);
  });

  test('has onConnect handler', () => {
    expect(typeof config.onConnect).toBe('function');
  });

  test('has onMessage handler', () => {
    expect(typeof config.onMessage).toBe('function');
  });

  test('has onClose handler', () => {
    expect(typeof config.onClose).toBe('function');
  });
});
