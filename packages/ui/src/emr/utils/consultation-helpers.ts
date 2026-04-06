/**
 * Consultation Helper Functions
 * Utilities for consultation note display and formatting
 */

export function getStatusDisplayName(status: string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    finalized: 'Finalized',
    amended: 'Amended',
    deleted: 'Deleted',
    scheduled: 'Scheduled',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No Show',
  }
  return map[status] || status
}

export function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'finalized':
    case 'completed':
      return 'default'
    case 'draft':
    case 'scheduled':
      return 'secondary'
    case 'deleted':
    case 'cancelled':
    case 'no_show':
      return 'destructive'
    case 'amended':
      return 'outline'
    default:
      return 'secondary'
  }
}

export function formatVitals(vitals?: {
  bloodPressure?: string
  pulse?: string
  temperature?: string
  weight?: string
  height?: string
  respiratoryRate?: string
  oxygenSaturation?: string
}): string {
  if (!vitals) return 'No vitals recorded'
  
  const parts: string[] = []
  if (vitals.bloodPressure) parts.push(`BP: ${vitals.bloodPressure}`)
  if (vitals.pulse) parts.push(`HR: ${vitals.pulse}`)
  if (vitals.temperature) parts.push(`Temp: ${vitals.temperature}`)
  if (vitals.respiratoryRate) parts.push(`RR: ${vitals.respiratoryRate}`)
  if (vitals.oxygenSaturation) parts.push(`O2: ${vitals.oxygenSaturation}%`)
  if (vitals.weight) parts.push(`Weight: ${vitals.weight}`)
  if (vitals.height) parts.push(`Height: ${vitals.height}`)
  
  return parts.length > 0 ? parts.join(', ') : 'No vitals recorded'
}
