import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";
import "./dental-scheduling.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Dental Fee Schedule Module (EF-ORG-P016 / WF-025, FR6.3)
 *
 * The fee schedule is the active CDT procedure-code catalog (owned by
 * dental-visit) with per-branch price overrides stored on
 * `dental_branch.settings.feeSchedule`. Read access is any branch clinical
 * member; PATCH is dentist_owner only. RBAC is enforced in-handler; routes
 * emit via `FeeScheduleMgmt` in main.tsp (the @route/@tag live on that
 * service-namespace interface; operations below carry only relative sub-routes).
 *
 * Handlers: handlers/dental-org/feeSchedule.ts
 *   getFeeSchedule (GET /dental/fee-schedule?branchId=...) reads ctx.req.query('branchId')
 *   updateFeeScheduleEntry (PATCH /dental/fee-schedule/:cdt) reads ctx.req.param('cdt')
 *     + ctx.req.json() validated against { branchId: uuid, priceCents: int }.
 */
namespace DentalFeeScheduleModule {
  @doc("A single fee-schedule entry: CDT code with its effective per-branch price")
  model FeeScheduleEntry {
    @doc("CDT procedure code (e.g. 'D1110')")
    cdtCode: string;

    @doc("Human-readable procedure description")
    description: string;

    @doc("Effective price in minor units (per-branch override or catalog default)")
    priceCents: int32;

    @doc("ISO 4217 currency code (defaults to 'PHP')")
    currency: string;
  }

  @doc("Fee schedule listing wrapper")
  model FeeScheduleList {
    data: FeeScheduleEntry[];
  }

  @doc("Single fee-schedule entry wrapper")
  model FeeScheduleEntryResponse {
    data: FeeScheduleEntry;
  }

  @doc("Body to set a per-branch CDT price override (dentist_owner only)")
  model UpdateFeeScheduleEntryRequest {
    @doc("Branch whose fee schedule is being modified")
    branchId: UUID;

    @doc("New price in minor units (0..999999)")
    priceCents: int32;
  }

  @doc("Per-branch CDT fee schedule (read = branch members, write = dentist_owner)")
  interface FeeScheduleManagement {
    @doc("Read the active CDT catalog with effective per-branch prices")
    @operationId("getFeeSchedule")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getFeeSchedule(
      @doc("Branch to read the fee schedule for (required by the handler)")
      @query
      branchId?: UUID,
    ):
      | ApiOkResponse<FeeScheduleList>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Set a per-branch price override for a CDT code")
    @operationId("updateFeeScheduleEntry")
    @patch
    @route("/{cdt}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateFeeScheduleEntry(
      @doc("CDT procedure code (string, e.g. 'D1110') — not a UUID")
      @path
      cdt: string,

      @body body: UpdateFeeScheduleEntryRequest,
    ):
      | ApiOkResponse<FeeScheduleEntryResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }
}

/**
 * Dental Queue Board Module (A5 P1-003)
 *
 * Patient flow board: an appointment can be added to a branch's live queue,
 * the board lists active (non-terminal) items for a branch, and an item's
 * status is transitioned via an FSM (waiting → called → in_progress →
 * completed, with cancelled reachable from non-terminal states). RBAC is
 * branch-membership based and enforced in-handler; routes emit via three
 * interfaces in main.tsp (distinct @route bases). Operations carry only
 * relative sub-routes.
 *
 * Handlers: handlers/dental-scheduling/{createQueueItem,listQueueBoard,updateQueueItemStatus}.ts
 * Validators mirrored from handlers/dental-scheduling/queue-item-validators.ts.
 */
namespace DentalQueueModule {
  @doc("Lifecycle status of a queue item")
  enum QueueItemStatus {
    @doc("Patient is in the waiting room")
    waiting: "waiting",

    @doc("Patient has been called")
    called: "called",

    @doc("Patient is being treated")
    inProgress: "in_progress",

    @doc("Visit complete (terminal)")
    completed: "completed",

    @doc("Removed from the queue (terminal)")
    cancelled: "cancelled",
  }

  @doc("A queue-board item linking an appointment to the branch patient-flow board")
  model QueueItem extends BaseEntity {
    @doc("Appointment this queue item belongs to")
    appointmentId: UUID;

    @doc("Patient on the queue")
    patientId: UUID;

    @doc("Branch whose board this item is on")
    branchId: UUID;

    @doc("Current lifecycle status")
    status: QueueItemStatus;

    @doc("When the patient was called (ISO 8601 UTC)")
    calledAt: utcDateTime | null;

    @doc("When treatment started (ISO 8601 UTC)")
    startedAt: utcDateTime | null;

    @doc("When the visit completed (ISO 8601 UTC)")
    completedAt: utcDateTime | null;

    @doc("Optional free-text note")
    notes: string | null;
  }

  @doc("Body to add an appointment to the queue board")
  model CreateQueueItemRequest {
    @doc("Optional free-text note")
    notes?: string;
  }

  @doc("Body to transition a queue item's status")
  model UpdateQueueItemStatusRequest {
    @doc("Target status (validated against the FSM in-handler)")
    status: QueueItemStatus;

    @doc("Optional free-text note")
    notes?: string;
  }

  @doc("Add an appointment to the branch queue board")
  interface QueueItemCreation {
    @doc("Create a queue entry for an appointment (status defaults to 'waiting')")
    @operationId("createQueueItem")
    @post
    @route("/{appointmentId}/queue-item")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createQueueItem(
      @path appointmentId: UUID,
      @body body: CreateQueueItemRequest,
    ):
      | ApiCreatedResponse<QueueItem>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }

  @doc("Read the live queue board for a branch")
  interface QueueBoardListing {
    @doc("List active (non-terminal) queue items for the branch")
    @operationId("listQueueBoard")
    @get
    @route("/{branchId}/queue-board")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listQueueBoard(@path branchId: UUID):
      | ApiOkResponse<QueueItem[]>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ErrorResponse;
  }

  @doc("Transition a queue item through its status FSM")
  interface QueueItemStatusManagement {
    @doc("Transition a queue item's status (FSM-validated)")
    @operationId("updateQueueItemStatus")
    @patch
    @route("/{itemId}/status")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateQueueItemStatus(
      @path itemId: UUID,
      @body body: UpdateQueueItemStatusRequest,
    ):
      | ApiOkResponse<QueueItem>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }
}

/**
 * Dental Scheduling Waitlist Module (P2-15 — ASAP fill)
 *
 * A waitlist entry records a patient who wants an earlier / short-notice slot
 * at a branch. When a cancellation opens a slot, an `active` entry is promoted —
 * which books an appointment for the supplied window and marks the entry
 * `scheduled`. Lifecycle: active → scheduled | cancelled (both terminal).
 *
 * RBAC is branch-membership based and enforced in-handler; routes emit via
 * three interfaces in main.tsp (distinct @route bases). Operations carry only
 * relative sub-routes.
 *
 * Handlers: handlers/dental-scheduling/{createWaitlistEntry,listWaitlist,promoteWaitlistEntry}.ts
 */
namespace DentalWaitlistModule {
  @doc("Lifecycle status of a waitlist entry")
  enum WaitlistEntryStatus {
    @doc("Waiting to be filled")
    active: "active",

    @doc("Promoted into a booked appointment (terminal)")
    scheduled: "scheduled",

    @doc("Removed from the waitlist (terminal)")
    cancelled: "cancelled",
  }

  @doc("How urgently the patient wants an earlier slot")
  enum WaitlistUrgency {
    routine: "routine",
    soon: "soon",
    asap: "asap",
  }

  @doc("A scheduling waitlist entry for short-notice / ASAP fill")
  model WaitlistEntry extends BaseEntity {
    @doc("Patient waiting for an earlier slot")
    patientId: UUID;

    @doc("Branch this waitlist belongs to")
    branchId: UUID;

    @doc("Preferred provider (null = any provider)")
    preferredProviderId: UUID | null;

    @doc("Preferred visit type (checkup/treatment/emergency/recall), if any")
    visitType: string | null;

    @doc("Urgency of the request")
    urgency: WaitlistUrgency;

    @doc("Current lifecycle status")
    status: WaitlistEntryStatus;

    @doc("Optional free-text note")
    notes: string | null;

    @doc("Appointment booked when this entry was promoted (null until promoted)")
    promotedAppointmentId: UUID | null;

    @doc("When the entry was promoted into an appointment (ISO 8601 UTC)")
    scheduledAt: utcDateTime | null;

    @doc("When the entry was cancelled (ISO 8601 UTC)")
    cancelledAt: utcDateTime | null;
  }

  @doc("Body to add a patient to the waitlist")
  model CreateWaitlistEntryRequest {
    patientId: UUID;
    preferredProviderId?: UUID;
    visitType?: string;
    urgency?: WaitlistUrgency;

    @maxLength(500)
    notes?: string;
  }

  @doc("Body to promote a waitlist entry into a booked appointment")
  model PromoteWaitlistEntryRequest {
    @doc("Slot start (ISO 8601 UTC)")
    startAt: utcDateTime;

    @doc("Slot end (ISO 8601 UTC) — must be after startAt")
    endAt: utcDateTime;

    @doc("Provider to book (defaults to the entry's preferredProviderId; required if none)")
    providerId?: UUID;

    @doc("Visit type override (defaults to the entry's stored visitType)")
    visitType?: string;

    @doc("Operatory to assign, if any")
    operatoryId?: UUID;
  }

  @doc("Result of promoting a waitlist entry")
  model PromoteWaitlistEntryResponse {
    entry: WaitlistEntry;
    appointment: DentalAppointment;
  }

  @doc("Add a patient to a branch's waitlist")
  interface WaitlistEntryCreation {
    @doc("Create a waitlist entry (status defaults to 'active')")
    @operationId("createWaitlistEntry")
    @post
    @route("/{branchId}/waitlist")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createWaitlistEntry(
      @path branchId: UUID,
      @body body: CreateWaitlistEntryRequest,
    ):
      | ApiCreatedResponse<WaitlistEntry>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }

  @doc("List a branch's waitlist entries")
  interface WaitlistListing {
    @doc("List waitlist entries for a branch (defaults to active entries)")
    @operationId("listWaitlist")
    @get
    @route("/{branchId}/waitlist")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listWaitlist(
      @path branchId: UUID,
      @query status?: WaitlistEntryStatus,
    ):
      | ApiOkResponse<WaitlistEntry[]>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ErrorResponse;
  }

  @doc("Promote a waitlist entry into a booked appointment")
  interface WaitlistPromotion {
    @doc("Fill a short-notice slot from the waitlist (active entries only)")
    @operationId("promoteWaitlistEntry")
    @post
    @route("/{entryId}/promote")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    promoteWaitlistEntry(
      @path entryId: UUID,
      @body body: PromoteWaitlistEntryRequest,
    ):
      | ApiCreatedResponse<PromoteWaitlistEntryResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }
}
