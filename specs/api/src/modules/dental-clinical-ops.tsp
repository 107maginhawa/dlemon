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
 * Dental Clinical-Ops Module (TR-DG-002 manual-route → TypeSpec migration)
 *
 * Three branch/patient-scoped clinical-operations features whose routes were
 * previously hand-registered in `services/api-ts/src/app.ts`:
 *
 *   1. Occlusion screenings  — POST/GET /dental/patients/{patientId}/occlusion-screenings
 *   2. Post-op templates     — POST/GET /dental/branches/{branchId}/postop-templates,
 *                              PATCH .../{templateId}
 *   3. Inventory             — POST/GET /dental/branches/{branchId}/inventory,
 *                              PATCH .../{itemId},
 *                              POST/GET .../{itemId}/adjustments
 *
 * Handlers live under `handlers/dental-clinical/{occlusion,postop,inventory}/*`.
 * Dental RBAC is membership-based and enforced in-handler; the Better-Auth role
 * is always `user`, so every op declares
 * `@extension("x-security-required-roles", #["user"])`.
 *
 * The namespace carries NO @route/@tag. The base @route + @tag("Dental:Clinical")
 * live on the re-declared interfaces inside `MonobaseAPI` (main.tsp); operations
 * here use only relative sub-routes. Bodies/queries/params mirror the hand-written
 * Zod validators and the Drizzle schemas exactly (nullable columns → `T | null`).
 */
namespace DentalClinicalOpsModule {
  // ------------------------------------------------------------------------
  // 1. Occlusion screenings
  // ------------------------------------------------------------------------

  @doc("Angle classification of occlusion")
  enum OcclusionClass {
    class_i: "class_i",
    class_ii_div1: "class_ii_div1",
    class_ii_div2: "class_ii_div2",
    class_iii: "class_iii",
    edge_to_edge: "edge_to_edge",
  }

  @doc("An occlusion screening record")
  model OcclusionScreening extends BaseEntity {
    @doc("Patient this screening belongs to")
    patientId: UUID;

    @doc("Visit context, if any")
    visitId: UUID | null;

    @doc("Angle classification")
    angleClass: OcclusionClass | null;

    @doc("Overbite in millimetres")
    overbiteMm: int32 | null;

    @doc("Overjet in millimetres")
    overjetMm: int32 | null;

    @doc("Crossbite present")
    crossbite: boolean | null;

    @doc("Crowding present")
    crowding: boolean | null;

    @doc("Spacing present")
    spacing: boolean | null;

    @doc("Midline deviation description")
    midlineDeviation: string | null;

    @doc("Free-text clinical notes")
    notes: string | null;
  }

  @doc("Body to create an occlusion screening")
  model CreateOcclusionScreeningRequest {
    angleClass?: OcclusionClass;
    overbiteMm?: int32;
    overjetMm?: int32;
    crossbite?: boolean;
    crowding?: boolean;
    spacing?: boolean;
    midlineDeviation?: string;
    visitId?: UUID;
    notes?: string;
  }

  @doc("Occlusion screening endpoints (membership RBAC enforced in-handler)")
  interface OcclusionScreeningManagement {
    @doc("Create an occlusion screening for a patient")
    @operationId("createOcclusionScreening")
    @post
    @route("/{patientId}/occlusion-screenings")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createOcclusionScreening(
      @path patientId: UUID,
      @body body: CreateOcclusionScreeningRequest,
    ):
      | ApiCreatedResponse<OcclusionScreening>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("List occlusion screenings for a patient")
    @operationId("listOcclusionScreenings")
    @get
    @route("/{patientId}/occlusion-screenings")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listOcclusionScreenings(@path patientId: UUID):
      | ApiOkResponse<OcclusionScreening[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }

  // ------------------------------------------------------------------------
  // 2. Post-op templates
  // ------------------------------------------------------------------------

  @doc("Category of a post-op care template")
  enum PostopCategory {
    extraction: "extraction",
    implant: "implant",
    root_canal: "root_canal",
    filling: "filling",
    crown: "crown",
    cleaning: "cleaning",
    surgery: "surgery",
    orthodontic: "orthodontic",
    other: "other",
  }

  @doc("A branch-scoped post-op care template")
  model PostopTemplate extends BaseEntity {
    @doc("Branch this template belongs to")
    branchId: UUID;

    @doc("Template category")
    category: PostopCategory;

    @doc("Template title")
    title: string;

    @doc("Template body content")
    content: string;

    @doc("Whether the template is active")
    active: boolean;
  }

  @doc("Body to create a post-op template")
  model CreatePostopTemplateRequest {
    category: PostopCategory;

    @minLength(1)
    title: string;

    @minLength(1)
    content: string;
  }

  @doc("Body to update a post-op template (at least one field required)")
  model UpdatePostopTemplateRequest {
    category?: PostopCategory;

    @minLength(1)
    title?: string;

    @minLength(1)
    content?: string;

    active?: boolean;
  }

  @doc("Post-op template endpoints (membership RBAC enforced in-handler)")
  interface PostopTemplateManagement {
    @doc("Create a post-op template for a branch")
    @operationId("createPostopTemplate")
    @post
    @route("/{branchId}/postop-templates")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createPostopTemplate(
      @path branchId: UUID,
      @body body: CreatePostopTemplateRequest,
    ):
      | ApiCreatedResponse<PostopTemplate>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("List post-op templates for a branch, optionally filtered by category")
    @operationId("listPostopTemplates")
    @get
    @route("/{branchId}/postop-templates")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listPostopTemplates(
      @path branchId: UUID,
      @query category?: PostopCategory,
    ):
      | ApiOkResponse<PostopTemplate[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Update a post-op template")
    @operationId("updatePostopTemplate")
    @patch
    @route("/{branchId}/postop-templates/{templateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updatePostopTemplate(
      @path branchId: UUID,
      @path templateId: UUID,
      @body body: UpdatePostopTemplateRequest,
    ):
      | ApiOkResponse<PostopTemplate>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }

  // ------------------------------------------------------------------------
  // 3. Inventory items + adjustments
  // ------------------------------------------------------------------------

  @doc("Category of an inventory item")
  enum InventoryCategory {
    consumable: "consumable",
    instrument: "instrument",
    medication: "medication",
    equipment: "equipment",
    other: "other",
  }

  @doc("Lifecycle status of an inventory item")
  enum InventoryStatus {
    active: "active",
    depleted: "depleted",
    discontinued: "discontinued",
  }

  @doc("Type of a stock adjustment ledger entry")
  enum AdjustmentType {
    restock: "restock",
    usage: "usage",
    disposal: "disposal",
    correction: "correction",
  }

  @doc("A branch-scoped inventory item")
  model InventoryItem extends BaseEntity {
    @doc("Branch this item belongs to")
    branchId: UUID;

    @doc("Item name")
    name: string;

    @doc("Item category")
    category: InventoryCategory;

    @doc("Unit of measure")
    unit: string;

    @doc("Lifecycle status")
    status: InventoryStatus;

    @doc("Materialized running quantity on hand")
    quantityOnHand: int32;

    @doc("Reorder threshold")
    reorderLevel: int32;

    @doc("Free-text notes")
    notes: string | null;
  }

  @doc("A stock adjustment ledger entry")
  model InventoryAdjustment extends BaseEntity {
    @doc("Inventory item this adjustment applies to")
    itemId: UUID;

    @doc("Adjustment type")
    adjustmentType: AdjustmentType;

    @doc("Signed quantity delta (non-zero)")
    quantity: int32;

    @doc("Reason for the adjustment")
    reason: string | null;
  }

  @doc("Body to create an inventory item")
  model CreateInventoryItemRequest {
    @minLength(1)
    name: string;

    category: InventoryCategory;

    @minLength(1)
    unit: string;

    @minValue(0)
    quantityOnHand?: int32;

    @minValue(0)
    reorderLevel?: int32;

    notes?: string;
  }

  @doc("Body to update an inventory item (at least one field required)")
  model UpdateInventoryItemRequest {
    @minLength(1)
    name?: string;

    category?: InventoryCategory;

    @minLength(1)
    unit?: string;

    status?: InventoryStatus;

    @minValue(0)
    quantityOnHand?: int32;

    @minValue(0)
    reorderLevel?: int32;

    notes?: string;
  }

  @doc("Body to create a stock adjustment")
  model CreateInventoryAdjustmentRequest {
    adjustmentType: AdjustmentType;

    @doc("Signed quantity delta; must be non-zero")
    quantity: int32;

    reason?: string;
  }

  @doc("Inventory endpoints (membership RBAC enforced in-handler)")
  interface InventoryManagement {
    @doc("Create an inventory item for a branch")
    @operationId("createInventoryItem")
    @post
    @route("/{branchId}/inventory")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createInventoryItem(
      @path branchId: UUID,
      @body body: CreateInventoryItemRequest,
    ):
      | ApiCreatedResponse<InventoryItem>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("List inventory items for a branch")
    @operationId("listInventoryItems")
    @get
    @route("/{branchId}/inventory")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listInventoryItems(@path branchId: UUID):
      | ApiOkResponse<InventoryItem[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Update an inventory item")
    @operationId("updateInventoryItem")
    @patch
    @route("/{branchId}/inventory/{itemId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateInventoryItem(
      @path branchId: UUID,
      @path itemId: UUID,
      @body body: UpdateInventoryItemRequest,
    ):
      | ApiOkResponse<InventoryItem>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Create a stock adjustment for an inventory item")
    @operationId("createInventoryAdjustment")
    @post
    @route("/{branchId}/inventory/{itemId}/adjustments")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createInventoryAdjustment(
      @path branchId: UUID,
      @path itemId: UUID,
      @body body: CreateInventoryAdjustmentRequest,
    ):
      | ApiCreatedResponse<InventoryAdjustment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("List stock adjustments for an inventory item")
    @operationId("listInventoryAdjustments")
    @get
    @route("/{branchId}/inventory/{itemId}/adjustments")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listInventoryAdjustments(@path branchId: UUID, @path itemId: UUID):
      | ApiOkResponse<InventoryAdjustment[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }
}
