import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '../../components/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../../components/form'
import { Input } from '../../components/input'
import { Switch } from '../../components/switch'
import { primaryProviderSchema, type PrimaryProviderData } from '../schemas'

interface PrimaryCareProviderFormProps {
  defaultValues?: Partial<PrimaryProviderData>
  onSubmit: (data: PrimaryProviderData) => void | Promise<void>
  mode?: 'create' | 'edit'
  showButtons?: boolean
  onCancel?: () => void
  submitText?: string
  formId?: string
}

export function PrimaryCareProviderForm({
  defaultValues,
  onSubmit,
  mode = 'create',
  showButtons = true,
  onCancel,
  submitText,
  formId
}: PrimaryCareProviderFormProps) {
  const form = useForm<PrimaryProviderData>({
    resolver: zodResolver(primaryProviderSchema),
    defaultValues: {
      hasProvider: defaultValues?.hasProvider ?? false,
      name: defaultValues?.name || '',
      specialty: defaultValues?.specialty || '',
      phone: defaultValues?.phone || '',
      fax: defaultValues?.fax || '',
    },
  })

  const hasProvider = form.watch('hasProvider')

  const handleSubmit = async (data: PrimaryProviderData) => {
    await onSubmit(data)
  }

  const getDefaultSubmitText = () => {
    if (submitText) return submitText
    if (mode === 'create') return 'Complete Setup'
    return 'Save Changes'
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-6"
        id={formId}
      >
        <FormField
          control={form.control}
          name="hasProvider"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  Do you have a primary care provider?
                </FormLabel>
                <FormDescription>
                  This helps us coordinate your care and share relevant information.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {hasProvider && (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Provider Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Dr. Jane Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="specialty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specialty</FormLabel>
                  <FormControl>
                    <Input placeholder="Family Medicine" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="(555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fax Number</FormLabel>
                    <FormControl>
                      <Input placeholder="(555) 123-4568" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {showButtons && (
          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit">
              {getDefaultSubmitText()}
            </Button>
          </div>
        )}
      </form>
    </Form>
  )
}
