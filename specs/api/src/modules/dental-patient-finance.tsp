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
 * Dental Patient-Finance Module (TR-DG-002 manual-route migration)
 *
 * Migrates four previously hand-registered route families off `app.ts` and onto
 * TypeSpec codegen:
 *   1. Treatment plans (PLURAL header entity) — create / list / update / approval.
 *      NOTE: the SINGULAR `/dental/patients/{patientId}/treatment-plan` resource
 *      (presentation aggregate + accept + versions) is a *different* resource owned
 *      by dental-visit (DentalVisitModule.TreatmentPlanPresentation) and keeps its
 *      operationIds (`getTreatmentPlan`, `acceptTreatmentPlan`,
 *      `getTreatmentPlanVersion`). The plural GET-by-id and accept routes are
 *      re-export shims of those same dental-visit handlers, so they CANNOT be
 *      re-emitted here without duplicating a global operationId — they remain
 *      Category-1 manual keeps in app.ts. Only the four genuinely-new plural
 *      operations are migrated.
 *   2. Sync logs — local-first sync ledger (base /dental/sync-logs, NOT under /patients).
 *   3. Insurance profiles — per-patient coverage records.
 *   4. Claim drafts ("claims") — insurance claim drafts + readiness check + status FSM.
 *
 * RBAC is membership-based and enforced in-handler; every op declares
 * `x-security-required-roles: ["user"]` (the Better-Auth role is always `user`).
 * Namespaces carry no @route/@tag — the base prefix + tag live on the
 * MonobaseAPI interface re-declarations; operations below use relative sub-routes.
 *
 * operationIds match the exact exported handler function names under
 * services/api-ts/src/handlers/dental-patient/{treatment-plans,sync,insurance}/.
 */
namespace DentalPatientFinanceModule {
  // ==========================================================================
  // 1 — TREATMENT PLANS (plural header entity)
  // ==========================================================================

  @doc("Lifecycle of a treatment-plan header")
  enum TreatmentPlanStatus {
    draft: "draft",
    presented: "presented",
    approved: "approved",
    // P2-8: explicit case-acceptance + scheduling states.
    rejected: "rejected",
    scheduled: "scheduled",
    partially_completed: "partially_completed",
    completed: "completed",
    cancelled: "cancelled",
  }

  @doc("How a treatment plan was approved")
  enum TreatmentPlanApprovalMethod {
    signature: "signature",
    verbal: "verbal",
    portal: "portal",
  }

  @doc("A treatment-plan header record")
  model TreatmentPlan extends BaseEntity {
    @doc("Patient this plan belongs to")
    patientId: UUID;

    @doc("Provider who authored the plan")
    providerId: UUID;

    @doc("Current lifecycle status")
    status: TreatmentPlanStatus;

    @doc("Total estimate in cents")
    totalEstimateCents: int32;

    @doc("Free-text notes")
    notes: string | null;

    @doc("ADA CDT code-set year the plan's procedure codes were authored against (P2-10)")
    cdtCodeSetYear: int32;

    @doc("When the plan was presented to the patient (ISO 8601 UTC)")
    presentedAt: utcDateTime | null;

    @doc("When the plan was approved (ISO 8601 UTC)")
    approvedAt: utcDateTime | null;
  }

  @doc("An append-only treatment-plan approval record (CR-05 / TR-P1-08)")
  model TreatmentPlanApproval extends BaseEntity {
    @doc("Treatment plan that was approved")
    treatmentPlanId: UUID;

    @doc("Loose ref to the accepted plan-version snapshot, if any")
    planVersionId: UUID | null;

    @doc("Person (patient/guardian) who approved")
    approvedByPersonId: UUID;

    @doc("Approval method")
    method: TreatmentPlanApprovalMethod;

    @doc("Loose ref to the consent form, if the approval was consented")
    consentFormId: UUID | null;

    @doc("Captured signature payload, if method = signature")
    signatureData: string | null;

    @doc("When the approval was recorded (ISO 8601 UTC)")
    approvedAt: utcDateTime;
  }

  @doc("An append-only treatment-plan status-transition record (P2-8)")
  model TreatmentPlanStatusHistoryEntry extends BaseEntity {
    @doc("Treatment plan this transition belongs to")
    treatmentPlanId: UUID;

    @doc("Status before the transition (null on the initial 'draft' creation event)")
    fromStatus: TreatmentPlanStatus | null;

    @doc("Status after the transition")
    toStatus: TreatmentPlanStatus;

    @doc("Person who performed the transition")
    changedByPersonId: UUID;

    @doc("When the transition occurred (ISO 8601 UTC)")
    changedAt: utcDateTime;
  }

  @doc("Result of approving a treatment plan: the approval record plus the recomputed plan")
  model TreatmentPlanApprovalResult {
    @doc("The newly-written approval record")
    approval: TreatmentPlanApproval;

    @doc("The plan header after binding items + status derivation")
    plan: TreatmentPlan;
  }

  @doc("Body to create a treatment-plan header (created in 'draft')")
  model CreateTreatmentPlanRequest {
    @doc("Provider who authors the plan")
    providerId: UUID;

    @doc("Total estimate in cents (default 0)")
    @minValue(0)
    totalEstimateCents?: int32;

    @doc("Optional free-text notes")
    notes?: string;

    @doc("ADA CDT code-set year stamp (P2-10; defaults to the current default year)")
    @minValue(2000)
    @maxValue(2100)
    cdtCodeSetYear?: int32;
  }

  @doc("Body to update a treatment plan (at least one field required)")
  model UpdateTreatmentPlanRequest {
    @doc("New lifecycle status (FSM-validated)")
    status?: TreatmentPlanStatus;

    @doc("Updated total estimate in cents")
    @minValue(0)
    totalEstimateCents?: int32;

    @doc("Updated free-text notes")
    notes?: string;
  }

  @doc("Body to record a patient approval of a treatment plan (CR-05)")
  model ApproveTreatmentPlanRequest {
    @doc("Person (patient/guardian) who approved")
    approvedByPersonId: UUID;

    @doc("Approval method")
    method: TreatmentPlanApprovalMethod;

    @doc("Consent form linkage, if consented")
    consentFormId?: UUID;

    @doc("Accepted plan-version snapshot linkage, if any")
    planVersionId?: UUID;

    @doc("Captured signature payload, if method = signature")
    signatureData?: string;
  }

  @doc("Treatment-plan (plural) header management")
  interface TreatmentPlanHeaderManagement {
    @doc("Create a treatment-plan header in 'draft' status")
    @operationId("createTreatmentPlan")
    @post
    @route("/{patientId}/treatment-plans")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createTreatmentPlan(
      @path patientId: UUID,
      @body body: CreateTreatmentPlanRequest,
    ):
      | ApiCreatedResponse<TreatmentPlan>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("List a patient's treatment-plan headers")
    @operationId("listPatientTreatmentPlans")
    @get
    @route("/{patientId}/treatment-plans")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listPatientTreatmentPlans(@path patientId: UUID):
      | ApiOkResponse<TreatmentPlan[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Update a treatment-plan header (FSM-validated status transitions)")
    @operationId("updateTreatmentPlan")
    @patch(#{ implicitOptionality: false })
    @route("/{patientId}/treatment-plans/{planId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateTreatmentPlan(
      @path patientId: UUID,
      @path planId: UUID,
      @body body: UpdateTreatmentPlanRequest,
    ):
      | ApiOkResponse<TreatmentPlan>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Record a patient approval of a treatment plan + bind its items (CR-05 / TP-BR-005)")
    @operationId("approveTreatmentPlan")
    @post
    @route("/{patientId}/treatment-plans/{planId}/approval")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    approveTreatmentPlan(
      @path patientId: UUID,
      @path planId: UUID,
      @body body: ApproveTreatmentPlanRequest,
    ):
      | ApiCreatedResponse<TreatmentPlanApprovalResult>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("List a treatment plan's status-transition history (P2-8)")
    @operationId("listTreatmentPlanStatusHistory")
    @get
    @route("/{patientId}/treatment-plans/{planId}/status-history")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listTreatmentPlanStatusHistory(@path patientId: UUID, @path planId: UUID):
      | ApiOkResponse<TreatmentPlanStatusHistoryEntry[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }

  // ==========================================================================
  // 1b — PLAN → APPOINTMENT LINKAGE (P1-21)
  // ==========================================================================

  @doc("Body to attach a planned treatment item to a scheduled appointment")
  model AttachTreatmentAppointmentRequest {
    @doc("Appointment to link the treatment to (must belong to the same patient)")
    appointmentId: UUID;
  }

  @doc("Result of attaching/detaching a treatment's appointment link")
  model TreatmentAppointmentLink {
    @doc("Treatment item that was (un)linked")
    id: UUID;

    @doc("The linked appointment, or null if detached")
    appointmentId: UUID | null;
  }

  @doc("Plan item ↔ appointment scheduling linkage (P1-21)")
  interface TreatmentAppointmentLinkManagement {
    @doc("Link a planned treatment item to a scheduled appointment")
    @operationId("attachTreatmentAppointment")
    @post
    @route("/{patientId}/treatments/{treatmentId}/appointment")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    attachTreatmentAppointment(
      @path patientId: UUID,
      @path treatmentId: UUID,
      @body body: AttachTreatmentAppointmentRequest,
    ):
      | ApiOkResponse<TreatmentAppointmentLink>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Unlink a planned treatment item from its appointment")
    @operationId("detachTreatmentAppointment")
    @delete
    @route("/{patientId}/treatments/{treatmentId}/appointment")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    detachTreatmentAppointment(@path patientId: UUID, @path treatmentId: UUID):
      | ApiOkResponse<TreatmentAppointmentLink>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }

  // ==========================================================================
  // 1c — ALTERNATE CASES / OPTION GROUPS (P1-19)
  // ==========================================================================

  @doc("One alternate-case treatment option within an option group")
  model TreatmentOption {
    @doc("Treatment item id")
    id: UUID;

    @doc("Item status (diagnosed/planned/declined/…)")
    status: string;

    @doc("Whether this is the clinician-recommended option")
    recommended: boolean;
  }

  @doc("An alternate-case option group (e.g. implant vs bridge)")
  model TreatmentOptionGroup {
    @doc("Option-group identifier shared by mutually-exclusive options")
    optionGroupId: UUID;

    @doc("The options in the group")
    options: TreatmentOption[];
  }

  @doc("Body to accept one option in an alternate-case group")
  model AcceptTreatmentOptionRequest {
    @doc("The chosen treatment; its siblings in the group are declined")
    chosenTreatmentId: UUID;
  }

  @doc("Result of accepting an alternate-case option")
  model AcceptTreatmentOptionResult {
    @doc("Option-group identifier")
    optionGroupId: UUID;

    @doc("The accepted treatment")
    chosenTreatmentId: UUID;

    @doc("The option group's post-acceptance state")
    options: TreatmentOption[];
  }

  @doc("Alternate-case / option-group management (P1-19)")
  interface TreatmentOptionManagement {
    @doc("List the alternate-case options in a group")
    @operationId("listTreatmentOptionGroup")
    @get
    @route("/{patientId}/treatment-options/{optionGroupId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listTreatmentOptionGroup(@path patientId: UUID, @path optionGroupId: UUID):
      | ApiOkResponse<TreatmentOptionGroup>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Accept one option; decline its non-terminal siblings")
    @operationId("acceptTreatmentOption")
    @post
    @route("/{patientId}/treatment-options/{optionGroupId}/accept")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    acceptTreatmentOption(
      @path patientId: UUID,
      @path optionGroupId: UUID,
      @body body: AcceptTreatmentOptionRequest,
    ):
      | ApiOkResponse<AcceptTreatmentOptionResult>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }

  // ==========================================================================
  // 1d — HOUSEHOLD / GUARANTOR (P1-27 family file)
  // ==========================================================================

  @doc("A household member: a patient + their relationship to the guarantor")
  model HouseholdMember extends BaseEntity {
    @doc("Household this membership belongs to")
    householdId: UUID;

    @doc("The patient in the household")
    patientId: UUID;

    @doc("Relationship to the guarantor (self/spouse/child/dependent/…)")
    relationship: string;

    @doc("True for the household's guarantor member")
    isGuarantor: boolean;
  }

  @doc("A household (family file) for shared billing under one guarantor")
  model Household extends BaseEntity {
    @doc("Branch the household is scoped to")
    branchId: UUID;

    @doc("Family / household display name")
    name: string;

    @doc("The guarantor patient (financially responsible party)")
    guarantorPatientId: UUID;

    @doc("Free-text notes")
    notes: string | null;
  }

  @doc("A household plus its members")
  model HouseholdWithMembers {
    @doc("The household")
    household: Household;

    @doc("The household's members (guarantor first)")
    members: HouseholdMember[];
  }

  @doc("Body to create a household (the guarantor becomes its first member)")
  model CreateHouseholdRequest {
    @doc("Branch the household is scoped to")
    branchId: UUID;

    @doc("Family / household display name")
    @minLength(1)
    name: string;

    @doc("The guarantor patient — financially responsible party")
    guarantorPatientId: UUID;

    @doc("Optional free-text notes")
    notes?: string;
  }

  @doc("Body to add a patient to a household")
  model AddHouseholdMemberRequest {
    @doc("The patient to add")
    patientId: UUID;

    @doc("Relationship to the guarantor (default 'dependent')")
    relationship?: string;
  }

  @doc("Household / guarantor management (P1-27)")
  interface HouseholdManagement {
    @doc("Create a household with a guarantor")
    @operationId("createHousehold")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createHousehold(@body body: CreateHouseholdRequest):
      | ApiCreatedResponse<HouseholdWithMembers>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Get a household with its members")
    @operationId("getHousehold")
    @get
    @route("/{householdId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getHousehold(@path householdId: UUID):
      | ApiOkResponse<HouseholdWithMembers>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Add a patient to a household")
    @operationId("addHouseholdMember")
    @post
    @route("/{householdId}/members")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    addHouseholdMember(@path householdId: UUID, @body body: AddHouseholdMemberRequest):
      | ApiCreatedResponse<HouseholdMember>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Remove a patient from a household (the guarantor cannot be removed)")
    @operationId("removeHouseholdMember")
    @delete
    @route("/{householdId}/members/{patientId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    removeHouseholdMember(@path householdId: UUID, @path patientId: UUID):
      | ApiOkResponse<HouseholdMember>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }

  @doc("Patient → household lookup (P1-27)")
  interface PatientHouseholdManagement {
    @doc("Get the household a patient belongs to (204 if patient is in no household)")
    @operationId("getPatientHousehold")
    @get
    @route("/{patientId}/household")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getPatientHousehold(@path patientId: UUID):
      | ApiOkResponse<HouseholdWithMembers>
      | ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }

  // ==========================================================================
  // 1e — CASE PRESENTATION (P1-20, patient-facing treatment acceptance)
  // ==========================================================================
  //
  // Phase 1 (this pass) is ENTIRELY staff `bearerAuth`: a staff member opens the
  // presentation on the operatory iPad and the patient taps Accept/Reject on the
  // staff's authenticated session. The public shareable-link (`by-token`) family
  // is DEFERRED to Phase 2 — see docs/reviews/plans/04-case-presentation.md §3.3.

  @doc("Lifecycle of a case presentation (distinct from the plan FSM)")
  enum CasePresentationStatus {
    draft: "draft",
    sent: "sent",
    viewed: "viewed",
    accepted: "accepted",
    rejected: "rejected",
    expired: "expired",
    revoked: "revoked",
  }

  @doc("Terminal patient decision on a presented case")
  enum CasePresentationDecision {
    accepted: "accepted",
    rejected: "rejected",
  }

  @doc("A patient-facing case-presentation record (P1-20)")
  model CasePresentation extends BaseEntity {
    @doc("Patient the presented case belongs to")
    patientId: UUID;

    @doc("Treatment-plan header being presented")
    treatmentPlanId: UUID;

    @doc("Loose ref to the immutable plan-version snapshot presented, if any")
    planVersionId: UUID | null;

    @doc("Presentation lifecycle status")
    status: CasePresentationStatus;

    @doc("Terminal patient decision, if decided")
    decision: CasePresentationDecision | null;

    @doc("When the decision was recorded (ISO 8601 UTC)")
    decisionAt: utcDateTime | null;

    @doc("Name typed at signing (patient/guardian), if accepted")
    signerName: string | null;

    @doc("Loose ref to the consent_form written on accept, if any")
    consentFormId: UUID | null;

    @doc("Optional free-text reason captured on reject")
    rejectionReason: string | null;

    @doc("When the presentation was first viewed (ISO 8601 UTC)")
    firstViewedAt: utcDateTime | null;

    @doc("When the presentation was last viewed (ISO 8601 UTC)")
    lastViewedAt: utcDateTime | null;
  }

  @doc("One patient-readable line item within a presented phase")
  model CasePresentationLineItem {
    @doc("Treatment item id")
    id: UUID;

    @doc("Tooth number, if tooth-specific")
    toothNumber: int32 | null;

    @doc("Affected surfaces, if any")
    surfaces: string[] | null;

    @doc("Layperson procedure description (not the raw CDT code)")
    description: string;

    @doc("CDT procedure code")
    cdtCode: string;

    @doc("Item status (diagnosed/planned/declined/…)")
    status: string;

    @doc("Fee for this item in cents (₱)")
    priceCents: int32;

    @doc("Option-group id, if this item is one of a set of alternates")
    optionGroupId: UUID | null;

    @doc("Whether this item is the clinician-recommended alternate")
    recommended: boolean;
  }

  @doc("A clinical phase grouping of line items with a subtotal")
  model CasePresentationPhase {
    @doc("Clinical phase key (systemic/disease_control/…), or null for unphased")
    phase: string | null;

    @doc("Line items in this phase, in clinical order")
    items: CasePresentationLineItem[];

    @doc("Phase subtotal in cents (₱)")
    subtotalCents: int32;
  }

  @doc("An alternate-case option group surfaced for the patient to choose")
  model CasePresentationOptionGroup {
    @doc("Option-group identifier shared by mutually-exclusive options")
    optionGroupId: UUID;

    @doc("The alternate options in the group")
    options: CasePresentationLineItem[];
  }

  @doc("A reference to one of the patient's own annotated images")
  model CasePresentationImageRef {
    @doc("Image id")
    id: UUID;

    @doc("Image type (e.g. radiograph, intraoral_photo)")
    imageType: string;

    @doc("Tooth number the image is associated with, if any")
    toothNumber: int32 | null;

    @doc("Number of clinician annotations/findings on this image")
    findingCount: int32;
  }

  @doc("Denormalized, patient-readable case-presentation aggregate (P1-20)")
  model CasePresentationAggregate {
    @doc("The case-presentation record")
    presentation: CasePresentation;

    @doc("The plan header being presented")
    plan: TreatmentPlan;

    @doc("Patient first name (the only PII surfaced on the presentation)")
    patientFirstName: string;

    @doc("Line items grouped by clinical phase, in clinical order")
    phases: CasePresentationPhase[];

    @doc("Alternate-case option groups with the recommended option flagged")
    optionGroups: CasePresentationOptionGroup[];

    @doc("References to the patient's own annotated images")
    images: CasePresentationImageRef[];

    @doc("Grand total across all phases in cents (₱)")
    grandTotalCents: int32;
  }

  @doc("Body to create a case presentation from a presented plan")
  model CreateCasePresentationRequest {
    @doc("Treatment-plan header to present")
    treatmentPlanId: UUID;

    @doc("Loose ref to the immutable plan-version snapshot presented, if any")
    planVersionId?: UUID;
  }

  @doc("Body to accept a presented case (patient e-signs on the staff session)")
  model AcceptCasePresentationRequest {
    @doc("Name typed at signing (patient or guardian)")
    @minLength(1)
    signerName: string;

    @doc("Captured signature payload (e-sig, immutable once recorded)")
    @minLength(1)
    signatureData: string;
  }

  @doc("Body to reject a presented case")
  model RejectCasePresentationRequest {
    @doc("Optional free-text reason for declining")
    rejectionReason?: string;
  }

  @doc("Result of accepting a case presentation")
  model AcceptCasePresentationResult {
    @doc("The decided presentation record")
    presentation: CasePresentation;

    @doc("The plan after transitioning presented → approved")
    plan: TreatmentPlan;

    @doc("The immutable consent e-sig written on accept")
    consentFormId: UUID;
  }

  @doc("Result of rejecting a case presentation")
  model RejectCasePresentationResult {
    @doc("The decided presentation record")
    presentation: CasePresentation;

    @doc("The plan after transitioning presented → rejected")
    plan: TreatmentPlan;
  }

  @doc("Patient-facing case-presentation management (P1-20, staff bearerAuth)")
  interface CasePresentationManagement {
    @doc("Create a case presentation from a presented treatment plan")
    @operationId("createCasePresentation")
    @post
    @route("/{patientId}/case-presentations")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createCasePresentation(
      @path patientId: UUID,
      @body body: CreateCasePresentationRequest,
    ):
      | ApiCreatedResponse<CasePresentation>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("List a patient's case presentations")
    @operationId("listCasePresentations")
    @get
    @route("/{patientId}/case-presentations")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listCasePresentations(@path patientId: UUID):
      | ApiOkResponse<CasePresentation[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Get the patient-readable case-presentation aggregate (records first/last view)")
    @operationId("getCasePresentation")
    @get
    @route("/{patientId}/case-presentations/{presentationId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getCasePresentation(@path patientId: UUID, @path presentationId: UUID):
      | ApiOkResponse<CasePresentationAggregate>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Accept a presented case: write immutable e-sig, plan presented → approved")
    @operationId("acceptCasePresentation")
    @post
    @route("/{patientId}/case-presentations/{presentationId}/accept")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    acceptCasePresentation(
      @path patientId: UUID,
      @path presentationId: UUID,
      @body body: AcceptCasePresentationRequest,
    ):
      | ApiOkResponse<AcceptCasePresentationResult>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Reject a presented case: plan presented → rejected (terminal)")
    @operationId("rejectCasePresentation")
    @post
    @route("/{patientId}/case-presentations/{presentationId}/reject")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    rejectCasePresentation(
      @path patientId: UUID,
      @path presentationId: UUID,
      @body body: RejectCasePresentationRequest,
    ):
      | ApiOkResponse<RejectCasePresentationResult>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }

  // ==========================================================================
  // 2 — SYNC LOGS (base /dental/sync-logs)
  // ==========================================================================

  @doc("Lifecycle of a local-first sync entry")
  enum SyncStatus {
    pending: "pending",
    syncing: "syncing",
    synced: "synced",
    failed: "failed",
  }

  @doc("A local-first sync ledger entry")
  model SyncLog extends BaseEntity {
    @doc("Client-assigned local identifier")
    localId: string;

    @doc("Server-assigned identifier once reconciled")
    serverId: string | null;

    @doc("Entity type being synced")
    entityType: string;

    @doc("Entity identifier being synced")
    entityId: string;

    @doc("Branch context, if any")
    branchId: string | null;

    @doc("Current sync status")
    syncStatus: SyncStatus;

    @doc("When the entry last reached 'synced' (ISO 8601 UTC)")
    lastSyncAt: utcDateTime | null;

    @doc("Last error message, if the sync failed")
    error: string | null;
  }

  @doc("Body to register a local-first sync entry")
  model CreateSyncLogRequest {
    @doc("Client-assigned local identifier")
    @minLength(1)
    localId: string;

    @doc("Entity type being synced")
    @minLength(1)
    entityType: string;

    @doc("Entity identifier being synced")
    @minLength(1)
    entityId: string;

    @doc("Server-assigned identifier, if already known")
    serverId?: string;

    @doc("Branch context, if any")
    branchId?: string;
  }

  @doc("Body to transition a sync entry (at least one non-version field required)")
  model UpdateSyncLogRequest {
    @doc("New sync status (FSM-validated; 'synced' is terminal)")
    syncStatus?: SyncStatus;

    @doc("Server-assigned identifier")
    serverId?: string;

    @doc("Error message")
    error?: string;

    @doc("Expected current version for optimistic-lock conflict detection (LF-BR-004)")
    version?: int32;
  }

  @doc("Local-first sync-log management")
  interface SyncLogManagement {
    @doc("Register a local-first sync entry (created in 'pending')")
    @operationId("createSyncLog")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createSyncLog(@body body: CreateSyncLogRequest):
      | ApiCreatedResponse<SyncLog>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ErrorResponse;

    @doc("List sync-log entries")
    @operationId("listSyncLogs")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listSyncLogs():
      | ApiOkResponse<SyncLog[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ErrorResponse;

    @doc("Transition a sync entry's status (FSM-validated; stale version → 409)")
    @operationId("updateSyncLog")
    @patch(#{ implicitOptionality: false })
    @route("/{logId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateSyncLog(@path logId: UUID, @body body: UpdateSyncLogRequest):
      | ApiOkResponse<SyncLog>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ErrorResponse;
  }

  // ==========================================================================
  // 3 — INSURANCE PROFILES
  // ==========================================================================

  @doc("Subscriber relationship to the patient")
  enum InsuranceRelationship {
    self: "self",
    spouse: "spouse",
    child: "child",
    other: "other",
  }

  @doc("PH payer type (P1-26). hmo is the dominant model; philhealth is minimal.")
  enum PayerType {
    hmo: "hmo",
    philhealth: "philhealth",
    corporate: "corporate",
    self_pay_assist: "self_pay_assist",
    other: "other",
  }

  @doc("A patient insurance-coverage profile")
  model InsuranceProfile extends BaseEntity {
    @doc("Patient this profile belongs to")
    patientId: UUID;

    @doc("Insurer / carrier name")
    insurerName: string;

    @doc("Policy number")
    policyNumber: string;

    @doc("Group number, if any")
    groupNumber: string | null;

    @doc("Subscriber full name")
    subscriberName: string;

    @doc("Subscriber date of birth (YYYY-MM-DD)")
    subscriberDob: plainDate | null;

    @doc("Subscriber relationship to the patient")
    relationship: string;

    @doc("Whether the profile is active")
    active: boolean;

    @doc("Free-text notes")
    notes: string | null;

    @doc("PH payer type (P1-26; default hmo)")
    payerType: PayerType;

    @doc("Whether the clinic/branch is an accredited provider for this payer")
    accredited: boolean | null;

    @doc("Annual benefit cap in centavos, if any")
    annualLimitCents: int32 | null;

    @doc("Annual benefit already consumed, in centavos")
    annualLimitUsedCents: int32 | null;
  }

  @doc("Body to create an insurance profile")
  model CreateInsuranceProfileRequest {
    @doc("Insurer / carrier name")
    @minLength(1)
    insurerName: string;

    @doc("Policy number")
    @minLength(1)
    policyNumber: string;

    @doc("Group number, if any")
    groupNumber?: string;

    @doc("Subscriber full name")
    @minLength(1)
    subscriberName: string;

    @doc("Subscriber date of birth (YYYY-MM-DD)")
    @pattern("^\\d{4}-\\d{2}-\\d{2}$")
    subscriberDob?: string;

    @doc("Subscriber relationship to the patient (default 'self')")
    relationship?: InsuranceRelationship;

    @doc("Free-text notes")
    notes?: string;

    @doc("PH payer type (default hmo)")
    payerType?: PayerType;

    @doc("Whether the clinic/branch is an accredited provider for this payer")
    accredited?: boolean;

    @doc("Annual benefit cap in centavos")
    @minValue(0) annualLimitCents?: int32;

    @doc("Annual benefit already consumed, in centavos")
    @minValue(0) annualLimitUsedCents?: int32;
  }

  @doc("Body to update an insurance profile (at least one field required)")
  model UpdateInsuranceProfileRequest {
    @doc("Insurer / carrier name")
    @minLength(1)
    insurerName?: string;

    @doc("Policy number")
    @minLength(1)
    policyNumber?: string;

    @doc("Group number")
    groupNumber?: string;

    @doc("Subscriber full name")
    @minLength(1)
    subscriberName?: string;

    @doc("Subscriber date of birth (YYYY-MM-DD)")
    @pattern("^\\d{4}-\\d{2}-\\d{2}$")
    subscriberDob?: string;

    @doc("Subscriber relationship to the patient")
    relationship?: InsuranceRelationship;

    @doc("Whether the profile is active")
    active?: boolean;

    @doc("Free-text notes")
    notes?: string;

    @doc("PH payer type")
    payerType?: PayerType;

    @doc("Whether the clinic/branch is an accredited provider for this payer")
    accredited?: boolean;

    @doc("Annual benefit cap in centavos")
    @minValue(0) annualLimitCents?: int32;

    @doc("Annual benefit already consumed, in centavos")
    @minValue(0) annualLimitUsedCents?: int32;
  }

  @doc("Patient insurance-profile management")
  interface InsuranceProfileManagement {
    @doc("Create an insurance profile for a patient")
    @operationId("createInsuranceProfile")
    @post
    @route("/{patientId}/insurance-profiles")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createInsuranceProfile(
      @path patientId: UUID,
      @body body: CreateInsuranceProfileRequest,
    ):
      | ApiCreatedResponse<InsuranceProfile>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("List a patient's insurance profiles")
    @operationId("listPatientInsuranceProfiles")
    @get
    @route("/{patientId}/insurance-profiles")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listPatientInsuranceProfiles(@path patientId: UUID):
      | ApiOkResponse<InsuranceProfile[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Update a patient's insurance profile")
    @operationId("updateInsuranceProfile")
    @patch(#{ implicitOptionality: false })
    @route("/{patientId}/insurance-profiles/{profileId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateInsuranceProfile(
      @path patientId: UUID,
      @path profileId: UUID,
      @body body: UpdateInsuranceProfileRequest,
    ):
      | ApiOkResponse<InsuranceProfile>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }

  // ==========================================================================
  // 4 — CLAIM DRAFTS ("claims")
  // ==========================================================================

  @doc("Lifecycle of a claim draft")
  enum ClaimDraftStatus {
    draft: "draft",
    ready: "ready",
    submitted: "submitted",
    accepted: "accepted",
    rejected: "rejected",
  }

  @doc("An insurance claim draft")
  model ClaimDraft extends BaseEntity {
    @doc("Patient this claim belongs to")
    patientId: UUID;

    @doc("Insurance profile backing the claim")
    insuranceProfileId: UUID;

    @doc("Visit the claim is anchored to, if any")
    visitId: UUID | null;

    @doc("CDT procedure code")
    cdtCode: string;

    @doc("ICD-10 diagnosis code, if any")
    icd10Code: string | null;

    @doc("Free-text diagnosis description, if any")
    diagnosisDescription: string | null;

    @doc("Fee amount in cents")
    feeAmountCents: int32;

    @doc("Current lifecycle status")
    status: ClaimDraftStatus;

    @doc("When the claim was submitted (ISO 8601 UTC)")
    submittedAt: utcDateTime | null;

    @doc("Free-text notes")
    notes: string | null;
  }

  @doc("Claim-readiness checklist result")
  model ClaimReadiness {
    @doc("Claim being evaluated")
    claimId: UUID;

    @doc("Whether a CDT code is present")
    hasCdtCode: boolean;

    @doc("Whether an ICD-10 code is present")
    hasIcd10Code: boolean;

    @doc("Whether an active insurance profile backs the claim")
    hasInsuranceProfile: boolean;

    @doc("Whether a positive fee is present")
    hasFee: boolean;

    @doc("Overall readiness (all checks pass)")
    ready: boolean;
  }

  @doc("Body to create a claim draft (created in 'draft')")
  model CreateClaimDraftRequest {
    @doc("Insurance profile backing the claim")
    insuranceProfileId: UUID;

    @doc("Visit the claim is anchored to, if any")
    visitId?: UUID;

    @doc("CDT procedure code")
    @minLength(1)
    cdtCode: string;

    @doc("ICD-10 diagnosis code, if any")
    icd10Code?: string;

    @doc("Free-text diagnosis description, if any")
    diagnosisDescription?: string;

    @doc("Fee amount in cents")
    @minValue(0)
    feeAmountCents: int32;

    @doc("Free-text notes")
    notes?: string;
  }

  @doc("Body to transition a claim draft's status (FSM-validated)")
  model UpdateClaimStatusRequest {
    @doc("New lifecycle status")
    status: ClaimDraftStatus;
  }

  @doc("Patient claim-draft management")
  interface ClaimDraftManagement {
    @doc("Create a claim draft for a patient")
    @operationId("createClaimDraft")
    @post
    @route("/{patientId}/claims")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createClaimDraft(
      @path patientId: UUID,
      @body body: CreateClaimDraftRequest,
    ):
      | ApiCreatedResponse<ClaimDraft>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("List a patient's claim drafts")
    @operationId("listPatientClaims")
    @get
    @route("/{patientId}/claims")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listPatientClaims(@path patientId: UUID):
      | ApiOkResponse<ClaimDraft[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Compute a claim draft's submission-readiness checklist")
    @operationId("getClaimReadiness")
    @get
    @route("/{patientId}/claims/{claimId}/readiness")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getClaimReadiness(@path patientId: UUID, @path claimId: UUID):
      | ApiOkResponse<ClaimReadiness>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Transition a claim draft's status (FSM-validated)")
    @operationId("updateClaimStatus")
    @patch(#{ implicitOptionality: false })
    @route("/{patientId}/claims/{claimId}/status")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateClaimStatus(
      @path patientId: UUID,
      @path claimId: UUID,
      @body body: UpdateClaimStatusRequest,
    ):
      | ApiOkResponse<ClaimDraft>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }

  // ==========================================================================
  // 5 — COVERAGE AUTHORIZATION (LOA) — P1-26
  // ==========================================================================

  @doc("Lifecycle of a coverage authorization (PH LOA)")
  enum CoverageAuthStatus {
    requested: "requested",
    approved: "approved",
    partial: "partial",
    denied: "denied",
    expired: "expired",
  }

  @doc("One covered-procedure entry on an itemized authorization")
  model CoveredProcedure {
    @doc("CDT procedure code")
    cdtCode: string;

    @doc("Approved amount for this procedure, in centavos")
    approvedAmountCents?: int32;

    @doc("Free-text note")
    note?: string;
  }

  @doc("A coverage authorization (HMO Letter of Authorization / approval record)")
  model CoverageAuthorization extends BaseEntity {
    @doc("Patient the authorization covers")
    patientId: UUID;

    @doc("Insurance profile backing the authorization")
    insuranceProfileId: UUID;

    @doc("Branch the authorization is scoped to")
    branchId: UUID;

    @doc("Visit the authorization is anchored to, if any")
    visitId: UUID | null;

    @doc("Treatment plan the authorization is anchored to, if any")
    treatmentPlanId: UUID | null;

    @doc("Approval code / LOA number")
    loaNumber: string | null;

    @doc("Authorization status")
    status: CoverageAuthStatus;

    @doc("Date the authorization was approved (YYYY-MM-DD)")
    approvedAt: plainDate | null;

    @doc("Date the authorization expires (YYYY-MM-DD)")
    validUntil: plainDate | null;

    @doc("Approved coverage cap for this authorization, in centavos")
    approvedAmountCents: int32 | null;

    @doc("Itemized covered procedures, if any")
    coveredProcedures: CoveredProcedure[] | null;

    @doc("Storage file id of the scanned LOA, if any")
    attachmentFileId: UUID | null;

    @doc("Free-text notes")
    notes: string | null;
  }

  @doc("Body to capture a coverage authorization (LOA)")
  model CreateCoverageAuthorizationRequest {
    @doc("Insurance profile backing the authorization")
    insuranceProfileId: UUID;

    @doc("Visit the authorization is anchored to, if any")
    visitId?: UUID;

    @doc("Treatment plan the authorization is anchored to, if any")
    treatmentPlanId?: UUID;

    @doc("Approval code / LOA number")
    loaNumber?: string;

    @doc("Initial status (default 'requested')")
    status?: CoverageAuthStatus;

    @doc("Date the authorization was approved (YYYY-MM-DD)")
    @pattern("^\\d{4}-\\d{2}-\\d{2}$")
    approvedAt?: string;

    @doc("Date the authorization expires (YYYY-MM-DD)")
    @pattern("^\\d{4}-\\d{2}-\\d{2}$")
    validUntil?: string;

    @doc("Approved coverage cap, in centavos")
    @minValue(0)
    approvedAmountCents?: int32;

    @doc("Itemized covered procedures, if any")
    coveredProcedures?: CoveredProcedure[];

    @doc("Storage file id of the scanned LOA, if any")
    attachmentFileId?: UUID;

    @doc("Free-text notes")
    notes?: string;
  }

  @doc("Body to transition a coverage authorization's status (FSM-validated)")
  model UpdateCoverageAuthorizationStatusRequest {
    @doc("New status")
    status: CoverageAuthStatus;

    @doc("Approved cap to set on approval/partial, in centavos")
    @minValue(0)
    approvedAmountCents?: int32;

    @doc("Itemized covered procedures to set on approval/partial")
    coveredProcedures?: CoveredProcedure[];
  }

  @doc("Coverage-authorization (LOA) management")
  interface CoverageAuthorizationManagement {
    @doc("Capture a coverage authorization for a patient")
    @operationId("createCoverageAuthorization")
    @post
    @route("/{patientId}/authorizations")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createCoverageAuthorization(
      @path patientId: UUID,
      @body body: CreateCoverageAuthorizationRequest,
    ):
      | ApiCreatedResponse<CoverageAuthorization>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("List a patient's coverage authorizations")
    @operationId("listCoverageAuthorizations")
    @get
    @route("/{patientId}/authorizations")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listCoverageAuthorizations(@path patientId: UUID):
      | ApiOkResponse<CoverageAuthorization[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Transition a coverage authorization's status (FSM-validated)")
    @operationId("updateCoverageAuthorizationStatus")
    @patch(#{ implicitOptionality: false })
    @route("/{patientId}/authorizations/{authorizationId}/status")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateCoverageAuthorizationStatus(
      @path patientId: UUID,
      @path authorizationId: UUID,
      @body body: UpdateCoverageAuthorizationStatusRequest,
    ):
      | ApiOkResponse<CoverageAuthorization>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }
}
