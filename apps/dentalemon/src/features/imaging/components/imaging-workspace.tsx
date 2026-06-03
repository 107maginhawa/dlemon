import { useEffect, useRef, useState, useCallback } from 'react'
import { composeCephCanvas, canvasToPngBlob } from '../lib/ceph-export'
import type { LayerState } from './CephLayerPanel'
import { useOfflineCache } from '../hooks/use-offline-cache'
import { useMeasurements } from '../hooks/use-measurements'
import { MeasurementToolbar, type ToolMode } from './measurement-toolbar'
import { AnnotationToolbar } from './annotation-toolbar'
import { CalibrationDialog } from './calibration-dialog'
import { FindingsSidebar } from './FindingsSidebar'
import { CephWorkspacePanel } from './CephWorkspacePanel'
import { CephLandmarkLayer } from './CephLandmarkLayer'
import { CephLoupe } from './CephLoupe'
import { decideCephKey, nextUnplacedCode } from '../lib/ceph-keyboard'
import { CephTracingOverlay } from './CephTracingOverlay'
import { CephAngleArcLayer } from './CephAngleArcLayer'
import { useCephLandmarks } from '../hooks/use-ceph-landmarks'
import { useCephAnalysis } from '../hooks/use-ceph-analysis'
import type { CephTransformState } from '@monobase/ceph-math'
import { MeasurementShape, AnnotationShape, DrawingPreview } from './canvas-overlays'
import { BRAND_GOLD } from '@/constants/brand'
import { apiBaseUrl } from '@/lib/config'
import {
  processToolClick,
  buildLabelMeasurement,
  buildToothMeasurement,
} from './imaging-workspace.handlers'

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

  const isCeph = modality === 'cephalometric'
  const { landmarks: cephLandmarks, dragLandmark, commitLandmark } = useCephLandmarks(
    isCeph && cephPanelOpen ? imageId : '',
  )
  const { analysis: cephAnalysis } = useCephAnalysis(
    isCeph && cephPanelOpen ? imageId : '',
  )

  const pixelSpacingMm = externalPixelSpacingMm ?? internalPixelSpacingMm

  const { measurements, createMeasurement, deleteMeasurement } = useMeasurements(imageId)

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
      const rect = svg.getBoundingClientRect()
      const newPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top }
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
          createMeasurement.mutate(action.input)
          setDrawPoints([])
          onMeasurementSaved?.()
          return
        case 'promptLabel': {
          const text = window.prompt('Label text (max 200 chars):')
          const input = text == null ? null : buildLabelMeasurement(action.point, text)
          if (!input) { setDrawPoints([]); return }
          createMeasurement.mutate(input)
          setDrawPoints([])
          onMeasurementSaved?.()
          return
        }
        case 'promptTooth': {
          const raw = window.prompt('Tooth number (1–32):')
          const input = raw == null ? null : buildToothMeasurement(action.point, raw)
          if (!input) { setDrawPoints([]); return }
          createMeasurement.mutate(input)
          setDrawPoints([])
          onMeasurementSaved?.()
          return
        }
      }
    },
    [toolMode, drawPoints, pixelSpacingMm, createMeasurement, onMeasurementSaved],
  )

  const handleCalibrationConfirm = useCallback(
    async (actualMm: number) => {
      if (calibrationPixelDist <= 0 || actualMm <= 0) return
      const pxMm = actualMm / calibrationPixelDist
      await fetch(`${apiBaseUrl}/dental/imaging/images/${imageId}/calibration`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixelSpacingMm: pxMm }),
      })
      setInternalPixelSpacingMm(pxMm)
      onCalibrationSaved?.(pxMm)
      setCalibrationOpen(false)
      setDrawPoints([])
      setToolMode('none')
    },
    [calibrationPixelDist, imageId, onCalibrationSaved],
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
      <div className="flex items-center gap-2 p-2 bg-zinc-900">
        <button onClick={() => rotate(-1)} className="px-2 py-1 text-xs text-white bg-zinc-700 rounded">↺ CCW</button>
        <button onClick={() => rotate(1)} className="px-2 py-1 text-xs text-white bg-zinc-700 rounded">↻ CW</button>
        <button onClick={flip} className="px-2 py-1 text-xs text-white bg-zinc-700 rounded">⇆ Flip</button>
        <label className="text-xs text-zinc-300">
          Brightness
          <input type="range" min={0} max={200} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="ml-1 w-20" />
        </label>
        <label className="text-xs text-zinc-300">
          Contrast
          <input type="range" min={0} max={200} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="ml-1 w-20" />
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
        <button onClick={fullscreen} className="ml-auto px-2 py-1 text-xs text-white bg-zinc-700 rounded">⛶ Fullscreen</button>
      </div>

      <MeasurementToolbar toolMode={toolMode} onToolChange={setToolMode} isCalibrated={isCalibrated} modality={modality} onRequestCalibrate={() => setToolMode('calibration')} />
      <AnnotationToolbar toolMode={toolMode} onToolChange={setToolMode} />

      <div className="flex flex-row flex-1 overflow-hidden">
        <div
          style={{ filter: `brightness(${brightness}%) contrast(${contrast}%)`, flex: 1, position: 'relative' }}
          className="overflow-hidden outline-none"
          tabIndex={isCeph && cephPanelOpen ? 0 : undefined}
          onKeyDown={handleCephKeyDown}
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
              cursor: toolMode !== 'none' ? 'crosshair' : 'default',
              pointerEvents: toolMode !== 'none' ? 'auto' : 'none',
            }}
            onClick={handleSvgClick}
          >
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill={BRAND_GOLD} />
              </marker>
            </defs>

            {measurements.map((m) => {
              const isAnnotationType = ['label', 'arrow', 'freehand', 'shape', 'tooth'].includes(m.type)
              if (isAnnotationType) {
                return (
                  <AnnotationShape
                    key={m.id}
                    annotation={m}
                    pixelSpacingMm={pixelSpacingMm}
                    onDelete={(id) => deleteMeasurement.mutate(id)}
                    onAnnotationClick={(id) => { setSelectedAnnotationId(id); setFindingsPanelOpen(true) }}
                  />
                )
              }
              return (
                <MeasurementShape
                  key={m.id}
                  annotation={m}
                  pixelSpacingMm={pixelSpacingMm}
                  onDelete={(id) => deleteMeasurement.mutate(id)}
                />
              )
            })}
            <DrawingPreview toolMode={toolMode} points={drawPoints} />
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
        />
      </div>

      <CalibrationDialog
        open={calibrationOpen}
        pixelDistance={calibrationPixelDist}
        onConfirm={(mm) => void handleCalibrationConfirm(mm)}
        onCancel={() => { setCalibrationOpen(false); setDrawPoints([]) }}
      />
    </div>
  )
}
