import { MapPin, Languages } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '../../components/avatar'
import { Badge } from '../../components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/card'

export interface ProviderCardProps {
  provider: {
    id: string
    name: string
    title: string
    avatar?: string
    bio?: string
    specialties: string[]
    practiceLocations?: string[]
    languages?: string[]
  }
  children?: React.ReactNode
}

export function ProviderCard({ provider, children }: ProviderCardProps) {
  const initials = provider.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <Card className="h-full hover:shadow-lg transition-shadow" data-testid="provider-card">
      <CardHeader className="space-y-4">
        <div className="flex items-start gap-4">
          <Avatar className="w-20 h-20">
            <AvatarImage src={provider.avatar} alt={provider.name} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-xl" data-testid="provider-name">
              {provider.name}
            </CardTitle>
            <p className="text-base font-semibold text-primary" data-testid="provider-title">
              {provider.title}
            </p>

            {/* Practice Locations */}
            {provider.practiceLocations && provider.practiceLocations.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>Licensed to Practice in {provider.practiceLocations.join(', ')}</span>
              </div>
            )}

            {/* Languages */}
            {provider.languages && provider.languages.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                <Languages className="w-4 h-4" />
                <span>{provider.languages.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Bio */}
          {provider.bio && (
            <p className="text-sm text-muted-foreground">{provider.bio}</p>
          )}

          {/* Specialties */}
          {provider.specialties.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Specializes in:</h4>
              <div className="flex flex-wrap gap-1.5">
                {provider.specialties.slice(0, 4).map((specialty) => (
                  <Badge key={specialty} variant="secondary" className="text-xs">
                    {specialty}
                  </Badge>
                ))}
                {provider.specialties.length > 4 && (
                  <Badge variant="secondary" className="text-xs">
                    +{provider.specialties.length - 4} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Custom Actions */}
          {children && <div className="pt-2">{children}</div>}
        </div>
      </CardContent>
    </Card>
  )
}
