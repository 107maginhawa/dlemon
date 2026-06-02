import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Dental Organization Module
 *
 * Multi-tenant org hierarchy for dental practices:
 * Organization (the practice/business) -> Branch (physical clinic location) -> Membership (staff)
 */
namespace DentalOrgModule {

  // ==========================================================================
  // Enums
  // ==========================================================================

  @doc("Subscription tier controlling feature access and device limits")
  enum OrgTier {
    @doc("Solo dentist, 1 device")
    solo: "solo",

    @doc("Small clinic, up to 3 devices")
    clinic: "clinic",

    @doc("Multi-branch practice, up to 10 devices per branch")
    group: "group",

    @doc("Enterprise, unlimited devices")
    enterprise: "enterprise",
  }

  @doc("Imaging feature tier (null treated as free)")
  enum ImagingTier {
    @doc("No imaging features")
    free: "free",

    @doc("Basic imaging (study upload, viewer)")
    basic: "basic",

    @doc("Imaging add-on (cephalometric analysis, measurements)")
    addon: "addon",
  }

  @doc("Staff role within a branch — drives RBAC")
  enum MemberRole {
    @doc("Practice owner, full access including financials and admin")
    dentistOwner: "dentist_owner",

    @doc("Associate dentist, clinical access for own patients")
    dentistAssociate: "dentist_associate",

    @doc("Hygienist — clinical hygiene access")
    hygienist: "hygienist",

    @doc("Full operations staff — billing, scheduling, patient records")
    staffFull: "staff_full",

    @doc("Scheduling-only staff")
    staffScheduling: "staff_scheduling",

    @doc("Dental assistant — chairside clinical support")
    dentalAssistant: "dental_assistant",

    @doc("Front-desk reception staff")
    frontDesk: "front_desk",

    @doc("Billing-only staff")
    billingStaff: "billing_staff",

    @doc("Read-only access")
    readOnly: "read_only",
  }

  @doc("Membership status")
  enum MemberStatus {
    @doc("Active and can log in")
    active: "active",

    @doc("Temporarily deactivated")
    inactive: "inactive",
  }

  // ==========================================================================
  // Models
  // ==========================================================================

  @example(#{
    id: "or-1a2b3c4d-0000-4000-8000-000000000001",
    createdAt: utcDateTime.fromISO("2025-01-15T08:00:00Z"),
    updatedAt: utcDateTime.fromISO("2026-03-01T09:00:00Z"),
    version: 4,
    name: "Sunrise Dental Clinic",
    tier: OrgTier.clinic,
    ownerPersonId: "p1a2b3c4-0000-4000-8000-000000000001",
    countryCode: "PH",
    active: true,
  }, #{ title: "Sunrise Dental Clinic — clinic tier" })
  @doc("Dental practice organization — top-level tenant boundary")
  model DentalOrganization extends BaseEntity {
    @doc("Practice display name")
    @minLength(1)
    @maxLength(120)
    name: string;

    @doc("Subscription tier")
    tier: OrgTier;

    @doc("Cloud account person ID (links to Better-Auth user)")
    ownerPersonId: UUID;

    @doc("Country code for locale rules (ISO 3166-1 alpha-2)")
    @maxLength(2)
    countryCode: string;

    @doc("Whether the organization is active")
    active: boolean;
  }

  @example(#{
    id: "br-1a2b3c4d-0000-4000-8000-000000000001",
    createdAt: utcDateTime.fromISO("2025-01-15T08:00:00Z"),
    updatedAt: utcDateTime.fromISO("2026-01-10T07:30:00Z"),
    version: 2,
    organizationId: "or-1a2b3c4d-0000-4000-8000-000000000001",
    name: "Sunrise Dental — Makati Branch",
    address: "3F Ayala Center, Makati Ave",
    city: "Makati City",
    timezone: "Asia/Manila",
    workingHours: "{\"monday\":{\"open\":\"09:00\",\"close\":\"18:00\",\"isOpen\":true}}",
    phone: "+63 2 8888 1234",
    active: true,
  }, #{ title: "Makati branch — active clinic" })
  @doc("Physical branch / clinic location")
  model DentalBranch extends BaseEntity {
    @doc("Parent organization")
    organizationId: UUID;

    @doc("Branch display name")
    @minLength(1)
    @maxLength(120)
    name: string;

    @doc("Street address")
    @maxLength(255)
    address?: string;

    @doc("City")
    @maxLength(80)
    city?: string;

    @doc("IANA timezone identifier (e.g. Asia/Manila)")
    @maxLength(64)
    timezone: string;

    @doc("Operating hours as JSON object with day keys and open/close times")
    workingHours?: string;

    @doc("Branch phone number")
    phone?: string;

    @doc("Whether this branch is active")
    active: boolean;
  }

  @example(#{
    id: "ms-1a2b3c4d-0000-4000-8000-000000000001",
    createdAt: utcDateTime.fromISO("2025-02-01T08:00:00Z"),
    updatedAt: utcDateTime.fromISO("2026-03-01T10:00:00Z"),
    version: 1,
    branchId: "br-1a2b3c4d-0000-4000-8000-000000000001",
    personId: "p1a2b3c4-0000-4000-8000-000000000001",
    displayName: "Dr. Maria Santos",
    role: MemberRole.dentistOwner,
    pinFailedAttempts: 0,
    status: MemberStatus.active,
    avatarUrl: "https://cdn.example.com/avatars/ms-1a2b3c4d.jpg",
  }, #{ title: "Dr. Maria Santos — owner dentist" })
  @doc("Staff membership — one person in one branch with one role")
  model DentalMembership extends BaseEntity {
    @doc("Branch this membership belongs to")
    branchId: UUID;

    @doc("Person (Better-Auth user) or local-only staff name for PIN-only staff")
    personId?: UUID;

    @doc("Display name shown on PIN select screen")
    @minLength(1)
    @maxLength(80)
    displayName: string;

    @doc("Role within this branch")
    role: MemberRole;

    @doc("PIN hash (bcrypt) — null if PIN not yet set")
    pinHash?: string;

    @doc("PIN lockout expiry timestamp — null if not locked")
    pinLockedUntil?: utcDateTime;

    @doc("Consecutive failed PIN attempts since last success")
    pinFailedAttempts: int32;

    @doc("Membership status")
    status: MemberStatus;

    @doc("Profile photo URL")
    avatarUrl?: string;

    @doc("Provider license number (used on clinical records + claims). Null for non-clinical staff.")
    @maxLength(64)
    licenseNumber?: string;

    @doc("National Provider Identifier (NPI) — 10 digits. Null for non-clinical staff.")
    @pattern("^\\d{10}$")
    npi?: string;

    @doc("Credential / license type label, e.g. 'DDS', 'DMD', 'RDH'.")
    @maxLength(32)
    credentialType?: string;

    @doc("License expiry date (ISO 8601 date).")
    licenseExpiry?: utcDateTime;
  }

  // ==========================================================================
  // Request / Response Models
  // ==========================================================================

  @doc("Create a dental organization")
  model CreateOrganizationRequest {
    @doc("Practice name")
    name: string;

    @doc("Subscription tier")
    tier: OrgTier;

    @doc("ISO 3166-1 alpha-2 country code")
    countryCode: string;
  }

  @doc("Update organization details")
  model UpdateOrganizationRequest {
    @doc("New practice name")
    name?: string;

    @doc("New tier")
    tier?: OrgTier;

    @doc("New country code")
    countryCode?: string;

    @doc("Imaging feature tier (set to addon to enable cephalometric analysis)")
    imagingTier?: ImagingTier;
  }

  @doc("Create a branch")
  model CreateBranchRequest {
    @doc("Branch name")
    name: string;

    @doc("Street address")
    address?: string;

    @doc("City")
    city?: string;

    @doc("IANA timezone identifier")
    timezone: string;

    @doc("JSON working hours object")
    workingHours?: string;

    @doc("Branch phone number")
    phone?: string;
  }

  @doc("Create a membership")
  model CreateMembershipRequest {
    @doc("Person ID from Better-Auth (optional for PIN-only staff)")
    personId?: UUID;

    @doc("Display name for PIN select screen")
    displayName: string;

    @doc("Staff role")
    role: MemberRole;

    @doc("Profile photo URL")
    avatarUrl?: string;
  }

  @doc("Deactivate a membership")
  model DeactivateMembershipRequest {
    @doc("Reason for deactivation")
    reason?: string;
  }

  @doc("Verify a staff member's PIN")
  model VerifyPinRequest {
    @doc("Digit-only PIN entered by the staff member (4-8 digits)")
    @pattern("^\\d{4,8}$")
    @minLength(4)
    @maxLength(8)
    pin: string;
  }

  @doc("PIN verification result")
  model VerifyPinResponse {
    @doc("Whether the PIN was accepted")
    success: boolean;

    @doc("Number of failed attempts so far (helps frontend show remaining attempts)")
    failedAttempts: int32;

    @doc("If locked out, the lockout expiry timestamp")
    lockedUntil?: utcDateTime;
  }

  @doc("Set or change a staff member's PIN")
  model SetPinRequest {
    @doc("New digit-only PIN (4-8 digits)")
    @pattern("^\\d{4,8}$")
    @minLength(4)
    @maxLength(8)
    pin: string;
  }

  @doc("Too many requests error (rate limit / lockout)")
  model TooManyRequestsError {
    @statusCode statusCode: 429;
    @body body: {
      message: string;
      lockedUntil: utcDateTime;
    };
  }

  @doc("List of organizations")
  model OrganizationList {
    items: DentalOrganization[];
    total: int32;
  }

  @doc("List of branches")
  model BranchList {
    items: DentalBranch[];
    total: int32;
  }


  @doc("Org context for the authenticated user")
  model OrgContextResponse {
    organizationId: UUID;
    branchId: UUID;
    memberId: UUID;
    role: MemberRole;
    orgName: string;
    branchName: string;
    timezone: string;
  }

  @doc("Dashboard summary metrics")
  model DashboardSummaryResponse {
    todayVisits: int32;
    pendingInvoices: int32;
    totalPatients: int32;
    revenueThisMonthCents: int32;
  }

  @doc("Create a flat member (org/branch resolved from auth context)")
  model CreateFlatMemberRequest {
    @doc("Display name for PIN select screen")
    displayName: string;

    @doc("Staff role")
    role: MemberRole;

    @doc("Person ID from Better-Auth (optional for PIN-only staff)")
    personId?: UUID;

    @doc("Profile photo URL")
    avatarUrl?: string;
  }

  @doc("Update a member's profile, role, and provider credentials")
  model UpdateMemberRequest {
    @doc("New display name")
    @minLength(1)
    @maxLength(80)
    displayName?: string;

    @doc("New role (dentist_owner only)")
    role?: MemberRole;

    @doc("Profile photo URL")
    avatarUrl?: string;

    @doc("Provider license number")
    @maxLength(64)
    licenseNumber?: string;

    @doc("National Provider Identifier (NPI) — 10 digits")
    @pattern("^\\d{10}$")
    npi?: string;

    @doc("Credential / license type label, e.g. 'DDS', 'DMD', 'RDH'")
    @maxLength(32)
    credentialType?: string;

    @doc("License expiry date (ISO 8601 date)")
    licenseExpiry?: utcDateTime;
  }

  @doc("Reset a member's PIN")
  model ResetMemberPinRequest {
    @doc("New PIN — exactly 6 digits")
    @pattern("^\\d{6}$")
    @minLength(6)
    @maxLength(6)
    newPin: string;
  }

  @doc("Set a security question for PIN recovery")
  model SetSecurityQuestionRequest {
    @doc("Security question text")
    question: string;

    @doc("Answer to the security question")
    answer: string;
  }

  @doc("Recover PIN using security question")
  model RecoverPinRequest {
    @doc("The security question previously set")
    securityQuestion: string;

    @doc("Answer to the security question")
    answer: string;
  }

  @doc("PIN recovery response")
  model RecoverPinResponse {
    @doc("Whether recovery was successful")
    success: boolean;

    @doc("Temporary PIN if recovery succeeded")
    temporaryPin?: string;
  }

  @doc("Working hours for a single day")
  model DentalWorkingHoursDay {
    @doc("Opening time (HH:mm)")
    open: string;

    @doc("Closing time (HH:mm)")
    close: string;

    @doc("Whether the branch is open on this day")
    isOpen: boolean;
  }

  @doc("Weekly working hours configuration for a branch")
  model DentalWorkingHours {
    monday?: DentalWorkingHoursDay;
    tuesday?: DentalWorkingHoursDay;
    wednesday?: DentalWorkingHoursDay;
    thursday?: DentalWorkingHoursDay;
    friday?: DentalWorkingHoursDay;
    saturday?: DentalWorkingHoursDay;
    sunday?: DentalWorkingHoursDay;
  }

  @doc("Branch operational settings")
  model DentalBranchSettings {
    @doc("Branch ID")
    branchId: UUID;

    @doc("Default appointment duration in minutes")
    appointmentDurationMinutes: int32;

    @doc("Currency code (ISO 4217)")
    currency: string;

    @doc("Tax rate as a decimal (e.g. 0.12 for 12%)")
    taxRate: float32;

    @doc("Whether appointment reminders are enabled")
    appointmentReminderEnabled: boolean;
  }

  @doc("Update branch settings request")
  model UpdateDentalBranchSettingsRequest {
    @doc("Default appointment duration in minutes")
    appointmentDurationMinutes?: int32;

    @doc("Currency code (ISO 4217)")
    currency?: string;

    @doc("Tax rate as a decimal")
    taxRate?: float32;

    @doc("Whether appointment reminders are enabled")
    appointmentReminderEnabled?: boolean;
  }

  @example(#{
    id: "ct-1a2b3c4d-0000-4000-8000-000000000001",
    createdAt: utcDateTime.fromISO("2025-03-01T08:00:00Z"),
    updatedAt: utcDateTime.fromISO("2025-03-01T08:00:00Z"),
    version: 1,
    branchId: "br-1a2b3c4d-0000-4000-8000-000000000001",
    title: "General Tooth Extraction Consent",
    content: "<p>I, the undersigned patient, hereby consent to the extraction of the tooth/teeth indicated by my dentist...</p>",
    isActive: true,
  }, #{ title: "Extraction consent template — active" })
  @doc("Consent form template for a branch")
  model DentalConsentTemplate extends BaseEntity {
    @doc("Branch this template belongs to")
    branchId: UUID;

    @doc("Template title")
    title: string;

    @doc("Template content (HTML or plain text)")
    content: string;

    @doc("Whether this template is active")
    isActive: boolean;
  }

  @doc("Create a consent template")
  model CreateDentalConsentTemplateRequest {
    @doc("Template title")
    title: string;

    @doc("Template content")
    content: string;
  }

  @doc("Update a consent template")
  model UpdateDentalConsentTemplateRequest {
    @doc("New title")
    title?: string;

    @doc("New content")
    content?: string;

    @doc("Active status")
    isActive?: boolean;
  }

  // ==========================================================================
  // Granular feature permissions (P2-17)
  // ==========================================================================

  @doc("A single feature in the permission catalog")
  model PermissionCatalogEntry {
    @doc("Stable feature key, e.g. 'billing.invoice.void'")
    feature: string;

    @doc("Human-readable label for the settings grid")
    label: string;

    @doc("Grouping category for the settings grid")
    category: string;

    @doc("Roles allowed by default (absent override falls back to these)")
    defaultAllowedRoles: MemberRole[];
  }

  @doc("Effective decision for one (role, feature) cell")
  model PermissionGridCell {
    @doc("Role this cell applies to")
    role: MemberRole;

    @doc("Feature key this cell applies to")
    feature: string;

    @doc("Whether this role is currently allowed the feature")
    allowed: boolean;

    @doc("'override' if set explicitly by the org, 'default' if from the catalog")
    source: string;
  }

  @doc("Full permission grid for an organization: catalog + effective cells")
  model PermissionGridResponse {
    @doc("Organization the grid belongs to")
    organizationId: UUID;

    @doc("Feature catalog (labels, categories, defaults)")
    catalog: PermissionCatalogEntry[];

    @doc("Effective decision for every (role, feature) pair")
    cells: PermissionGridCell[];
  }

  @doc("A single permission override to apply")
  model PermissionOverrideInput {
    @doc("Role to override")
    role: MemberRole;

    @doc("Feature key to override")
    feature: string;

    @doc("Allow (true) or deny (false) this role the feature")
    allowed: boolean;
  }

  @doc("Update one or more permission overrides for an organization")
  model UpdatePermissionsRequest {
    @doc("Override decisions to upsert")
    overrides: PermissionOverrideInput[];
  }

  // ==========================================================================
  // Interfaces
  // ==========================================================================

  @doc("Dental organization management")
  interface DentalOrganizationManagement {
    @doc("Create a new dental organization")
    @useAuth(bearerAuth)
    @post
    create(@body body: CreateOrganizationRequest): {
      @statusCode statusCode: 201;
      @body body: DentalOrganization;
    } | ApiUnauthorizedResponse | ErrorResponse;

    @doc("Get organization by ID")
    @useAuth(bearerAuth)
    @get
    @route("/{id}")
    get(@path id: UUID): DentalOrganization | NotFoundError | ApiUnauthorizedResponse | ErrorResponse;

    @doc("Update organization")
    @useAuth(bearerAuth)
    @patch
    @route("/{id}")
    update(
      @path id: UUID,
      @body body: UpdateOrganizationRequest,
    ): DentalOrganization | NotFoundError | ApiUnauthorizedResponse | ErrorResponse;
  }

  @doc("Dental branch management")
  interface DentalBranchManagement {
    @doc("Create a branch within an organization")
    @useAuth(bearerAuth)
    @post
    create(
      @path orgId: UUID,
      @body body: CreateBranchRequest,
    ): {
      @statusCode statusCode: 201;
      @body body: DentalBranch;
    } | ApiUnauthorizedResponse | ErrorResponse;

    @doc("List branches for an organization")
    @useAuth(bearerAuth)
    @get
    list(@path orgId: UUID): BranchList | ApiUnauthorizedResponse | ErrorResponse;

    @doc("Get a branch by ID")
    @useAuth(bearerAuth)
    @get
    @route("/{branchId}")
    get(@path orgId: UUID, @path branchId: UUID): DentalBranch | NotFoundError | ApiUnauthorizedResponse | ErrorResponse;
  }

  @doc("Dental membership management")
  interface DentalMembershipManagement {
    @doc("Add a staff member to a branch")
    @useAuth(bearerAuth)
    @post
    create(
      @path orgId: UUID,
      @path branchId: UUID,
      @body body: CreateMembershipRequest,
    ): {
      @statusCode statusCode: 201;
      @body body: DentalMembership;
    } | ApiUnauthorizedResponse | ErrorResponse;

    @doc("List active members for a branch")
    @useAuth(bearerAuth)
    @get
    list(@path orgId: UUID, @path branchId: UUID): ApiOkResponse<PaginatedResponse<DentalMembership>> | ApiUnauthorizedResponse | ErrorResponse;

    @doc("Deactivate a member")
    @useAuth(bearerAuth)
    @post
    @route("/{membershipId}/deactivate")
    deactivate(
      @path orgId: UUID,
      @path branchId: UUID,
      @path membershipId: UUID,
      @body body: DeactivateMembershipRequest,
    ): DentalMembership | NotFoundError | ApiUnauthorizedResponse | ErrorResponse;

    @doc("Verify a staff member's PIN for local authentication")
    @useAuth(bearerAuth)
    @post
    @route("/{membershipId}/verify-pin")
    verifyPin(
      @path orgId: UUID,
      @path branchId: UUID,
      @path membershipId: UUID,
      @body body: VerifyPinRequest,
    ): VerifyPinResponse | TooManyRequestsError | NotFoundError | ApiUnauthorizedResponse | ErrorResponse;

    @doc("Set or change a staff member's PIN")
    @useAuth(bearerAuth)
    @post
    @route("/{membershipId}/set-pin")
    setPin(
      @path orgId: UUID,
      @path branchId: UUID,
      @path membershipId: UUID,
      @body body: SetPinRequest,
    ): DentalMembership | NotFoundError | ApiUnauthorizedResponse | ErrorResponse;
  }

  interface OrgContextManagement {
    @get
    @route("/context")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getOrgContext")
    getOrgContext(): ApiOkResponse<OrgContextResponse>
      | ApiUnauthorizedResponse;
  }

  interface DashboardManagement {
    @get
    @route("/summary")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getDashboardSummary")
    getDashboardSummary(
      @query branchId?: UUID
    ): ApiOkResponse<DashboardSummaryResponse>
      | ApiUnauthorizedResponse;
  }

  interface FlatMemberManagement {
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listMembers")
    listMembers(
      @query branchId?: UUID
    ): ApiOkResponse<PaginatedResponse<DentalMembership>>
      | ApiUnauthorizedResponse;

    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createMember")
    createMember(
      @body body: CreateFlatMemberRequest
    ): ApiCreatedResponse<DentalMembership>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @patch(#{implicitOptionality: true})
    @route("/{memberId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("updateMember")
    updateMember(
      @path memberId: UUID,
      @body body: UpdateMemberRequest
    ): ApiOkResponse<DentalMembership>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/{memberId}/reset-pin")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("resetMemberPin")
    resetMemberPin(
      @path memberId: UUID,
      @body body: ResetMemberPinRequest
    ): ApiOkResponse<DentalMembership>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/{memberId}/security-question")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("setSecurityQuestion")
    setSecurityQuestion(
      @path memberId: UUID,
      @body body: SetSecurityQuestionRequest
    ): ApiOkResponse<{}>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/{memberId}/recover-pin")
    @operationId("recoverPin")
    recoverPin(
      @path memberId: UUID,
      @body body: RecoverPinRequest
    ): ApiOkResponse<RecoverPinResponse>
      | ApiBadRequestResponse
      | ApiNotFoundResponse;
  }

  @doc("Granular feature-permission grid management (P2-17)")
  interface PermissionManagement {
    @doc("Get the effective permission grid for an organization")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getPermissionGrid")
    getPermissionGrid(
      @query organizationId?: UUID
    ): ApiOkResponse<PermissionGridResponse>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @doc("Upsert permission overrides for an organization (owner only)")
    @put
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("updatePermissions")
    updatePermissions(
      @query organizationId?: UUID,
      @body body: UpdatePermissionsRequest
    ): ApiOkResponse<PermissionGridResponse>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface BranchConfigManagement {
    @doc("List all branches the authenticated user has an active membership in")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getBranchesByUser")
    getBranchesByUser(): ApiOkResponse<BranchList>
      | ApiUnauthorizedResponse
      | ErrorResponse;

    @get
    @route("/{branchId}/working-hours")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getWorkingHours")
    getWorkingHours(
      @path branchId: UUID
    ): ApiOkResponse<DentalWorkingHours>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @put
    @route("/{branchId}/working-hours")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("updateWorkingHours")
    updateWorkingHours(
      @path branchId: UUID,
      @body body: DentalWorkingHours
    ): ApiOkResponse<DentalWorkingHours>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/{branchId}/settings")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getBranchSettings")
    getBranchSettings(
      @path branchId: UUID
    ): ApiOkResponse<DentalBranchSettings>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @put
    @route("/{branchId}/settings")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("updateBranchSettings")
    updateBranchSettings(
      @path branchId: UUID,
      @body body: UpdateDentalBranchSettingsRequest
    ): ApiOkResponse<DentalBranchSettings>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/{branchId}/consent-templates")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listConsentTemplates")
    listConsentTemplates(
      @path branchId: UUID
    ): ApiOkResponse<DentalConsentTemplate[]>
      | ApiUnauthorizedResponse;

    @post
    @route("/{branchId}/consent-templates")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createConsentTemplate")
    createConsentTemplate(
      @path branchId: UUID,
      @body body: CreateDentalConsentTemplateRequest
    ): ApiCreatedResponse<DentalConsentTemplate>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @patch(#{implicitOptionality: true})
    @route("/{branchId}/consent-templates/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("updateConsentTemplate")
    updateConsentTemplate(
      @path branchId: UUID,
      @path id: UUID,
      @body body: UpdateDentalConsentTemplateRequest
    ): ApiOkResponse<DentalConsentTemplate>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @delete
    @route("/{branchId}/consent-templates/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("deleteConsentTemplate")
    deleteConsentTemplate(
      @path branchId: UUID,
      @path id: UUID
    ): ApiOkResponse<{}>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }
}
