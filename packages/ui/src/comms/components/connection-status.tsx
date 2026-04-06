/**
 * Connection Status Component
 * Shows connection state indicator
 */

import { Badge } from '@monobase/ui/components/badge'
import { Loader2 } from 'lucide-react'

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed'

interface ConnectionStatusProps {
  state: ConnectionState
  className?: string
}

export function ConnectionStatus({ state, className }: ConnectionStatusProps) {
  const getStatusConfig = () => {
    switch (state) {
      case 'idle':
        return {
          label: 'Ready',
          variant: 'secondary' as const,
          showSpinner: false
        }
      case 'connecting':
        return {
          label: 'Connecting...',
          variant: 'secondary' as const,
          showSpinner: true
        }
      case 'connected':
        return {
          label: 'Connected',
          variant: 'default' as const,
          showSpinner: false
        }
      case 'reconnecting':
        return {
          label: 'Reconnecting...',
          variant: 'secondary' as const,
          showSpinner: true
        }
      case 'disconnected':
        return {
          label: 'Disconnected',
          variant: 'secondary' as const,
          showSpinner: false
        }
      case 'failed':
        return {
          label: 'Connection Failed',
          variant: 'destructive' as const,
          showSpinner: false
        }
    }
  }

  const config = getStatusConfig()

  return (
    <Badge variant={config.variant} className={className}>
      {config.showSpinner && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
      {config.label}
    </Badge>
  )
}
