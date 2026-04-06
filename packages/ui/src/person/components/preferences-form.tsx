import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@monobase/ui/components/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@monobase/ui/components/form'
import { Combobox } from '@monobase/ui/components/combobox'
import { LANGUAGES } from '@monobase/ui/constants/languages'
import { TIMEZONES } from '@monobase/ui/constants/timezones'
import { useDetectTimezone } from '@monobase/ui/hooks/use-detect-timezone'
import { useDetectLanguage } from '@monobase/ui/hooks/use-detect-language'
import { preferencesSchema, type Preferences } from '../schemas'

// Map constants to Combobox format (code/name → value/label)
const LANGUAGE_OPTIONS = LANGUAGES.map(lang => ({
  value: lang.code,
  label: lang.nativeName || lang.name
}))

const TIMEZONE_OPTIONS = TIMEZONES.map(tz => ({
  value: tz.code,
  label: tz.name,
  description: tz.offset,
  group: tz.group,
  keywords: tz.mainCities
}))

interface PreferencesFormProps {
  defaultValues?: Partial<Preferences>
  onSubmit: (data: Preferences) => void | Promise<void>
  mode?: 'create' | 'edit'
  showButtons?: boolean
  onCancel?: () => void
}

export function PreferencesForm({
  defaultValues,
  onSubmit,
  mode: _mode = 'edit',
  showButtons = true,
  onCancel
}: PreferencesFormProps) {
  // mode parameter kept for future use
  const detectedLanguage = useDetectLanguage()
  const detectedTimezone = useDetectTimezone()
  const detectedTimezoneName = TIMEZONE_OPTIONS.find(tz => tz.value === detectedTimezone)?.label

  const form = useForm<Preferences>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      languagesSpoken: defaultValues?.languagesSpoken || [detectedLanguage],
      timezone: defaultValues?.timezone || detectedTimezone,
    },
  })

  // Update form when defaultValues change (e.g., when data loads)
  useEffect(() => {
    if (defaultValues) {
      form.reset({
        languagesSpoken: defaultValues.languagesSpoken || [detectedLanguage],
        timezone: defaultValues.timezone || detectedTimezone,
      })
    }
  }, [defaultValues, form, detectedLanguage, detectedTimezone])

  const handleSubmit = async (data: Preferences) => {
    await onSubmit(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Languages Spoken */}
        <FormField
          control={form.control}
          name="languagesSpoken"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Languages Spoken</FormLabel>
              <FormDescription>
                Select all languages you speak. The first language will be your primary language.
              </FormDescription>
              <FormControl>
                <Combobox
                  options={LANGUAGE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select languages..."
                  searchPlaceholder="Search languages..."
                  emptyText="No language found."
                  multiSelect={true}
                  testId="languages-combobox"
                  maxHeight={400}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Timezone */}
        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Timezone</FormLabel>
              <FormDescription>
                Current detected timezone: {detectedTimezoneName || detectedTimezone}
              </FormDescription>
              <FormControl>
                <Combobox
                  options={TIMEZONE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select timezone..."
                  searchPlaceholder="Search timezone or city..."
                  emptyText="No timezone found."
                  multiSelect={false}
                  testId="timezone-combobox"
                  maxHeight={400}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {showButtons && (
          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit">
              Save Preferences
            </Button>
          </div>
        )}
      </form>
    </Form>
  )
}
