import { createFileRoute } from '@tanstack/react-router';
import { MyInvoicesView } from '@/features/portal/components/my-invoices-view';

export const Route = createFileRoute('/_portal/portal/bills')({
  component: MyInvoicesView,
});
