import * as React from 'react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronsUpDown } from 'lucide-react'
import { getNames, getCode, getName } from 'country-list'
import { Button } from '@monobase/ui/components/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@monobase/ui/components/form'
import { Input } from '@monobase/ui/components/input'
import { Popover, PopoverContent, PopoverTrigger } from '@monobase/ui/components/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@monobase/ui/components/command'
import { ScrollArea } from '@monobase/ui/components/scroll-area'
import { cn } from '@monobase/ui/lib/utils'
import { optionalAddressSchema, addressSchema, type OptionalAddress } from '../schemas'
import { detectCountry } from '@monobase/ui/lib/detect-country'

interface AddressFormProps {
  defaultValues?: Partial<OptionalAddress>
  onSubmit: (data: OptionalAddress) => void | Promise<void>
  mode?: 'create' | 'edit'
  showButtons?: boolean
  onCancel?: () => void
  onSkip?: () => void
  required?: boolean // Whether fields are required
  formId?: string // Optional form ID for external submit buttons
}

// Get all country names from the library
const countries = getNames()

// Use country-list library functions for mapping
const getCountryCode = (countryName: string): string => {
  // The getCode function from country-list returns the ISO 2-letter code
  const code = getCode(countryName)
  return code || detectCountry() // Default to detected country if not found
}

const getCountryName = (code: string): string => {
  // The getName function from country-list returns the country name
  const name = getName(code)
  // If name lookup fails, fall back to detected country's name
  if (!name) {
    const detectedCode = detectCountry()
    return getName(detectedCode) || 'United States'
  }
  return name
}

export function AddressForm({
  defaultValues,
  onSubmit,
  mode = 'create',
  showButtons = true,
  onCancel,
  onSkip,
  required = false,
  formId
}: AddressFormProps) {
  // Use detected country or provided default
  const getDefaultCountryCode = () => {
    if (defaultValues?.country) return defaultValues.country
    return detectCountry()
  }

  const form = useForm<OptionalAddress>({
    resolver: zodResolver(required ? addressSchema : optionalAddressSchema),
    defaultValues: {
      street1: defaultValues?.street1 || '',
      street2: defaultValues?.street2 || '',
      city: defaultValues?.city || '',
      state: defaultValues?.state || '',
      postalCode: defaultValues?.postalCode || '',
      country: getDefaultCountryCode(),
    },
  })

  // Update form when defaultValues change (e.g., when data loads)
  useEffect(() => {
    if (defaultValues) {
      form.reset({
        street1: defaultValues.street1 || '',
        street2: defaultValues.street2 || '',
        city: defaultValues.city || '',
        state: defaultValues.state || '',
        postalCode: defaultValues.postalCode || '',
        country: defaultValues.country || detectCountry(),
      })
    }
  }, [defaultValues, form])

  const handleSubmit = async (data: OptionalAddress) => {
    await onSubmit(data)
  }

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="street1"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Street Address {required && <span className="text-red-500">*</span>}
              </FormLabel>
              <FormControl>
                <Input placeholder="123 Main Street" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="street2"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Street Address Line 2</FormLabel>
              <FormControl>
                <Input placeholder="Apartment, suite, unit, etc." {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  City {required && <span className="text-red-500">*</span>}
                </FormLabel>
                <FormControl>
                  <Input placeholder="San Francisco" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  State/Province {required && <span className="text-red-500">*</span>}
                </FormLabel>
                <FormControl>
                  <Input placeholder="CA" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  ZIP/Postal Code {required && <span className="text-red-500">*</span>}
                </FormLabel>
                <FormControl>
                  <Input placeholder="94102" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="country"
            render={({ field }) => {
              const [open, setOpen] = React.useState(false)

              return (
                <FormItem className="flex flex-col">
                  <FormLabel>
                    Country {required && <span className="text-red-500">*</span>}
                  </FormLabel>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={open}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? getCountryName(field.value) : "Select country"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search country..." />
                        <CommandList>
                          <CommandEmpty>No country found.</CommandEmpty>
                          <ScrollArea className="h-72">
                            <CommandGroup>
                              {countries.map((country: string) => {
                                const code = getCountryCode(country)
                                return (
                                  <CommandItem
                                    key={country}
                                    value={country}
                                    onSelect={() => {
                                      field.onChange(code) // Save the country code, not name
                                      setOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === code ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {country}
                                  </CommandItem>
                                )
                              })}
                            </CommandGroup>
                          </ScrollArea>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        </div>

        {showButtons && (
          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {onSkip && mode === 'create' && (
              <Button type="button" variant="outline" onClick={onSkip}>
                Skip for now
              </Button>
            )}
            <Button type="submit">
              {mode === 'create' ? 'Continue' : 'Save Changes'}
            </Button>
          </div>
        )}
      </form>
    </Form>
  )
}
