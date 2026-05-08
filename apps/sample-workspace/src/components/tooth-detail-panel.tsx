import { useState, useEffect } from 'react'
import { SurfaceSelector } from './surface-selector'
import type { SurfaceCondition, ConditionType } from '@/data/mock-visits'
import { CONDITION_COLORS } from './dental/constants'
import { UNIVERSAL_TOOTH_MAP } from './dental/types'

interface ToothDetailPanelProps {
  toothNumber: number
  existingConditions: SurfaceCondition[]
  onSave: (condition: SurfaceCondition) => void
  onClose: () => void
}

const CONDITIONS: { type: ConditionType; label: string }[] = [
  { type: 'caries',   label: 'Caries'   },
  { type: 'decayed',  label: 'Decayed'  },
  { type: 'crown',    label: 'Crown'    },
  { type: 'extract',  label: 'Extract'  },
  { type: 'filling',  label: 'Filling'  },
  { type: 'fracture', label: 'Fracture' },
]

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatCost(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return ''
  return num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Step Indicator ────────────────────────────────────────────────────────────

interface StepIndicatorProps {
  step: 1 | 2 | 3
}

function StepIndicator({ step }: StepIndicatorProps) {
  const labels = ['Condition', 'Treatment', 'Review']

  function circleStyle(idx: number): React.CSSProperties {
    const n = idx + 1
    const base: React.CSSProperties = {
      width: 28,
      height: 28,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      fontWeight: 700,
      flexShrink: 0,
      fontFamily: 'Sora, sans-serif',
    }
    if (n < step) return { ...base, background: '#22c55e', color: '#000' }
    if (n === step) return { ...base, background: '#FFE97D', color: '#000' }
    return { ...base, background: '#f3f4f6', color: '#9ca3af' }
  }

  function lineColor(afterIdx: number): string {
    // line between circle afterIdx and afterIdx+1
    return afterIdx + 1 < step ? '#22c55e' : '#e5e7eb'
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 24 }}>
      {labels.map((label, idx) => (
        <div key={label} style={{ display: 'flex', alignItems: 'flex-start', flex: idx < 2 ? 1 : 'none' }}>
          {/* circle + label */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={circleStyle(idx)}>
              {idx + 1 < step ? '✓' : idx + 1}
            </div>
            <span style={{
              fontSize: 10,
              fontFamily: 'Sora, sans-serif',
              color: idx + 1 === step ? '#111' : idx + 1 < step ? '#22c55e' : '#9ca3af',
              fontWeight: idx + 1 === step ? 600 : 400,
              whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
          </div>
          {/* connecting line */}
          {idx < 2 && (
            <div style={{
              flex: 1,
              height: 2,
              background: lineColor(idx),
              marginTop: 13,
              marginLeft: 4,
              marginRight: 4,
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Panel Header ──────────────────────────────────────────────────────────────

interface PanelHeaderProps {
  toothNumber: number
  onClose: () => void
}

function PanelHeader({ toothNumber, onClose }: PanelHeaderProps) {
  const toothInfo = UNIVERSAL_TOOTH_MAP[toothNumber]
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Sora, sans-serif', color: '#111' }}>
          Tooth #{toothNumber}
        </div>
        {toothInfo && (
          <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>
            {toothInfo.name}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 18,
          color: '#6b7280',
          padding: '2px 6px',
          lineHeight: 1,
        }}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  )
}

// ── Condition Summary Chip ────────────────────────────────────────────────────

interface SummaryChipProps {
  condition: ConditionType
  surfaces: string[]
}

function SummaryChip({ condition, surfaces }: SummaryChipProps) {
  const color = CONDITION_COLORS[condition]
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: hexToRgba(color, 0.12),
      border: `1px solid ${hexToRgba(color, 0.4)}`,
      borderRadius: 20,
      padding: '4px 10px',
      fontSize: 12,
      fontFamily: 'DM Sans, sans-serif',
      color: '#111',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span>{capitalize(condition)} — {surfaces.map(capitalize).join(', ')}</span>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  fontFamily: 'DM Sans, sans-serif',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  color: '#111',
  background: '#fff',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'Sora, sans-serif',
  color: '#374151',
  marginBottom: 4,
  display: 'block',
}

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  marginBottom: 12,
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ToothDetailPanel({ toothNumber, existingConditions, onSave, onClose }: ToothDetailPanelProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedSurfaces, setSelectedSurfaces] = useState<string[]>([])
  const [selectedCondition, setSelectedCondition] = useState<ConditionType | null>(null)
  const [treatment, setTreatment] = useState('')
  const [cdtCode, setCdtCode] = useState('')
  const [notes, setNotes] = useState('')
  const [cost, setCost] = useState('')

  // Reset when tooth changes
  useEffect(() => {
    setStep(1)
    setSelectedSurfaces([])
    setSelectedCondition(null)
    setTreatment('')
    setCdtCode('')
    setNotes('')
    setCost('')
  }, [toothNumber])

  function handleToggleSurface(surface: string) {
    setSelectedSurfaces(prev =>
      prev.includes(surface) ? prev.filter(s => s !== surface) : [...prev, surface]
    )
  }

  function handleSave() {
    if (!selectedCondition || selectedSurfaces.length === 0) return
    onSave({
      toothNumber,
      surfaces: selectedSurfaces,
      condition: selectedCondition,
      treatment: treatment || undefined,
      cdtCode: cdtCode || undefined,
      notes: notes || undefined,
      cost: cost ? parseFloat(cost) : undefined,
    })
    setStep(1)
    setSelectedSurfaces([])
    setSelectedCondition(null)
    setTreatment('')
    setCdtCode('')
    setNotes('')
    setCost('')
  }

  const conditionColor = selectedCondition ? CONDITION_COLORS[selectedCondition] : undefined
  const step1Valid = selectedSurfaces.length > 0 && selectedCondition !== null

  return (
    <div data-testid="tooth-detail-panel" style={{
      width: 340,
      height: '100%',
      background: '#ffffff',
      borderLeft: '1px solid #e8e6e1',
      padding: 24,
      overflowY: 'auto',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <PanelHeader toothNumber={toothNumber} onClose={onClose} />
      <StepIndicator step={step} />

      {/* ── Step 1: Condition ── */}
      {step === 1 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Surface Selector */}
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <SurfaceSelector
              toothNumber={toothNumber}
              selectedSurfaces={selectedSurfaces}
              onToggle={handleToggleSurface}
              highlightColor={conditionColor}
            />
          </div>

          {/* Condition Grid */}
          <div style={{ marginBottom: 4 }}>
            <span style={{ ...labelStyle }}>Select Condition</span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginBottom: 20,
          }}>
            {CONDITIONS.map(({ type, label }) => {
              const color = CONDITION_COLORS[type]
              const isSelected = selectedCondition === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedCondition(type)}
                  style={{
                    borderRadius: 8,
                    padding: '10px 6px',
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 400,
                    fontFamily: 'DM Sans, sans-serif',
                    border: `2px solid ${isSelected ? color : '#e5e7eb'}`,
                    background: isSelected ? hexToRgba(color, 0.12) : '#fafafa',
                    color: '#111',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.12s',
                    lineHeight: 1.2,
                  }}
                >
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: color,
                    margin: '0 auto 4px',
                  }} />
                  {label}
                </button>
              )
            })}
          </div>

          {/* Actions */}
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: '1.5px solid #d1d5db',
                background: '#fff',
                color: '#374151',
                fontFamily: 'Sora, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: 'none',
                background: step1Valid ? '#FFE97D' : '#f3f4f6',
                color: step1Valid ? '#111' : '#9ca3af',
                fontFamily: 'Sora, sans-serif',
                fontSize: 13,
                fontWeight: 700,
                cursor: step1Valid ? 'pointer' : 'not-allowed',
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Treatment ── */}
      {step === 2 && selectedCondition && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Summary chip */}
          <div style={{ marginBottom: 16 }}>
            <SummaryChip condition={selectedCondition} surfaces={selectedSurfaces} />
          </div>

          {/* Treatment fields */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Treatment Plan <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
            <input
              type="text"
              value={treatment}
              onChange={e => setTreatment(e.target.value)}
              placeholder="e.g. Composite Filling"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>CDT Code <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
            <input
              type="text"
              value={cdtCode}
              onChange={e => setCdtCode(e.target.value)}
              placeholder="e.g. D2391"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Notes <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Estimated Cost <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6b7280',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 14,
                pointerEvents: 'none',
              }}>₱</span>
              <input
                type="number"
                value={cost}
                onChange={e => setCost(e.target.value)}
                placeholder="0.00"
                min={0}
                step={0.01}
                style={{ ...inputStyle, paddingLeft: 28 }}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8, paddingTop: 8 }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: '1.5px solid #d1d5db',
                background: '#fff',
                color: '#374151',
                fontFamily: 'Sora, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: 'none',
                background: '#FFE97D',
                color: '#111',
                fontFamily: 'Sora, sans-serif',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review ── */}
      {step === 3 && selectedCondition && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Summary card */}
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            background: '#fafafa',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Sora, sans-serif', color: '#111', marginBottom: 10 }}>
              {UNIVERSAL_TOOTH_MAP[toothNumber]?.name ?? `Tooth #${toothNumber}`}
            </div>
            <ReviewRow label="Surfaces" value={selectedSurfaces.map(capitalize).join(', ')} />
            <ReviewRow
              label="Condition"
              value={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: CONDITION_COLORS[selectedCondition],
                    flexShrink: 0,
                    display: 'inline-block',
                  }} />
                  {capitalize(selectedCondition)}
                </span>
              }
            />
            {treatment && <ReviewRow label="Treatment" value={treatment} />}
            {cdtCode && <ReviewRow label="CDT Code" value={cdtCode} />}
            {notes && <ReviewRow label="Notes" value={notes} />}
            {cost && <ReviewRow label="Est. Cost" value={`₱${formatCost(cost)}`} />}
          </div>

          {/* Existing conditions */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Sora, sans-serif', color: '#374151', marginBottom: 8 }}>
              Existing Conditions
            </div>
            {existingConditions.length === 0 ? (
              <p style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
                No other conditions on this tooth.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {existingConditions.map((ec, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    fontFamily: 'DM Sans, sans-serif',
                    color: '#374151',
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '6px 10px',
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: CONDITION_COLORS[ec.condition],
                      flexShrink: 0,
                    }} />
                    <span style={{ fontWeight: 600 }}>{capitalize(ec.condition)}</span>
                    <span style={{ color: '#9ca3af' }}>—</span>
                    <span>{ec.surfaces.map(capitalize).join(', ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: '1.5px solid #d1d5db',
                background: '#fff',
                color: '#374151',
                fontFamily: 'Sora, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: 'none',
                background: '#22c55e',
                color: '#fff',
                fontFamily: 'Sora, sans-serif',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
      <span style={{ color: '#6b7280', minWidth: 72, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#111', fontWeight: 500, flex: 1 }}>{value}</span>
    </div>
  )
}
