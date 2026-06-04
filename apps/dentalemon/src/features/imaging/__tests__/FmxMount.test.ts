/**
 * FmxMount component tests (P2-5).
 */
import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { FmxMount } from '../components/FmxMount'
import type { PatientImageItem } from '../hooks/use-imaging-studies'

afterEach(cleanup)

function makeItem(
  id: string,
  modality: string,
  toothNumbers: number[],
): PatientImageItem {
  return {
    id,
    source: 'imaging',
    modality,
    fileName: `${id}.jpg`,
    mimeType: 'image/jpeg',
    fileSizeBytes: 2048,
    studyId: `s-${id}`,
    visitId: 'v-1',
    toothNumbers,
    createdAt: '2025-01-01T00:00:00Z',
    downloadUrl: null,
  } as unknown as PatientImageItem
}

describe('FmxMount', () => {
  test('renders the three anatomical rows', () => {
    render(React.createElement(FmxMount, { images: [] }))
    expect(screen.getByLabelText('Maxillary')).not.toBeNull()
    expect(screen.getByLabelText('Bitewings')).not.toBeNull()
    expect(screen.getByLabelText('Mandibular')).not.toBeNull()
  })

  test('a maxillary periapical slot becomes enabled when an image is placed', () => {
    render(
      React.createElement(FmxMount, { images: [makeItem('a', 'periapical', [3])] }),
    )
    const slot = screen.getByTestId('fmx-slot-max-ur-molar') as HTMLButtonElement
    expect(slot.disabled).toBe(false)
  })

  test('empty slots are disabled', () => {
    render(React.createElement(FmxMount, { images: [] }))
    const slot = screen.getByTestId('fmx-slot-max-incisors') as HTMLButtonElement
    expect(slot.disabled).toBe(true)
  })

  test('clicking a filled slot calls onSelectImage with the image', async () => {
    const user = userEvent.setup()
    const onSelectImage = mock(() => {})
    render(
      React.createElement(FmxMount, {
        images: [makeItem('a', 'periapical', [8])],
        onSelectImage,
      }),
    )
    await user.click(screen.getByTestId('fmx-slot-max-incisors'))
    expect(onSelectImage).toHaveBeenCalledTimes(1)
  })

  test('non-FMX images (panoramic) appear in the leftover section', () => {
    render(
      React.createElement(FmxMount, { images: [makeItem('pano', 'panoramic', [])] }),
    )
    const leftover = screen.getByTestId('fmx-leftover')
    expect(leftover.textContent).toContain('pano.jpg')
  })
})
