import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@monobase/ui/components/card'
import { Badge } from '@monobase/ui/components/badge'
import { Separator } from '@monobase/ui/components/separator'
import { VitalsDisplay } from './vitals-display'
import { PrescriptionsList } from './prescriptions-list'
import { SymptomsDisplay } from './symptoms-display'
import { FollowUpDisplay } from './follow-up-display'
import type { ConsultationNote } from '@monobase/sdk/types'
import { formatDate } from '@monobase/ui/lib/format-date'

interface ConsultationCardProps {
  consultation: ConsultationNote
}

export function ConsultationCard({ consultation }: ConsultationCardProps) {
  // Extract provider name if expanded (provider field is an ID string by default,
  // but may be expanded to a Provider object via the API ?expand=provider param).
  const expandedProvider = consultation.provider as unknown as
    | { person?: { firstName?: string; lastName?: string } }
    | string
  const providerName =
    typeof expandedProvider === 'object' && expandedProvider?.person
      ? `${expandedProvider.person.firstName ?? ''} ${expandedProvider.person.lastName ?? ''}`.trim() || 'Provider'
      : 'Provider'

  // Format date
  const consultationDate = formatDate(consultation.createdAt, { format: 'long' })

  // Status badge variant
  const statusVariant =
    consultation.status === 'finalized'
      ? 'default'
      : consultation.status === 'draft'
        ? 'secondary'
        : 'outline'

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              {consultation.chiefComplaint || 'Consultation'}
            </CardTitle>
            <CardDescription>
              {providerName} • {consultationDate}
            </CardDescription>
          </div>
          <Badge variant={statusVariant}>{consultation.status}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Vitals */}
        {consultation.vitals && <VitalsDisplay vitals={consultation.vitals} />}

        {/* Symptoms */}
        {consultation.symptoms && <SymptomsDisplay symptoms={consultation.symptoms} />}

        {/* Assessment */}
        {consultation.assessment && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Assessment</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {consultation.assessment}
            </p>
          </div>
        )}

        {/* Treatment Plan */}
        {consultation.plan && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Treatment Plan</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {consultation.plan}
              </p>
            </div>
          </>
        )}

        {/* Prescriptions */}
        {consultation.prescriptions && consultation.prescriptions.length > 0 && (
          <>
            <Separator />
            <PrescriptionsList prescriptions={consultation.prescriptions} />
          </>
        )}

        {/* Follow-Up */}
        {consultation.followUp && (
          <>
            <Separator />
            <FollowUpDisplay followUp={consultation.followUp} />
          </>
        )}

        {/* Finalized info */}
        {consultation.finalizedAt && (
          <div className="text-xs text-muted-foreground mt-4 pt-4 border-t">
            Finalized on {formatDate(consultation.finalizedAt, { format: 'datetime' })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
