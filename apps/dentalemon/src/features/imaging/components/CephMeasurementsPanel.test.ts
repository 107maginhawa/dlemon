import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { CephMeasurementsPanel } from './CephMeasurementsPanel'
import type { CephAnalysis } from '../hooks/use-ceph-analysis'

afterEach(cleanup)

function mkAnalysis(overrides: Partial<CephAnalysis> = {}): CephAnalysis {
  return {
    imageId: 'img1',
    analysisType: 'steiner_hybrid_sn',
    measurements: { sna: 82, sn_gome: 32 },
    missing: [],
    uncalibrated: false,
    calibrationValue: null,
    calibrationMethod: 'none',
    calibratedAt: null,
    calibratedBy: null,
    updatedAt: '',
    ...overrides,
  }
}

function renderPanel(analysis: CephAnalysis | null, isLoading = false, population?: string) {
  return render(
    React.createElement(CephMeasurementsPanel, { analysis, isLoading, population }),
  )
}

describe('CephMeasurementsPanel', () => {
  test('renders metric label "SNA"', () => {
    renderPanel(mkAnalysis())
    expect(screen.getByText('SNA')).not.toBeNull()
  })

  test('renders metric label "SN-GoMe" (NOT FMA / Mandibular Plane Angle) — D-F', () => {
    const { container } = renderPanel(mkAnalysis())
    expect(screen.getByText('SN-GoMe')).not.toBeNull()
    expect(container.textContent).not.toContain('FMA')
    expect(container.textContent).not.toContain('Mandibular Plane Angle')
  })

  test('shows steiner_hybrid_sn badge in header — D-G', () => {
    const { container } = renderPanel(mkAnalysis())
    expect(container.textContent).toContain('steiner_hybrid_sn')
  })

  test('shows SN footnote text — D-F', () => {
    const { container } = renderPanel(mkAnalysis())
    expect(container.textContent).toContain('referenced to Sella-Nasion')
  })

  test('shows numeric value formatted to 2dp', () => {
    renderPanel(mkAnalysis({ measurements: { sna: 82 } }))
    expect(screen.getByText('82.00')).not.toBeNull()
  })

  test('shows "missing: N" when N in analysis.missing', () => {
    const { container } = renderPanel(
      mkAnalysis({ measurements: { sna: null }, missing: ['N'] }),
    )
    expect(container.textContent).toContain('missing: N')
  })

  test('shows "calibrate for mm" for mm metric when uncalibrated=true', () => {
    const { container } = renderPanel(
      mkAnalysis({
        measurements: { overjet: null },
        uncalibrated: true,
      }),
    )
    expect(container.textContent).toContain('calibrate for mm')
  })

  // Revised D-H: the WORKING panel surfaces the industry-standard Class read-out as an
  // informational aid, but it must always carry the non-diagnostic framing. The frozen
  // EXPORTED report stays fully conservative (no Class verdict — enforced in
  // CephReportView.test.tsx), since that is the clinical/legal artifact.
  test('skeletal pattern read-out is labeled informational, not a diagnosis — revised D-H', () => {
    const { container } = renderPanel(
      mkAnalysis({ measurements: { anb: 6, sn_gome: 42, u1_sn: 112 } }),
    )
    expect(container.textContent).toContain('Class II')
    expect(container.textContent).toContain('Hyperdivergent')
    expect(container.textContent?.toLowerCase()).toContain('not a diagnosis')
  })

  test('shows no pattern block when nothing is classifiable', () => {
    const { container } = renderPanel(mkAnalysis({ measurements: {} }))
    expect(container.textContent).not.toContain('Class')
  })

  test('shows mm magnification footnote text — D-J', () => {
    const { container } = renderPanel(mkAnalysis())
    expect(container.textContent).toContain('magnification')
  })

  test('shows an amber deviation chip with signed delta for a 1–2 SD value', () => {
    // SNA norm 82±2; value 86 → +4 → 2.0 SD → mild
    const { container } = renderPanel(mkAnalysis({ measurements: { sna: 86 } }))
    expect(container.textContent).toContain('+4.0°')
  })

  test('shows a deviation chip for a >2 SD value (severe)', () => {
    // SNA norm 82±2; value 90 → +8 → 4.0 SD → severe
    const { container } = renderPanel(mkAnalysis({ measurements: { sna: 90 } }))
    expect(container.textContent).toContain('+8.0°')
  })

  test('shows NO deviation chip when value is within 1 SD (no traffic-light green)', () => {
    // SNA 82 is exactly the mean → normal → no chip / no delta shown
    const { container } = renderPanel(mkAnalysis({ measurements: { sna: 82 } }))
    expect(container.textContent).not.toContain('+0.0')
    expect(container.textContent).toContain('82.00')
  })

  test('shows the "reference ranges, not a diagnosis" disclaimer', () => {
    const { container } = renderPanel(mkAnalysis())
    expect(container.textContent?.toLowerCase()).toContain('reference ranges')
  })

  test('renders Ricketts metric rows (Facial Angle) and NOT Steiner-only rows (SNA) for a ricketts analysis', () => {
    const { container } = renderPanel(
      mkAnalysis({
        analysisType: 'ricketts',
        measurements: { facial_angle: 87, mandibular_plane_fh: 26 },
      }),
    )
    expect(container.textContent).toContain('Facial Angle')
    expect(container.textContent).not.toContain('SNA')
  })

  test('Ricketts norm chip uses the Ricketts norm (facial_angle 87±3), not a Steiner norm', () => {
    // facial_angle 93 → +6 → 2 SD → mild chip with +6.0°
    const { container } = renderPanel(
      mkAnalysis({ analysisType: 'ricketts', measurements: { facial_angle: 93 } }),
    )
    expect(container.textContent).toContain('+6.0°')
  })

  test('P1-8 renders Downs rows (Facial Angle (FH)) for a downs analysis, not SNA', () => {
    const { container } = renderPanel(
      mkAnalysis({
        analysisType: 'downs',
        measurements: { facial_angle: 87.8, mandibular_plane_angle: 22, interincisal: 135 },
      }),
    )
    expect(container.textContent).toContain('Facial Angle (FH)')
    expect(container.textContent).not.toContain('SNA')
  })

  test('P1-8 renders Tweed triangle rows (FMA / IMPA / FMIA)', () => {
    const { container } = renderPanel(
      mkAnalysis({ analysisType: 'tweed', measurements: { fma: 25, impa: 90, fmia: 65 } }),
    )
    expect(container.textContent).toContain('FMA')
    expect(container.textContent).toContain('IMPA')
    expect(container.textContent).toContain('FMIA')
  })

  test('P1-8 renders McNamara N-perp rows', () => {
    const { container } = renderPanel(
      mkAnalysis({ analysisType: 'mcnamara', measurements: { a_to_nperp: 1, pog_to_nperp: -2 } }),
    )
    expect(container.textContent).toContain('N-perp')
  })

  test('P1-8 renders Jarabak P/A facial-height row', () => {
    const { container } = renderPanel(
      mkAnalysis({ analysisType: 'jarabak', measurements: { pa_fhr: 64 } }),
    )
    expect(container.textContent).toContain('Facial Height')
  })

  test('P2-6 population selection swaps the norm set (African American SNA mean shifts the chip)', () => {
    // SNA 86 is +4 (severe) under default (82±2) but on-mean (normal, no chip) under
    // the African-American norm (86±3.7).
    const def = renderPanel(mkAnalysis({ measurements: { sna: 86 } }), false, 'default')
    expect(def.container.textContent).toContain('+4.0°')
    cleanup()
    const aa = renderPanel(mkAnalysis({ measurements: { sna: 86 } }), false, 'african_american')
    expect(aa.container.textContent).not.toContain('+4.0°')
  })

  test('renders skeleton when isLoading=true', () => {
    const { container } = renderPanel(null, true)
    // shadcn Skeleton uses data-slot="skeleton" or animate-pulse class
    expect(
      container.querySelector('[data-slot="skeleton"]') ??
        container.querySelector('.animate-pulse'),
    ).not.toBeNull()
  })

  test('shows "No analysis data" when analysis null and not loading', () => {
    const { container } = renderPanel(null, false)
    expect(container.textContent).toContain('No analysis data')
  })
})
