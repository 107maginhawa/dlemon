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

  @doc("Staff role within a branch — drives RBAC")
  enum MemberRole {
    @doc("Practice owner, full access including financials and admin")
    dentistOwner: "dentist_owner",

    @doc("Associate dentist, clinical access for own patients")
    dentistAssociate: "dentist_associate",

    @doc("Full operations staff — billing, scheduling, patient records")
    staffFull: "staff_full",

    @doc("Scheduling-only staff")
    staffScheduling: "staff_scheduling",
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
    @doc("6-digit PIN entered by the staff member")
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
    @doc("New 4-8 digit PIN")
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

  @doc("List of memberships")
  model MembershipList {
    items: DentalMembership[];
    total: int32;
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
    list(@path orgId: UUID, @path branchId: UUID): MembershipList | ApiUnauthorizedResponse | ErrorResponse;

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
}
