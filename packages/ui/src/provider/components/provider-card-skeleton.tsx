import { Card, CardContent, CardHeader } from '../../components/card'
import { Skeleton } from '../../components/skeleton'

export function ProviderCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader className="space-y-4">
        <div className="flex items-start gap-4">
          {/* Avatar Skeleton */}
          <Skeleton className="w-20 h-20 rounded-full shrink-0" />
          
          <div className="flex-1 space-y-2">
            {/* Name */}
            <Skeleton className="h-5 w-3/4" />
            {/* Title */}
            <Skeleton className="h-4 w-1/2" />
            {/* Location */}
            <Skeleton className="h-4 w-2/3 mt-2" />
            {/* Languages */}
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Bio */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>

        {/* Specialties Header */}
        <Skeleton className="h-4 w-32" />

        {/* Specialty Badges */}
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

export function ProviderListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProviderCardSkeleton key={i} />
      ))}
    </div>
  )
}
