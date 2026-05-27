/**
 * ComparisonView component tests
 *
 * Covers: loading skeleton, offline fallback, close button, file name display.
 *
 * Uses globalThis.indexedDB mocking (no mock.module) to control useOfflineCache
 * without contaminating use-offline-cache hook tests.
 */
import { describe, test, expect, afterEach, afterAll, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ComparisonView } from '../components/comparison-view';

// ── IndexedDB fake helpers ──────────────────────────────────────────────────

type BlobOrNull = Blob | null;

/**
 * Create a fake IndexedDB that returns a given blob for ALL get() calls.
 * Pass null to simulate cache miss. Pass a never-resolving signal to simulate loading.
 */
function createFakeIndexedDB(resolveWith: BlobOrNull | 'hang') {
  const fakeDB = {
    transaction(_storeNames: string | string[], _mode = 'readonly') {
      const tx: Record<string, unknown> = {
        error: null,
        objectStore: (_name: string) => ({
          get(_key: string) {
            const req: Record<string, unknown> = {
              result: undefined,
              error: null,
            };
            if (resolveWith === 'hang') {
              // Never fires — keeps component in loading state
            } else {
              queueMicrotask(() => {
                // Simulate a cache hit: result has { blob } shape; miss: undefined
                req.result =
                  resolveWith !== null ? { blob: resolveWith } : undefined;
                if (typeof req.onsuccess === 'function') {
                  (req.onsuccess as () => void)();
                }
              });
            }
            return req;
          },
          put() {
            return { error: null };
          },
        }),
      };
      queueMicrotask(() => {
        if (typeof tx.oncomplete === 'function') {
          (tx.oncomplete as () => void)();
        }
      });
      return tx;
    },
    objectStoreNames: {
      contains: (name: string) =>
        name === 'image-blobs' || name === 'annotations',
    },
    createObjectStore: () => ({}),
  };

  return {
    open(_name: string, _version?: number) {
      const req: Record<string, unknown> = {
        result: fakeDB,
        error: null,
      };
      queueMicrotask(() => {
        if (typeof req.onsuccess === 'function') {
          (req.onsuccess as () => void)();
        }
      });
      return req;
    },
  };
}

// ── URL stubs ───────────────────────────────────────────────────────────────

const originalCreateObjectURL = globalThis.URL.createObjectURL;
const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;
const originalIndexedDB = globalThis.indexedDB;

globalThis.URL.createObjectURL = (blob: Blob) => `blob://fake-${blob.size}`;
globalThis.URL.revokeObjectURL = () => {};

afterAll(() => {
  globalThis.URL.createObjectURL = originalCreateObjectURL;
  globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
  (globalThis as Record<string, unknown>).indexedDB = originalIndexedDB;
});

// ── Fixtures ────────────────────────────────────────────────────────────────

const IMAGE_A = {
  id: 'img-a',
  source: 'imaging' as const,
  modality: 'periapical' as const,
  fileName: 'xray-left.jpg',
  mimeType: 'image/jpeg',
  fileSizeBytes: 2048,
  studyId: 's-1',
  visitId: 'v-1',
  toothNumbers: [14],
  createdAt: '2025-01-01T00:00:00Z',
};

const IMAGE_B = {
  id: 'img-b',
  source: 'imaging' as const,
  modality: 'bitewing' as const,
  fileName: 'xray-right.jpg',
  mimeType: 'image/jpeg',
  fileSizeBytes: 3072,
  studyId: 's-2',
  visitId: 'v-1',
  toothNumbers: [15],
  createdAt: '2025-01-02T00:00:00Z',
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ComparisonView', () => {
  afterEach(() => {
    cleanup();
    // Reset indexedDB to original after each test
    (globalThis as Record<string, unknown>).indexedDB = originalIndexedDB;
  });

  test('shows loading skeleton for both panes initially', () => {
    // Hang the IndexedDB open so getCachedBlob never resolves
    (globalThis as Record<string, unknown>).indexedDB =
      createFakeIndexedDB('hang') as unknown as IDBFactory;

    render(React.createElement(ComparisonView, { imageA: IMAGE_A, imageB: IMAGE_B }));
    const paneA = screen.getByTestId('comparison-pane-a');
    const paneB = screen.getByTestId('comparison-pane-b');
    // Loading state = animate-pulse div
    expect(paneA.querySelector('.animate-pulse')).not.toBeNull();
    expect(paneB.querySelector('.animate-pulse')).not.toBeNull();
  });

  test('shows offline message when blob not available', async () => {
    // Return null from cache → both panes show offline message
    (globalThis as Record<string, unknown>).indexedDB =
      createFakeIndexedDB(null) as unknown as IDBFactory;

    render(React.createElement(ComparisonView, { imageA: IMAGE_A, imageB: IMAGE_B }));
    await waitFor(() => {
      expect(screen.getAllByText(/not available offline/i).length).toBe(2);
    });
  });

  test('close button calls onClose', async () => {
    (globalThis as Record<string, unknown>).indexedDB =
      createFakeIndexedDB(null) as unknown as IDBFactory;

    const user = userEvent.setup();
    const onClose = mock(() => {});
    render(React.createElement(ComparisonView, { imageA: IMAGE_A, imageB: IMAGE_B, onClose }));
    const closeBtn = screen.getByLabelText(/close comparison/i);
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('displays file names for both panes', () => {
    (globalThis as Record<string, unknown>).indexedDB =
      createFakeIndexedDB('hang') as unknown as IDBFactory;

    render(React.createElement(ComparisonView, { imageA: IMAGE_A, imageB: IMAGE_B }));
    expect(screen.getByText('xray-left.jpg')).not.toBeNull();
    expect(screen.getByText('xray-right.jpg')).not.toBeNull();
  });
});
