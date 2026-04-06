import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '../../components/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../../components/form'
import { Input } from '../../components/input'
import { Textarea } from '../../components/textarea'
import { Switch } from '../../components/switch'
import { primaryPharmacySchema, type PrimaryPharmacyData } from '../schemas'

interface PrimaryPharmacyFormProps {
  defaultValues?: Partial<PrimaryPharmacyData>
  onSubmit: (data: PrimaryPharmacyData) => void | Promise<void>
  mode?: 'create' | 'edit'
  showButtons?: boolean
  onCancel?: () => void
  submitText?: string
  formId?: string
}

export function PrimaryPharmacyForm({
  defaultValues,
  onSubmit,
  mode = 'create',
  showButtons = true,
  onCancel,
  submitText,
  formId
}: PrimaryPharmacyFormProps) {
  const form = useForm<PrimaryPharmacyData>({
    resolver: zodResolver(primaryPharmacySchema),
    defaultValues: {
      hasPharmacy: defaultValues?.hasPharmacy ?? false,
      name: defaultValues?.name || '',
      address: defaultValues?.address || '',
      phone: defaultValues?.phone || '',
      fax: defaultValues?.fax || '',
    },
  })

  const hasPharmacy = form.watch('hasPharmacy')

  const handleSubmit = async (data: PrimaryPharmacyData) => {
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
          name="hasPharmacy"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  Do you have a primary pharmacy?
                </FormLabel>
                <FormDescription>
                  This helps us send prescriptions to your preferred pharmacy.
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

        {hasPharmacy && (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Pharmacy Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="CVS Pharmacy" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="123 Main Street&#10;Suite 100&#10;City, State 12345"
                      {...field}
                      rows={3}
                    />
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
