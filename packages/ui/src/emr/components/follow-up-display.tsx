import { Card, CardContent, CardHeader, CardTitle } from '@monobase/ui/components/card'
import { Badge } from '@monobase/ui/components/badge'
import { Calendar, Info } from 'lucide-react'
import type { FollowUpData } from '@monobase/sdk/types'

interface FollowUpDisplayProps {
  followUp: FollowUpData
}

export function FollowUpDisplay({ followUp }: FollowUpDisplayProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Follow-Up</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Follow-up Required</span>
          <Badge variant={followUp.needed ? 'default' : 'secondary'}>
            {followUp.needed ? 'Yes' : 'No'}
          </Badge>
        </div>

        {followUp.needed && followUp.timeframe && (
          <div className="flex items-start space-x-2">
            <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <span className="text-xs text-muted-foreground">Timeframe</span>
              <p className="text-sm font-medium">{followUp.timeframe}</p>
            </div>
          </div>
        )}

        {followUp.needed && followUp.instructions && (
          <div className="flex items-start space-x-2">
            <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <span className="text-xs text-muted-foreground">Instructions</span>
              <p className="text-sm">{followUp.instructions}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
