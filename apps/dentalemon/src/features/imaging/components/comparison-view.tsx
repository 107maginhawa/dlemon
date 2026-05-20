import { useEffect, useState } from 'react'
import { useOfflineCache } from '@/features/imaging/hooks/use-offline-cache'
import { ImagingWorkspace } from './imaging-workspace'
import type { PatientImageItem } from '@/features/imaging/hooks/use-imaging-studies'

export interface ComparisonViewProps {
  imageA: PatientImageItem
  imageB: PatientImageItem
  onClose?: () => void
}

interface OfflinePlaceholderProps {
  fileName: string
}

function OfflinePlaceholder({ fileName }: OfflinePlaceholderProps) {
  return (
    <div className="flex flex-col h-full items-center justify-center bg-zinc-100 text-center p-6">
      <p className="text-sm text-zinc-500 font-medium">{fileName}</p>
      <p className="text-xs text-zinc-400 mt-1" role="alert">
        Image not available offline
      </p>
    </div>
  )
}

export function ComparisonView({ imageA, imageB, onClose }: ComparisonViewProps) {
  const { getCachedBlob } = useOfflineCache()
  const [urlA, setUrlA] = useState<string | null | 'loading'>('loading')
  const [urlB, setUrlB] = useState<string | null | 'loading'>('loading')

  useEffect(() => {
    let cancelled = false
    const objectUrls: string[] = []

    void Promise.all([getCachedBlob(imageA.id), getCachedBlob(imageB.id)]).then(
      ([blobA, blobB]) => {
        if (cancelled) return

        if (blobA) {
          const url = URL.createObjectURL(blobA)
          objectUrls.push(url)
          setUrlA(url)
        } else {
          setUrlA(null)
        }

        if (blobB) {
          const url = URL.createObjectURL(blobB)
          objectUrls.push(url)
          setUrlB(url)
        } else {
          setUrlB(null)
        }
      },
    )

    return () => {
      cancelled = true
      objectUrls.forEach(URL.revokeObjectURL)
    }
  }, [imageA.id, imageB.id, getCachedBlob])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-zinc-900 shrink-0">
        <span className="text-sm font-semibold text-white">Compare Images</span>
        <button
          onClick={onClose}
          aria-label="Close comparison"
          className="text-zinc-400 hover:text-white text-xs px-2 py-1"
        >
          ✕ Exit Compare
        </button>
      </div>

      {/* Panes */}
      <div className="flex gap-2 flex-1 min-h-0 p-2 bg-zinc-950">
        {/* Pane A */}
        <div className="flex-1 min-w-0 flex flex-col" data-testid="comparison-pane-a">
          <p className="text-xs text-zinc-400 px-1 pb-1 truncate">{imageA.fileName}</p>
          {urlA === 'loading' ? (
            <div className="flex-1 bg-zinc-900 animate-pulse rounded" />
          ) : urlA === null ? (
            <OfflinePlaceholder fileName={imageA.fileName} />
          ) : (
            <ImagingWorkspace
              imageId={imageA.id}
              imageUrl={urlA}
              className="flex-1"
              modality={imageA.modality}
            />
          )}
        </div>

        {/* Pane B */}
        <div className="flex-1 min-w-0 flex flex-col" data-testid="comparison-pane-b">
          <p className="text-xs text-zinc-400 px-1 pb-1 truncate">{imageB.fileName}</p>
          {urlB === 'loading' ? (
            <div className="flex-1 bg-zinc-900 animate-pulse rounded" />
          ) : urlB === null ? (
            <OfflinePlaceholder fileName={imageB.fileName} />
          ) : (
            <ImagingWorkspace
              imageId={imageB.id}
              imageUrl={urlB}
              className="flex-1"
              modality={imageB.modality}
            />
          )}
        </div>
      </div>
    </div>
  )
}
