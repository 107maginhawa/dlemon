# Component Reference: Dentalemon Frontend

Inventory of every shared UI component, feature component, and data-fetching hook.

**Shared UI:** `apps/dentalemon/src/components/`
**Feature components:** `apps/dentalemon/src/features/{domain}/components/`
**Feature hooks:** `apps/dentalemon/src/features/{domain}/hooks/`

---

## Shared UI Components (`src/components/`)

These are Shadcn/UI primitives and app-wide layout components. Import from
`@/components/{name}`.

| File | Export | Usage |
|------|--------|-------|
| `alert-dialog.tsx` | `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, … | Destructive-action confirmation dialogs |
| `alert.tsx` | `Alert`, `AlertDescription`, `AlertTitle` | Inline status alerts |
| `app-sidebar.tsx` | `AppSidebar` | Main navigation sidebar — rendered by `_dashboard.tsx` layout |
| `avatar.tsx` | `Avatar`, `AvatarImage`, `AvatarFallback` | User / patient avatars |
| `badge.tsx` | `Badge` | Status chips, tags |
| `button.tsx` | `Button` | Primary, secondary, ghost, destructive variants |
| `calendar.tsx` | `Calendar` | Date-picker calendar (Radix DayPicker) |
| `card.tsx` | `Card`, `CardHeader`, `CardContent`, `CardFooter` | Content containers |
| `checkbox.tsx` | `Checkbox` | Form checkboxes |
| `combobox.tsx` | `Combobox` | Searchable select |
| `command.tsx` | `Command`, `CommandInput`, `CommandList`, … | Command palette primitives |
| `datetime-filter.tsx` | `DatetimeFilter` | Date-range filter control used in reports / billing |
| `dialog.tsx` | `Dialog`, `DialogTrigger`, `DialogContent`, `DialogTitle`, … | Modal dialogs |
| `dropdown-menu.tsx` | `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, … | Context / action menus |
| `empty-state.tsx` | `EmptyState` | Zero-data placeholder with icon and CTA |
| `form.tsx` | `Form`, `FormField`, `FormItem`, `FormLabel`, `FormMessage` | React Hook Form + Zod wrappers |
| `image-cropper-dialog.tsx` | `ImageCropperDialog` | Avatar / image crop modal |
| `input.tsx` | `Input` | Text input |
| `label.tsx` | `Label` | Form labels |
| `loading.tsx` | `Loading` | Full-screen or inline spinner |
| `logo.tsx` | `Logo` | Clinic / app logo |
| `not-found.tsx` | `NotFound` | 404 page component |
| `pagination.tsx` | `Pagination`, `PaginationContent`, … | List pagination controls |
| `phone-input.tsx` | `PhoneInput` | International phone number input |
| `popover.tsx` | `Popover`, `PopoverTrigger`, `PopoverContent` | Anchored overlay panels |
| `progress.tsx` | `Progress` | Progress bar |
| `scroll-area.tsx` | `ScrollArea` | Custom scrollable container |
| `select.tsx` | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, … | Dropdown select |
| `separator.tsx` | `Separator` | Horizontal / vertical divider |
| `sheet.tsx` | `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, … | Side drawer / slide-over panel |
| `sidebar.tsx` | `Sidebar`, `SidebarProvider`, `SidebarMenu`, … | Sidebar layout primitives (consumed by `app-sidebar.tsx`) |
| `skeleton.tsx` | `Skeleton` | Loading placeholder shapes |
| `slider.tsx` | `Slider` | Range slider input |
| `sonner.tsx` | `Toaster` | Toast notification provider (Sonner) |
| `switch.tsx` | `Switch` | Toggle switch |
| `table.tsx` | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, … | Data table primitives |
| `tabs.tsx` | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Tab navigation |
| `textarea.tsx` | `Textarea` | Multi-line text input |
| `toggle-group.tsx` | `ToggleGroup`, `ToggleGroupItem` | Exclusive / multi-select toggle buttons |
| `toggle.tsx` | `Toggle` | Single toggle button |
| `tooltip.tsx` | `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` | Hover tooltips |

---

## Feature Components (`src/features/`)

### Billing (`features/billing/components/`)

| File | Export | Used In |
|------|--------|---------|
| `billing-list.tsx` | `BillingList` | `/_dashboard/billing` |
| `invoice-detail.tsx` | `InvoiceDetail` | `/_dashboard/billing` detail panel |
| `payment-plan-view.tsx` | `PaymentPlanView` | `/_dashboard/billing` modal |

### Dashboard (`features/dashboard/components/`)

| File | Export | Used In |
|------|--------|---------|
| `metric-card.tsx` | `MetricCard` | `/_dashboard/dashboard` |
| `morning-briefing.tsx` | `MorningBriefing` | `/_dashboard/dashboard` |

### Onboarding (`features/onboarding/components/`)

| File | Export | Used In |
|------|--------|---------|
| `onboarding-wizard.tsx` | `OnboardingWizard` | `/onboarding` |

### Patients (`features/patients/components/`)

| File | Export | Used In |
|------|--------|---------|
| `dental-chart-thumbnail.tsx` | `DentalChartThumbnail` | `PatientFolderCard` |
| `patient-filter-tabs.tsx` | `PatientFilterTabs` | `/_dashboard/patients` |
| `patient-folder-card.tsx` | `PatientFolderCard` | `PatientList` |
| `patient-list.tsx` | `PatientList` | `/_dashboard/patients` |
| `patient-registration-modal.tsx` | `PatientRegistrationModal` | `/_dashboard/patients` |

### Person (`features/person/components/`)

Sub-forms used inside `PatientRegistrationModal` and settings.

| File | Export | Used In |
|------|--------|---------|
| `address-form.tsx` | `AddressForm` | Patient registration, settings |
| `contact-info-form.tsx` | `ContactInfoForm` | Patient registration |
| `personal-info-form.tsx` | `PersonalInfoForm` | Patient registration |
| `preferences-form.tsx` | `PreferencesForm` | Patient profile settings |

### PMD (`features/pmd/components/`)

| File | Export | Used In |
|------|--------|---------|
| `pmd-import.tsx` | `PmdImport` | Workspace PMD import flow |
| `pmd-viewer.tsx` | `PmdViewer` | Workspace PMD viewer panel |

### Reports (`features/reports/components/`)

| File | Export | Used In |
|------|--------|---------|
| `revenue-report.tsx` | `RevenueReport` | `/_dashboard/reports` |

### Scheduling (`features/scheduling/components/`)

| File | Export | Used In |
|------|--------|---------|
| `appointment-card.tsx` | `AppointmentCard` | `CalendarDay`, `CalendarWeek` |
| `appointment-modal.tsx` | `AppointmentModal` | `/_dashboard/calendar` |
| `calendar-day.tsx` | `CalendarDay` | `/_dashboard/calendar` |
| `calendar-week.tsx` | `CalendarWeek` | `/_dashboard/calendar` |

### Settings (`features/settings/components/`)

| File | Export | Used In |
|------|--------|---------|
| `clinic-settings.tsx` | `ClinicSettings` | `/_dashboard/settings` |
| `fee-schedule.tsx` | `FeeSchedule` | `/_dashboard/settings` |
| `locale-settings.tsx` | `LocaleSettings` | `/_dashboard/settings` |

### Staff (`features/staff/components/`)

| File | Export | Used In |
|------|--------|---------|
| `staff-create-modal.tsx` | `StaffCreateModal` | `/_dashboard/staff` |
| `staff-list.tsx` | `StaffList` | `/_dashboard/staff` |

### Workspace (`features/workspace/components/`)

| File | Export | Used In |
|------|--------|---------|
| `consent-sheet.tsx` | `ConsentSheet` | `/_workspace/$patientId` |
| `dental-chart.tsx` | `DentalChart` | `/_workspace/$patientId` |
| `five-surface-selector.tsx` | `FiveSurfaceSelector` | `ToothSlideout` |
| `lab-orders-sheet.tsx` | `LabOrdersSheet` | `/_workspace/$patientId` |
| `medical-history-form.tsx` | `MedicalHistoryForm` | `/_workspace/$patientId` |
| `rx-sheet.tsx` | `RxSheet` | `/_workspace/$patientId` |
| `timeline-carousel.tsx` | `TimelineCarousel` | `/_workspace/$patientId` tooth history panel |
| `tooth-slideout.tsx` | `ToothSlideout` | `/_workspace/$patientId` |
| `workspace-tabs.tsx` | `WorkspaceTabs` | `/_workspace/$patientId` |

---

## Feature Hooks (`src/features/`)

TanStack Query hooks. Import from `@/features/{domain}/hooks/{hook-name}`.

### Billing

| Hook | File | Query / Mutation |
|------|------|-----------------|
| `useInvoices` | `features/billing/hooks/use-invoices.ts` | Query — fetches invoice list |

### Dashboard

| Hook | File | Query / Mutation |
|------|------|-----------------|
| `useDashboardSummary` | `features/dashboard/hooks/use-dashboard-summary.ts` | Query — fetches morning briefing metrics |

### Patients

| Hook | File | Query / Mutation |
|------|------|-----------------|
| `usePatients` | `features/patients/hooks/use-patients.ts` | Query — fetches patient list with chart data |

### Scheduling

| Hook | File | Query / Mutation |
|------|------|-----------------|
| `useAppointments` | `features/scheduling/hooks/use-appointments.ts` | Query — fetches appointments for date range |

### Settings

| Hook | File | Query / Mutation |
|------|------|-----------------|
| `useBranchSettings` | `features/settings/hooks/use-branch-settings.ts` | Query — fetches clinic/branch settings |

### Staff

| Hook | File | Query / Mutation |
|------|------|-----------------|
| `useStaffMembers` | `features/staff/hooks/use-staff-members.ts` | Query — fetches staff list |

### Workspace

| Hook | File | Query / Mutation |
|------|------|-----------------|
| `useCreateVisit` | `features/workspace/hooks/use-create-visit.ts` | Mutation — POST /dental/visits |
| `useDentalChartQuery` | `features/workspace/hooks/use-dental-chart-query.ts` | Query — fetches tooth chart for patient |
| `useMedicalHistory` | `features/workspace/hooks/use-medical-history.ts` | Query — fetches medical history form data |
| `useSaveChart` | `features/workspace/hooks/use-save-chart.ts` | Mutation — saves tooth chart, invalidates chart query |
| `useSaveTreatment` | `features/workspace/hooks/use-save-treatment.ts` | Mutation — saves treatment, invalidates treatments query |
| `useSharePmd` | `features/workspace/hooks/use-share-pmd.ts` | Mutation — POST /dental/visits/:id/pmd |
| `useTreatments` | `features/workspace/hooks/use-treatments.ts` | Query — fetches treatment list for visit |
| `useVisits` | `features/workspace/hooks/use-visits.ts` | Query — fetches visit history for patient |
