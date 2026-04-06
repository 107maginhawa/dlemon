import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/card'
import { Skeleton } from '../../components/skeleton'
import { Separator } from '../../components/separator'

export function BookingWidgetSkeleton({ className }: { className?: string }): React.JSX.Element {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Book Session</CardTitle>
        <CardDescription>Loading available time slots...</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Selection Skeleton */}
        <div>
          <Skeleton className="h-4 w-20 mb-3" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
        
        <Separator />
        
        {/* Time Slots Skeleton */}
        <div>
          <Skeleton className="h-4 w-48 mb-3" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </div>
        
        <Separator />
        
        {/* Footer Info Skeleton */}
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Skeleton className="w-4 h-4 mt-0.5" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Skeleton className="w-4 h-4 mt-0.5" />
            <div className="flex-1">
              <Skeleton className="h-4 w-28 mb-1" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function TimeSlotsSkeleton(): React.JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  )
}

export function DateSelectionSkeleton(): React.JSX.Element {
  return (
    <div className="grid grid-cols-4 gap-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center">
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  )
}
