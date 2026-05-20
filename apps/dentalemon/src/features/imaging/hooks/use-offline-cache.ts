import { useCallback } from 'react'

const DB_NAME = 'dentalemon-imaging'
const DB_VERSION = 1
const BLOB_STORE = 'image-blobs'
const ANNOTATION_STORE = 'annotations'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(ANNOTATION_STORE)) {
        db.createObjectStore(ANNOTATION_STORE, { keyPath: 'imageId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function useOfflineCache() {
  const getCachedBlob = useCallback(async (imageId: string): Promise<Blob | null> => {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(BLOB_STORE, 'readonly')
      const req = tx.objectStore(BLOB_STORE).get(imageId)
      req.onsuccess = () => resolve((req.result as { blob: Blob } | undefined)?.blob ?? null)
      req.onerror = () => resolve(null)
    })
  }, [])

  const setCachedBlob = useCallback(async (imageId: string, blob: Blob): Promise<void> => {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BLOB_STORE, 'readwrite')
      tx.objectStore(BLOB_STORE).put({ id: imageId, blob, cachedAt: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }, [])

  const getCachedAnnotations = useCallback(async (imageId: string): Promise<unknown | null> => {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(ANNOTATION_STORE, 'readonly')
      const req = tx.objectStore(ANNOTATION_STORE).get(imageId)
      req.onsuccess = () => resolve((req.result as { data: unknown } | undefined)?.data ?? null)
      req.onerror = () => resolve(null)
    })
  }, [])

  const setCachedAnnotations = useCallback(
    async (imageId: string, data: unknown): Promise<void> => {
      const db = await openDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(ANNOTATION_STORE, 'readwrite')
        tx.objectStore(ANNOTATION_STORE).put({ imageId, data, cachedAt: Date.now() })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    },
    [],
  )

  return { getCachedBlob, setCachedBlob, getCachedAnnotations, setCachedAnnotations }
}
