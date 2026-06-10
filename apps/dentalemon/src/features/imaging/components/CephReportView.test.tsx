import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { CephReportView, type CephReportSnapshot } from './CephReportView'

afterEach(cleanup)

function mkSnapshot(overrides: Partial<CephReportSnapshot> = {}): CephReportSnapshot {
  return {
    landmarks: {
      S: { x: 100, y: 200, status: 'confirmed', source: 'manual' },
      N: { x: 300, y: 200, status: 'confirmed', source: 'manual' },
      A: { x: 290, y: 271, status: 'confirmed', source: 'manual' },
      B: { x: 288, y: 268, status: 'confirmed', source: 'manual' },
      Go: { x: 220, y: 310, status: 'confirmed', source: 'manual' },
      Po: { x: 310, y: 185, status: 'confirmed', source: 'manual' },
    },
    measurements: {
      sna: 82.0,
      snb: 80.0,
      anb: 2.0,
      convexity_napog: 3.5,
      sn_gome: 32.0,
    },
    analysis_label: 'steiner_hybrid_sn',
    calibration: { value: 0.24, method: 'manual_ruler', at: '2026-05-17T00:00:00Z', by: 'dr-test' },
    software_version: '1.4.0',
    operator: 'dr-test',
    generated_at: '2026-05-17T10:00:00Z',
    study_date: '2026-05-15',
    patient_display_id: 'PT-001',
    branch_name: 'Test Clinic',
    missing: [],
    uncalibrated: false,
    ...overrides,
  }
}

function renderView(snapshot: CephReportSnapshot, version = 1, imageUrl?: string) {
  return render(
    React.createElement(CephReportView, { snapshot, version, imageUrl }),
  )
}

// Image composite (bug fix): the report must actually render the radiograph
describe('radiograph composite', () => {
  test('renders an <img> with the provided imageUrl', () => {
    const { container } = renderView(mkSnapshot(), 1, 'https://example.test/ceph.jpg')
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('src')).toBe('https://example.test/ceph.jpg')
  })

  test('renders no <img> when imageUrl is absent', () => {
    const { container } = renderView(mkSnapshot())
    expect(container.querySelector('img')).toBeNull()
  })

  test('keeps the D-N "not to scale" labeling on the overlay', () => {
    const { container } = renderView(mkSnapshot(), 1, 'https://example.test/ceph.jpg')
    expect(container.textContent?.toLowerCase()).toContain('not to scale')
  })
})

// D-G: analysis label badge
describe('D-G — analysis label', () => {
  test('shows steiner_hybrid_sn badge', () => {
    const { container } = renderView(mkSnapshot())
    expect(container.textContent).toContain('steiner_hybrid_sn')
  })

  test('shows label from snapshot.analysis_label (snapshot-driven, not hardcoded)', () => {
    const { container } = renderView(mkSnapshot({ analysis_label: 'steiner_hybrid_sn' }))
    expect(container.textContent).toContain('steiner_hybrid_sn')
  })
})

// D-H: no norms disclaimer
describe('D-H — no normative comparison', () => {
  test('shows norms disclaimer text', () => {
    const { container } = renderView(mkSnapshot())
    // Should explain that no norm comparison is provided
    expect(container.textContent?.toLowerCase()).toMatch(/norm|normative/)
    expect(container.textContent?.toLowerCase()).toMatch(/not provided|no norm|vary|raw measurement/)
  })

  test('does not show a class verdict (Class I/II/III label)', () => {
    const { container } = renderView(mkSnapshot())
    // Verdicts are forbidden — measured values only
    expect(container.textContent).not.toMatch(/Class I[^V]|Class II[^I]|Class III/)
  })
})

// D-J: magnification disclosure
describe('D-J — magnification disclosure', () => {
  test('shows lateral ceph magnification note', () => {
    const { container } = renderView(mkSnapshot())
    const text = container.textContent?.toLowerCase() ?? ''
    expect(text).toMatch(/magnif|7.{0,5}13%/)
  })

  test('shows uncorrected linear values disclaimer', () => {
    const { container } = renderView(mkSnapshot())
    expect(container.textContent?.toLowerCase()).toMatch(/uncorrected|estimate/)
  })
})

// D-N: no scale bar
describe('D-N — no scale bar', () => {
  test('does not render any scale bar element', () => {
    const { container } = renderView(mkSnapshot())
    expect(container.textContent?.toLowerCase()).not.toContain('scale bar')
  })

  test('linear overlays labeled "not to scale"', () => {
    const { container } = renderView(mkSnapshot())
    expect(container.textContent?.toLowerCase()).toContain('not to scale')
  })
})

// D-O: out-of-scope block
describe('D-O — out-of-scope block', () => {
  test('contains an out-of-scope / not included section', () => {
    const { container } = renderView(mkSnapshot())
    const text = container.textContent?.toLowerCase() ?? ''
    expect(text).toMatch(/not included|out of scope|not available/)
  })

  test('mentions soft-tissue analysis as out-of-scope', () => {
    const { container } = renderView(mkSnapshot())
    expect(container.textContent?.toLowerCase()).toMatch(/soft.tissue/)
  })

  test('mentions superimposition as out-of-scope', () => {
    const { container } = renderView(mkSnapshot())
    expect(container.textContent?.toLowerCase()).toMatch(/superimposition|serial/)
  })

  test('mentions DICOM as out-of-scope', () => {
    const { container } = renderView(mkSnapshot())
    expect(container.textContent?.toLowerCase()).toContain('dicom')
  })

  test('mentions SND or D-point as out-of-scope', () => {
    const { container } = renderView(mkSnapshot())
    const text = container.textContent?.toLowerCase() ?? ''
    expect(text).toMatch(/snd|d.point|soft.tissue/)
  })
})

// D4: context fields from frozen snapshot
describe('D4 — context fields from snapshot', () => {
  test('renders study_date from snapshot', () => {
    const { container } = renderView(mkSnapshot({ study_date: '2026-03-15' }))
    expect(container.textContent).toContain('2026-03-15')
  })

  test('renders patient_display_id from snapshot', () => {
    const { container } = renderView(mkSnapshot({ patient_display_id: 'PT-999' }))
    expect(container.textContent).toContain('PT-999')
  })

  test('renders branch_name from snapshot', () => {
    const { container } = renderView(mkSnapshot({ branch_name: 'Downtown Clinic' }))
    expect(container.textContent).toContain('Downtown Clinic')
  })
})

// G2: reproducibility provenance pinned in the snapshot
describe('G2 — reproducibility provenance', () => {
  test('renders the pinned norm population label', () => {
    const { container } = renderView(mkSnapshot({ norm_population: 'japanese' }))
    expect(container.textContent).toContain('Japanese')
  })

  test('renders the pinned norm-table version', () => {
    const { container } = renderView(mkSnapshot({ norm_version: '1.0.0' }))
    expect(container.textContent).toContain('1.0.0')
  })

  test('renders the pinned measurement-engine (formula) version', () => {
    const { container } = renderView(mkSnapshot({ formula_version: '9.9.9' }))
    expect(container.textContent).toContain('9.9.9')
  })

  test('badge reflects the analysis actually used (e.g. ricketts)', () => {
    const { container } = renderView(mkSnapshot({ analysis_label: 'ricketts', analysis_type: 'ricketts' }))
    expect(container.textContent).toContain('ricketts')
  })
})

// Snapshot-driven (D-I)
describe('D-I — snapshot-driven rendering', () => {
  test('renders measurements from snapshot, not live state', () => {
    const { container } = renderView(mkSnapshot({
      measurements: { sna: 77.5 },
    }))
    expect(container.textContent).toContain('77.50')
  })

  test('renders version number', () => {
    const { container } = renderView(mkSnapshot(), 3)
    expect(container.textContent).toContain('3')
  })
})

// D-F: SN-referenced metric labels
describe('D-F — SN-referenced labels', () => {
  test('shows SNA label', () => {
    renderView(mkSnapshot())
    expect(screen.getByText('SNA')).not.toBeNull()
  })

  test('shows SN-GoMe label (not FMA)', () => {
    const { container } = renderView(mkSnapshot())
    expect(container.textContent).toContain('SN-GoMe')
    expect(container.textContent).not.toContain('FMA')
  })

  test('shows SN reference footnote', () => {
    const { container } = renderView(mkSnapshot())
    expect(container.textContent?.toLowerCase()).toMatch(/sella.nasion|sn/)
    expect(container.textContent?.toLowerCase()).toMatch(/frankfort/)
  })
})
