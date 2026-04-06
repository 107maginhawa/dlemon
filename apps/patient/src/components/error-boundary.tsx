import { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@monobase/ui/components/button'
import { Card, CardContent } from '@monobase/ui/components/card'
import { AlertCircle } from 'lucide-react'
import { formatDate } from '@monobase/ui/lib/format-date'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error with component stack context for debugging
    // TODO: Add error tracking service integration (Sentry recommended)
    // Implementation: Install @sentry/react, initialize in main.tsx, errors will auto-report
    // See: https://docs.sentry.io/platforms/javascript/guides/react/
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: formatDate(new Date(), { format: 'iso' }),
      })
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultErrorFallback error={this.state.error} />
    }

    return this.props.children
  }
}

function DefaultErrorFallback({ error }: { error?: Error }) {
  return (
    <Card className="m-4">
      <CardContent className="p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
        <p className="text-muted-foreground mb-4">{error?.message || 'An unexpected error occurred'}</p>
        <Button onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </CardContent>
    </Card>
  )
}