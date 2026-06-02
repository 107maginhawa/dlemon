import type { QueryClient } from '@tanstack/react-query'
import type { PatientImageItem } from '@/features/imaging/hooks/use-imaging-studies'

export const TEST_IDS = {
  imageId: 'test-image-id',
  patientId: 'test-patient-id',
  visitId: 'test-visit-id',
  branchId: 'test-branch-id',
} as const

// 3 stable fixtures — ids are intentionally fixed so E2E specs can reference them
const STUDY_ITEMS: PatientImageItem[] = [
  {
    id: 'test-image-id',
    source: 'imaging',
    modality: 'cephalometric',
    fileName: 'ceph-lateral.jpg',
    mimeType: 'image/jpeg',
    fileSizeBytes: 512000,
    studyId: 'test-study-id',
    visitId: TEST_IDS.visitId,
    toothNumbers: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    downloadUrl: null,
  },
  {
    id: 'test-image-id-2',
    source: 'imaging',
    modality: 'panoramic',
    fileName: 'panoramic.jpg',
    mimeType: 'image/jpeg',
    fileSizeBytes: 204800,
    studyId: 'test-study-id-2',
    visitId: null,
    toothNumbers: [],
    createdAt: '2026-01-02T00:00:00.000Z',
    downloadUrl: null,
  },
  {
    id: 'test-image-id-3',
    source: 'imaging',
    modality: 'periapical',
    fileName: 'periapical.jpg',
    mimeType: 'image/jpeg',
    fileSizeBytes: 102400,
    studyId: 'test-study-id-3',
    visitId: null,
    toothNumbers: [14],
    createdAt: '2026-01-03T00:00:00.000Z',
    downloadUrl: null,
  },
  // P2-7: a CBCT volume fixture — renders as a volume card (not a flat row), so the
  // E2E can verify the truthful volume affordance + "Open in viewer" handoff.
  {
    id: 'test-image-id-cbct',
    source: 'imaging',
    modality: 'cbct',
    fileName: 'cone-beam.dcm',
    mimeType: 'application/dicom',
    fileSizeBytes: 52428800,
    studyId: 'test-study-id-cbct',
    visitId: null,
    toothNumbers: [],
    createdAt: '2026-01-04T00:00:00.000Z',
    downloadUrl: null,
    isVolume: true,
    frameCount: 128,
    viewerKind: 'volume',
  },
]

export function studiesFixture(): { items: PatientImageItem[]; total: number } {
  return { items: STUDY_ITEMS, total: STUDY_ITEMS.length }
}

export function comparisonFixtures(): { imageA: PatientImageItem; imageB: PatientImageItem } {
  return { imageA: STUDY_ITEMS[0]!, imageB: STUDY_ITEMS[1]! }
}

// Seed TanStack Query cache so PatientImageList renders without any network call.
// queryKey mirrors use-imaging-studies.ts; staleTime: 30_000 means data stays fresh
// for the entire E2E test window and no background refetch fires.
export function seedStudiesCache(queryClient: QueryClient): void {
  queryClient.setQueryData(['imaging', 'patient', TEST_IDS.patientId], studiesFixture())
}

// Standalone IDB helpers — mirrors use-offline-cache.ts constants without requiring hooks
const DB_NAME = 'dentalemon-imaging'
const DB_VERSION = 1
const BLOB_STORE = 'image-blobs'

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Minimal 1×1 transparent PNG — valid blob, no network needed
const PLACEHOLDER_PNG_BYTES = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0,
  0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 98, 0, 0, 0, 2, 0, 1, 226, 33,
  188, 51, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
])

export async function seedOfflineBlobs(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const blob = new Blob([PLACEHOLDER_PNG_BYTES], { type: 'image/png' })
  const db = await openIDB()
  await Promise.all(
    ids.map(
      (id) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(BLOB_STORE, 'readwrite')
          tx.objectStore(BLOB_STORE).put({ id, blob, cachedAt: Date.now() })
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }),
    ),
  )
  db.close()
}
