import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Search, Filter, Loader2 } from 'lucide-react'
import { requireAuth, requireEmailVerified, requirePerson, composeGuards } from '@/utils/guards'
import { Button } from '@monobase/ui/components/button'
import { Input } from '@monobase/ui/components/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@monobase/ui/components/select'
import { useConsultations } from '@monobase/sdk/react/hooks/use-emr'
import { ConsultationCard } from '@monobase/ui/emr/components/consultation-card'
import type { ConsultationStatus } from '@monobase/sdk/types'

export const Route = createFileRoute('/_dashboard/medical-records')({
  beforeLoad: composeGuards(requireAuth, requireEmailVerified, requirePerson),
  component: MedicalRecordsPage,
})

function MedicalRecordsPage() {
  const { profile } = Route.useRouteContext()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ConsultationStatus | 'all'>('all')

  // Fetch consultations for current patient
  const { data: consultationsData, isLoading, error } = useConsultations({
    patient: profile.id,
    expand: 'provider,provider.person',
    status: statusFilter !== 'all' ? statusFilter : undefined,
    sort: '-createdAt', // Most recent first
  })

  // Filter by search query (chief complaint)
  const filteredConsultations = consultationsData?.items?.filter((consultation) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return consultation.chiefComplaint?.toLowerCase().includes(query)
  }) || []

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Medical Records</h1>
        <p className="text-muted-foreground">
          View your consultation notes, prescriptions, and treatment plans
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by chief complaint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status Filter */}
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as ConsultationStatus | 'all')}
        >
          <SelectTrigger className="w-full md:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="finalized">Finalized</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="amended">Amended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      {consultationsData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="border rounded-lg p-4">
            <div className="text-2xl font-bold">{consultationsData.total || 0}</div>
            <div className="text-sm text-muted-foreground">Total Consultations</div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-2xl font-bold">
              {consultationsData.items?.filter((c) => c.status === 'finalized').length || 0}
            </div>
            <div className="text-sm text-muted-foreground">Finalized Notes</div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-2xl font-bold">
              {consultationsData.items?.filter((c) => c.prescriptions && c.prescriptions.length > 0).length || 0}
            </div>
            <div className="text-sm text-muted-foreground">With Prescriptions</div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load medical records. Please try again.</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredConsultations && filteredConsultations.length === 0 && (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground">
            {searchQuery || statusFilter !== 'all'
              ? 'No consultations found matching your filters.'
              : 'No consultation records yet.'}
          </p>
          {(searchQuery || statusFilter !== 'all') && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Consultations List */}
      {!isLoading && !error && filteredConsultations && filteredConsultations.length > 0 && (
        <div className="space-y-4">
          {filteredConsultations.map((consultation) => (
            <ConsultationCard key={consultation.id} consultation={consultation} />
          ))}
        </div>
      )}
    </div>
  )
}
