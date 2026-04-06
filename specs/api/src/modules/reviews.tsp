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
 * Reviews Module - Flexible NPS Review System
 * 
 * Provides a lightweight, flexible review system using Net Promoter Score (NPS)
 * methodology. Applications define their own review types and contexts.
 * 
 * Key Features:
 * - Flexible context field (bookings, sessions, orders, etc.)
 * - Application-defined review types (no hardcoded enums)
 * - Optional reviewed entity (for person reviews)
 * - NPS scoring (0-10)
 * - Immutable reviews (no updates, only delete)
 * - Role-based access control
 * 
 * Sample Use Cases:
 * - Healthcare: Patient reviews provider/platform after appointment
 * - E-commerce: Buyer reviews seller/product/shipping
 * - Services: Client reviews professional/booking experience
 */

// ============================================================================
// CORE MODELS
// ============================================================================

/**
 * Review model with flexible context and type
 */
@doc("Review with NPS score and optional feedback")
model Review extends BaseEntity {
  @doc("Flexible context reference (booking, session, order, etc.)")
  context: UUID;

  @doc("Person who submits the review")
  reviewer: UUID;

  @doc("Application-defined review type (e.g., 'provider', 'platform', 'product')")
  @maxLength(50)
  reviewType: string;

  @doc("Optional person being reviewed (null for non-person reviews like 'platform')")
  reviewedEntity?: UUID;

  @doc("NPS score (0-10)")
  @minValue(0)
  @maxValue(10)
  npsScore: int32;

  @doc("Optional comment/feedback")
  @maxLength(1000)
  comment?: string;
}

// ============================================================================
// REQUEST/RESPONSE MODELS
// ============================================================================

/**
 * Create review request
 */
@doc("Request to create a review")
model CreateReviewRequest {
  @doc("Context reference (booking, session, order, etc.)")
  context: UUID;

  @doc("Application-defined review type")
  @maxLength(50)
  reviewType: string;

  @doc("Optional person being reviewed")
  reviewedEntity?: UUID;

  @doc("NPS score (0-10)")
  @minValue(0)
  @maxValue(10)
  npsScore: int32;

  @doc("Optional comment/feedback")
  @maxLength(1000)
  comment?: string;
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Reviews management endpoints
 */
namespace ReviewsModule {
  interface ReviewsManagement {
    
    @doc("Create a new review. Requires authenticated user. Unique constraint on (context, reviewer, reviewType).")
    @operationId("createReview")
    @post
    @route("/")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createReview(
      @body request: CreateReviewRequest
    ): ApiCreatedResponse<Review>
      | ApiConflictResponse // Duplicate review (same context + reviewer + reviewType)
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List reviews with filtering. Role-based access: users see their own reviews, reviewed entities see received reviews, admins see all.")
    @operationId("listReviews")
    @get
    @route("/")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listReviews(
      @doc("Filter by context UUID")
      @query context?: UUID,
      @doc("Filter by reviewer person ID")
      @query reviewer?: UUID,
      @doc("Filter by review type")
      @query reviewType?: string,
      @doc("Filter by reviewed entity person ID")
      @query reviewedEntity?: UUID,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<Review>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get specific review. Role-based access control.")
    @operationId("getReview")
    @get
    @route("/{review}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getReview(
      @path review: UUID
    ): ApiOkResponse<Review>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Delete review. Only review owner can delete.")
    @operationId("deleteReview")
    @delete
    @route("/{review}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["review:owner", "admin"])
    deleteReview(
      @path review: UUID
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
