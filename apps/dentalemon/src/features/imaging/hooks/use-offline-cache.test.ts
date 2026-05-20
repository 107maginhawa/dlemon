/**
 * useOfflineCache — unit tests
 *
 * Covers IndexedDB-backed caching of image blobs and annotation JSON.
 * Uses a hand-rolled IndexedDB fake (no extra deps) that stubs the
 * API surface actually used by use-offline-cache.ts.
 *
 * @BR-031
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { renderHook, cleanup, act } from '@testing-library/react';
import { useOfflineCache } from './use-offline-cache';
import { freshClient, makeWrapper } from '@/test-utils';

// ─── IndexedDB Fake ─────────────────────────────────────────────────────────

function createFakeIndexedDB() {
  // Backing stores keyed by store name → Map<key, value>
  const stores: Record<string, Map<string, unknown>> = {
    'image-blobs': new Map(),
    annotations: new Map(),
  };

  function fakeObjectStore(storeName: string, mode: string) {
    const store = stores[storeName] ?? new Map();
    stores[storeName] = store;

    return {
      get(key: string) {
        const req: Record<string, unknown> = {
          result: store.get(key) ?? undefined,
          error: null,
        };
        // Fire onsuccess async
        queueMicrotask(() => {
          if (typeof req.onsuccess === 'function') {
            (req.onsuccess as () => void)();
          }
        });
        return req;
      },
      put(value: Record<string, unknown>) {
        const key =
          storeName === 'image-blobs'
            ? (value.id as string)
            : (value.imageId as string);
        store.set(key, value);
        // put doesn't need onsuccess for our code — tx.oncomplete handles it
        return { error: null };
      },
    };
  }

  function fakeTransaction(storeNames: string | string[], mode = 'readonly') {
    const name = Array.isArray(storeNames) ? storeNames[0]! : storeNames;
    const tx: Record<string, unknown> = {
      error: null,
      objectStore: (sn: string) => fakeObjectStore(sn, mode),
    };
    // Fire oncomplete async for readwrite transactions
    queueMicrotask(() => {
      if (typeof tx.oncomplete === 'function') {
        (tx.oncomplete as () => void)();
      }
    });
    return tx;
  }

  const fakeDB = {
    transaction: fakeTransaction,
    objectStoreNames: {
      contains: (name: string) =>
        name === 'image-blobs' || name === 'annotations',
    },
    createObjectStore: () => ({}),
  };

  const fakeIndexedDB = {
    open(_name: string, _version?: number) {
      const req: Record<string, unknown> = {
        result: fakeDB,
        error: null,
      };
      // Fire onsuccess async
      queueMicrotask(() => {
        if (typeof req.onsuccess === 'function') {
          (req.onsuccess as () => void)();
        }
      });
      return req;
    },
  };

  return { fakeIndexedDB, stores };
}

// ─── Error-producing IndexedDB Fake ─────────────────────────────────────────

function createErrorIndexedDB() {
  const fakeIndexedDB = {
    open(_name: string, _version?: number) {
      const fakeDB = {
        transaction(storeNames: string | string[], _mode = 'readonly') {
          const tx: Record<string, unknown> = {
            error: new DOMException('Transaction failed'),
            objectStore: () => ({
              get(_key: string) {
                const req: Record<string, unknown> = {
                  result: undefined,
                  error: new DOMException('Get failed'),
                };
                queueMicrotask(() => {
                  if (typeof req.onerror === 'function') {
                    (req.onerror as () => void)();
                  }
                });
                return req;
              },
              put() {
                return { error: null };
              },
            }),
          };
          return tx;
        },
        objectStoreNames: { contains: () => true },
        createObjectStore: () => ({}),
      };

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
  return { fakeIndexedDB };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useOfflineCache — blob cache', () => {
  // @BR-031
  const originalIndexedDB = globalThis.indexedDB;
  let fake: ReturnType<typeof createFakeIndexedDB>;

  beforeEach(() => {
    fake = createFakeIndexedDB();
    (globalThis as Record<string, unknown>).indexedDB =
      fake.fakeIndexedDB as unknown as IDBFactory;
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).indexedDB = originalIndexedDB;
    cleanup();
  });

  test('getCachedBlob returns null when imageId not in store', async () => {
    // @BR-031
    const qc = freshClient();
    const { result } = renderHook(() => useOfflineCache(), {
      wrapper: makeWrapper(qc),
    });

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.getCachedBlob('nonexistent');
    });

    expect(blob).toBeNull();
  });

  test('setCachedBlob + getCachedBlob round-trips a Blob value', async () => {
    // @BR-031
    const qc = freshClient();
    const { result } = renderHook(() => useOfflineCache(), {
      wrapper: makeWrapper(qc),
    });

    const testBlob = new Blob(['test-data'], { type: 'image/png' });

    await act(async () => {
      await result.current.setCachedBlob('img-1', testBlob);
    });

    let retrieved: Blob | null = null;
    await act(async () => {
      retrieved = await result.current.getCachedBlob('img-1');
    });

    expect(retrieved).toBe(testBlob);
  });
});

describe('useOfflineCache — annotation cache', () => {
  // @BR-031
  const originalIndexedDB = globalThis.indexedDB;
  let fake: ReturnType<typeof createFakeIndexedDB>;

  beforeEach(() => {
    fake = createFakeIndexedDB();
    (globalThis as Record<string, unknown>).indexedDB =
      fake.fakeIndexedDB as unknown as IDBFactory;
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).indexedDB = originalIndexedDB;
    cleanup();
  });

  test('getCachedAnnotations returns null for missing imageId', async () => {
    // @BR-031
    const qc = freshClient();
    const { result } = renderHook(() => useOfflineCache(), {
      wrapper: makeWrapper(qc),
    });

    let data: unknown = 'sentinel';
    await act(async () => {
      data = await result.current.getCachedAnnotations('nonexistent');
    });

    expect(data).toBeNull();
  });

  test('setCachedAnnotations + getCachedAnnotations round-trips JSON data', async () => {
    // @BR-031
    const qc = freshClient();
    const { result } = renderHook(() => useOfflineCache(), {
      wrapper: makeWrapper(qc),
    });

    const annotations = {
      lines: [{ x1: 0, y1: 0, x2: 10, y2: 10 }],
      labels: ['caries'],
    };

    await act(async () => {
      await result.current.setCachedAnnotations('img-2', annotations);
    });

    let retrieved: unknown = null;
    await act(async () => {
      retrieved = await result.current.getCachedAnnotations('img-2');
    });

    expect(retrieved).toEqual(annotations);
  });
});

describe('useOfflineCache — error path', () => {
  // @BR-031
  const originalIndexedDB = globalThis.indexedDB;

  afterEach(() => {
    (globalThis as Record<string, unknown>).indexedDB = originalIndexedDB;
    cleanup();
  });

  test('IDBRequest.onerror fires, getCachedBlob returns null gracefully', async () => {
    // @BR-031
    const { fakeIndexedDB } = createErrorIndexedDB();
    (globalThis as Record<string, unknown>).indexedDB =
      fakeIndexedDB as unknown as IDBFactory;

    const qc = freshClient();
    const { result } = renderHook(() => useOfflineCache(), {
      wrapper: makeWrapper(qc),
    });

    let blob: Blob | null = new Blob(); // non-null sentinel
    await act(async () => {
      blob = await result.current.getCachedBlob('img-error');
    });

    expect(blob).toBeNull();
  });
});
