import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { CephLandmarkPalette } from './CephLandmarkPalette'
import { LANDMARK_CODES } from '../lib/ceph-geometry'
import type { CephLandmark, CephLandmarkCode } from '../hooks/use-ceph-landmarks'

afterEach(cleanup)

function mk(
  code: CephLandmarkCode,
  status: CephLandmark['status'] = 'placed',
): CephLandmark {
  return {
    id: `id-${code}`,
    imageId: 'img1',
    landmarkCode: code,
    x: 10,
    y: 10,
    source: 'manual',
    confidence: null,
    status,
    createdAt: '',
    updatedAt: '',
  }
}

function renderPalette(
  landmarks: CephLandmark[] = [],
  selectedCode: CephLandmarkCode | null = null,
) {
  const onSelect = mock(() => {})
  const { container } = render(
    React.createElement(CephLandmarkPalette, { landmarks, selectedCode, onSelect }),
  )
  return { onSelect, container }
}

describe('CephLandmarkPalette — reference hints', () => {
  test('every landmark button has an anatomical title (Sella for S)', () => {
    const { container } = renderPalette()
    const sBtn = container.querySelector('[data-landmark-code="S"]')
    expect(sBtn?.getAttribute('title')?.toLowerCase()).toContain('sella')
  })

  test('shows the inline hint for the next-unplaced landmark (S) when nothing selected', () => {
    const { container } = renderPalette([])
    const hint = container.querySelector('[data-landmark-hint="S"]')
    expect(hint).not.toBeNull()
    expect(hint?.textContent?.toLowerCase()).toContain('sella')
  })

  test('shows the inline hint for the selected landmark, not the next-unplaced', () => {
    const { container } = renderPalette([], 'N')
    expect(container.querySelector('[data-landmark-hint="N"]')).not.toBeNull()
    expect(container.querySelector('[data-landmark-hint="S"]')).toBeNull()
  })
})

describe('CephLandmarkPalette', () => {
  test('renders all 16 LANDMARK_CODES', () => {
    const { container } = renderPalette()
    expect(LANDMARK_CODES.length).toBe(16)
    for (const code of LANDMARK_CODES) {
      expect(container.querySelector(`[data-landmark-code="${code}"]`)).not.toBeNull()
    }
  })

  test('next unplaced landmark has data-next-unplaced attribute', () => {
    const { container } = renderPalette([mk('S'), mk('N')])
    const next = container.querySelector('[data-next-unplaced="true"]')
    expect(next).not.toBeNull()
    // First unplaced in LANDMARK_CODES order after S, N is A
    expect(next?.getAttribute('data-landmark-code')).toBe('A')
  })

  test('shows "confirmed" badge for confirmed landmark', () => {
    const { container } = renderPalette([mk('S', 'confirmed')])
    const btn = container.querySelector('[data-landmark-code="S"]')
    expect(btn?.textContent).toContain('confirmed')
  })

  test('shows "locked" badge for locked landmark', () => {
    const { container } = renderPalette([mk('S', 'locked')])
    const btn = container.querySelector('[data-landmark-code="S"]')
    expect(btn?.textContent).toContain('locked')
  })

  test('clicking unplaced code calls onSelect', async () => {
    const user = userEvent.setup()
    const { onSelect, container } = renderPalette()
    const btn = container.querySelector('[data-landmark-code="S"]') as HTMLButtonElement
    await user.click(btn)
    expect(onSelect).toHaveBeenCalledWith('S')
  })

  test('clicking locked code does NOT call onSelect', async () => {
    const user = userEvent.setup()
    const { onSelect, container } = renderPalette([mk('S', 'locked')])
    const btn = container.querySelector('[data-landmark-code="S"]') as HTMLButtonElement
    await user.click(btn)
    expect(onSelect).not.toHaveBeenCalled()
  })

  test('selected code button has visual selection class', () => {
    const { container } = renderPalette([], 'N')
    const btn = container.querySelector('[data-landmark-code="N"]') as HTMLButtonElement
    expect(btn.className).toContain('border-[#FFE97D]')
  })

  test('Go landmark has title attribute containing "bilateral"', () => {
    const { container } = renderPalette()
    const btn = container.querySelector('[data-landmark-code="Go"]') as HTMLButtonElement
    expect(btn.getAttribute('title')).toContain('bilateral')
  })
})
