import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@monobase/ui/components/card'
import { Activity, Users, Calendar, DollarSign } from 'lucide-react'
import { useEMRPatients, useConsultations } from '@monobase/sdk/react/hooks/use-emr'
import { useEarningsOverview } from '@/hooks/use-earnings'

export const Route = createFileRoute('/_dashboard/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { data: patientsData } = useEMRPatients({ limit: 1 })
  const { data: consultationsData } = useConsultations({ status: 'completed', limit: 1 })
  const { data: earnings } = useEarningsOverview()

  const stats = [
    {
      title: 'Total Patients',
      value: patientsData?.pagination?.totalCount?.toString() || '0',
      icon: Users,
      description: 'Active patients',
    },
    {
      title: 'Appointments',
      value: '0',
      icon: Calendar,
      description: 'This month',
    },
    {
      title: 'Consultations',
      value: consultationsData?.pagination?.totalCount?.toString() || '0',
      icon: Activity,
      description: 'Completed',
    },
    {
      title: 'Earnings',
      value: `$${earnings?.month?.earnings?.toFixed(2) || '0'}`,
      icon: DollarSign,
      description: 'This month',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your provider portal</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your recent appointments and consultations</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No recent activity to display</p>
        </CardContent>
      </Card>
    </div>
  )
}
