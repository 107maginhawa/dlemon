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

function renderPanel(analysis: CephAnalysis | null, isLoading = false) {
  return render(
    React.createElement(CephMeasurementsPanel, { analysis, isLoading }),
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

  test('no "Class" text anywhere — D-H', () => {
    const { container } = renderPanel(
      mkAnalysis({ measurements: { sna: 82, snb: 78, anb: 4 } }),
    )
    expect(container.textContent).not.toContain('Class')
  })

  test('shows mm magnification footnote text — D-J', () => {
    const { container } = renderPanel(mkAnalysis())
    expect(container.textContent).toContain('magnification')
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
