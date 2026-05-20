/**
 * Print route for cephalometric reports.
 *
 * Path:   /imaging-ceph-report/:imageId
 * Search: ?version=N  — selects a specific frozen snapshot; omit for latest.
 *
 * Renders CephReportView from the immutable snapshot (D-I). Re-editing
 * landmarks after a report is generated produces a new version; this route
 * always shows the frozen snapshot at the requested version.
 */
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CephReportView, type CephReportSnapshot } from '@/features/imaging/components/CephReportView'

interface CephReportResponse {
  version: number
  imageId: string
  snapshot: CephReportSnapshot
  createdAt: string
  createdBy: string | null
}

export const Route = createFileRoute('/imaging-ceph-report/$imageId')({
  validateSearch: (search: Record<string, unknown>) => ({
    version: typeof search.version === 'number' ? search.version : undefined,
  }),
  component: CephReportPage,
})

function CephReportPage() {
  const { imageId } = Route.useParams()
  const { version } = Route.useSearch()

  const url = version != null
    ? `/dental/imaging/images/${imageId}/ceph/report?version=${version}`
    : `/dental/imaging/images/${imageId}/ceph/report`

  const { data, isLoading, isError, error } = useQuery<CephReportResponse>({
    queryKey: ['ceph-report', imageId, version ?? 'latest'],
    queryFn: async () => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<CephReportResponse>
    },
    staleTime: Infinity, // immutable snapshot — never stale
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-zinc-500 text-sm">Loading report…</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-red-600 text-sm">
          {isError ? String(error) : 'Report not found.'}
        </p>
      </div>
    )
  }

  return (
    <CephReportView
      snapshot={data.snapshot}
      version={data.version}
    />
  )
}
