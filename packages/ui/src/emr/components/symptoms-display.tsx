import { Card, CardContent, CardHeader, CardTitle } from '@monobase/ui/components/card'
import { Badge } from '@monobase/ui/components/badge'
import type { SymptomsData } from '@monobase/sdk/types'

interface SymptomsDisplayProps {
  symptoms: SymptomsData
}

export function SymptomsDisplay({ symptoms }: SymptomsDisplayProps) {
  const hasSymptoms =
    symptoms.onset ||
    symptoms.duration ||
    symptoms.severity ||
    (symptoms.associated && symptoms.associated.length > 0) ||
    (symptoms.denies && symptoms.denies.length > 0)

  if (!hasSymptoms) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Symptoms</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(symptoms.onset || symptoms.duration || symptoms.severity) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {symptoms.onset && (
              <div>
                <span className="text-xs text-muted-foreground">Onset</span>
                <p className="text-sm font-medium">{symptoms.onset}</p>
              </div>
            )}
            {symptoms.duration && (
              <div>
                <span className="text-xs text-muted-foreground">Duration</span>
                <p className="text-sm font-medium">{symptoms.duration}</p>
              </div>
            )}
            {symptoms.severity && (
              <div>
                <span className="text-xs text-muted-foreground">Severity</span>
                <Badge
                  variant={
                    symptoms.severity.toLowerCase() === 'severe'
                      ? 'destructive'
                      : symptoms.severity.toLowerCase() === 'moderate'
                        ? 'default'
                        : 'secondary'
                  }
                >
                  {symptoms.severity}
                </Badge>
              </div>
            )}
          </div>
        )}

        {symptoms.associated && symptoms.associated.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">Associated Symptoms</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {symptoms.associated.map((symptom, index) => (
                <Badge key={index} variant="outline">
                  {symptom}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {symptoms.denies && symptoms.denies.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">Denies</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {symptoms.denies.map((symptom, index) => (
                <Badge key={index} variant="secondary">
                  {symptom}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
