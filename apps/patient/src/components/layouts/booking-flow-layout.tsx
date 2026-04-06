import { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from '@tanstack/react-router'

interface BookingFlowLayoutProps {
  children: ReactNode
  currentStep: number
  totalSteps: number
  stepTitle: string
  onBack?: () => void
  onExit?: () => void
  bookingDetails?: {
    providerName?: string
    date?: string
    time?: string
    duration?: string
    price?: string
  }
}

export function BookingFlowLayout({
  children,
  currentStep,
  totalSteps,
  stepTitle,
  onBack,
  onExit
}: BookingFlowLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-6">
        {/* Exit link */}
        {onExit && (
          <div className="flex justify-start">
            <button
              onClick={onExit}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Browse Providers
            </button>
          </div>
        )}

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalSteps }).map((_, index) => {
            const stepNumber = index + 1
            const isActive = stepNumber === currentStep
            const isCompleted = stepNumber < currentStep

            return (
              <div
                key={stepNumber}
                className={`h-2 flex-1 rounded-full ${
                  isCompleted || isActive ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )
          })}
        </div>

        {/* Step title */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Step {currentStep} of {totalSteps}
          </p>
          <h1 className="text-2xl font-headline font-bold mt-1">{stepTitle}</h1>
        </div>

        {/* Content */}
        <div>{children}</div>
      </div>
    </div>
  )
}
