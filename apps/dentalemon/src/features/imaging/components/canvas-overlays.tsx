import type { ImagingAnnotation } from '../hooks/use-measurements'
import type { ToolMode } from './measurement-toolbar'
import { BRAND_GOLD } from '@/constants/brand'

interface AnnotationShapeProps {
  annotation: ImagingAnnotation
  pixelSpacingMm: number | null | undefined
  onDelete: (id: string) => void
  onAnnotationClick?: (id: string) => void
}

/**
 * Returns true when a distance/area measurement was stored in raw pixel units,
 * meaning the image was not calibrated at draw time. We surface a warning glyph
 * so clinicians never mistake a px value for a clinical mm measurement.
 */
function isUncalibratedPxMeasurement(annotation: ImagingAnnotation): boolean {
  const unit = annotation.measurementUnit
  return (
    (annotation.type === 'distance' || annotation.type === 'line' || annotation.type === 'area') &&
    (unit === 'px' || unit === 'px²' || unit == null)
  )
}

export function MeasurementShape({ annotation, onDelete }: AnnotationShapeProps) {
  const geo = annotation.geometry as Record<string, unknown>

  if (annotation.type === 'line' || annotation.type === 'distance') {
    const pts = geo.points as { x: number; y: number }[] | undefined
    if (!pts || pts.length < 2) return null
    const p1 = pts[0]!
    const p2 = pts[1]!
    const mx = (p1.x + p2.x) / 2
    const my = (p1.y + p2.y) / 2
    const uncalibrated = isUncalibratedPxMeasurement(annotation)
    const unit = annotation.measurementUnit ?? 'px'
    const label =
      annotation.measurementValue !== null
        ? `${uncalibrated ? '⚠ ' : ''}${annotation.measurementValue.toFixed(1)} ${unit}`
        : ''
    const labelColor = uncalibrated ? '#FCA5A5' : BRAND_GOLD
    return (
      <g data-testid="saved-measurement">
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={labelColor} strokeWidth={2} strokeDasharray={uncalibrated ? '5 3' : undefined} />
        <text x={mx} y={my - 6} fill={labelColor} fontSize={12} textAnchor="middle" aria-label={uncalibrated ? `Uncalibrated measurement: ${label}` : label}>
          {label}
        </text>
        <circle
          cx={p2.x}
          cy={p2.y}
          r={6}
          fill="red"
          fillOpacity={0.7}
          style={{ cursor: 'pointer' }}
          onClick={() => onDelete(annotation.id)}
        />
      </g>
    )
  }

  if (annotation.type === 'angle') {
    const pts = geo.points as { x: number; y: number }[] | undefined
    if (!pts || pts.length < 3) return null
    const p1 = pts[0]!
    const p2 = pts[1]!
    const p3 = pts[2]!
    const label =
      annotation.measurementValue !== null
        ? `${annotation.measurementValue.toFixed(1)}°`
        : ''
    return (
      <g>
        <polyline
          points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
          fill="none"
          stroke={BRAND_GOLD}
          strokeWidth={2}
        />
        <text x={p2.x} y={p2.y - 8} fill={BRAND_GOLD} fontSize={12} textAnchor="middle">
          {label}
        </text>
        <circle
          cx={p3.x}
          cy={p3.y}
          r={6}
          fill="red"
          fillOpacity={0.7}
          style={{ cursor: 'pointer' }}
          onClick={() => onDelete(annotation.id)}
        />
      </g>
    )
  }

  if (annotation.type === 'area') {
    const pts = geo.points as { x: number; y: number }[] | undefined
    if (!pts || pts.length < 3) return null
    const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ')
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
    const lastPt = pts[pts.length - 1]!
    const uncalibrated = isUncalibratedPxMeasurement(annotation)
    const unit = annotation.measurementUnit ?? 'px²'
    const label =
      annotation.measurementValue !== null
        ? `${uncalibrated ? '⚠ ' : ''}${annotation.measurementValue.toFixed(1)} ${unit}`
        : ''
    const areaColor = uncalibrated ? '#FCA5A5' : BRAND_GOLD
    return (
      <g>
        <polygon
          points={pointsStr}
          fill={areaColor}
          fillOpacity={0.2}
          stroke={areaColor}
          strokeWidth={2}
          strokeDasharray={uncalibrated ? '5 3' : undefined}
        />
        <text x={cx} y={cy} fill={areaColor} fontSize={12} textAnchor="middle" aria-label={uncalibrated ? `Uncalibrated measurement: ${label}` : label}>
          {label}
        </text>
        <circle
          cx={lastPt.x}
          cy={lastPt.y}
          r={6}
          fill="red"
          fillOpacity={0.7}
          style={{ cursor: 'pointer' }}
          onClick={() => onDelete(annotation.id)}
        />
      </g>
    )
  }

  return null
}

export function AnnotationShape({ annotation, onDelete, onAnnotationClick }: AnnotationShapeProps) {
  const geo = annotation.geometry as Record<string, unknown>

  if (annotation.type === 'label') {
    const pt = geo.point as { x: number; y: number } | undefined
    const text = geo.text as string | undefined
    if (!pt || !text) return null
    return (
      <g
        style={{ cursor: onAnnotationClick ? 'pointer' : 'default' }}
        onClick={() => onAnnotationClick?.(annotation.id)}
      >
        {/* UJ-IMG-002: annotation text rendered as JSX string child — React escapes it, no XSS possible */}
        <text x={pt.x} y={pt.y} fill={BRAND_GOLD} fontSize={13} fontWeight={600}>
          {text}
        </text>
        <circle
          cx={pt.x}
          cy={pt.y}
          r={6}
          fill="red"
          fillOpacity={0.7}
          style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onDelete(annotation.id) }}
        />
      </g>
    )
  }

  if (annotation.type === 'arrow') {
    const from = geo.from as { x: number; y: number } | undefined
    const to = geo.to as { x: number; y: number } | undefined
    if (!from || !to) return null
    return (
      <g>
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={BRAND_GOLD}
          strokeWidth={2}
          markerEnd="url(#arrowhead)"
        />
        <circle
          cx={to.x}
          cy={to.y}
          r={6}
          fill="red"
          fillOpacity={0.7}
          style={{ cursor: 'pointer' }}
          onClick={() => onDelete(annotation.id)}
        />
      </g>
    )
  }

  if (annotation.type === 'freehand') {
    const pts = geo.points as { x: number; y: number }[] | undefined
    if (!pts || pts.length < 2) return null
    const lastPt = pts[pts.length - 1]!
    return (
      <g>
        <polyline
          points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={BRAND_GOLD}
          strokeWidth={2}
        />
        <circle
          cx={lastPt.x}
          cy={lastPt.y}
          r={6}
          fill="red"
          fillOpacity={0.7}
          style={{ cursor: 'pointer' }}
          onClick={() => onDelete(annotation.id)}
        />
      </g>
    )
  }

  if (annotation.type === 'shape') {
    const shapeType = geo.shapeType as 'rect' | 'ellipse' | undefined
    const x = geo.x as number | undefined
    const y = geo.y as number | undefined
    const width = geo.width as number | undefined
    const height = geo.height as number | undefined
    if (shapeType == null || x == null || y == null || width == null || height == null) return null

    const deleteX = x + (width ?? 0)
    const deleteY = y

    if (shapeType === 'rect') {
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={BRAND_GOLD}
            fillOpacity={0.1}
            stroke={BRAND_GOLD}
            strokeWidth={2}
          />
          <circle
            cx={deleteX}
            cy={deleteY}
            r={6}
            fill="red"
            fillOpacity={0.7}
            style={{ cursor: 'pointer' }}
            onClick={() => onDelete(annotation.id)}
          />
        </g>
      )
    }

    if (shapeType === 'ellipse') {
      const cx = x + width / 2
      const cy = y + height / 2
      return (
        <g>
          <ellipse
            cx={cx}
            cy={cy}
            rx={width / 2}
            ry={height / 2}
            fill={BRAND_GOLD}
            fillOpacity={0.1}
            stroke={BRAND_GOLD}
            strokeWidth={2}
          />
          <circle
            cx={deleteX}
            cy={deleteY}
            r={6}
            fill="red"
            fillOpacity={0.7}
            style={{ cursor: 'pointer' }}
            onClick={() => onDelete(annotation.id)}
          />
        </g>
      )
    }
  }

  if (annotation.type === 'tooth') {
    const pt = geo.point as { x: number; y: number } | undefined
    const toothNumber = geo.toothNumber as number | undefined
    if (!pt || toothNumber == null) return null
    return (
      <g>
        <circle cx={pt.x} cy={pt.y} r={14} fill={BRAND_GOLD} fillOpacity={0.2} stroke={BRAND_GOLD} strokeWidth={2} />
        <text x={pt.x} y={pt.y + 5} fill={BRAND_GOLD} fontSize={11} fontWeight={700} textAnchor="middle">
          {toothNumber}
        </text>
        <circle
          cx={pt.x + 14}
          cy={pt.y - 14}
          r={6}
          fill="red"
          fillOpacity={0.7}
          style={{ cursor: 'pointer' }}
          onClick={() => onDelete(annotation.id)}
        />
      </g>
    )
  }

  return null
}

interface DrawingPreviewProps {
  toolMode: ToolMode | undefined
  points: { x: number; y: number }[]
}

export function DrawingPreview({ toolMode, points }: DrawingPreviewProps) {
  if (points.length === 0) return null

  if (toolMode === 'calibration' || toolMode === 'distance') {
    const p0 = points[0]
    if (!p0) return null
    if (points.length < 2) {
      return (
        <circle cx={p0.x} cy={p0.y} r={4} fill={BRAND_GOLD} fillOpacity={0.8} />
      )
    }
    const p1 = points[1]!
    return (
      <line
        x1={p0.x}
        y1={p0.y}
        x2={p1.x}
        y2={p1.y}
        stroke={BRAND_GOLD}
        strokeWidth={2}
        strokeDasharray="6 3"
      />
    )
  }

  if (toolMode === 'angle') {
    return (
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={BRAND_GOLD}
        strokeWidth={2}
        strokeDasharray="6 3"
      />
    )
  }

  if (toolMode === 'area' && points.length >= 2) {
    return (
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill={BRAND_GOLD}
        fillOpacity={0.15}
        stroke={BRAND_GOLD}
        strokeWidth={2}
        strokeDasharray="6 3"
      />
    )
  }

  if (toolMode === 'label' || toolMode === 'tooth') {
    const p0 = points[0]
    if (!p0) return null
    return <circle cx={p0.x} cy={p0.y} r={5} fill={BRAND_GOLD} fillOpacity={0.7} />
  }

  if (toolMode === 'arrow' && points.length >= 1) {
    const p0 = points[0]!
    if (points.length < 2) {
      return <circle cx={p0.x} cy={p0.y} r={4} fill={BRAND_GOLD} fillOpacity={0.8} />
    }
    const p1 = points[1]!
    return (
      <line
        x1={p0.x}
        y1={p0.y}
        x2={p1.x}
        y2={p1.y}
        stroke={BRAND_GOLD}
        strokeWidth={2}
        strokeDasharray="6 3"
        markerEnd="url(#arrowhead)"
      />
    )
  }

  if (toolMode === 'freehand' && points.length >= 2) {
    return (
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={BRAND_GOLD}
        strokeWidth={2}
        strokeDasharray="4 2"
      />
    )
  }

  if (toolMode === 'shape' && points.length >= 1) {
    const p0 = points[0]!
    if (points.length < 2) {
      return <circle cx={p0.x} cy={p0.y} r={4} fill={BRAND_GOLD} fillOpacity={0.8} />
    }
    const p1 = points[1]!
    const x = Math.min(p0.x, p1.x)
    const y = Math.min(p0.y, p1.y)
    const width = Math.abs(p1.x - p0.x)
    const height = Math.abs(p1.y - p0.y)
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={BRAND_GOLD}
        fillOpacity={0.1}
        stroke={BRAND_GOLD}
        strokeWidth={2}
        strokeDasharray="6 3"
      />
    )
  }

  return null
}
