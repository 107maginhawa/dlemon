/**
 * LabOrdersSheet — slide-up sheet for managing lab orders
 *
 * Shows list of existing orders with status + action buttons.
 * Create new order form at bottom.
 *
 * Wireframe: docs/prd/context/wireframes/ws-lab-orders.html
 */

import React, { useState } from 'react';
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
  fitted: 'bg-[#FFE97D] text-[#4A4018]',
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
  expectedDeliveryDate: string;
}

export function validateLabOrderForm(form: Pick<CreateForm, 'labName' | 'description'>): string[] {
  const errs: string[] = [];
  if (!form.labName.trim()) errs.push('Lab name is required');
  if (!form.description.trim()) errs.push('Description is required');
  return errs;
}

export interface LabOrdersSheetProps {
  visitId: string;
  patientId: string;
  open: boolean;
  onClose: () => void;
}

export function LabOrdersSheet({ visitId, patientId, open, onClose }: LabOrdersSheetProps) {
  const [form, setForm] = useState<CreateForm>({ labName: '', description: '', expectedDeliveryDate: '' });
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
      setForm({ labName: '', description: '', expectedDeliveryDate: '' });
    },
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
        expectedDeliveryDate: form.expectedDeliveryDate ? new Date(form.expectedDeliveryDate).toISOString() : undefined,
      } as Parameters<typeof createMutation.mutate>[0]['body'],
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end" role="dialog" aria-modal="true" aria-label="Lab orders sheet">
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
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#FFE97D] text-[#4A4018] hover:bg-[#F5DC60] transition-colors"
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
                  className="w-full h-10 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
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
                  className="w-full h-10 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="lo-delivery">Expected Delivery</label>
                <input
                  id="lo-delivery"
                  type="date"
                  value={form.expectedDeliveryDate}
                  onChange={e => setForm(f => ({ ...f, expectedDeliveryDate: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
                />
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
                  className="flex-1 h-10 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors disabled:opacity-50"
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
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status as LabOrderStatus]}`}>
                    {STATUS_LABELS[order.status as LabOrderStatus]}
                  </span>
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
