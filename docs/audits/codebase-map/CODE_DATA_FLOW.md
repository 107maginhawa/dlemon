# Code Data Flow

<!-- oli:regen:code-data-flow:begin -->
| Component | Props From | Events To | Store Reads | Store Writes | API Calls |
|---|---|---|---|---|---|
| `AppSidebar` | DashboardLayout | — | — | — | — |
| `Combobox` | PreferencesForm | PreferencesForm | — | — | — |
| `DateTimeFilter` | — | — | — | — | — |
| `EmptyState` | TreatmentPlanTab | — | — | — | — |
| `ImageCropperDialog` | PersonalInfoForm | PersonalInfoForm | — | — | — |
| `useOneSignal` | — | — | — | — | — |
| `RootComponent` | — | — | — | — | — |
| `DashboardLayout` | — | — | — | — | — |
| `WorkspaceLayout` | — | — | — | — | — |
| `CephReportPage` | — | — | — | — | — |
| `HomePage` | — | — | — | — | — |
| `OnboardingPage` | — | — | — | — | — |
| `VerifyEmailPage` | — | — | — | — | — |
| `BillingPage` | — | — | — | — | — |
| `CalendarPage` | — | — | — | — | — |
| `DashboardPage` | — | — | — | — | — |
| `DentalOnboardingPage` | — | — | — | — | — |
| `PatientsPage` | — | — | — | — | POST /dental/patients |
| `ReportsPage` | — | — | — | — | — |
| `SettingsPage` | — | — | — | — | — |
| `StaffPage` | — | — | — | — | — |
| `WorkspacePage` | — | — | — | — | — |
| `QueueBoardPage` | — | — | — | — | — |
| `RouteComponent` | — | — | — | — | — |
| `PinEntry` | PinEntryRoute | PinEntryRoute | — | — | — |
| `PinEntryRoute` | — | — | — | — | GET /dental/org/members, POST /dental/organizations/:orgId/branches/:branchId/members/:memberId/verify-pin |
| `PinSelect` | PinSelectRoute | PinSelectRoute | — | — | — |
| `PinSelectRoute` | — | — | — | — | GET /dental/org/members |
| `BillingList` | BillingPage | BillingPage | — | — | — |
| `InvoiceDetail` | BillingPage, WorkspacePaymentModal | BillingPage, WorkspacePaymentModal | — | — | GET /dental/billing/invoices/:invoiceId, PATCH /dental/billing/invoices/:invoiceId/issue, POST /dental/billing/invoices/:invoiceId/void, POST /dental/billing/invoices/:invoiceId/payments |
| `PaymentPlanView` | BillingPage | BillingPage | — | — | GET /dental/billing/invoices/:invoiceId/plan |
| `useInvoiceDetail` | — | — | — | — | — |
| `useInvoices` | — | — | — | — | — |
| `MetricCard` | MorningBriefing | — | — | — | — |
| `MorningBriefing` | DashboardPage | — | — | — | — |
| `useDashboardSummary` | — | — | — | — | — |
| `AnnotationToolbar` | ImagingWorkspace | ImagingWorkspace | — | — | — |
| `CalibrationDialog` | ImagingWorkspace | ImagingWorkspace | — | — | — |
| `MeasurementShape` | ImagingWorkspace | ImagingWorkspace | — | — | — |
| `AnnotationShape` | ImagingWorkspace | ImagingWorkspace | — | — | — |
| `DrawingPreview` | ImagingWorkspace | — | — | — | — |
| `CephAngleArcLayer` | ImagingWorkspace | — | — | — | — |
| `CephLandmarkLayer` | ImagingWorkspace | ImagingWorkspace | — | — | — |
| `CephLandmarkPalette` | CephWorkspacePanel | CephWorkspacePanel | — | — | — |
| `CephLayerPanel` | CephWorkspacePanel | CephWorkspacePanel | — | — | — |
| `CephLoupe` | ImagingWorkspace | — | — | — | — |
| `CephMeasurementsPanel` | CephWorkspacePanel | — | — | — | — |
| `CephReportView` | CephReportPage | — | — | — | — |
| `CephTracingOverlay` | ImagingWorkspace | — | — | — | — |
| `CephWorkspacePanel` | ImagingWorkspace | ImagingWorkspace | — | — | POST /dental/imaging/images/:imageId/ceph/reports |
| `ComparisonView` | WorkspaceImagingOverlay | WorkspaceImagingOverlay | — | — | — |
| `FindingsSidebar` | ImagingWorkspace | ImagingWorkspace | — | — | — |
| `ImageUpload` | PatientImageList | PatientImageList | — | — | — |
| `ImagingWorkspace` | ComparisonView, WorkspaceImagingOverlay | — | — | — | PATCH /dental/imaging/images/:imageId/calibration |
| `MeasurementToolbar` | ImagingWorkspace | ImagingWorkspace | — | — | — |
| `PatientImageList` | WorkspaceImagingOverlay | WorkspaceImagingOverlay | — | — | — |
| `useCephAnalysis` | — | — | — | — | GET /dental/imaging/images/:imageId/ceph/analysis:qs |
| `useCephLandmarks` | — | — | — | — | GET /dental/imaging/images/:imageId/ceph/landmarks, PATCH /dental/imaging/images/:imageId/ceph/landmarks/:code, POST /dental/imaging/images/:imageId/ceph/landmarks, DELETE /dental/imaging/images/:imageId/ceph/landmarks/:code |
| `useImagingFindings` | — | — | — | — | GET /dental/imaging/images/:imageId/findings, POST /dental/imaging/images/:imageId/findings, PATCH /dental/imaging/findings/:findingId, DELETE /dental/imaging/findings/:findingId |
| `useImagingStudies` | — | — | — | — | GET /dental/patients/:patientId/images |
| `useImagingUpload` | — | — | — | — | POST /dental/imaging/studies, DELETE /storage/multipart/:fileId/abort |
| `useMeasurements` | — | — | — | — | GET /dental/imaging/images/:imageId/measurements, POST /dental/imaging/images/:imageId/measurements, DELETE /dental/imaging/measurements/:measurementId |
| `useOfflineCache` | — | — | — | — | — |
| `OnboardingWizard` | DentalOnboardingPage | DentalOnboardingPage | — | — | POST /dental/organizations, POST /dental/organizations/:id/branches, POST /dental/organizations/:id/branches/:id/members, POST /dental/organizations/:id/branches/:id/members/:id/set-pin, POST /dental/patients |
| `ClinicStep` | OnboardingWizard | OnboardingWizard | — | — | — |
| `DentistStep` | OnboardingWizard | OnboardingWizard | — | — | — |
| `FeesStep` | OnboardingWizard | OnboardingWizard | — | — | — |
| `PatientStep` | OnboardingWizard | OnboardingWizard | — | — | — |
| `DentalChartThumbnail` | PatientFolderCard | — | — | — | — |
| `FollowUpNotes` | — | — | — | — | — |
| `PatientFilterTabs` | PatientsPage | PatientsPage | — | — | — |
| `PatientFolderCard` | PatientList | PatientList | — | — | — |
| `PatientList` | PatientsPage | PatientsPage | — | — | — |
| `PatientProfilePage` | ProfilePage | — | — | — | — |
| `PatientRegistrationModal` | PatientsPage | PatientsPage | — | — | — |
| `useFollowUpNotes` | — | — | — | — | — |
| `useAddFollowUpNote` | — | — | — | — | — |
| `useArchivePatient` | — | — | — | — | — |
| `useRestorePatient` | — | — | — | — | — |
| `useBulkArchive` | — | — | — | — | — |
| `useExportPatients` | — | — | — | — | — |
| `usePatientBilling` | — | — | — | — | — |
| `usePatientProfile` | — | — | — | — | — |
| `usePatients` | — | — | — | — | — |
| `AddressForm` | OnboardingPage | OnboardingPage | — | — | — |
| `ContactInfoForm` | — | — | — | — | — |
| `PersonalInfoForm` | OnboardingPage | OnboardingPage | — | — | — |
| `PreferencesForm` | — | — | — | — | — |
| `PMDImport` | WorkspacePage | WorkspacePage | — | — | POST /dental/pmd/import |
| `PMDViewerSheet` | WorkspacePage | WorkspacePage | — | — | — |
| `PMDViewer` | PMDViewerSheet | — | — | — | — |
| `InvoiceDetailSheet` | RevenueReport | RevenueReport | — | — | — |
| `PatientReport` | ReportsPage | — | — | — | — |
| `RevenueReport` | ReportsPage | — | — | — | GET /dental/billing/invoices |
| `TreatmentReport` | ReportsPage | — | — | — | — |
| `usePatientReport` | — | — | — | — | — |
| `useTreatmentReport` | — | — | — | — | — |
| `AppointmentCard` | CalendarDay | CalendarDay | — | — | — |
| `AppointmentModal` | CalendarPage | CalendarPage | — | — | — |
| `CalendarDay` | CalendarPage | CalendarPage | — | — | — |
| `CalendarMonth` | CalendarPage | CalendarPage | — | — | — |
| `CalendarWeek` | CalendarPage | CalendarPage | — | — | — |
| `QueueBoard` | QueueBoardPage | — | — | — | — |
| `useAppointments` | — | — | — | — | — |
| `useQueueBoard` | — | — | — | — | GET /dental/branches/:branchId/queue-board, PATCH /dental/queue-items/:itemId/status |
| `ClinicSettings` | SettingsPage | — | — | — | — |
| `FeeSchedule` | SettingsPage | — | — | — | — |
| `LocaleSettings` | SettingsPage | — | — | — | — |
| `NotificationSettings` | SettingsPage | — | — | — | — |
| `WorkingHours` | SettingsPage | — | — | — | — |
| `useBranchSettings` | — | — | — | — | — |
| `useUpdateBranchSettings` | — | — | — | — | — |
| `StaffCreateModal` | StaffList | StaffList | — | — | — |
| `StaffAccessDenied` | StaffPage | — | — | — | — |
| `StaffList` | StaffPage | — | — | — | — |
| `useStaffMembers` | — | — | — | — | — |
| `useStaffMutations` | — | — | — | — | — |
| `AmendmentForm` | ToothSlideout | ToothSlideout | — | — | — |
| `AttachmentsSheet` | WorkspacePage | WorkspacePage | — | — | — |
| `CdtCodeBrowser` | ToothSlideout | ToothSlideout | — | — | — |
| `ConsentSheet` | WorkspacePage | WorkspacePage | — | — | — |
| `DentalChart` | — | — | — | — | — |
| `FiveSurfaceSelector` | — | — | — | — | — |
| `LabOrdersSheet` | WorkspacePage | WorkspacePage | — | — | — |
| `MedicalHistoryForm` | MedicalHistorySheet | — | — | — | — |
| `MedicalHistorySheet` | — | — | — | — | — |
| `PreCompletionChecklist` | WorkspacePage | WorkspacePage | — | — | — |
| `RecallsSheet` | WorkspacePage | WorkspacePage | — | — | — |
| `ResizableDivider` | — | — | — | — | — |
| `RxSheet` | WorkspacePage | WorkspacePage | — | — | — |
| `SoapNotesSheet` | WorkspacePage | WorkspacePage | — | — | — |
| `SyncStatusBadge` | WorkspacePage | — | — | — | — |
| `TimelineCarousel` | WorkspacePage | WorkspacePage | — | — | — |
| `ToothOverviewStep` | ToothSlideout | ToothSlideout | — | — | — |
| `ToothSlideout` | WorkspacePage | WorkspacePage | — | — | — |
| `TreatmentPlanTab` | WorkspacePage | — | — | — | — |
| `TreatmentPlansSheet` | WorkspacePage | WorkspacePage | — | — | — |
| `DismissTreatmentPopover` | TreatmentTable | TreatmentTable | — | — | — |
| `DeclineTreatmentPopover` | TreatmentTable | TreatmentTable | — | — | — |
| `TreatmentTable` | WorkspacePage | WorkspacePage | — | — | — |
| `WorkspaceImagingOverlay` | WorkspacePage | WorkspacePage | — | — | — |
| `WorkspacePaymentModal` | WorkspacePage | WorkspacePage | — | — | — |
| `WorkspaceTopBar` | WorkspacePage | WorkspacePage | — | — | — |
| `YearSegmentControl` | WorkspacePage | WorkspacePage | — | — | — |
| `useAttachments` | — | — | — | — | — |
| `useUploadAttachment` | — | — | — | — | — |
| `useDeleteAttachment` | — | — | — | — | — |
| `useCreateVisit` | — | — | — | — | — |
| `useDentalChart` | — | — | — | — | — |
| `useInitializeDentition` | — | — | — | — | — |
| `useMarkTreatmentDone` | — | — | — | — | — |
| `useMedicalHistory` | — | — | — | — | — |
| `useMedicalHistoryMutations` | — | — | — | — | — |
| `usePMD` | — | — | — | — | — |
| `useRecalls` | — | — | — | — | GET /dental/patients/:patientId/recalls, POST /dental/patients/:patientId/recalls, PATCH /dental/patients/:patientId/recalls/:recallId |
| `useSaveChart` | — | — | — | — | — |
| `useSaveToothFlow` | — | — | — | — | — |
| `useSaveTreatment` | — | — | — | — | — |
| `useSharePMD` | — | — | — | — | — |
| `useSyncStatus` | — | — | — | — | GET /dental/sync-logs |
| `useToothHistory` | — | — | — | — | — |
| `useTreatmentPlan` | — | — | — | — | GET /dental/patients/:patientId/treatment-plan, POST /dental/patients/:patientId/treatment-plan/accept, PATCH /dental/visits/:visitId/treatments/:treatmentId |
| `useTreatmentPlans` | — | — | — | — | GET /dental/patients/:patientId/treatment-plans, POST /dental/patients/:patientId/treatment-plans, PATCH /dental/patients/:patientId/treatment-plans/:planId |
| `useTreatments` | — | — | — | — | — |
| `useUpdateTreatment` | — | — | — | — | — |
| `useUpdateVisit` | — | — | — | — | — |
| `useVisitNotes` | — | — | — | — | — |
| `useVisits` | — | — | — | — | — |
| `usePatientInvoices` | — | — | — | — | — |
| `useCreateInvoice` | — | — | — | — | — |
| `ProfilePage` | — | — | — | — | — |
| `UniversalToothFdi` | DentalChart, FiveSurfaceSelector, ToothOverviewStep | — | — | — | — |
| `UniversalTooth` | UniversalToothFdi | — | — | — | — |
<!-- oli:regen:code-data-flow:end -->
