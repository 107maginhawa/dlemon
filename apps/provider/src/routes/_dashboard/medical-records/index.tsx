import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import {
  FileText,
  Search,
  Filter,
  Plus,
  Calendar,
  User,
  Stethoscope,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit,
  Eye,
  Loader2,
  Activity,
  Pill,
  ClipboardCheck,
} from 'lucide-react'
import { subDays } from 'date-fns'
import { useConsultations } from '@monobase/sdk/react/hooks/use-emr'
import { Button } from "@monobase/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@monobase/ui/components/card"
import { Badge } from "@monobase/ui/components/badge"
import { Input } from "@monobase/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@monobase/ui/components/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@monobase/ui/components/tabs"
import { formatRelativeDate } from '@monobase/ui/lib/format-date'
import { MedicalRecordCard } from '@monobase/ui/emr/components/medical-record-card'

export const Route = createFileRoute('/_dashboard/medical-records/')({
  component: MedicalRecordsPage,
})

function MedicalRecordsPage() {
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch consultation notes from API (medical records = consultation notes for now)
  const { data: consultationsData, isLoading, error } = useConsultations({
    limit: 100,
  })

  // Get consultation notes from API
  const allNotes = consultationsData?.data || []
  
  const draftNotes = useMemo(
    () => allNotes.filter((note) => note.status === 'draft'),
    [allNotes]
  )
  
  const finalizedNotes = useMemo(
    () => allNotes.filter((note) => note.status === 'finalized'),
    [allNotes]
  )

  // Filter notes
  const filteredNotes = useMemo(() => {
    let notes = selectedStatus === 'draft' ? draftNotes : selectedStatus === 'finalized' ? finalizedNotes : allNotes

    if (searchQuery) {
      notes = notes.filter(
        (note) =>
          note.chiefComplaint?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.assessment?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return notes
  }, [allNotes, draftNotes, finalizedNotes, selectedStatus, searchQuery])

  const stats = useMemo(
    () => ({
      total: allNotes.length,
      draft: draftNotes.length,
      finalized: finalizedNotes.length,
      recent: allNotes.filter((note) => {
        const noteDate = new Date(note.createdAt)
        const weekAgo = subDays(new Date(), 7)
        return noteDate >= weekAgo
      }).length,
    }),
    [allNotes, draftNotes, finalizedNotes]
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'finalized':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="mr-1 h-3 w-3" />
            Finalized
          </Badge>
        )
      case 'draft':
        return (
          <Badge variant="outline">
            <Edit className="mr-1 h-3 w-3" />
            Draft
          </Badge>
        )
      case 'amended':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            <Activity className="mr-1 h-3 w-3" />
            Amended
          </Badge>
        )
      default:
        return null
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading medical records...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <p className="font-semibold">Failed to load medical records</p>
            </div>
            <p className="mt-2 text-sm text-red-700">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold">Medical Records</h1>
          <p className="text-muted-foreground font-body">
            Manage consultation notes and patient medical records
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Consultation Note
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Draft Notes</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.draft}</p>
              </div>
              <Edit className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Finalized</p>
                <p className="text-2xl font-bold text-green-600">{stats.finalized}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold text-blue-600">{stats.recent}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by chief complaint or assessment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="finalized">Finalized</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Consultation Notes List (Medical Records) */}
      <div className="grid gap-4">
        {filteredNotes.map((note) => (
          <MedicalRecordCard
            key={note.id}
            record={{
              id: note.id,
              patientId: note.patient,
              patientName: 'Patient Name', // This would be fetched from patient data
              date: note.createdAt,
              type: 'consultation' as const,
              chiefComplaint: note.chiefComplaint,
              assessment: note.assessment,
              plan: note.plan,
              status: note.status as 'draft' | 'finalized',
              vitals: note.vitals,
              prescriptions: note.prescriptions,
              followUp: note.followUp,
            }}
          />
        ))}
      </div>

      {filteredNotes.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No medical records found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? 'Try adjusting your search criteria'
                : 'Start by creating your first consultation note'}
            </p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Consultation Note
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}