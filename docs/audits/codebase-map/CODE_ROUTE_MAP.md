# Code Route Map

<!-- oli:regen:code-route-map:begin -->
Strategy: `file-based`

| Route | Method | Component | Auth | Params | Module |
|---|---|---|---|---|---|
| `/_dashboard` | * | DashboardLayout | ? | — | routes |
| `/_workspace` | * | WorkspaceLayout | ? | — | routes |
| `/imaging-ceph-report/$imageId` | * | CephReportPage | ? | imageId | routes |
| `/` | * | HomePage | ? | — | routes |
| `/onboarding` | * | OnboardingPage | true | — | routes |
| `/verify-email` | * | VerifyEmailPage | true | — | routes |
| `/_dashboard/billing` | * | BillingPage | ? | — | routes |
| `/_dashboard/calendar` | * | CalendarPage | ? | — | routes |
| `/_dashboard/dashboard` | * | DashboardPage | ? | — | routes |
| `/_dashboard/dental-onboarding` | * | DentalOnboardingPage | ? | — | routes |
| `/_dashboard/patients` | * | PatientsPage | ? | — | routes |
| `/_dashboard/reports` | * | ReportsPage | ? | — | routes |
| `/_dashboard/settings` | * | SettingsPage | ? | — | routes |
| `/_dashboard/staff` | * | StaffPage | ? | — | routes |
| `/_workspace/$patientId` | * | WorkspacePage | ? | patientId | routes |
| `/_workspace/queue-board` | * | QueueBoardPage | ? | — | routes |
| `/auth/$authView` | * | RouteComponent | ? | authView | routes |
| `/auth/pin-entry/$memberId` | * | PinEntryRoute | true | memberId | routes |
| `/auth/pin-select` | * | PinSelectRoute | true | — | routes |
| `/_dashboard/patients_/$patientId` | * | ProfilePage | ? | patientId | routes |
<!-- oli:regen:code-route-map:end -->
