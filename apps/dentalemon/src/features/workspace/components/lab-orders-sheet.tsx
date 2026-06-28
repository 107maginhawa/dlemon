/**
 * LabOrdersSheet — slide-up sheet for managing lab orders
 *
 * Shows list of existing orders with status + action buttons.
 * Create new order form at bottom.
 *
 * Wireframe: docs/prd/context/wireframes/ws-lab-orders.html
 */

import React, { useState } from 'react';
import { toast } from 'sonner';
import { toastError } from '@/lib/error-toast';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listLabOrdersOptions,
  listLabOrdersQueryKey,
  createLabOrderMutation,
  updateLabOrderMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type { LabOrder } from '@monobase/sdk-ts/generated';

type LabOrderStatus = 'ordered' | 'in_fabrication' | 'delivered' | 'fitted' | 'cancelled';

export const STATUS_LABELS: Record<LabOrderStatus, string> = {
  ordered: 'Ordered',
  in_fabrication: 'In Fabrication',
  delivered: 'Delivered',
  fitted: 'Fitted',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<LabOrderStatus, string> = {
  ordered: 'bg-blue-100 text-blue-700',
  in_fabrication: 'bg-orange-100 text-orange-700',
  delivered: 'bg-green-100 text-green-700',
  fitted: 'bg-lemon text-lemon-foreground',
  cancelled: 'bg-gray-100 text-gray-500',
};

export const NEXT_STATUS: Record<LabOrderStatus, LabOrderStatus | null> = {
  ordered: 'in_fabrication',
  in_fabrication: 'delivered',
  delivered: 'fitted',
  fitted: null,
  cancelled: null,
};

interface CreateForm {
  labName: string;
  description: string;
  shade: string;
  material: string;
  dueDate: string;
  expectedDeliveryDate: string;
}

export function validateLabOrderForm(form: Pick<CreateForm, 'labName' | 'description'>): string[] {
  const errs: string[] = [];
  if (!form.labName.trim()) errs.push('Lab name is required');
  if (!form.description.trim()) errs.push('Description is required');
  return errs;
}

/**
 * Returns due-date display state for a lab order card (P2-12).
 * `overdue` when the due date is in the past for a non-terminal order.
 */
export function labOrderDueState(
  dueDate: string | Date | null | undefined,
  status: LabOrderStatus,
  now: Date = new Date(),
): { label: string; overdue: boolean } | null {
  if (!dueDate) return null;
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const terminal = status === 'fitted' || status === 'cancelled';
  const overdue = !terminal && due.getTime() < now.getTime();
  return { label: due.toLocaleDateString(), overdue };
}

export interface LabOrdersSheetProps {
  visitId: string;
  patientId: string;
  open: boolean;
  onClose: () => void;
}

export function LabOrdersSheet({ visitId, patientId, open, onClose }: LabOrdersSheetProps) {
  // WCAG 2.4.3: Escape closes the sheet; focus returns to the opener on close + trapped within.
  const { containerRef } = useSheetA11y({ open, onClose });

  const [form, setForm] = useState<CreateForm>({ labName: '', description: '', shade: '', material: '', dueDate: '', expectedDeliveryDate: '' });
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const queryClient = useQueryClient();

  const { data: ordersResponse, isLoading: loading } = useQuery({
    ...listLabOrdersOptions({ path: { visitId } }),
    enabled: open,
  });

  const orders = (ordersResponse?.data ?? []) as LabOrder[];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: listLabOrdersQueryKey({ path: { visitId } }) });

  const updateMutation = useMutation({
    ...updateLabOrderMutation(),
    onSuccess: invalidate,
  });

  const createMutation = useMutation({
    ...createLabOrderMutation(),
    onSuccess: () => {
      invalidate();
      setShowCreate(false);
      setForm({ labName: '', description: '', shade: '', material: '', dueDate: '', expectedDeliveryDate: '' });
      toast.success('Lab order created');
    },
    onError: (err) => toastError(err, 'Could not create the lab order'),
  });

  function handleAdvanceStatus(order: LabOrder) {
    const next = NEXT_STATUS[order.status as LabOrderStatus];
    if (!next) return;
    updateMutation.mutate({
      path: { visitId, orderId: order.id },
      body: { status: next } as Parameters<typeof updateMutation.mutate>[0]['body'],
    });
  }

  function handleCancel(order: LabOrder) {
    updateMutation.mutate({
      path: { visitId, orderId: order.id },
      body: { status: 'cancelled', cancelReason: 'Cancelled by user' } as Parameters<typeof updateMutation.mutate>[0]['body'],
    });
  }

  function handleCreate() {
    const errs = validateLabOrderForm(form);
    if (errs.length > 0) { setFormErrors(errs); return; }
    setFormErrors([]);
    createMutation.mutate({
      path: { visitId },
      body: {
        visitId,
        patientId,
        labName: form.labName.trim(),
        description: form.description.trim(),
        // P2-12: restoration detail + clinically-needed due date
        shade: form.shade.trim() || undefined,
        material: form.material.trim() || undefined,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        expectedDeliveryDate: form.expectedDeliveryDate ? new Date(form.expectedDeliveryDate).toISOString() : undefined,
      } as Parameters<typeof createMutation.mutate>[0]['body'],
    });
  }

  if (!open) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-40 flex items-end" role="dialog" aria-modal="true" aria-label="Lab orders sheet">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        data-testid="lab-orders-sheet"
        className="relative w-full max-h-[75vh] bg-background rounded-t-2xl shadow-2xl flex flex-col"
      >
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 pb-3 border-b flex-shrink-0">
          <h2 className="text-base font-semibold">Lab Orders</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(v => !v)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-lemon text-lemon-foreground hover:bg-lemon-hover transition-colors"
            >
              + New Order
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close lab orders"
              className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {/* Create form */}
          {showCreate && (
            <div className="rounded-xl border border-dashed border-border p-4 flex flex-col gap-3 bg-secondary/20">
              <h3 className="text-sm font-semibold">New Lab Order</h3>
              {formErrors.length > 0 && (
                <div className="text-sm text-destructive">{formErrors.map(e => <p key={e}>{e}</p>)}</div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="lo-lab-name">Lab Name *</label>
                <input
                  id="lo-lab-name"
                  type="text"
                  value={form.labName}
                  onChange={e => setForm(f => ({ ...f, labName: e.target.value }))}
                  placeholder="e.g. Precision Dental Lab"
                  className="w-full h-10 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="lo-description">Description *</label>
                <input
                  id="lo-description"
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. PFM Crown tooth 21"
                  className="w-full h-10 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="lo-shade">Shade</label>
                  <input
                    id="lo-shade"
                    type="text"
                    value={form.shade}
                    onChange={e => setForm(f => ({ ...f, shade: e.target.value }))}
                    placeholder="e.g. A2"
                    className="w-full h-10 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="lo-material">Material</label>
                  <input
                    id="lo-material"
                    type="text"
                    value={form.material}
                    onChange={e => setForm(f => ({ ...f, material: e.target.value }))}
                    placeholder="e.g. Zirconia"
                    className="w-full h-10 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="lo-due">Due Date</label>
                  <input
                    id="lo-due"
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full h-10 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="lo-delivery">Expected Delivery</label>
                  <input
                    id="lo-delivery"
                    type="date"
                    value={form.expectedDeliveryDate}
                    onChange={e => setForm(f => ({ ...f, expectedDeliveryDate: e.target.value }))}
                    className="w-full h-10 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 h-10 rounded-xl border border-border text-sm hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="flex-1 h-10 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create order'}
                </button>
              </div>
            </div>
          )}

          {/* Orders list */}
          {loading && <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>}
          {!loading && orders.length === 0 && !showCreate && (
            <p className="text-sm text-muted-foreground text-center py-8">No lab orders yet.</p>
          )}
          {orders.map(order => {
            const next = NEXT_STATUS[order.status as LabOrderStatus];
            const due = labOrderDueState(order.dueDate, order.status as LabOrderStatus);
            const detailBits = [order.shade && `Shade ${order.shade}`, order.material].filter(Boolean) as string[];
            return (
              <div
                key={order.id}
                data-testid={`lab-order-${order.id}`}
                className="rounded-xl border border-border p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{order.description}</p>
                    <p className="text-xs text-muted-foreground">{order.labName}</p>
                    {detailBits.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">{detailBits.join(' · ')}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status as LabOrderStatus]}`}>
                      {STATUS_LABELS[order.status as LabOrderStatus]}
                    </span>
                    {due && (
                      <span
                        data-testid={`lab-order-due-${order.id}`}
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          due.overdue ? 'bg-destructive/15 text-destructive' : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {due.overdue ? `Overdue · ${due.label}` : `Due ${due.label}`}
                      </span>
                    )}
                  </div>
                </div>
                {next && (
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(order)}
                      className="flex-1 h-8 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                    >
                      Mark as {STATUS_LABELS[next]}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancel(order)}
                      className="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
