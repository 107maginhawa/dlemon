/**
 * MyInvoicesView — the patient's own invoices + outstanding balance (E4 portal).
 *
 * Mobile-first, read-only. Shows only patient-appropriate figures (number,
 * status, amounts, dates) from /me/invoices + the /me/balance roll-up.
 *
 * Phase 1 is read-only: NO online payment action (deferred — needs a
 * payments-vendor + PHI-scope product decision). We never imply payability.
 */
import { Badge, Button, Card, CardContent, Skeleton } from '@monobase/ui';
import { Receipt } from 'lucide-react';
import { formatCents } from '@/lib/format-currency';
import { useMyInvoices, useMyBalance, type MyInvoice } from '../hooks/use-my-portal';

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

export function formatInvoiceStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function invoiceStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'paid':
      return 'secondary';
    case 'overdue':
      return 'destructive';
    case 'issued':
    case 'partial':
      return 'default';
    default:
      return 'outline';
  }
}

export function formatInvoiceDate(date: Date | string | null): string {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Presentational pieces (exported for testing without the network)
// ---------------------------------------------------------------------------

export function BalanceSummary({ outstandingCents }: { outstandingCents: number }) {
  return (
    <Card data-testid="portal-balance-summary">
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Outstanding balance
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight" data-testid="portal-balance-amount">
          {formatCents(outstandingCents)}
        </p>
      </CardContent>
    </Card>
  );
}

export function InvoiceCard({ invoice }: { invoice: MyInvoice }) {
  return (
    <Card data-testid="portal-invoice-card" data-status={invoice.status}>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">{invoice.invoiceNumber}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatInvoiceDate(invoice.issuedAt)}
          </p>
          <p className="mt-1 text-sm" data-testid="portal-invoice-balance">
            Balance {formatCents(invoice.balanceCents)} of {formatCents(invoice.totalCents)}
          </p>
        </div>
        <Badge variant={invoiceStatusVariant(invoice.status)} className="shrink-0">
          {formatInvoiceStatus(invoice.status)}
        </Badge>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

export function MyInvoicesView() {
  const { invoices, isLoading, error, refetch } = useMyInvoices();
  const { balance } = useMyBalance();

  return (
    <section className="space-y-3" aria-labelledby="portal-invoices-heading">
      <h1 id="portal-invoices-heading" className="text-lg font-semibold tracking-tight">
        My Bills
      </h1>

      {balance && <BalanceSummary outstandingCents={balance.outstandingBalanceCents} />}

      {isLoading ? (
        <div className="space-y-3" data-testid="portal-invoices-loading">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center text-sm text-destructive">
            <p role="alert">We couldn’t load your bills. Please try again later.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent
            className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground"
            data-testid="portal-invoices-empty"
          >
            <Receipt className="h-6 w-6" aria-hidden="true" />
            <p className="text-sm">You have no bills.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" data-testid="portal-invoices-list">
          {invoices.map((inv) => (
            <InvoiceCard key={inv.id} invoice={inv} />
          ))}
        </div>
      )}
    </section>
  );
}
