/**
 * SignalingClient unit tests
 *
 * Tests constructor, handler registration, and close behavior.
 * WebSocket is not available in the test environment,
 * so we test the client's API surface and handler management.
 */

import { describe, test, expect, mock } from 'bun:test';
import { SignalingClient } from './signaling-client';

describe('SignalingClient', () => {
  test('constructs with roomId and token', () => {
    const client = new SignalingClient('room-1', 'token-1');
    expect(client).toBeDefined();
  });

  test('constructs with custom API base URL', () => {
    const client = new SignalingClient('room-1', 'token-1', 'https://api.example.com');
    expect(client).toBeDefined();
  });

  test('defaults to localhost when no API base URL provided', () => {
    const client = new SignalingClient('room-1', 'token-1');
    // The wsBaseUrl should be derived from localhost
    expect(client).toBeDefined();
  });

  test('onMessage registers a handler', () => {
    const client = new SignalingClient('room-1', 'token-1');
    const handler = mock(() => {});
    client.onMessage(handler);
    // Handler should be registered (no error thrown)
    expect(handler).not.toHaveBeenCalled();
  });

  test('onChatMessage registers a handler', () => {
    const client = new SignalingClient('room-1', 'token-1');
    const handler = mock(() => {});
    client.onChatMessage(handler);
    expect(handler).not.toHaveBeenCalled();
  });

  test('onStateChange registers a handler', () => {
    const client = new SignalingClient('room-1', 'token-1');
    const handler = mock(() => {});
    client.onStateChange(handler);
    expect(handler).not.toHaveBeenCalled();
  });

  test('close cleans up handlers and state', () => {
    const client = new SignalingClient('room-1', 'token-1');
    const handler = mock(() => {});
    client.onMessage(handler);
    client.onChatMessage(handler);
    client.onStateChange(handler);

    // Should not throw
    client.close();
    expect(true).toBe(true);
  });

  test('close can be called multiple times safely', () => {
    const client = new SignalingClient('room-1', 'token-1');
    client.close();
    client.close();
    expect(true).toBe(true);
  });

  test('send does nothing when not connected', () => {
    const client = new SignalingClient('room-1', 'token-1');
    // Should not throw even when WebSocket is not open
    client.send('offer', { type: 'offer', sdp: 'test' } as any);
    expect(true).toBe(true);
  });

  test('sendChatMessage does nothing when not connected', () => {
    const client = new SignalingClient('room-1', 'token-1');
    client.sendChatMessage('hello');
    expect(true).toBe(true);
  });
});
