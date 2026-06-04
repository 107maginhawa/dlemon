# Code Route Map

<!-- oli:regen:code-route-map:begin -->
Strategy: `mixed`

| Route | Method | Component | Auth | Params | Module |
|---|---|---|---|---|---|
| `/_dashboard` | * | DashboardLayout | ? | — | src/routes |
| `/_workspace` | * | WorkspaceLayout | ? | — | src/routes |
| `/book/$branchId` | * | PublicBookingPage | ? | branchId | src/routes |
| `/dental-onboarding` | * | DentalOnboardingPage | true | — | src/routes |
| `/imaging-ceph-report/$imageId` | * | CephReportPage | ? | imageId | src/routes |
| `/imaging-comparison-test` | * | ComparisonTestHarness | ? | — | src/routes |
| `/imaging-test` | * | ImagingTestHarness | ? | — | src/routes |
| `/` | * | HomePage | ? | — | src/routes |
| `/onboarding` | * | OnboardingPage | true | — | src/routes |
| `/verify-email` | * | VerifyEmailPage | true | — | src/routes |
| `/_dashboard/billing` | * | BillingPage | ? | — | src/routes |
| `/_dashboard/calendar` | * | CalendarPage | ? | — | src/routes |
| `/_dashboard/dashboard` | * | DashboardPage | ? | — | src/routes |
| `/_dashboard/patients` | * | PatientsPage | ? | — | src/routes |
| `/_dashboard/reports` | * | ReportsPage | ? | — | src/routes |
| `/_dashboard/settings` | * | SettingsPage | ? | — | src/routes |
| `/_dashboard/staff` | * | StaffPage | ? | — | src/routes |
| `/_workspace/$patientId` | * | WorkspacePage | ? | patientId | src/routes |
| `/_workspace/queue-board` | * | QueueBoardPage | ? | — | src/routes |
| `/auth/$authView` | * | RouteComponent | ? | authView | src/routes |
| `/auth/pin-entry/$memberId` | * | PinEntryRoute | true | memberId | src/routes |
| `/auth/pin-select` | * | PinSelectRoute | true | — | src/routes |
| `/_dashboard/patients_/$patientId` | * | ProfilePage | ? | patientId | src/routes |
<!-- oli:regen:code-route-map:end -->
