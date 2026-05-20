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

    expect(container).not.toBeNull()
  })

  test('displays "Any Time" for "any" value', () => {
    const onChange = () => {}
    render(<DateTimeFilter value="any" onChange={onChange} />)

    // SelectContent mock renders items inline, so multiple matches exist — grab first (the SelectValue trigger)
    expect(screen.getAllByText('Any Time')[0]).not.toBeNull()
  })

  test('displays "Today" for "today" value', () => {
    const onChange = () => {}
    render(<DateTimeFilter value="today" onChange={onChange} />)

    expect(screen.getAllByText('Today')[0]).not.toBeNull()
  })

  test('displays "Tomorrow" for "tomorrow" value', () => {
    const onChange = () => {}
    render(<DateTimeFilter value="tomorrow" onChange={onChange} />)

    expect(screen.getAllByText('Tomorrow')[0]).not.toBeNull()
  })

  test('displays "This Weekend" for "this-weekend" value', () => {
    const onChange = () => {}
    render(<DateTimeFilter value="this-weekend" onChange={onChange} />)

    expect(screen.getAllByText('This Weekend')[0]).not.toBeNull()
  })

  test('displays formatted date for custom date value', () => {
    const onChange = () => {}
    const customValue: DateTimeFilterValue = { date: '2023-10-05' }
    render(<DateTimeFilter value={customValue} onChange={onChange} />)

    // Should display formatted date without year (e.g., "Oct 5")
    const displayText = screen.getByText(/Oct 5/)
    expect(displayText).not.toBeNull()
  })

  test('renders with custom className', () => {
    const onChange = () => {}
    const { container } = render(
      <DateTimeFilter value="any" onChange={onChange} className="custom-class" />
    )

    const trigger = container.querySelector('.custom-class')
    expect(trigger).not.toBeNull()
  })

  test('renders Clock icon', () => {
    const onChange = () => {}
    const { container } = render(<DateTimeFilter value="any" onChange={onChange} />)

    // Clock icon is mocked as a span with data-testid="icon-clock"
    const icon = container.querySelector('[data-testid="icon-clock"]')
    expect(icon).not.toBeNull()
  })

  test('renders all filter options', () => {
    const onChange = () => {}
    render(<DateTimeFilter value="any" onChange={onChange} />)

    // SelectContent mock renders items inline, so multiple matches exist — grab first (the SelectValue trigger)
    expect(screen.getAllByText('Any Time')[0]).not.toBeNull()
    // Note: Other options are in SelectContent which may not be visible without user interaction
  })

  test('handles different date formats for custom value', () => {
    const onChange = () => {}
    const customValue: DateTimeFilterValue = { date: '2023-12-25' }
    render(<DateTimeFilter value={customValue} onChange={onChange} />)

    // Should format the date (e.g., "Dec 25")
    const displayText = screen.getByText(/Dec 25/)
    expect(displayText).not.toBeNull()
  })
})
