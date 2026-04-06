'use client'

import { useState } from 'react'
import { Clock, Settings } from 'lucide-react'
import { Button } from "@monobase/ui/components/button"
import { Input } from "@monobase/ui/components/input"
import { formatDate } from "@monobase/ui/lib/format-date"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@monobase/ui/components/select"
import { Popover, PopoverContent, PopoverTrigger } from "@monobase/ui/components/popover"

export interface DateTimeRange {
  from?: Date
  to?: Date
}

interface UnifiedDateTimeFilterProps {
  value: DateTimeRange
  onChange: (value: DateTimeRange) => void
  className?: string
}

type PresetValue = 'any' | 'today' | 'tomorrow' | 'today-morning' | 'today-afternoon' | 'today-evening'
  | 'tomorrow-morning' | 'tomorrow-afternoon' | 'tomorrow-evening' | 'this-weekend' | 'custom'

export function UnifiedDateTimeFilter({ value, onChange, className }: UnifiedDateTimeFilterProps): React.JSX.Element {
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false)
  const [tempCustomDateTime, setTempCustomDateTime] = useState<{
    date: string;
    timeRange: 'morning' | 'afternoon' | 'evening' | 'any'
  }>({
    date: value.from ? formatDate(value.from, { format: 'iso' }).split('T')[0]! : '',
    timeRange: 'any'
  })

  // Convert preset to Date range
  const presetToDateRange = (preset: PresetValue): DateTimeRange => {
    if (preset === 'any') {
      return {}
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const createRange = (date: Date, startHour: number, endHour: number): DateTimeRange => {
      const from = new Date(date)
      from.setHours(startHour, 0, 0, 0)
      const to = new Date(date)
      to.setHours(endHour, 0, 0, 0)
      return { from, to }
    }

    switch (preset) {
      case 'today':
        return createRange(today, 0, 23)
      case 'tomorrow':
        return createRange(tomorrow, 0, 23)
      case 'today-morning':
        return createRange(today, 9, 12)
      case 'today-afternoon':
        return createRange(today, 12, 17)
      case 'today-evening':
        return createRange(today, 17, 21)
      case 'tomorrow-morning':
        return createRange(tomorrow, 9, 12)
      case 'tomorrow-afternoon':
        return createRange(tomorrow, 12, 17)
      case 'tomorrow-evening':
        return createRange(tomorrow, 17, 21)
      case 'this-weekend': {
        const daysUntilSaturday = (6 - now.getDay() + 7) % 7
        const saturday = new Date(today)
        saturday.setDate(saturday.getDate() + daysUntilSaturday)
        return createRange(saturday, 0, 23)
      }
      default:
        return {}
    }
  }

  // Get display label from DateTimeRange
  const getDisplayLabel = (): string => {
    if (!value.from) return 'Any Time'

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const isSameDate = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()

    const getTimeLabel = (date: Date) => {
      const hour = date.getHours()
      if (hour >= 9 && hour < 12) return 'Morning'
      if (hour >= 12 && hour < 17) return 'Afternoon'
      if (hour >= 17 && hour < 21) return 'Evening'
      return ''
    }

    if (isSameDate(value.from, today)) {
      const timeLabel = getTimeLabel(value.from)
      return timeLabel ? `Today ${timeLabel}` : 'Today'
    }

    if (isSameDate(value.from, tomorrow)) {
      const timeLabel = getTimeLabel(value.from)
      return timeLabel ? `Tomorrow ${timeLabel}` : 'Tomorrow'
    }

    // Check if it's this weekend
    const daysUntilSaturday = (6 - now.getDay() + 7) % 7
    const saturday = new Date(today)
    saturday.setDate(saturday.getDate() + daysUntilSaturday)
    if (isSameDate(value.from, saturday)) {
      return 'This Weekend'
    }

    // Custom date
    const dateStr = formatDate(value.from, { format: 'medium' }).replace(/,?\s*\d{4}$/, '') // "MMM d" format
    const timeLabel = getTimeLabel(value.from)
    return timeLabel ? `${dateStr}, ${timeLabel}` : dateStr
  }

  // Determine current preset value for select display
  const getCurrentPreset = (): PresetValue => {
    if (!value.from) return 'any'

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const isSameDate = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()

    const hour = value.from.getHours()

    if (isSameDate(value.from, today)) {
      if (hour === 9) return 'today-morning'
      if (hour === 12) return 'today-afternoon'
      if (hour === 17) return 'today-evening'
      if (hour === 0) return 'today'
    }

    if (isSameDate(value.from, tomorrow)) {
      if (hour === 9) return 'tomorrow-morning'
      if (hour === 12) return 'tomorrow-afternoon'
      if (hour === 17) return 'tomorrow-evening'
      if (hour === 0) return 'tomorrow'
    }

    const daysUntilSaturday = (6 - now.getDay() + 7) % 7
    const saturday = new Date(today)
    saturday.setDate(saturday.getDate() + daysUntilSaturday)
    if (isSameDate(value.from, saturday) && hour === 0) {
      return 'this-weekend'
    }

    return 'custom'
  }

  const handlePresetChange = (preset: PresetValue) => {
    if (preset === 'custom') {
      setCustomPopoverOpen(true)
    } else {
      onChange(presetToDateRange(preset))
    }
  }

  const handleCustomApply = () => {
    if (tempCustomDateTime.date) {
      const date = new Date(tempCustomDateTime.date)

      const getTimeRange = (range: string) => {
        switch (range) {
          case 'morning': return { start: 9, end: 12 }
          case 'afternoon': return { start: 12, end: 17 }
          case 'evening': return { start: 17, end: 21 }
          default: return { start: 0, end: 23 }
        }
      }

      const { start, end } = getTimeRange(tempCustomDateTime.timeRange)

      const from = new Date(date)
      from.setHours(start, 0, 0, 0)
      const to = new Date(date)
      to.setHours(end, 0, 0, 0)

      onChange({ from, to })
    }
    setCustomPopoverOpen(false)
  }

  const handleCustomCancel = () => {
    setTempCustomDateTime({
      date: value.from ? formatDate(value.from, { format: 'iso' }).split('T')[0]! : '',
      timeRange: 'any'
    })
    setCustomPopoverOpen(false)
  }

  return (
    <div className={className}>
      <Popover open={customPopoverOpen} onOpenChange={setCustomPopoverOpen}>
        <div className="relative">
          <Select value={getCurrentPreset()} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-full pr-8">
              <div className="flex items-center gap-2 flex-1">
                <Clock className="w-3 h-3" />
                <SelectValue placeholder="When?">
                  {getDisplayLabel()}
                </SelectValue>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Any Time
                </div>
              </SelectItem>
              <SelectItem value="today">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Today
                </div>
              </SelectItem>
              <SelectItem value="tomorrow">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Tomorrow
                </div>
              </SelectItem>
              <SelectItem value="today-morning">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Today Morning
                </div>
              </SelectItem>
              <SelectItem value="today-afternoon">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Today Afternoon
                </div>
              </SelectItem>
              <SelectItem value="today-evening">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Today Evening
                </div>
              </SelectItem>
              <SelectItem value="tomorrow-morning">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Tomorrow Morning
                </div>
              </SelectItem>
              <SelectItem value="tomorrow-afternoon">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Tomorrow Afternoon
                </div>
              </SelectItem>
              <SelectItem value="tomorrow-evening">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Tomorrow Evening
                </div>
              </SelectItem>
              <SelectItem value="this-weekend">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  This Weekend
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-muted/80"
              onClick={(e) => {
                e.stopPropagation()
                setCustomPopoverOpen(true)
              }}
            >
              <Settings className="w-3 h-3" />
            </Button>
          </PopoverTrigger>
        </div>

        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Date</label>
              <Input
                type="date"
                value={tempCustomDateTime.date}
                onChange={(e) => setTempCustomDateTime(prev => ({ ...prev, date: e.target.value }))}
                min={formatDate(new Date(), { format: 'iso' }).split('T')[0]}
                max={formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), { format: 'iso' }).split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Time Range</label>
              <Select
                value={tempCustomDateTime.timeRange}
                onValueChange={(timeRange: 'morning' | 'afternoon' | 'evening' | 'any') =>
                  setTempCustomDateTime(prev => ({ ...prev, timeRange }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Any Time
                    </div>
                  </SelectItem>
                  <SelectItem value="morning">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Morning (9AM-12PM)
                    </div>
                  </SelectItem>
                  <SelectItem value="afternoon">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Afternoon (12PM-5PM)
                    </div>
                  </SelectItem>
                  <SelectItem value="evening">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Evening (5PM-9PM)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCustomApply} className="flex-1">
                Apply
              </Button>
              <Button variant="outline" onClick={handleCustomCancel} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
