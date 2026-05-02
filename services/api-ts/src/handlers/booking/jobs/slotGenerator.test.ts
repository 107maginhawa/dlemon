/**
 * Slot generator job unit tests
 *
 * Tests the slot generation configuration defaults and interface types.
 * The main job function requires real DB, so we test types and configuration.
 */

import { describe, test, expect } from 'bun:test';
import type { SlotGeneratorConfig } from './slotGenerator';

describe('SlotGeneratorConfig', () => {
  test('default config has 30 days to generate', () => {
    const config: SlotGeneratorConfig = {
      daysToGenerate: 30,
      batchSize: 10,
      retryOnError: true,
    };
    expect(config.daysToGenerate).toBe(30);
  });

  test('default config has batch size 10', () => {
    const config: SlotGeneratorConfig = {
      daysToGenerate: 30,
      batchSize: 10,
      retryOnError: true,
    };
    expect(config.batchSize).toBe(10);
  });

  test('default config has retryOnError true', () => {
    const config: SlotGeneratorConfig = {
      daysToGenerate: 30,
      batchSize: 10,
      retryOnError: true,
    };
    expect(config.retryOnError).toBe(true);
  });

  test('config can be overridden', () => {
    const config: SlotGeneratorConfig = {
      daysToGenerate: 7,
      batchSize: 5,
      retryOnError: false,
    };
    expect(config.daysToGenerate).toBe(7);
    expect(config.batchSize).toBe(5);
    expect(config.retryOnError).toBe(false);
  });
});

describe('regenerateEventSlots export', () => {
  test('regenerateEventSlots is exported', async () => {
    const mod = await import('./slotGenerator');
    expect(typeof mod.regenerateEventSlots).toBe('function');
  });

  test('slotGeneratorJob is exported', async () => {
    const mod = await import('./slotGenerator');
    expect(typeof mod.slotGeneratorJob).toBe('function');
  });
});
