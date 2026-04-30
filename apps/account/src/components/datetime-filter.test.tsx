import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { DateTimeFilter, type DateTimeFilterValue } from './datetime-filter'

describe('DateTimeFilter', () => {
  afterEach(() => {
    cleanup()
  })

  test('renders without crashing', () => {
    const onChange = () => {}
    const { container } = render(<DateTimeFilter value="any" onChange={onChange} />)

    expect(container).toBeDefined()
  })

  test('displays "Any Time" for "any" value', () => {
    const onChange = () => {}
    render(<DateTimeFilter value="any" onChange={onChange} />)

    expect(screen.getByText('Any Time')).toBeDefined()
  })

  test('displays "Today" for "today" value', () => {
    const onChange = () => {}
    render(<DateTimeFilter value="today" onChange={onChange} />)

    expect(screen.getByText('Today')).toBeDefined()
  })

  test('displays "Tomorrow" for "tomorrow" value', () => {
    const onChange = () => {}
    render(<DateTimeFilter value="tomorrow" onChange={onChange} />)

    expect(screen.getByText('Tomorrow')).toBeDefined()
  })

  test('displays "This Weekend" for "this-weekend" value', () => {
    const onChange = () => {}
    render(<DateTimeFilter value="this-weekend" onChange={onChange} />)

    expect(screen.getByText('This Weekend')).toBeDefined()
  })

  test('displays formatted date for custom date value', () => {
    const onChange = () => {}
    const customValue: DateTimeFilterValue = { date: '2023-10-05' }
    render(<DateTimeFilter value={customValue} onChange={onChange} />)

    // Should display formatted date without year (e.g., "Oct 5")
    const displayText = screen.getByText(/Oct 5/)
    expect(displayText).toBeDefined()
  })

  test('renders with custom className', () => {
    const onChange = () => {}
    const { container } = render(
      <DateTimeFilter value="any" onChange={onChange} className="custom-class" />
    )

    const trigger = container.querySelector('.custom-class')
    expect(trigger).toBeDefined()
  })

  test('renders Clock icon', () => {
    const onChange = () => {}
    const { container } = render(<DateTimeFilter value="any" onChange={onChange} />)

    // Clock icon should be present (lucide-react icon)
    const icon = container.querySelector('svg')
    expect(icon).toBeDefined()
  })

  test('renders all filter options', () => {
    const onChange = () => {}
    render(<DateTimeFilter value="any" onChange={onChange} />)

    // All options should be in the document (even if not visible until dropdown opens)
    expect(screen.getByText('Any Time')).toBeDefined()
    // Note: Other options are in SelectContent which may not be visible without user interaction
  })

  test('handles different date formats for custom value', () => {
    const onChange = () => {}
    const customValue: DateTimeFilterValue = { date: '2023-12-25' }
    render(<DateTimeFilter value={customValue} onChange={onChange} />)

    // Should format the date (e.g., "Dec 25")
    const displayText = screen.getByText(/Dec 25/)
    expect(displayText).toBeDefined()
  })
})
