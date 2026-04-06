# Reviews Module

## Overview

The Reviews module provides a lightweight, flexible review system using Net Promoter Score (NPS) methodology. The module is intentionally generic to support multiple use cases across different application types.

## Core Concepts

### Flexible Design

Unlike traditional review modules with hardcoded review types, this module allows applications to define their own:

- **Review Types**: Application-defined strings (e.g., 'provider', 'platform', 'product', 'seller')
- **Context**: Flexible UUID reference to any entity (bookings, sessions, orders, etc.)
- **Reviewed Entity**: Optional person ID when reviewing individuals

### NPS Scoring

Reviews use the standard Net Promoter Score methodology:
- **Score Range**: 0-10 integer
- **Categorization** (handled in application layer):
  - Detractors: 0-6
  - Passives: 7-8
  - Promoters: 9-10

### Data Integrity

- **Immutable**: Reviews cannot be updated after submission (only soft-deleted)
- **Unique Constraint**: One review per (context, reviewer, reviewType) combination
- **Soft Deletes**: Reviews are soft-deleted, maintaining audit trail

## Sample Use Cases

### Healthcare/Booking Platform

```typescript
// Patient reviews provider after appointment
POST /reviews
{
  "context": "booking-uuid-here",
  "reviewType": "provider",
  "reviewedEntity": "provider-person-uuid",
  "npsScore": 9,
  "comment": "Excellent care and very professional"
}

// Patient reviews platform/call experience
POST /reviews
{
  "context": "booking-uuid-here",
  "reviewType": "platform",
  "reviewedEntity": null,
  "npsScore": 8,
  "comment": "Video call quality was good"
}

// Provider reviews platform/call experience
POST /reviews
{
  "context": "booking-uuid-here",
  "reviewType": "platform",
  "reviewedEntity": null,
  "npsScore": 7,
  "comment": "Interface could be more intuitive"
}
```

### E-commerce/Marketplace

```typescript
// Buyer reviews seller
POST /reviews
{
  "context": "order-uuid-here",
  "reviewType": "seller",
  "reviewedEntity": "seller-person-uuid",
  "npsScore": 10,
  "comment": "Fast shipping and great communication"
}

// Buyer reviews product
POST /reviews
{
  "context": "order-uuid-here",
  "reviewType": "product",
  "reviewedEntity": null,
  "npsScore": 9,
  "comment": "Exactly as described, high quality"
}

// Buyer reviews shipping experience
POST /reviews
{
  "context": "order-uuid-here",
  "reviewType": "shipping",
  "reviewedEntity": null,
  "npsScore": 6,
  "comment": "Took longer than expected"
}
```

### Service Platform

```typescript
// Client reviews professional
POST /reviews
{
  "context": "session-uuid-here",
  "reviewType": "professional",
  "reviewedEntity": "pro-person-uuid",
  "npsScore": 10,
  "comment": "Exceptional service, highly recommend"
}

// Client reviews booking experience
POST /reviews
{
  "context": "session-uuid-here",
  "reviewType": "booking_experience",
  "reviewedEntity": null,
  "npsScore": 8,
  "comment": "Easy to book and reschedule"
}
```

## API Endpoints

### Create Review
`POST /reviews`

Creates a new review. Requires authentication.

**Request Body:**
```json
{
  "context": "uuid",
  "reviewType": "string",
  "reviewedEntity": "uuid (optional)",
  "npsScore": 0-10,
  "comment": "string (optional, max 1000 chars)"
}
```

**Responses:**
- `201 Created`: Review created successfully
- `409 Conflict`: Duplicate review (same context + reviewer + reviewType)
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized

### List Reviews
`GET /reviews`

Lists reviews with optional filtering. Role-based access control applies.

**Query Parameters:**
- `context`: Filter by context UUID
- `reviewer`: Filter by reviewer person ID
- `reviewType`: Filter by review type string
- `reviewedEntity`: Filter by reviewed entity person ID
- `page`, `limit`: Pagination parameters

**Access Control:**
- Users see their own reviews (as reviewer)
- Reviewed entities see reviews about them
- Admins see all reviews

### Get Review
`GET /reviews/{id}`

Retrieves a specific review. Role-based access control applies.

**Responses:**
- `200 OK`: Review found
- `404 Not Found`: Review not found
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized to view this review

### Delete Review
`DELETE /reviews/{id}`

Soft deletes a review. Only the review owner can delete their own review.

**Responses:**
- `204 No Content`: Review deleted successfully
- `404 Not Found`: Review not found
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized to delete this review

## Integration Guide

### Best Practices

1. **Review Type Naming**
   - Use lowercase with underscores: `booking_experience`, `video_quality`
   - Be specific: `provider` vs `provider_professionalism`
   - Keep consistent across your application

2. **Context References**
   - Use completed/finalized entities (e.g., completed bookings, delivered orders)
   - Validate context exists before allowing review
   - Consider context lifecycle (can deleted contexts be reviewed?)

3. **Reviewed Entity**
   - Set to person UUID when reviewing individuals
   - Set to `null` when reviewing non-person aspects (platform, product, etc.)
   - Prevent self-reviews (reviewer ≠ reviewedEntity) in application logic

4. **Authorization**
   - Verify users have participated in the context before reviewing
   - Consider time windows for review eligibility
   - Implement role checks in application layer

### Example Implementation

```typescript
// Application-layer validation before submitting review
async function submitReview(bookingId: string, reviewData: ReviewData) {
  // 1. Verify booking exists and is completed
  const booking = await getBooking(bookingId);
  if (booking.status !== 'completed') {
    throw new Error('Can only review completed bookings');
  }
  
  // 2. Verify user was a participant
  const userId = getCurrentUserId();
  if (userId !== booking.client && userId !== booking.provider) {
    throw new Error('Can only review bookings you participated in');
  }
  
  // 3. Prevent self-reviews for provider reviews
  if (reviewData.reviewType === 'provider' && 
      reviewData.reviewedEntity === userId) {
    throw new Error('Cannot review yourself');
  }
  
  // 4. Submit review
  return await createReview({
    context: bookingId,
    reviewType: reviewData.reviewType,
    reviewedEntity: reviewData.reviewedEntity,
    npsScore: reviewData.npsScore,
    comment: reviewData.comment,
  });
}
```

## Data Model

### Review Entity

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| context | UUID | Reference to reviewed entity (booking, session, order, etc.) |
| reviewer | UUID | Person who submitted the review (foreign key to person.id) |
| reviewType | string | Application-defined review type (max 50 chars) |
| reviewedEntity | UUID? | Optional person being reviewed (foreign key to person.id) |
| npsScore | int | NPS score (0-10) |
| comment | string? | Optional feedback (max 1000 chars) |
| createdAt | timestamp | When review was created |
| updatedAt | timestamp | Last updated |

### Constraints

- **Unique**: (context, reviewer, reviewType)
- **Check**: npsScore between 0 and 10
- **Check**: comment length ≤ 1000 characters
- **Check**: reviewType length ≤ 50 characters

### Indexes

- context_idx: For filtering by context
- reviewer_idx: For filtering by reviewer
- reviewType_idx: For filtering by review type
- reviewedEntity_idx: For filtering by reviewed entity

## What's NOT Included

This is a minimal module. The following features are intentionally excluded:

- ❌ Review updates/edits (immutable by design)
- ❌ NPS analytics/aggregation endpoints
- ❌ Notification triggers
- ❌ Review responses/replies
- ❌ Review moderation/flagging
- ❌ Review helpful/voting features
- ❌ Public review display pages
- ❌ Review type registry/validation
- ❌ Context validation (assumes valid UUIDs)

Applications should implement these features in their own layer if needed.

## Future Considerations

While not currently implemented, the flexible design allows for future enhancements:

- Analytics endpoints for NPS calculation per reviewType
- Aggregated scores per reviewedEntity
- Time-series analysis of review trends
- Review moderation workflows
- Notification triggers on review submission
- Review response functionality

These can be added without schema changes due to the flexible design.
