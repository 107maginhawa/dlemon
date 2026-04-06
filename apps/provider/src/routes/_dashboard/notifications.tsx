import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import {
  Bell,
  BellRing,
  Check,
  Clock,
  Calendar,
  FileText,
  Pill,
  CreditCard,
  UserCheck,
  AlertCircle,
  Trash2,
  MoreVertical,
  Loader2,
  Shield,
  MessageSquare,
  Package,
  User,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react'
import {
  useNotifications,
  useUnreadNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from '@monobase/sdk/react/hooks/use-notifications'
import type {
  Notification,
  NotificationType,
  NotificationStatus,
  NotificationChannel,
} from '@monobase/sdk/services/notifications'
import { Button } from '@monobase/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@monobase/ui/components/card'
import { Badge } from '@monobase/ui/components/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@monobase/ui/components/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@monobase/ui/components/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@monobase/ui/components/dropdown-menu'
import { Skeleton } from '@monobase/ui/components/skeleton'
import { ScrollArea } from '@monobase/ui/components/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@monobase/ui/components/select'
import { Separator } from '@monobase/ui/components/separator'
import { cn } from '@monobase/ui/lib/utils'

export const Route = createFileRoute('/_dashboard/notifications')({
  component: NotificationsPage,
})

// Utility functions
function formatNotificationTime(date: Date | string | undefined): string {
  if (!date) return ''

  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function isNotificationUnread(notification: Notification): boolean {
  return notification.status === 'unread' || !notification.readAt
}

// Notification icon and color mapping
function getNotificationDisplay(type: NotificationType): {
  icon: React.ElementType
  color: string
  bgColor: string
} {
  switch (type) {
    case 'appointment-reminder':
    case 'appointment-confirmation':
    case 'appointment-cancellation':
    case 'appointment-reschedule':
      return {
        icon: Calendar,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
      }
    case 'billing':
    case 'payment-received':
    case 'payment-failed':
    case 'invoice':
      return {
        icon: CreditCard,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
      }
    case 'security':
    case 'password-reset':
    case 'login-alert':
      return {
        icon: Shield,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
      }
    case 'prescription':
    case 'prescription-renewal':
      return {
        icon: Pill,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
      }
    case 'lab-results':
    case 'test-results':
      return {
        icon: FileText,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
      }
    case 'message':
    case 'chat':
      return {
        icon: MessageSquare,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
      }
    case 'system':
    case 'update':
    case 'maintenance':
      return {
        icon: Bell,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
      }
    default:
      return {
        icon: Bell,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
      }
  }
}

// Notification priority calculation
function getNotificationPriority(notification: Notification): 'high' | 'medium' | 'low' {
  // High priority for security and urgent medical notifications
  if (
    notification.type === 'security' ||
    notification.type === 'lab-results' ||
    notification.type === 'prescription'
  ) {
    return 'high'
  }

  // Medium priority for appointments and billing
  if (
    notification.type?.includes('appointment') ||
    notification.type?.includes('payment') ||
    notification.type === 'billing'
  ) {
    return 'medium'
  }

  // Low priority for everything else
  return 'low'
}

function NotificationsPage() {
  // State
  const [selectedTab, setSelectedTab] = useState<'all' | 'unread'>('all')
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all')
  const [channelFilter, setChannelFilter] = useState<NotificationChannel | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  // Fetch notifications with filters
  const { data: notificationsData, isLoading, error, refetch } = useNotifications({
    type: typeFilter !== 'all' ? typeFilter : undefined,
    channel: channelFilter !== 'all' ? channelFilter : undefined,
    status: selectedTab === 'unread' ? 'unread' : undefined,
    page: currentPage,
    pageSize,
    sort: '-createdAt', // Sort by newest first
  })

  // Fetch unread count separately for badge
  const { data: unreadData } = useUnreadNotifications()

  // Mutations
  const markAsReadMutation = useMarkNotificationAsRead()
  const markAllAsReadMutation = useMarkAllNotificationsAsRead()

  const notifications = notificationsData?.data || []
  const totalPages = notificationsData?.totalPages || 1
  const totalCount = notificationsData?.total || 0
  const unreadCount = unreadData?.total || 0

  // Map notifications to UI format with enhanced data
  const uiNotifications = useMemo(() => {
    return notifications.map((notif) => {
      const display = getNotificationDisplay(notif.type)
      const priority = getNotificationPriority(notif)

      return {
        ...notif,
        icon: display.icon,
        color: display.color,
        bgColor: display.bgColor,
        priority,
        unread: isNotificationUnread(notif),
        formattedTime: formatNotificationTime(notif.createdAt),
      }
    })
  }, [notifications])

  // Handlers
  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsReadMutation.mutateAsync(id)
    } catch (error) {
      // Error handled by mutation with toast
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync()
      refetch() // Refresh the list
    } catch (error) {
      // Error handled by mutation with toast
    }
  }

  const handleViewDetails = (notification: typeof uiNotifications[0]) => {
    // Mark as read when viewing
    if (notification.unread) {
      handleMarkAsRead(notification.id)
    }

    // Navigate based on related entity
    if (notification.relatedEntityType && notification.relatedEntity) {
      // TODO: Navigate to related entity
      console.log('Navigate to:', notification.relatedEntityType, notification.relatedEntity)
    }
  }

  // Reset page when filters change
  const handleFilterChange = (
    type: 'type' | 'channel',
    value: string
  ) => {
    setCurrentPage(1)
    if (type === 'type') {
      setTypeFilter(value as NotificationType | 'all')
    } else {
      setChannelFilter(value as NotificationChannel | 'all')
    }
  }

  // Loading skeleton component
  const NotificationSkeleton = () => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">Loading your notifications...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <NotificationSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
          </div>
        </div>
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="font-semibold">Failed to load notifications</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => refetch()}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Empty state component
  const EmptyState = ({ filtered = false }: { filtered?: boolean }) => (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-3 mb-4">
          <Bell className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-1">
          {filtered ? 'No matching notifications' : 'All caught up!'}
        </h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          {filtered
            ? 'Try adjusting your filters to see more notifications'
            : "You don't have any notifications at the moment. We'll notify you when something important happens."}
        </p>
        {filtered && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setTypeFilter('all')
              setChannelFilter('all')
              setSelectedTab('all')
            }}
          >
            Clear Filters
          </Button>
        )}
      </CardContent>
    </Card>
  )

  // Notification card component
  const NotificationCard = ({ notification }: { notification: typeof uiNotifications[0] }) => {
    const Icon = notification.icon

    return (
      <Card
        className={cn(
          'transition-all hover:shadow-md cursor-pointer',
          notification.unread && 'border-primary/20 bg-accent/5'
        )}
        onClick={() => handleViewDetails(notification)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div
              className={cn(
                'flex-shrink-0 rounded-full p-2',
                notification.bgColor
              )}
            >
              <Icon className={cn('h-5 w-5', notification.color)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  {/* Title with unread indicator */}
                  <div className="flex items-center gap-2">
                    <h3
                      className={cn(
                        'font-semibold line-clamp-1',
                        !notification.unread && 'text-muted-foreground'
                      )}
                    >
                      {notification.title}
                    </h3>
                    {notification.unread && (
                      <div className="flex-shrink-0">
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* Message */}
                  <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
                    {notification.message}
                  </p>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-muted-foreground">
                      {notification.formattedTime}
                    </span>
                    {notification.channel && (
                      <Badge variant="outline" className="text-xs">
                        {notification.channel}
                      </Badge>
                    )}
                    {notification.priority === 'high' && (
                      <Badge variant="destructive" className="text-xs">
                        Urgent
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Actions menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Notification options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {notification.unread && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMarkAsRead(notification.id)
                        }}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Mark as Read
                      </DropdownMenuItem>
                    )}
                    {notification.relatedEntityType && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewDetails(notification)
                        }}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Stay updated with your healthcare notifications
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0 || markAllAsReadMutation.isPending}
          >
            {markAllAsReadMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Mark All Read
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={typeFilter}
          onValueChange={(value) => handleFilterChange('type', value)}
        >
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="appointment-reminder">Appointments</SelectItem>
            <SelectItem value="billing">Billing</SelectItem>
            <SelectItem value="prescription">Prescriptions</SelectItem>
            <SelectItem value="lab-results">Lab Results</SelectItem>
            <SelectItem value="message">Messages</SelectItem>
            <SelectItem value="security">Security</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={channelFilter}
          onValueChange={(value) => handleFilterChange('channel', value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="push">Push</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="in-app">In-App</SelectItem>
          </SelectContent>
        </Select>

        {(typeFilter !== 'all' || channelFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTypeFilter('all')
              setChannelFilter('all')
            }}
          >
            <X className="mr-1 h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Notifications Tabs */}
      <Tabs
        value={selectedTab}
        onValueChange={(value) => {
          setSelectedTab(value as 'all' | 'unread')
          setCurrentPage(1)
        }}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="all" className="relative">
            All
            {totalCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread" className="relative">
            Unread
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-6">
          {uiNotifications.length === 0 ? (
            <EmptyState
              filtered={typeFilter !== 'all' || channelFilter !== 'all'}
            />
          ) : (
            <>
              {/* Notification List */}
              <ScrollArea className="h-[calc(100vh-24rem)]">
                <div className="space-y-3 pr-4">
                  {uiNotifications.map((notification) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                    />
                  ))}
                </div>
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages} ({totalCount} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Real-time notification indicator (optional) */}
      {markAsReadMutation.isPending && (
        <div className="fixed bottom-4 right-4 bg-background border rounded-lg shadow-lg p-3 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Updating notification...</span>
        </div>
      )}
    </div>
  )
}