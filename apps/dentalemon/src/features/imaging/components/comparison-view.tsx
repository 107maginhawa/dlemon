import { useEffect, useMemo, useReducer, useState } from 'react'
import { Skeleton } from '@monobase/ui'
import { useOfflineCache } from '@/features/imaging/hooks/use-offline-cache'
import { ImagingWorkspace } from './imaging-workspace'
import { SuperimpositionPanel } from './SuperimpositionPanel'
import {
  useCephSuperimpositionPreview,
  useLatestCephReport,
  type SuperimpositionReference,
} from '@/features/imaging/hooks/use-ceph-superimposition'
import { resolveBLayerOpacity } from '@/features/imaging/lib/ceph-superimposition-geometry'
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

/** prefers-reduced-motion (mirrors workspace/chart-compare-overlay pattern). */
function usePrefersReducedMotion(): boolean {
  const [reduced, toggle] = useReducer(
    (_: boolean, e: MediaQueryListEvent) => e.matches,
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    mql.addEventListener('change', toggle)
    return () => mql.removeEventListener('change', toggle)
  }, [])
  return reduced
}

type Mode = 'compare' | 'superimpose'

export function ComparisonView({ imageA, imageB, onClose }: ComparisonViewProps) {
  const { getCachedBlob } = useOfflineCache()
  const [urlA, setUrlA] = useState<string | null | 'loading'>('loading')
  const [urlB, setUrlB] = useState<string | null | 'loading'>('loading')

  const [mode, setMode] = useState<Mode>('compare')
  const [reference, setReference] = useState<SuperimpositionReference>('cranial_base')
  const [opacityPct, setOpacityPct] = useState(50)
  const [onionSkin, setOnionSkin] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  // Timepoints = the two images' latest ceph report-version snapshots (§6.1).
  const reportA = useLatestCephReport(imageA.id)
  const reportB = useLatestCephReport(imageB.id)
  const superimposition = useCephSuperimpositionPreview()

  // imageA is the earlier (from); imageB the later (to). Compute on demand.
  useEffect(() => {
    if (mode !== 'superimpose') return
    const from = reportA.data
    const to = reportB.data
    if (!from || !to) return
    superimposition.mutate({ reportFromId: from.id, reportToId: to.id, reference })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, reference, reportA.data?.id, reportB.data?.id])

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
      .catch(() => {
        if (cancelled) return
        setUrlA(null)
        setUrlB(null)
      })
    return () => {
      cancelled = true
      objectUrls.forEach(URL.revokeObjectURL)
    }
  }, [imageA.id, imageB.id, getCachedBlob])

  const bLayerOpacity = useMemo(
    () => resolveBLayerOpacity({ opacityPct, onionSkin, reducedMotion }),
    [opacityPct, onionSkin, reducedMotion],
  )

  const reportsReady = Boolean(reportA.data && reportB.data)
  const superimpError =
    mode === 'superimpose' && !reportsReady && !reportA.isLoading && !reportB.isLoading
      ? 'Superimposition needs a saved ceph report on both timepoints.'
      : superimposition.error
        ? superimposition.error.message
        : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-zinc-900 shrink-0">
        <div className="flex items-center gap-2" role="tablist" aria-label="Comparison mode">
          <button
            role="tab"
            aria-selected={mode === 'compare'}
            onClick={() => setMode('compare')}
            className={[
              'text-xs min-h-[40px] px-3 py-1.5 rounded',
              mode === 'compare' ? 'bg-lemon text-lemon-foreground font-semibold' : 'text-zinc-300 hover:text-white',
            ].join(' ')}
          >
            Compare
          </button>
          <button
            role="tab"
            aria-selected={mode === 'superimpose'}
            onClick={() => setMode('superimpose')}
            className={[
              'text-xs min-h-[40px] px-3 py-1.5 rounded',
              mode === 'superimpose' ? 'bg-lemon text-lemon-foreground font-semibold' : 'text-zinc-300 hover:text-white',
            ].join(' ')}
          >
            Superimpose
          </button>
        </div>
        <button
          onClick={onClose}
          aria-label="Close comparison"
          className="text-zinc-400 hover:text-white text-xs px-2 py-1"
        >
          ✕ Exit
        </button>
      </div>

      {mode === 'compare' ? (
        /* Side-by-side panes */
        <div className="flex gap-2 flex-1 min-h-0 p-2 bg-zinc-950">
          <div className="flex-1 min-w-0 flex flex-col" data-testid="comparison-pane-a">
            <p className="text-xs text-zinc-400 px-1 pb-1 truncate">{imageA.fileName}</p>
            {urlA === 'loading' ? (
              <Skeleton className="flex-1 bg-zinc-900" />
            ) : urlA === null ? (
              <OfflinePlaceholder fileName={imageA.fileName} />
            ) : (
              <ImagingWorkspace imageId={imageA.id} imageUrl={urlA} className="flex-1" modality={imageA.modality} />
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col" data-testid="comparison-pane-b">
            <p className="text-xs text-zinc-400 px-1 pb-1 truncate">{imageB.fileName}</p>
            {urlB === 'loading' ? (
              <Skeleton className="flex-1 bg-zinc-900" />
            ) : urlB === null ? (
              <OfflinePlaceholder fileName={imageB.fileName} />
            ) : (
              <ImagingWorkspace imageId={imageB.id} imageUrl={urlB} className="flex-1" modality={imageB.modality} />
            )}
          </div>
        </div>
      ) : (
        /* Stacked overlay + deltas panel */
        <div className="flex flex-1 min-h-0 bg-zinc-950">
          {/* Stacked, synced overlay: A base + B at resolved opacity */}
          <div className="relative flex-1 min-w-0" data-testid="superimposition-overlay">
            {typeof urlA === 'string' && (
              <img
                src={urlA}
                alt={`${imageA.fileName} (earlier timepoint)`}
                width={1024}
                height={1280}
                className="absolute inset-0 h-full w-full object-contain"
              />
            )}
            {typeof urlB === 'string' && (
              <img
                src={urlB}
                alt={`${imageB.fileName} (later timepoint)`}
                width={1024}
                height={1280}
                className="absolute inset-0 h-full w-full object-contain"
                style={{ opacity: bLayerOpacity }}
                data-testid="superimposition-b-layer"
              />
            )}
          </div>
          {/* Controls + deltas */}
          <div className="w-80 shrink-0 overflow-y-auto border-l border-zinc-800 bg-white">
            <SuperimpositionPanel
              result={superimposition.data ?? null}
              isLoading={superimposition.isPending || reportA.isLoading || reportB.isLoading}
              error={superimpError}
              reference={reference}
              onReferenceChange={setReference}
              opacityPct={opacityPct}
              onOpacityChange={setOpacityPct}
              onionSkin={onionSkin}
              onOnionSkinChange={setOnionSkin}
              fromLabel={reportA.data ? `v${reportA.data.version} · ${reportA.data.createdAt.slice(0, 10)}` : imageA.fileName}
              toLabel={reportB.data ? `v${reportB.data.version} · ${reportB.data.createdAt.slice(0, 10)}` : imageB.fileName}
            />
          </div>
        </div>
      )}
    </div>
  )
}
