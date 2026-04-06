import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@monobase/ui/components/table'
import { Card, CardContent, CardHeader, CardTitle } from '@monobase/ui/components/card'
import type { PrescriptionData } from '@monobase/sdk/types'

interface PrescriptionsListProps {
  prescriptions: PrescriptionData[]
}

export function PrescriptionsList({ prescriptions }: PrescriptionsListProps) {
  if (!prescriptions || prescriptions.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Prescriptions</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Medication</TableHead>
              <TableHead>Dosage</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Instructions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prescriptions.map((prescription, index) => (
              <TableRow key={prescription.id || index}>
                <TableCell className="font-medium">{prescription.medication}</TableCell>
                <TableCell>{prescription.dosage || '-'}</TableCell>
                <TableCell>{prescription.frequency || '-'}</TableCell>
                <TableCell>{prescription.duration || '-'}</TableCell>
                <TableCell className="max-w-xs truncate" title={prescription.instructions}>
                  {prescription.instructions || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
