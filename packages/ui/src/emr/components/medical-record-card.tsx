/**
 * Medical Record Card Component
 * 
 * Displays medical record information in a card format
 */

import { Card, CardContent, CardHeader, CardTitle } from '../../components/card'
import { Badge } from '../../components/badge'
import { Calendar, FileText, Activity, Pill, TestTube, Image as ImageIcon, StickyNote } from 'lucide-react'
import type { MedicalRecordDisplay } from '../types'

export interface MedicalRecordCardProps {
  record: MedicalRecordDisplay
  onClick?: () => void
  className?: string
}

const recordTypeIcons = {
  consultation: Activity,
  diagnosis: FileText,
  prescription: Pill,
  lab_result: TestTube,
  imaging: ImageIcon,
  note: StickyNote,
}

const recordTypeColors = {
  consultation: 'default',
  diagnosis: 'secondary',
  prescription: 'outline',
  lab_result: 'default',
  imaging: 'secondary',
  note: 'outline',
} as const

export function MedicalRecordCard({ record, onClick, className }: MedicalRecordCardProps) {
  const TypeIcon = recordTypeIcons[record.type]
  
  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-shadow ${className || ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{record.title}</CardTitle>
          </div>
          <Badge variant={recordTypeColors[record.type]}>
            {record.type.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{record.date}</span>
        </div>
        {record.providerName && (
          <div className="text-sm text-muted-foreground">
            Provider: {record.providerName}
          </div>
        )}
        {record.summary && (
          <div className="pt-2 text-sm">
            {record.summary}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
