/**
 * _portal — patient self-service portal layout (E4, Phase 1, read-only).
 *
 * A PATIENT session is a Better-Auth system role `user` with a linked Person +
 * dental_patient record and NO dental_membership. This route group is therefore
 * guarded by AUTH ONLY — it deliberately does NOT require the staff PIN session
 * or an org-context membership (those gate `_dashboard`). Ownership of the data
 * shown here is enforced SERVER-SIDE by every /me endpoint (assertSelfPatient);
 * a non-patient account that reaches these views simply gets honest empty/denied
 * states from the API, never another patient's data.
 *
 * Mobile-first shell: a top bar with sign-out and a bottom tab bar (Appointments
 * / Bills). No sidebar — patients are on phones.
 */
import { createFileRoute, Outlet, Link, useRouterState } from '@tanstack/react-router';
import { requireAuth } from '@/lib/guards';
import { useAuthClient } from '@monobase/sdk-ts/react/auth';
import { Button, Logo } from '@monobase/ui';
import { Calendar, Receipt, LogOut } from 'lucide-react';

export const Route = createFileRoute('/_portal')({
  beforeLoad: async (opts) => {
    // Patients only need to be authenticated. No PIN, no membership.
    await requireAuth(opts);
  },
  component: PortalLayout,
});

const TABS = [
  { to: '/portal/appointments', label: 'Appointments', icon: Calendar },
  { to: '/portal/bills', label: 'Bills', icon: Receipt },
] as const;

function PortalLayout() {
  const authClient = useAuthClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/auth/sign-in';
        },
      },
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
        <Logo variant="horizontal" size="sm" />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          data-testid="portal-sign-out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
          <span className="ml-1.5 hidden sm:inline">Sign out</span>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5 pb-24">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 border-t bg-background"
        aria-label="Patient portal sections"
      >
        <div className="mx-auto flex max-w-md items-stretch">
          {TABS.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-current={active ? 'page' : undefined}
                data-testid={`portal-tab-${label.toLowerCase()}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
