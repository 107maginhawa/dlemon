/**
 * Booking Helper Functions
 * Simple utilities for schedule management
 */

export type DayName = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

export interface TimeBlock {
  startTime: string
  endTime: string
  slotDuration: number
  bufferTime: number
}

export interface DailyConfig {
  enabled: boolean
  timeBlocks: TimeBlock[]
}

/**
 * Get display name for day
 */
export function getDayDisplayName(day: DayName): string {
  const names: Record<DayName, string> = {
    sun: 'Sunday',
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
  }
  return names[day]
}

/**
 * Get default weekly schedule template
 * Monday-Friday enabled with standard working hours
 */
export function getDefaultWeeklySchedule(
  slotDuration: number = 30,
  bufferTime: number = 0
): Record<DayName, DailyConfig> {
  const workingDay: DailyConfig = {
    enabled: true,
    timeBlocks: [{ startTime: '09:00', endTime: '17:00', slotDuration, bufferTime }],
  }
  
  const offDay: DailyConfig = {
    enabled: false,
    timeBlocks: [],
  }

  return {
    sun: offDay,
    mon: workingDay,
    tue: workingDay,
    wed: workingDay,
    thu: workingDay,
    fri: workingDay,
    sat: offDay,
  }
}
