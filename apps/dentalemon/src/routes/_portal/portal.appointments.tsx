import { createFileRoute } from '@tanstack/react-router';
import { MyAppointmentsView } from '@/features/portal/components/my-appointments-view';

export const Route = createFileRoute('/_portal/portal/appointments')({
  component: MyAppointmentsView,
});
