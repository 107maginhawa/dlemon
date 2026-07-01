import { useEffect, useRef, useState, useCallback } from 'react'
import { composeCephCanvas, canvasToPngBlob } from '../lib/ceph-export'
import type { LayerState } from './CephLayerPanel'
import { useOfflineCache } from '../hooks/use-offline-cache'
import { useMeasurements, type CreateMeasurementInput } from '../hooks/use-measurements'
import { MeasurementToolbar, type ToolMode } from './measurement-toolbar'
import { AnnotationToolbar } from './annotation-toolbar'
import { CalibrationDialog } from './calibration-dialog'
import { AnnotationInputDialog } from './annotation-input-dialog'
import type { Point } from './imaging-workspace.handlers'
import { FindingsSidebar } from './FindingsSidebar'
import { CephWorkspacePanel } from './CephWorkspacePanel'
import { CephLandmarkLayer } from './CephLandmarkLayer'
import { CephLoupe } from './CephLoupe'
import { decideCephKey, nextUnplacedCode } from '../lib/ceph-keyboard'
import { CephTracingOverlay } from './CephTracingOverlay'
import { CephAngleArcLayer } from './CephAngleArcLayer'
import { useCephLandmarks } from '../hooks/use-ceph-landmarks'
import { useCephAnalysis } from '../hooks/use-ceph-analysis'
import { screenToImage, type CephTransformState } from '@monobase/ceph-math'
import { MeasurementShape, AnnotationShape, DrawingPreview, AnnotationActionBar } from './canvas-overlays'
import { BRAND_GOLD } from '@/constants/brand'
import { toast } from 'sonner'
import { toastError } from '@/lib/error-toast'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { imagingMgmtUpdateImageCalibration } from '@monobase/sdk-ts/generated'
import {
  processToolClick,
  buildLabelMeasurement,
  buildToothMeasurement,
  buildCalibrationRequest,
  confirmCalibrationSave,
  decideAnnotationKey,
} from './imaging-workspace.handlers'

// distance/angle/area are the numeric MEASUREMENT tools; label/arrow/freehand/
// shape/tooth are ANNOTATION overlays. A "Measurement saved" toast for a text
// label reads wrong ("I didn't measure anything") — word the toast per category.
const MEASUREMENT_TYPES = new Set(['distance', 'angle', 'area'])
const savedLabelFor = (type: string): string =>
  MEASUREMENT_TYPES.has(type) ? 'Measurement saved' : 'Annotation saved'

interface ImagingWorkspaceProps {
  imageId: string
  imageUrl: string
  className?: string
  toolMode?: ToolMode
  onToolModeChange?: (mode: ToolMode) => void
  onMeasurementSaved?: () => void
  modality?: string
  pixelSpacingMm?: number | null
  onCalibrationSaved?: (pxMm: number) => void
  visitId?: string
  patientId?: string
  branchId?: string
}

export function ImagingWorkspace({
  imageId,
  imageUrl,
  className,
  toolMode: externalToolMode,
  onToolModeChange,
  onMeasurementSaved,
  modality,
  pixelSpacingMm: externalPixelSpacingMm,
  onCalibrationSaved,
  visitId = '',
  patientId = '',
  branchId = '',
}: ImagingWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const scaleRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })
  const rotationRef = useRef(0)
  const flipRef = useRef(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const isDraggingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })

  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)

  // Tool state — controlled externally or internally
  const [internalToolMode, setInternalToolMode] = useState<ToolMode>('none')
  const toolMode = externalToolMode ?? internalToolMode
  const setToolMode = (mode: ToolMode) => {
    setInternalToolMode(mode)
    onToolModeChange?.(mode)
  }

  const [drawPoints, setDrawPoints] = useState<{ x: number; y: number }[]>([])
  // Pending annotation captured by the styled input dialog (replaces window.prompt).
  // Holds the click point + which kind of input we're collecting; null = closed.
  const [pendingAnnotation, setPendingAnnotation] = useState<{ kind: 'label' | 'tooth'; point: Point } | null>(null)
  const [calibrationOpen, setCalibrationOpen] = useState(false)
  const [calibrationPixelDist, setCalibrationPixelDist] = useState(0)
  const [internalPixelSpacingMm, setInternalPixelSpacingMm] = useState<number | null>(null)
  const [findingsPanelOpen, setFindingsPanelOpen] = useState(false)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [cephPanelOpen, setCephPanelOpen] = useState(false)
  const [cephTransform, setCephTransform] = useState<CephTransformState | null>(null)
  const [cephSelectedCode, setCephSelectedCode] = useState<import('../hooks/use-ceph-landmarks').CephLandmarkCode | null>(null)
  // Pointer position (main-canvas px) for the magnifier loupe; null when off the image.
  const [cephPointer, setCephPointer] = useState<{ x: number; y: number } | null>(null)
  const [cephLayers, setCephLayers] = useState<LayerState>({ landmarks: true, tracing: true, arcs: true })
  // Single source of truth for the analysis protocol, shared between the canvas
  // angle-arc layer (below) and the panel's measurements table. Without this the
  // two ran separate useCephAnalysis queries and the arcs ignored the switcher.
  const [cephAnalysisType, setCephAnalysisType] = useState<string>('steiner_hybrid_sn')

  // Cephalometric analysis (landmarks/tracing/report) is a v2-deferred surface
  // (workspace.ceph). v1 still stores + views ceph images as plain films; only the
  // analysis panel is gated. Flag OFF → isCeph false → plain imaging-view.
  const isCeph = modality === 'cephalometric' && isFeatureEnabled('workspace.ceph')
  const { landmarks: cephLandmarks, dragLandmark, commitLandmark } = useCephLandmarks(
    isCeph && cephPanelOpen ? imageId : '',
  )
  const { analysis: cephAnalysis } = useCephAnalysis(
    isCeph && cephPanelOpen ? imageId : '',
    cephAnalysisType,
  )

  const pixelSpacingMm = externalPixelSpacingMm ?? internalPixelSpacingMm

  const { measurements, createMeasurement, deleteMeasurement } = useMeasurements(imageId)

  // Selection model: Select mode lets the clinician pick an existing overlay to
  // remove it — reachable without arming a draw tool, and a click never starts a
  // new drawing (see processToolClick's 'select' short-circuit).
  const selectMode = toolMode === 'select'
  const selectedAnnotation = selectedAnnotationId
    ? (measurements.find((m) => m.id === selectedAnnotationId) ?? null)
    : null
  // Focus the viewport when an annotation is selected so keyboard Delete/Esc work
  // immediately (a paired keyboard on iPad, or after a tap-select).
  const viewportRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (selectMode && selectedAnnotationId) viewportRef.current?.focus()
  }, [selectMode, selectedAnnotationId])

  // Delete is destructive on autosaved clinical data with no server-side undo, so
  // offer a client-side Undo (re-POST the same overlay) on the confirmation toast.
  const handleDeleteAnnotation = useCallback(
    (id: string) => {
      const target = measurements.find((m) => m.id === id)
      setSelectedAnnotationId(null)
      deleteMeasurement.mutate(id, {
        onError: (err) => toastError(err, 'Could not delete annotation.'),
        onSuccess: () => {
          if (!target) {
            toast.success('Annotation deleted')
            return
          }
          const restore: CreateMeasurementInput = {
            type: target.type,
            geometry: target.geometry,
            measurementValue: target.measurementValue,
            measurementUnit: target.measurementUnit,
          }
          toast.success('Annotation deleted', {
            action: {
              label: 'Undo',
              onClick: () =>
                createMeasurement.mutate(restore, {
                  onError: (err) => toastError(err, 'Could not restore annotation.'),
                }),
            },
          })
        },
      })
    },
    [measurements, deleteMeasurement, createMeasurement],
  )

  // Select-mode shortcuts: Delete/Backspace removes the selection, Esc clears it.
  const handleAnnotationKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const decision = decideAnnotationKey(e.key, selectedAnnotationId != null)
      if (!decision) return
      e.preventDefault()
      if (decision === 'delete') handleDeleteAnnotation(selectedAnnotationId!)
      else setSelectedAnnotationId(null)
    },
    [selectedAnnotationId, handleDeleteAnnotation],
  )

  const { getCachedBlob, setCachedBlob } = useOfflineCache()

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(canvas.width / 2 + offsetRef.current.x, canvas.height / 2 + offsetRef.current.y)
    ctx.scale(scaleRef.current * (flipRef.current ? -1 : 1), scaleRef.current)
    ctx.rotate((rotationRef.current * Math.PI) / 2)
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    ctx.restore()
    setCephTransform({
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      imgWidth: img.width,
      imgHeight: img.height,
      scale: scaleRef.current,
      flip: flipRef.current,
      rotation: rotationRef.current,
      offsetX: offsetRef.current.x,
      offsetY: offsetRef.current.y,
    })
  }, [setCephTransform])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const cached = await getCachedBlob(imageId)
      const src = cached ? URL.createObjectURL(cached) : imageUrl
      const img = new Image()
      // Request CORS so the composited canvas stays untainted — the loupe reads
      // pixels back from it and the report PNG export calls toBlob(). The storage
      // origin (MinIO/S3) returns Access-Control-Allow-Origin; same-origin blob:
      // URLs ignore this attribute.
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (cancelled) return
        imgRef.current = img
        const canvas = canvasRef.current
        if (canvas) {
          canvas.width = canvas.offsetWidth || 800
          canvas.height = canvas.offsetHeight || 600
        }
        render()
        if (!cached) {
          // eslint-disable-next-line no-restricted-syntax -- presigned image blob download, not an API endpoint
          fetch(imageUrl)
            .then((r) => r.blob())
            .then((blob) => setCachedBlob(imageId, blob))
            .catch(() => {})
        }
      }
      img.src = src
    })()
    return () => {
      cancelled = true
    }
  }, [imageId, imageUrl, getCachedBlob, setCachedBlob, render])

  // Keep the canvas backing-store + ceph transform in sync with the element's
  // displayed size. Without this, resizing the window leaves canvas.width/height
  // (and cephTransform) stale, so the SVG landmark/tracing overlays — mapped via
  // imageToScreen(transform) — drift away from the image ("points all over").
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      if (!w || !h) return
      if (canvas.width === w && canvas.height === h) return
      canvas.width = w
      canvas.height = h
      render()
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [render])

  // Wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      scaleRef.current = Math.max(0.1, Math.min(10, scaleRef.current - e.deltaY * 0.001))
      render()
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [render])

  // Mouse pan — only active when no tool selected
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onDown = (e: MouseEvent) => {
      if (toolMode !== 'none') return
      isDraggingRef.current = true
      lastPosRef.current = { x: e.clientX, y: e.clientY }
    }
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      offsetRef.current.x += e.clientX - lastPosRef.current.x
      offsetRef.current.y += e.clientY - lastPosRef.current.y
      lastPosRef.current = { x: e.clientX, y: e.clientY }
      render()
    }
    const onUp = () => {
      isDraggingRef.current = false
    }
    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [render, toolMode])

  const rotate = (dir: 1 | -1) => {
    rotationRef.current = (rotationRef.current + dir + 4) % 4
    render()
  }
  const flip = () => {
    flipRef.current = !flipRef.current
    render()
  }
  const fullscreen = () => {
    void containerRef.current?.requestFullscreen()
  }

  // SVG click handler
  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return
      // In Select mode a bare canvas click (annotations stop propagation) clears
      // the selection; it must never fall through to the drawing reducer.
      if (toolMode === 'select') {
        setSelectedAnnotationId(null)
        return
      }
      // No transform yet means no image drawn — nothing to annotate onto.
      if (!cephTransform) return
      const rect = svg.getBoundingClientRect()
      // Store geometry in IMAGE space (screenToImage) so overlays stay glued to the
      // film under zoom/pan/rotate/flip and measurement values are transform-invariant.
      const newPoint = screenToImage(e.clientX - rect.left, e.clientY - rect.top, cephTransform)
      const action = processToolClick({
        toolMode,
        drawPoints,
        newPoint,
        isDoubleClick: e.detail === 2,
        pixelSpacingMm,
      })

      switch (action.type) {
        case 'noop':
          return
        case 'setPoints':
          setDrawPoints(action.points)
          return
        case 'openCalibration':
          setCalibrationPixelDist(action.pixelDistance)
          setDrawPoints(action.points)
          setCalibrationOpen(true)
          return
        case 'commit':
          createMeasurement.mutate(action.input, {
            onSuccess: (created) => {
              toast.success(savedLabelFor(action.input.type))
              // Hybrid flow: drop into Select with the fresh overlay picked, so a
              // mistake is immediately removable without hunting for it.
              setSelectedAnnotationId(created.id)
              setToolMode('select')
            },
            onError: (err) => toastError(err, 'Could not save measurement.'),
          })
          setDrawPoints([])
          onMeasurementSaved?.()
          return
        case 'promptLabel':
          setPendingAnnotation({ kind: 'label', point: action.point })
          return
        case 'promptTooth':
          setPendingAnnotation({ kind: 'tooth', point: action.point })
          return
      }
    },
    [toolMode, drawPoints, pixelSpacingMm, createMeasurement, onMeasurementSaved, cephTransform],
  )

  // Confirm handler for the annotation input dialog. Builds the measurement from
  // the pending point + raw input exactly as the old window.prompt path did, then
  // commits with the same toasts. Validation lives both inline in the dialog
  // (tooth range / inline error) and in build*Measurement (the final guard — an
  // empty label or out-of-range tooth returns null → no commit), which matches
  // the prior behaviour. On success or a null build it closes + clears points.
  const handleAnnotationConfirm = useCallback(
    (raw: string) => {
      if (!pendingAnnotation) return
      const { kind, point } = pendingAnnotation
      const input =
        kind === 'label' ? buildLabelMeasurement(point, raw) : buildToothMeasurement(point, raw)
      setPendingAnnotation(null)
      if (!input) {
        setDrawPoints([])
        return
      }
      createMeasurement.mutate(input, {
        onSuccess: (created) => {
          toast.success(savedLabelFor(input.type))
          setSelectedAnnotationId(created.id)
          setToolMode('select')
        },
        onError: (err) => toastError(err, 'Could not save measurement.'),
      })
      setDrawPoints([])
      onMeasurementSaved?.()
    },
    [pendingAnnotation, createMeasurement, onMeasurementSaved],
  )

  // Cancel mirrors the prior `text == null` branch of window.prompt: clear the
  // in-progress draw points and close the dialog without committing.
  const handleAnnotationCancel = useCallback(() => {
    setPendingAnnotation(null)
    setDrawPoints([])
  }, [])

  const handleCalibrationConfirm = useCallback(
    async (actualMm: number) => {
      // G6: persist the 2 ruler points + known distance as a versioned record.
      // drawPoints still holds the two calibration points the operator drew.
      const req = buildCalibrationRequest({ points: drawPoints, actualMm })
      if (!req) return
      await confirmCalibrationSave({
        save: () =>
          imagingMgmtUpdateImageCalibration({
            path: { imageId },
            body: {
              pixelSpacingMm: req.pixelSpacingMm,
              pointA: req.pointA,
              pointB: req.pointB,
              knownDistanceMm: req.knownDistanceMm,
            },
            throwOnError: true,
          }),
        onError: (err) => toastError(err, 'Could not save calibration.'),
        onSuccess: () => {
          setInternalPixelSpacingMm(req.pixelSpacingMm)
          onCalibrationSaved?.(req.pixelSpacingMm)
          setCalibrationOpen(false)
          setDrawPoints([])
          setToolMode('none')
        },
      })
    },
    [drawPoints, imageId, onCalibrationSaved],
  )

  const handleExportPng = useCallback(
    async (reportVersion: number) => {
      const img = imgRef.current
      if (!img) return
      const canvas = composeCephCanvas(img, cephLandmarks)
      const blob = await canvasToPngBlob(canvas)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ceph-report-${imageId}-v${reportVersion}.png`
      a.click()
      URL.revokeObjectURL(url)
    },
    [imageId, cephLandmarks],
  )

  // #13 keyboard flow: Tab/Enter advance to next unplaced; arrows nudge the
  // selected placed (non-locked) landmark 1px. preventDefault traps focus so Tab
  // doesn't escape to browser chrome.
  const handleCephKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isCeph || !cephPanelOpen) return
      const { action, preventDefault } = decideCephKey({
        key: e.key,
        selectedCode: cephSelectedCode,
        landmarks: cephLandmarks.map((l) => ({
          landmarkCode: l.landmarkCode,
          x: l.x,
          y: l.y,
          status: l.status,
        })),
      })
      if (preventDefault) e.preventDefault()
      switch (action.type) {
        case 'select':
          setCephSelectedCode(action.code)
          return
        case 'nudge':
          dragLandmark(action.code, action.x, action.y)
          void commitLandmark.mutateAsync({ code: action.code, x: action.x, y: action.y })
          return
        case 'none':
          return
      }
    },
    [isCeph, cephPanelOpen, cephSelectedCode, cephLandmarks, dragLandmark, commitLandmark],
  )

  const isCalibrated = Boolean(pixelSpacingMm)

  return (
    <div ref={containerRef} className={`relative flex flex-col bg-black ${className ?? ''}`}>
      {/* Viewer toolbar */}
      <div className="flex items-center gap-2 p-2 bg-zinc-900" data-testid="imaging-toolbar">
        <button onClick={() => rotate(-1)} aria-label="Rotate counter-clockwise" className="min-h-[44px] px-2.5 py-1.5 text-xs text-white bg-zinc-700 rounded">↺ CCW</button>
        <button onClick={() => rotate(1)} aria-label="Rotate clockwise" className="min-h-[44px] px-2.5 py-1.5 text-xs text-white bg-zinc-700 rounded">↻ CW</button>
        <button onClick={flip} aria-label="Flip image" className="min-h-[44px] px-2.5 py-1.5 text-xs text-white bg-zinc-700 rounded">⇆ Flip</button>
        <label className="text-xs text-zinc-300">
          Brightness
          <input type="range" min={0} max={200} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="ml-1 w-20" data-testid="brightness-control" aria-label="Brightness" />
        </label>
        <label className="text-xs text-zinc-300">
          Contrast
          <input type="range" min={0} max={200} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="ml-1 w-20" data-testid="contrast-control" aria-label="Contrast" />
        </label>
        <button
          onClick={() => setFindingsPanelOpen((prev) => !prev)}
          className={`px-2 py-1 text-xs rounded ${findingsPanelOpen ? 'bg-lemon/20 text-lemon border border-lemon/40' : 'text-white bg-zinc-700'}`}
          aria-pressed={findingsPanelOpen}
        >
          Findings
        </button>
        {isCeph && (
          <button
            onClick={() => setCephPanelOpen((prev) => !prev)}
            className={`px-2 py-1 text-xs rounded ${cephPanelOpen ? 'bg-lemon/20 text-lemon border border-lemon/40' : 'text-white bg-zinc-700'}`}
            aria-pressed={cephPanelOpen}
            aria-label="Toggle ceph panel"
          >
            Ceph
          </button>
        )}
        <button onClick={fullscreen} aria-label="Fullscreen" data-testid="fullscreen-btn" className="ml-auto min-h-[44px] px-2.5 py-1.5 text-xs text-white bg-zinc-700 rounded">⛶ Fullscreen</button>
      </div>

      <MeasurementToolbar toolMode={toolMode} onToolChange={setToolMode} isCalibrated={isCalibrated} modality={modality} onRequestCalibrate={() => setToolMode('calibration')} />
      <AnnotationToolbar toolMode={toolMode} onToolChange={setToolMode} />

      <div className="flex flex-row flex-1 overflow-hidden">
        <div
          ref={viewportRef}
          style={{ filter: `brightness(${brightness}%) contrast(${contrast}%)`, flex: 1, position: 'relative' }}
          className="overflow-hidden outline-none"
          tabIndex={(isCeph && cephPanelOpen) || selectMode ? 0 : undefined}
          onKeyDown={(e) => {
            handleCephKeyDown(e)
            if (selectMode) handleAnnotationKeyDown(e)
          }}
          onPointerMove={(e) => {
            if (!isCeph || !cephPanelOpen || !cephSelectedCode) return
            const rect = e.currentTarget.getBoundingClientRect()
            setCephPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top })
          }}
          onPointerLeave={() => setCephPointer(null)}
        >
          <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" style={{ display: 'block' }} />
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full"
            data-testid="measurement-svg-overlay"
            style={{
              cursor: toolMode === 'select' ? 'default' : toolMode !== 'none' ? 'crosshair' : 'default',
              pointerEvents: toolMode !== 'none' ? 'auto' : 'none',
            }}
            onClick={handleSvgClick}
          >
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill={BRAND_GOLD} />
              </marker>
              {/* Selected-annotation cue: a white halo. Gold overlays glow white so the
                  selection reads on the dark film without relying on colour alone (paired
                  with the action bar as the non-colour signal). */}
              <filter id="annotationSelectGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#FFFFFF" floodOpacity="0.9" />
              </filter>
            </defs>

            {/* Overlays live in image space and map image→screen via the canvas
                transform; without it (image not drawn yet) there's nothing to place. */}
            {cephTransform && measurements.map((m) => {
              const isAnnotationType = ['label', 'arrow', 'freehand', 'shape', 'tooth'].includes(m.type)
              const Shape = isAnnotationType ? AnnotationShape : MeasurementShape
              return (
                <Shape
                  key={m.id}
                  annotation={m}
                  pixelSpacingMm={pixelSpacingMm}
                  transform={cephTransform}
                  selectMode={selectMode}
                  isSelected={selectMode && m.id === selectedAnnotationId}
                  onSelect={setSelectedAnnotationId}
                />
              )
            })}
            {cephTransform && <DrawingPreview toolMode={toolMode} points={drawPoints} transform={cephTransform} />}
            {selectMode && selectedAnnotation && cephTransform && (
              <AnnotationActionBar
                annotation={selectedAnnotation}
                transform={cephTransform}
                onDelete={handleDeleteAnnotation}
                onLinkFinding={(id) => { setSelectedAnnotationId(id); setFindingsPanelOpen(true) }}
              />
            )}
          </svg>

          {isCeph && cephPanelOpen && cephTransform && (
            <>
              {cephLayers.tracing && (
                <CephTracingOverlay landmarks={cephLandmarks} transform={cephTransform} width={cephTransform.canvasWidth} height={cephTransform.canvasHeight} />
              )}
              {cephLayers.arcs && (
                <CephAngleArcLayer landmarks={cephLandmarks} transform={cephTransform} measurements={cephAnalysis?.measurements ?? {}} width={cephTransform.canvasWidth} height={cephTransform.canvasHeight} />
              )}
              {cephLayers.landmarks && (
                <CephLandmarkLayer
                  landmarks={cephLandmarks}
                  selectedCode={cephSelectedCode}
                  transform={cephTransform}
                  width={cephTransform.canvasWidth}
                  height={cephTransform.canvasHeight}
                  onPlace={(code, x, y) => {
                    void commitLandmark.mutateAsync({ code, x, y })
                    // Advance to the next unplaced landmark (keyboard-free fast flow)
                    const placed = new Set(cephLandmarks.map((l) => l.landmarkCode))
                    placed.add(code)
                    setCephSelectedCode(nextUnplacedCode(placed, code))
                  }}
                  onDrag={(code, x, y) => dragLandmark(code, x, y)}
                  onCommit={(code, x, y) => void commitLandmark.mutateAsync({ code, x, y })}
                />
              )}
            </>
          )}

          {isCeph && cephPanelOpen && (
            <CephLoupe
              sourceCanvas={canvasRef.current}
              pointer={cephPointer}
              selectedCode={cephSelectedCode}
            />
          )}
        </div>

        <FindingsSidebar imageId={imageId} isOpen={findingsPanelOpen} onClose={() => setFindingsPanelOpen(false)} initialAnnotationId={selectedAnnotationId ?? undefined} />
        <CephWorkspacePanel
          imageId={imageId}
          isOpen={isCeph && cephPanelOpen}
          onClose={() => setCephPanelOpen(false)}
          onLayerChange={(key, value) => setCephLayers((prev) => ({ ...prev, [key]: value }))}
          onExportPng={(v) => void handleExportPng(v)}
          selectedCode={cephSelectedCode}
          onSelectCode={setCephSelectedCode}
          analysisType={cephAnalysisType}
          onAnalysisTypeChange={setCephAnalysisType}
        />
      </div>

      <CalibrationDialog
        open={calibrationOpen}
        pixelDistance={calibrationPixelDist}
        onConfirm={(mm) => void handleCalibrationConfirm(mm)}
        onCancel={() => { setCalibrationOpen(false); setDrawPoints([]) }}
      />

      <AnnotationInputDialog
        open={pendingAnnotation !== null}
        kind={pendingAnnotation?.kind ?? 'label'}
        onConfirm={handleAnnotationConfirm}
        onCancel={handleAnnotationCancel}
      />
    </div>
  )
}
