import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  FileText,
  Save,
  ArrowLeft,
  CheckCircle,
  Edit,
  Loader2,
  AlertCircle,
  Stethoscope,
  Pill,
  Calendar,
  ClipboardCheck,
  User,
  Activity,
} from 'lucide-react'
import { useConsultation, useUpdateConsultation, useFinalizeConsultation } from '@monobase/sdk/react/hooks/use-emr'
import { Button } from "@monobase/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@monobase/ui/components/card"
import { Badge } from "@monobase/ui/components/badge"
import { Textarea } from "@monobase/ui/components/textarea"
import { Label } from "@monobase/ui/components/label"
import { Input } from "@monobase/ui/components/input"
import { Separator } from "@monobase/ui/components/separator"
import { toast } from 'sonner'

export const Route = createFileRoute('/_dashboard/medical-records/$id')({
  component: MedicalRecordDetailPage,
})

function MedicalRecordDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)

  // Fetch consultation note
  const { data: note, isLoading, error } = useConsultation(id)
  const { mutate: updateConsultation, isPending: isUpdating } = useUpdateConsultation()
  const { mutate: finalizeConsultation, isPending: isFinalizing } = useFinalizeConsultation()

  // Form state
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')

  // Initialize form when note loads
  useEffect(() => {
    if (note) {
      setChiefComplaint(note.chiefComplaint || '')
      setAssessment(note.assessment || '')
      setPlan(note.plan || '')
    }
  }, [note])

  const handleSave = async () => {
    if (!note) return

    updateConsultation({
      consultationId: note.id,
      data: {
        chiefComplaint,
        assessment,
        plan,
      },
    }, {
      onSuccess: () => {
        toast.success('Consultation note saved')
        setIsEditing(false)
      },
      onError: () => {
        toast.error('Failed to save consultation note')
      }
    })
  }

  const handleFinalize = async () => {
    if (!note) return

    finalizeConsultation(note.id, {
      onSuccess: () => {
        toast.success('Consultation note finalized')
        setIsEditing(false)
      },
      onError: () => {
        toast.error('Failed to finalize consultation note')
      }
    })
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading medical record...</p>
      </div>
    )
  }

  // Error state
  if (error || !note) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <p className="font-semibold">Failed to load medical record</p>
            </div>
            <p className="mt-2 text-sm text-red-700">
              {error instanceof Error ? error.message : 'Record not found'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const canEdit = note.status === 'draft'
  const isCurrentlyEditing = isEditing && canEdit

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: '/medical-records' })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-headline font-bold">Medical Record</h1>
            <p className="text-muted-foreground font-body">
              Consultation note for patient
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {note.status === 'finalized' && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle className="mr-1 h-4 w-4" />
              Finalized
            </Badge>
          )}
          {note.status === 'draft' && (
            <>
              {!isEditing ? (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    disabled={isUpdating}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isUpdating}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isUpdating ? 'Saving...' : 'Save'}
                  </Button>
                </>
              )}
              <Button onClick={handleFinalize} disabled={isFinalizing}>
                <CheckCircle className="mr-2 h-4 w-4" />
                {isFinalizing ? 'Finalizing...' : 'Finalize'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Chief Complaint */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Chief Complaint
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isCurrentlyEditing ? (
            <Textarea
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="Enter chief complaint..."
              rows={3}
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {note.chiefComplaint || 'No chief complaint recorded'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Clinical Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Clinical Notes
          </CardTitle>
          <CardDescription>Assessment and treatment plan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Assessment */}
          <div>
            <Label className="text-base font-semibold">Assessment</Label>
            <Separator className="my-2" />
            {isCurrentlyEditing ? (
              <Textarea
                value={assessment}
                onChange={(e) => setAssessment(e.target.value)}
                placeholder="Clinical assessment and diagnosis..."
                rows={4}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">
                {note.assessment || 'No assessment recorded'}
              </p>
            )}
          </div>

          {/* Plan */}
          <div>
            <Label className="text-base font-semibold">Plan</Label>
            <Separator className="my-2" />
            {isCurrentlyEditing ? (
              <Textarea
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder="Treatment plan and recommendations..."
                rows={4}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">
                {note.plan || 'No plan recorded'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vitals */}
      {note.vitals && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Vitals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {note.vitals.bloodPressure && (
                <div>
                  <Label className="text-xs text-muted-foreground">Blood Pressure</Label>
                  <p className="text-lg font-semibold">{note.vitals.bloodPressure}</p>
                </div>
              )}
              {note.vitals.pulse && (
                <div>
                  <Label className="text-xs text-muted-foreground">Pulse</Label>
                  <p className="text-lg font-semibold">{note.vitals.pulse} bpm</p>
                </div>
              )}
              {note.vitals.temperature && (
                <div>
                  <Label className="text-xs text-muted-foreground">Temperature</Label>
                  <p className="text-lg font-semibold">{note.vitals.temperature}</p>
                </div>
              )}
              {note.vitals.weight && (
                <div>
                  <Label className="text-xs text-muted-foreground">Weight</Label>
                  <p className="text-lg font-semibold">{note.vitals.weight}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Treatment Plan */}
      {note.prescriptions && note.prescriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5" />
              Treatment Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {note.prescriptions.map((rx, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div>
                    <p className="font-semibold">{rx.medication}</p>
                    <p className="text-sm text-muted-foreground">
                      {rx.dosage} - {rx.frequency}
                    </p>
                    {rx.duration && (
                      <p className="text-sm text-muted-foreground">Duration: {rx.duration}</p>
                    )}
                    {rx.instructions && (
                      <p className="text-sm mt-1">{rx.instructions}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Follow-up */}
      {note.followUp?.needed && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Follow-up
            </CardTitle>
          </CardHeader>
          <CardContent>
            {note.followUp.timeframe && (
              <p className="text-sm font-semibold mb-2">
                Timeframe: {note.followUp.timeframe}
              </p>
            )}
            {note.followUp.instructions && (
              <p className="text-sm">{note.followUp.instructions}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}