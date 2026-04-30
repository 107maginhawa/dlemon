'use client'

import { Clock } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'
import { formatDate } from '../lib/format-date'

export type DateTimeFilterValue = 
  | 'any'
  | 'today'
  | 'tomorrow'
  | 'this-weekend'
  | { date: string }

export interface DateTimeFilterProps {
  value: DateTimeFilterValue
  onChange: (value: DateTimeFilterValue) => void
  className?: string
}

export function DateTimeFilter({ value, onChange, className }: DateTimeFilterProps) {
  const getDisplayValue = () => {
    if (typeof value === 'string') {
      return value
    }
    return 'custom'
  }

  const getDisplayLabel = () => {
    if (value === 'any') return 'Any Time'
    if (value === 'today') return 'Today'
    if (value === 'tomorrow') return 'Tomorrow'
    if (value === 'this-weekend') return 'This Weekend'
    if (typeof value === 'object') {
      return formatDate(value.date, { format: 'medium' }).replace(/,?\s*\d{4}$/, '') // Remove year, keep "MMM d"
    }
    return 'Select time'
  }

  return (
    <Select value={getDisplayValue()} onValueChange={(val) => onChange(val as any)}>
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <SelectValue>{getDisplayLabel()}</SelectValue>
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
        <SelectItem value="this-weekend">
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            This Weekend
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
