/**
 * EMR Patient Card Component
 * 
 * Displays patient information in a card format
 */

import { Card, CardContent, CardHeader, CardTitle } from '../../components/card'
import { Badge } from '../../components/badge'
import { Avatar, AvatarFallback } from '../../components/avatar'
import { Calendar, Mail, Phone, FileText, Activity } from 'lucide-react'
import type { EmrPatientDisplay } from '../types'

export interface EmrPatientCardProps {
  patient: EmrPatientDisplay
  onClick?: () => void
  className?: string
}

export function EmrPatientCard({ patient, onClick, className }: EmrPatientCardProps) {
  const initials = patient.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-shadow ${className || ''}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <CardTitle className="text-lg">{patient.name}</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <Calendar className="h-3 w-3" />
            <span>{patient.age} years old</span>
            {patient.gender && (
              <>
                <span>•</span>
                <span className="capitalize">{patient.gender}</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {patient.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-3 w-3 text-muted-foreground" />
            <span>{patient.email}</span>
          </div>
        )}
        {patient.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-3 w-3 text-muted-foreground" />
            <span>{patient.phone}</span>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          {patient.recordCount !== undefined && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {patient.recordCount} records
            </Badge>
          )}
          {patient.consultationCount !== undefined && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {patient.consultationCount} consultations
            </Badge>
          )}
        </div>
        {patient.lastVisit && (
          <div className="text-xs text-muted-foreground pt-1">
            Last visit: {patient.lastVisit}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
