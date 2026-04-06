import { describe, test, expect } from 'bun:test'
import { cn } from './utils'

describe('cn utility', () => {
  test('merges class names correctly', () => {
    const result = cn('px-4', 'py-2')
    expect(result).toBe('px-4 py-2')
  })

  test('handles conditional classes', () => {
    const result = cn('base', true && 'truthy', false && 'falsy')
    expect(result).toBe('base truthy')
  })

  test('merges tailwind classes with proper overrides', () => {
    const result = cn('px-4 py-2', 'px-8')
    expect(result).toBe('py-2 px-8')
  })

  test('handles arrays of classes', () => {
    const result = cn(['px-4', 'py-2'], ['mx-2', 'my-4'])
    expect(result).toBe('px-4 py-2 mx-2 my-4')
  })

  test('handles undefined and null values', () => {
    const result = cn('base', undefined, null, 'end')
    expect(result).toBe('base end')
  })

  test('handles empty strings', () => {
    const result = cn('', 'valid', '')
    expect(result).toBe('valid')
  })

  test('handles objects with boolean values', () => {
    const result = cn({
      'px-4': true,
      'py-2': true,
      'hidden': false,
      'block': true
    })
    expect(result).toBe('px-4 py-2 block')
  })

  test('handles complex nested structures', () => {
    const result = cn(
      'base',
      ['nested', 'array'],
      {
        'object': true,
        'false-obj': false
      },
      undefined,
      'final'
    )
    expect(result).toBe('base nested array object final')
  })

  test('properly overrides conflicting tailwind classes', () => {
    const result = cn('text-sm', 'text-lg')
    expect(result).toBe('text-lg')
  })

  test('handles no arguments', () => {
    const result = cn()
    expect(result).toBe('')
  })
})