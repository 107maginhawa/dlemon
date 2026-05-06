import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import {
  BookingWidgetSkeleton,
  TimeSlotsSkeleton,
  DateSelectionSkeleton,
} from './booking-widget-skeleton'

afterEach(() => cleanup())

describe('BookingWidgetSkeleton', () => {
  test('renders without crashing', () => {
    render(<BookingWidgetSkeleton />)
    expect(document.body).toBeDefined()
  })

  test('renders "Book Session" title', () => {
    render(<BookingWidgetSkeleton />)
    expect(screen.getByText('Book Session')).toBeDefined()
  })

  test('renders loading description text', () => {
    render(<BookingWidgetSkeleton />)
    expect(screen.getByText(/loading available time slots/i)).toBeDefined()
  })

  test('renders 7 date skeleton items', () => {
    render(<BookingWidgetSkeleton />)
    // Date grid has 7 skeleton items
    const dateGrid = document.querySelector('.grid.grid-cols-4')
    expect(dateGrid).not.toBeNull()
    const skeletons = dateGrid!.querySelectorAll('[class*="skeleton"], [class*="animate"]')
    // At least the grid exists with children
    expect(dateGrid!.children.length).toBe(7)
  })

  test('renders 6 time slot skeleton items', () => {
    render(<BookingWidgetSkeleton />)
    const timeGrid = document.querySelector('.grid.grid-cols-3')
    expect(timeGrid).not.toBeNull()
    expect(timeGrid!.children.length).toBe(6)
  })

  test('accepts optional className prop', () => {
    const { container } = render(<BookingWidgetSkeleton className="custom-class" />)
    expect(container.firstChild).not.toBeNull()
  })
})

describe('TimeSlotsSkeleton', () => {
  test('renders without crashing', () => {
    render(<TimeSlotsSkeleton />)
    expect(document.body).toBeDefined()
  })

  test('renders 9 time slot skeletons', () => {
    render(<TimeSlotsSkeleton />)
    const grid = document.querySelector('.grid.grid-cols-3')
    expect(grid).not.toBeNull()
    expect(grid!.children.length).toBe(9)
  })
})

describe('DateSelectionSkeleton', () => {
  test('renders without crashing', () => {
    render(<DateSelectionSkeleton />)
    expect(document.body).toBeDefined()
  })

  test('renders 7 date skeletons', () => {
    render(<DateSelectionSkeleton />)
    const grid = document.querySelector('.grid.grid-cols-4')
    expect(grid).not.toBeNull()
    expect(grid!.children.length).toBe(7)
  })
})
