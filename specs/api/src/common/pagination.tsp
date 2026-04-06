import "@typespec/http";
import "./models.tsp";

using TypeSpec.Http;

/**
 * Pagination and sorting models for API responses
 */

/**
 * General pagination query parameters (includes search and filtering)
 */
@doc("Pagination with search and filtering")
model PaginationQuery {
  ...OffsetPaginationParams;
  ...SearchFilterParams;
  ...SortingParams;
}

/**
 * General paginated response (alias for OffsetPaginatedResponse)
 */
alias PaginatedResponse<T> = OffsetPaginatedResponse<T>;

/**
 * Cursor-based pagination parameters
 */
@doc("Cursor-based pagination parameters for efficient large dataset traversal")
model CursorPaginationParams {
  @doc("Cursor pointing to the next page")
  @query
  cursor?: string;

  @doc("Number of items to return (1-100)")
  @query
  @minValue(1)
  @maxValue(100)
  limit?: int32 = 20;

  @doc("Sort direction")
  @query  
  direction?: SortDirection = SortDirection.asc;
}

/**
 * Offset-based pagination parameters
 */
@doc("Offset-based pagination parameters for simple navigation")
model OffsetPaginationParams {
  @doc("Number of items to skip")
  @query
  @minValue(0)
  offset?: int32 = 0;

  @doc("Number of items to return (1-100)")
  @query
  @minValue(1)
  @maxValue(100)
  limit?: int32 = 20;

  @doc("Page number (1-based) - alternative to offset")
  @query
  @minValue(1)
  page?: int32;

  @doc("Items per page (1-100) - alternative to limit")
  @query
  @minValue(1)
  @maxValue(100)
  pageSize?: int32;
}

/**
 * Sort direction enumeration
 */
@doc("Sort direction")
enum SortDirection {
  @doc("Ascending order")
  asc: "asc",
  
  @doc("Descending order")
  desc: "desc",
}

/**
 * Advanced sorting parameters
 */
@doc("Multi-field sorting parameters")
model SortingParams {
  @doc("Sort specifications (comma-separated field:direction pairs)")
  @query
  sort?: string;
}

/**
 * Cursor-based paginated response
 */
@doc("Cursor-based paginated response with navigation cursors")
model CursorPaginatedResponse<T> {
  @doc("Response data items")
  data: T[];

  @doc("Pagination metadata")
  pagination: CursorPaginationMeta;
}

/**
 * Cursor pagination metadata
 */
@doc("Cursor pagination navigation information")
model CursorPaginationMeta {
  @doc("Cursor for the next page")
  nextCursor?: string;

  @doc("Cursor for the previous page")
  previousCursor?: string;

  @doc("Whether there are more items after this page")
  hasNextPage: boolean;

  @doc("Whether there are items before this page")
  hasPreviousPage: boolean;

  @doc("Number of items in current page")
  count: int32;

  @doc("Total number of items (if available)")
  totalCount?: int32;
}

/**
 * Offset-based paginated response
 */
@doc("Offset-based paginated response with page navigation")
model OffsetPaginatedResponse<T> {
  @doc("Response data items")
  data: T[];

  @doc("Pagination metadata")
  pagination: OffsetPaginationMeta;
}

/**
 * Offset pagination metadata
 */
@doc("Offset pagination navigation information")
model OffsetPaginationMeta {
  @doc("Current offset")
  offset: int32;

  @doc("Items per page")
  limit: int32;

  @doc("Number of items in current page")
  count: int32;

  @doc("Total number of items")
  totalCount: int32;

  @doc("Total number of pages")
  totalPages: int32;

  @doc("Current page number (1-based)")
  currentPage: int32;

  @doc("Whether there are more pages")
  hasNextPage: boolean;

  @doc("Whether there are previous pages")
  hasPreviousPage: boolean;
}

/**
 * Search and filter parameters
 */
@doc("Search and filtering parameters")
model SearchFilterParams {
  @doc("Search query string")
  @query
  @maxLength(500)
  q?: string;
}
