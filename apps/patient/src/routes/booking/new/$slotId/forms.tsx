import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { z } from 'zod'
import { formatDate } from '@monobase/ui/lib/format-date'
import { FileText, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@monobase/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@monobase/ui/components/card'
import { Alert, AlertDescription } from '@monobase/ui/components/alert'
import { Label } from '@monobase/ui/components/label'
import { Input } from '@monobase/ui/components/input'
import { Textarea } from '@monobase/ui/components/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui/components/select'
import { Checkbox } from '@monobase/ui/components/checkbox'
import { Separator } from '@monobase/ui/components/separator'
import { BookingFlowLayout } from '@/components/layouts/booking-flow-layout'
import { useSession } from '@monobase/sdk/react/hooks/use-auth'
import { ErrorBoundary } from '@/components/error-boundary'
import { useTimeSlot } from '@monobase/sdk/react/hooks/use-booking'
import { Skeleton } from '@monobase/ui/components/skeleton'

// Booking form configuration types (temporarily defined here until API provides them)
interface BookingFormField {
  id: string
  type: 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'datetime' | 'select' | 'multiselect' | 'checkbox' | 'display'
  label?: string
  required?: boolean
  placeholder?: string
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
  options?: Array<{ label: string; value: string }>
  content?: string // For display type
}

interface BookingFormConfig {
  title?: string
  description?: string
  fields: BookingFormField[]
}

// Route params schema
const paramsSchema = z.object({
  slotId: z.string(),
})

export const Route = createFileRoute('/booking/new/$slotId/forms')({
  params: paramsSchema,
  component: () => (
    <ErrorBoundary>
      <BookingFormsPage />
    </ErrorBoundary>
  ),
})

function BookingFormsPage() {
  const { slotId } = Route.useParams()
  const navigate = useNavigate()
  const { data: session } = useSession()

  // Use real API hook to fetch slot data
  const { data: slot, isLoading: isLoadingSlot, error: slotError } = useTimeSlot(slotId)

  // Form responses state - key is field ID, value is the response
  const [formResponses, setFormResponses] = useState<Record<string, any>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Validate consent exists - redirect if missing (must be in useEffect to avoid render-time navigation)
  useEffect(() => {
    const consentData = sessionStorage.getItem(`booking_consent_${slotId}`)
    if (!consentData) {
      navigate({
        to: '/booking/new/$slotId/consent',
        params: { slotId },
        replace: true
      })
    }
  }, [slotId, navigate])

  // Redirect to confirmation if no booking forms configured
  useEffect(() => {
    if (slot && (!slot.bookingFormConfig || slot.bookingFormConfig.fields?.length === 0)) {
      navigate({
        to: '/booking/new/$slotId/confirm',
        params: { slotId },
        replace: true
      })
    }
  }, [slot, slotId, navigate])

  // Initialize form responses when slot data is loaded
  useEffect(() => {
    if (slot) {
      const formConfig = getFormConfig()
      const initialResponses: Record<string, any> = {}

      formConfig.fields.forEach(field => {
        if (field.type !== 'display') {
          initialResponses[field.id] = field.type === 'checkbox' ? false : ''
        }
      })

      setFormResponses(initialResponses)
    }
  }, [slot])
  
  const handleBack = () => {
    navigate({
      to: '/booking/new/$slotId/consent',
      params: { slotId }
    })
  }

  const handleExit = () => {
    navigate({ to: '/providers' })
  }
  
  // Validate a single field
  const validateField = (field: BookingFormField, value: any): string | null => {
    if (field.required && !value) {
      return `${field.label || 'This field'} is required`
    }
    
    if (field.type === 'text' || field.type === 'textarea') {
      const strValue = String(value)
      if (field.minLength && strValue.length < field.minLength) {
        return `Minimum length is ${field.minLength} characters`
      }
      if (field.maxLength && strValue.length > field.maxLength) {
        return `Maximum length is ${field.maxLength} characters`
      }
      if (field.pattern && !new RegExp(field.pattern).test(strValue)) {
        return 'Invalid format'
      }
    }
    
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Invalid email address'
    }
    
    if (field.type === 'phone' && value && !/^[\d\s\-\+\(\)]+$/.test(value)) {
      return 'Invalid phone number'
    }
    
    if (field.type === 'number') {
      const numValue = Number(value)
      if (field.min !== undefined && numValue < field.min) {
        return `Minimum value is ${field.min}`
      }
      if (field.max !== undefined && numValue > field.max) {
        return `Maximum value is ${field.max}`
      }
    }
    
    return null
  }
  
  // Get form config from slot
  const getFormConfig = (): BookingFormConfig => {
    // Return slot's booking form config (should always exist when this page is shown)
    return slot?.bookingFormConfig || { title: '', description: '', fields: [] }
  }

  // Validate all fields
  const validateForm = (): boolean => {
    const formConfig = getFormConfig()

    const errors: Record<string, string> = {}
    let isValid = true

    formConfig.fields.forEach(field => {
      if (field.type === 'display') return

      const error = validateField(field, formResponses[field.id])
      if (error) {
        errors[field.id] = error
        isValid = false
      }
    })

    setFormErrors(errors)
    return isValid
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    // Consent validation now handled in loader hook - no need for runtime check

    // Store form responses for the confirmation page
    // Note: This will be passed to appointment creation API in confirm.tsx
    sessionStorage.setItem(`booking_forms_${slotId}`, JSON.stringify(formResponses))

    // Navigate to confirmation page
    navigate({
      to: '/booking/new/$slotId/confirm',
      params: { slotId }
    })
  }

  const formatTime = (timeStr: string) => {
    try {
      return formatDate(new Date(timeStr), { format: 'time' })
    } catch {
      return timeStr
    }
  }

  const formatDateFull = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return formatDate(date, { format: 'full' })
  }
  
  if (isLoadingSlot) {
    return (
      <BookingFlowLayout
        currentStep={2}
        totalSteps={3}
        onBack={handleBack}
        onExit={handleExit}
      >
        <div className="p-6">
          <Card>
            <CardContent className="p-8">
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-muted-foreground">Loading booking form...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </BookingFlowLayout>
    )
  }
  
  if (!slot || slotError) {
    return (
      <BookingFlowLayout
        currentStep={2}
        totalSteps={3}
        onBack={handleBack}
        onExit={handleExit}
      >
        <div className="p-6">
          <Card>
            <CardContent className="p-8">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {slotError || 'Failed to load booking form'}
                </AlertDescription>
              </Alert>
              <div className="mt-4 text-center">
                <Button onClick={() => navigate({ to: '/providers' })}>
                  Browse Providers
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </BookingFlowLayout>
    )
  }
  
  const bookingDetails = {
    providerName: slot.owner || 'Provider', // API returns owner instead of providerName
    date: formatDateFull(slot.date),
    time: formatTime(slot.startTime),
    duration: '30 minutes',
    price: slot.billingOverride?.price?.toString() || 'TBD'
  }

  const formConfig = getFormConfig()
  
  const renderFormField = (field: BookingFormField) => {
    const error = formErrors[field.id]
    
    switch (field.type) {
      case 'display':
        return (
          <div key={field.id} className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{field.content}</p>
          </div>
        )
        
      case 'text':
      case 'email':
      case 'phone':
        return (
          <div key={field.id}>
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type={field.type}
              value={formResponses[field.id] || ''}
              onChange={(e) => {
                setFormResponses(prev => ({ ...prev, [field.id]: e.target.value }))
                setFormErrors(prev => ({ ...prev, [field.id]: '' }))
              }}
              placeholder={field.placeholder}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
          </div>
        )
        
      case 'textarea':
        return (
          <div key={field.id}>
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.id}
              value={formResponses[field.id] || ''}
              onChange={(e) => {
                setFormResponses(prev => ({ ...prev, [field.id]: e.target.value }))
                setFormErrors(prev => ({ ...prev, [field.id]: '' }))
              }}
              placeholder={field.placeholder}
              rows={3}
              className={error ? 'border-red-500' : ''}
            />
            {field.maxLength && (
              <p className="text-xs text-muted-foreground mt-1">
                {formResponses[field.id]?.length || 0}/{field.maxLength} characters
              </p>
            )}
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
          </div>
        )
        
      case 'select':
        return (
          <div key={field.id}>
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select
              value={formResponses[field.id] || ''}
              onValueChange={(value) => {
                setFormResponses(prev => ({ ...prev, [field.id]: value }))
                setFormErrors(prev => ({ ...prev, [field.id]: '' }))
              }}
            >
              <SelectTrigger className={error ? 'border-red-500' : ''}>
                <SelectValue placeholder={field.placeholder || 'Select an option'} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
          </div>
        )
        
      case 'checkbox':
        return (
          <div key={field.id} className="flex items-start space-x-3">
            <Checkbox
              id={field.id}
              checked={formResponses[field.id] || false}
              onCheckedChange={(checked) => {
                setFormResponses(prev => ({ ...prev, [field.id]: checked }))
                setFormErrors(prev => ({ ...prev, [field.id]: '' }))
              }}
            />
            <Label htmlFor={field.id} className="text-sm leading-relaxed cursor-pointer">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
          </div>
        )
        
      default:
        return null
    }
  }
  
  return (
    <BookingFlowLayout
      currentStep={2}
      totalSteps={3}
      onBack={handleBack}
      onExit={handleExit}
      bookingDetails={bookingDetails}
    >
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {formConfig.title || 'Booking Information'}
            </CardTitle>
            {formConfig.description && (
              <CardDescription>{formConfig.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {formConfig.fields.length > 0 ? (
                <div className="space-y-4">
                  {formConfig.fields.map(renderFormField)}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No additional information required. You can proceed to confirm your booking.
                  </AlertDescription>
                </Alert>
              )}
              
              <Separator />
              
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                >
                  Continue to Confirmation
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </BookingFlowLayout>
  )
}