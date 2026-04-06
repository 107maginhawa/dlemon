import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { formatDate as formatDateUtil } from '@monobase/ui/lib/format-date'
import { differenceInYears } from 'date-fns'
import {
  Users,
  Search,
  Filter,
  Plus,
  MoreVertical,
  Phone,
  Mail,
  MessageCircle,
  Video,
  FileText,
  Calendar,
  Clock,
  AlertTriangle,
  Star,
  ChevronDown,
  Eye,
  Edit,
  Archive,
  UserPlus,
  Activity,
  Heart,
  Thermometer,
  Stethoscope,
  Loader2
} from 'lucide-react'
import { useEMRPatients } from '@monobase/sdk/react/hooks/use-emr'
import { Button } from "@monobase/ui/components/button"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter 
} from "@monobase/ui/components/card"
import { Badge } from "@monobase/ui/components/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@monobase/ui/components/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@monobase/ui/components/tabs"
import { Input } from "@monobase/ui/components/input"
import { Label } from "@monobase/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@monobase/ui/components/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@monobase/ui/components/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@monobase/ui/components/table"
import { Checkbox } from "@monobase/ui/components/checkbox"

export const Route = createFileRoute('/_dashboard/patients')({
  component: PatientsPage,
})

type Gender = 'male' | 'female' | 'other'

type Patient = {
  id: string
  name: string
  email: string
  phone: string
  dateOfBirth: string
  gender: Gender
  status: 'active' | 'inactive' | 'new'
  lastVisit: string
  nextAppointment?: string
  conditions: string[]
  avatar?: string
  lastConsultation?: string
  primaryCondition?: string
}

function PatientsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [selectedPatients, setSelectedPatients] = useState<string[]>([])

  // Fetch real patient data using EMR endpoint (provider-scoped)
  const { data: patientsData, isLoading, error } = useEMRPatients({
    limit: 100,
  })

  // Transform API patients to UI format
  const patients: Patient[] = useMemo(() => {
    if (!patientsData?.data) return []

    return patientsData.data.map((apiPatient) => {
      return {
        id: apiPatient.id,
        name: `${apiPatient.firstName} ${apiPatient.middleName || ''} ${apiPatient.lastName || ''}`.trim(),
        email: apiPatient.email || 'No email',
        phone: apiPatient.phone || 'No phone',
        dateOfBirth: apiPatient.dateOfBirth || '1990-01-01',
        gender: (apiPatient.gender || 'other') as Gender,
        status: 'active' as const, // Default since API doesn't track this
        lastVisit: apiPatient.createdAt || new Date().toISOString(),
        conditions: [], // Would come from EMR module
        lastConsultation: apiPatient.updatedAt || new Date().toISOString(),
        primaryCondition: undefined,
      }
    })
  }, [patientsData])

  // Filter patients based on search and status
  const filteredPatients = useMemo(() => {
    return patients.filter(patient => {
      const matchesSearch = !searchQuery || 
        patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.conditions.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesStatus = selectedStatus === 'all' || patient.status === selectedStatus
      
      return matchesSearch && matchesStatus
    })
  }, [patients, searchQuery, selectedStatus])

  const patientStats = useMemo(() => ({
    total: patients.length,
    active: patients.filter(p => p.status === 'active').length,
    new: patients.filter(p => p.status === 'new').length,
  }), [patients])

  const getStatusBadge = (status: Patient['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="secondary">Active</Badge>
      case 'new':
        return <Badge variant="default">New</Badge>
      case 'inactive':
        return <Badge variant="outline">Inactive</Badge>
    }
  }

  const calculateAge = (dateOfBirth: string) => {
    return differenceInYears(new Date(), new Date(dateOfBirth))
  }

  const togglePatientSelection = (patientId: string) => {
    setSelectedPatients(prev => 
      prev.includes(patientId) 
        ? prev.filter(id => id !== patientId)
        : [...prev, patientId]
    )
  }

  const formatDate = (dateString: string) => {
    return formatDateUtil(new Date(dateString), { format: 'medium' })
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading patients...</p>
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
              <AlertTriangle className="h-5 w-5" />
              <p className="font-semibold">Failed to load patients</p>
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
      <div>
        <h1 className="text-3xl font-headline font-bold">Patient Roster</h1>
        <p className="text-muted-foreground font-body">
          Manage your patient information and care records
        </p>
      </div>

      {/* Patient Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Patients</p>
                <p className="text-2xl font-bold">{patientStats.total}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">{patientStats.active}</p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">New Patients</p>
                <p className="text-2xl font-bold text-blue-600">{patientStats.new}</p>
              </div>
              <UserPlus className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold text-purple-600">0</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search patients, conditions, or email..."
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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                Grid
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                Table
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patients Display */}
      {viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPatients.map((patient) => (
            <Card key={patient.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={patient.avatar} />
                      <AvatarFallback>
                        {patient.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{patient.name}</CardTitle>
                      <CardDescription>
                        Age {calculateAge(patient.dateOfBirth)} • {patient.gender}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="mr-2 h-4 w-4" />
                        View Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Calendar className="mr-2 h-4 w-4" />
                        Schedule Appointment
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive Patient
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  {getStatusBadge(patient.status)}
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground truncate">{patient.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{patient.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Last visit: {formatDate(patient.lastVisit)}
                    </span>
                  </div>
                </div>

                {patient.conditions.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Conditions:</p>
                    <div className="flex flex-wrap gap-1">
                      {patient.conditions.slice(0, 2).map((condition, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {condition}
                        </Badge>
                      ))}
                      {patient.conditions.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{patient.conditions.length - 2} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {patient.nextAppointment && (
                  <div className="bg-blue-50 p-2 rounded-lg">
                    <p className="text-xs text-blue-700 font-medium">
                      Next: {formatDate(patient.nextAppointment)}
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex gap-2">
                <div className="flex gap-2 w-full">
                  <Button size="sm" variant="outline" className="flex-1">
                    <MessageCircle className="mr-2 h-3 w-3" />
                    Message
                  </Button>
                  <Button size="sm" className="flex-1" asChild>
                    <Link to="/bookings">
                      <Calendar className="mr-2 h-3 w-3" />
                      Book
                    </Link>
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        /* Table View */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox />
                  </TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead>Next Appointment</TableHead>
                  <TableHead>Primary Condition</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedPatients.includes(patient.id)}
                        onCheckedChange={() => togglePatientSelection(patient.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={patient.avatar} />
                          <AvatarFallback className="text-xs">
                            {patient.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{patient.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Age {calculateAge(patient.dateOfBirth)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(patient.status)}</TableCell>
                    <TableCell>{formatDate(patient.lastVisit)}</TableCell>
                    <TableCell>
                      {patient.nextAppointment ? formatDate(patient.nextAppointment) : '-'}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{patient.primaryCondition || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <MessageCircle className="mr-2 h-4 w-4" />
                            Send Message
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Video className="mr-2 h-4 w-4" />
                            Start Consultation
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Calendar className="mr-2 h-4 w-4" />
                            Schedule Appointment
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {filteredPatients.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No patients found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search criteria or add a new patient
            </p>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions Bar */}
      {selectedPatients.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground p-4 rounded-lg shadow-lg flex items-center gap-4">
          <span className="text-sm font-medium">
            {selectedPatients.length} patient{selectedPatients.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary">
              Send Message
            </Button>
            <Button size="sm" variant="secondary">
              Schedule Appointment
            </Button>
            <Button size="sm" variant="secondary">
              Export Data
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}