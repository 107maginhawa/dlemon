import { createFileRoute, redirect } from '@tanstack/react-router';

// /portal → default to the appointments tab.
export const Route = createFileRoute('/_portal/portal/')({
  beforeLoad: () => {
    throw redirect({ to: '/portal/appointments' });
  },
});
