import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { providerFormSchema, type ProviderFormData } from '../schemas'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../../components/form'
import { Input } from '../../components/input'
import { Textarea } from '../../components/textarea'
import { Button } from '../../components/button'

interface ProviderFormProps {
  defaultValues?: Partial<ProviderFormData>
  onSubmit: (data: ProviderFormData) => Promise<void>
  isLoading?: boolean
  showButtons?: boolean
  formId?: string
}

export function ProviderForm({ defaultValues, onSubmit, isLoading, showButtons = true, formId }: ProviderFormProps) {
  const form = useForm<ProviderFormData>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: defaultValues || {
      providerType: 'general',
      yearsOfExperience: undefined,
      biography: '',
    },
    mode: 'onBlur',
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" id={formId}>
        <input type="hidden" {...form.register('providerType')} value="general" />

        <FormField
          control={form.control}
          name="yearsOfExperience"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Years of Experience</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={70}
                  placeholder="e.g., 10"
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const value = e.target.value
                    field.onChange(value ? parseInt(value, 10) : undefined)
                  }}
                />
              </FormControl>
              <FormDescription>
                Number of years practicing in your field
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="biography"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Professional Biography *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Brief professional bio (min 10 characters, max 2000 characters)"
                  rows={6}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormDescription>
                Share your background, education, and areas of expertise
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {showButtons && (
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Provider Profile'}
            </Button>
          </div>
        )}
      </form>
    </Form>
  )
}
