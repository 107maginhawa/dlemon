/**
 * Format utilities for SDK
 */

export function formatDate(date: Date, options: { format: 'date' | 'iso' }): string {
  if (options.format === 'iso') {
    return date.toISOString()
  }
  const formatted = date.toISOString().split('T')[0]
  if (!formatted) {
    throw new Error('Failed to format date')
  }
  return formatted
}
