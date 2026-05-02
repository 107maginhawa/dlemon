import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_dashboard/storage')({
  component: StoragePage,
})

function StoragePage() {
  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Storage</h1>
        <p className="text-sm text-muted-foreground mt-1">View storage usage and manage backups</p>
      </div>

      <div className="rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Used Storage</p>
            <p className="text-2xl font-semibold mt-1">0 MB</p>
          </div>
          <p className="text-sm text-muted-foreground">of 5 GB</p>
        </div>
        <div className="h-2 rounded-full bg-secondary">
          <div className="h-full rounded-full bg-[#FFE97D]" style={{ width: '0%' }} />
        </div>
      </div>

      <div className="rounded-xl border border-border p-6">
        <h3 className="font-medium mb-3">Storage Breakdown</h3>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Patient Records</span><span>0 MB</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Attachments & X-rays</span><span>0 MB</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Backups</span><span>0 MB</span></div>
        </div>
      </div>
    </div>
  );
}
