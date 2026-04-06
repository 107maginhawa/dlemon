# Website E2E Tests

## Prerequisites

**IMPORTANT**: Before running E2E tests, you MUST start the API server:

```bash
# From the monorepo root
cd services/api && bun dev
```

The API server must be running on port 7213 (default) for tests to work. Tests create real provider accounts via the API and test the full integration between the website and API.

## Running Tests

```bash
# Run all E2E tests
bun run test:e2e

# Run tests in UI mode (recommended for development)
bun run test:e2e:ui

# Run unit tests only
bun test
```

## Test Structure

- `tests/e2e/specs/` - Test specifications
- `tests/e2e/pages/` - Page Object Models
- `tests/e2e/helpers/` - Test utilities (provider creation, etc.)
- `tests/e2e/fixtures/` - Test data factories
- `utils/` - Unit tests for utility functions

## How Tests Work

E2E tests use a dynamic approach:
1. **Setup**: Create test providers via API (Better-Auth + POST /providers)
2. **Test**: Navigate website UI and verify behavior
3. **Cleanup**: Delete test providers via API

This ensures tests are predictable and don't rely on hardcoded/seeded data.

## Configuration

Set `API_BASE_URL` environment variable to override the default API endpoint:

```bash
API_BASE_URL=http://localhost:7213 bun run test:e2e
```

## Troubleshooting

### Phone Validation Errors

**Error**: `Validation failed: person.contactInfo.phone: Invalid`

**Cause**: Phone numbers must follow E.164 format (`^\\+[1-9]\\d{1,14}$`)

**Fix**: Use `'+1' + faker.string.numeric(10)` for US phone numbers

```typescript
// ❌ Wrong
phone: faker.phone.number('###-###-####')

// ✅ Correct
phone: '+1' + faker.string.numeric(10)  // E.164 format
```

### Better-Auth 404 Errors

**Error**: `Failed to sign up user: 404` on `/auth/signup/email`

**Cause**: Better-Auth uses hyphenated endpoint URLs

**Fix**: Use `/auth/sign-up/email` and `/auth/sign-in/email` (with hyphens)

```typescript
// ❌ Wrong
await page.request.post(`${API_BASE_URL}/auth/signup/email`, ...)
await page.request.post(`${API_BASE_URL}/auth/signin/email`, ...)

// ✅ Correct
await page.request.post(`${API_BASE_URL}/auth/sign-up/email`, ...)
await page.request.post(`${API_BASE_URL}/auth/sign-in/email`, ...)
```

### Booking API LocationType Errors

**Error**: `Invalid enum value. Expected 'video' | 'phone' | 'in-person', received 'telehealth'`

**Cause**: The API spec defines specific location types (see `specs/api/src/modules/booking.tsp`)

**Fix**: Use `'video'` instead of `'telehealth'`

```typescript
// ❌ Wrong
locationTypes: ['in-person', 'telehealth']

// ✅ Correct
locationTypes: ['in-person', 'video']
```

### Booking API DailyConfigs Structure Errors

**Error**: `Validation failed: dailyConfigs: Expected object, received array`

**Cause**: The API expects a `Record<DailyConfig>` with day-of-week keys, not an array

**Fix**: Convert dates to day-of-week keys and use the correct structure:

```typescript
// ❌ Wrong
const bookingEventPayload = {
  dailyConfigs: [
    { date: '2024-01-15', timeSlots: [...], available: true }
  ]
};

// ✅ Correct
const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const dayKey = dayNames[date.getDay()];

const dailyConfigs: Record<string, any> = {};
dailyConfigs[dayKey] = {
  enabled: true,
  timeBlocks: [
    {
      startTime: '09:00',
      endTime: '09:30',
      slotDuration: 30,
      bufferTime: 0
    }
  ]
};

const bookingEventPayload = {
  dailyConfigs,
  timezone: 'America/New_York',
  locationTypes: ['in-person', 'video'],
  maxBookingDays: 30
};
```

### Search Input Not Found

**Error**: `getByPlaceholder('Search pharmacists...') not found`

**Cause**: Page object locators must match the actual page implementation

**Fix**: Use the exact placeholder text from the page:

```typescript
// ❌ Wrong
this.searchInput = page.getByPlaceholder('Search pharmacists...');

// ✅ Correct
this.searchInput = page.getByPlaceholder('Search by name, specialty, or city...');
```

**Pro tip**: Always verify page locators against the actual rendered page. Run tests in UI mode (`bun run test:e2e:ui`) to inspect elements.

### ARIA Label Missing on Search Input

**Error**: `expect(ariaLabel).toBeTruthy()` - Received: null

**Cause**: Search input missing `aria-label` attribute for screen readers

**Fix**: Add `aria-label="Search pharmacists by name, specialty, or city"` to the Input component

```tsx
// ❌ Wrong
<Input
  type="text"
  placeholder="Search by name, specialty, or city..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
/>

// ✅ Correct
<Input
  type="text"
  placeholder="Search by name, specialty, or city..."
  aria-label="Search pharmacists by name, specialty, or city"
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
/>
```

### Provider Slug vs ID Errors

**Error**: `locator.textContent: Test timeout` or 404 when navigating to detail page

**Cause**: Using provider `slug` instead of `id` (UUID) when navigating to detail page

**Fix**: The API endpoint `/providers/{provider}` only accepts UUID or 'me', NOT slugs

```typescript
// ❌ Wrong - using slug
await pharmacistDetailPage.goto(testProvider.slug)  // 'detailtest-provider'

// ✅ Correct - using UUID
await pharmacistDetailPage.goto(testProvider.id)    // '123e4567-e89b-12d3-a456-426614174000'
```

**API Spec**: `/providers/{provider}` parameter accepts `UUID | "me"` only

### Person Object Not Expanded

**Error**: `TypeError: Cannot read properties of string` or page shows "Pharmacist not found"

**Cause**: API returns `person` as a UUID string instead of an expanded Person object by default

**Fix**: Add `expand=person` query parameter to provider API calls

```typescript
// ❌ Wrong - person returned as UUID string
export async function getProvider(id: string): Promise<ProviderResponse> {
  return apiGet<ProviderResponse>(`/providers/${id}`)
}

// ✅ Correct - person returned as expanded object
export async function getProvider(id: string): Promise<ProviderResponse> {
  return apiGet<ProviderResponse>(`/providers/${id}`, { expand: 'person' })
}
```

**API Response Without Expansion**:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "person": "6a241bf2-f49a-4998-bd9d-75bcdf61db6a"  // ❌ Just a UUID string
}
```

**API Response With Expansion**:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "person": {  // ✅ Full person object
    "id": "6a241bf2-f49a-4998-bd9d-75bcdf61db6a",
    "firstName": "John",
    "lastName": "Doe",
    "contactInfo": { "email": "...", "phone": "..." }
  }
}
```

### Transformer ID Field Error

**Error**: UI model has wrong ID, causing data mismatches

**Cause**: Transformer uses `person.id` instead of `provider.id` for the UI model

**Fix**: Update transformer to use the provider ID from the ProviderResponse

```typescript
// ❌ Wrong - uses person ID
export function transformProviderToPharmacist(provider: ProviderResponse): Pharmacist {
  return {
    id: provider.person.id,  // Wrong! This is the person ID
    // ...
  }
}

// ✅ Correct - uses provider ID
export function transformProviderToPharmacist(provider: ProviderResponse): Pharmacist {
  return {
    id: provider.id,  // Correct! This is the provider ID from BaseEntity
    // ...
  }
}
```

**Why This Matters**: The provider ID (from BaseEntity) is what the API expects for `/providers/{id}` endpoints, not the person ID. Using the wrong ID causes API calls to fail or return incorrect data.

### Detail Page Tests Timing Out

**Error**: `locator.textContent: Test timeout` when looking for `[data-testid="pharmacist-name"]`

**Cause**: Detail page is missing required data-testid attributes for testing

**Fix**: Add data-testid attributes to all key elements on the detail page:

```tsx
// Required data-testid attributes for detail page:
<h1 data-testid="pharmacist-name">{pharmacist.name}</h1>
<p data-testid="pharmacist-title">{pharmacist.title}</p>
<p data-testid="pharmacist-specializations">{pharmacist.specialty}</p>
<div data-testid="pharmacist-rating">...</div>
<span data-testid="pharmacist-review-count">...</span>
<p data-testid="pharmacist-bio">{pharmacist.bio}</p>
<p data-testid="years-experience">{pharmacist.yearsExperience} years</p>
<div data-testid="pharmacist-languages">...</div>
<p data-testid="consultation-fee">{pharmacist.priceRange}</p>
```

### Booking Widget Missing Test IDs

**Error**: `page.waitForSelector: Timeout exceeded` waiting for `[data-testid="date-selector"]` or `[data-testid="time-slot"]`

**Cause**: BookingWidget component missing required test attributes for date/time selection

**Fix**: Add test IDs to booking widget elements (`components/ui/booking/booking-widget.tsx`):

```tsx
// Date selector button
<Button data-testid="date-selector" ...>

// Time slot button
<Button
  data-testid="time-slot"
  data-available="true"
  data-selected={selectedSlot?.id === slot.id ? "true" : "false"}
  ...
>

// No slots message
<Alert data-testid="no-slots-message">
  <AlertDescription>
    No available time slots for this date. Please select another date.
  </AlertDescription>
</Alert>
```

**Test Page Object Update**: Since multiple date buttons share the same test ID, use `.first()`:
```typescript
this.dateSelector = page.locator('[data-testid="date-selector"]').first();
```

### General Debugging Tips

1. **Check API spec first**: Always reference `specs/api/dist/openapi/openapi.json` for exact field names and types
2. **Use UI mode**: Run `bun run test:e2e:ui` to step through tests and inspect page elements
3. **Check API logs**: Monitor the API server logs for validation errors
4. **Verify API is running**: Tests require the API server on port 7213
5. **Follow the API**: Remove features/fields not available in the API spec

## Future Enhancements

### Accessibility Testing (Deferred)

Accessibility tests have been deferred to focus on core functionality. See detailed implementation plan below.

**Planned Test Cases**:
- Keyboard navigation (Tab order, Enter key handling, focus management)
- ARIA labels and screen reader support (proper role attributes, semantic HTML)
- WCAG 2.1 Level AA compliance

**Implementation Notes**:
- Use database providers (276 exist) - no need to create test data
- Consider axe-core or pa11y for automated checks
- Requires manual testing with screen readers (NVDA, JAWS, VoiceOver)
- May warrant separate test suite due to different focus/tooling

**Resources**:
- [Playwright Accessibility Testing](https://playwright.dev/docs/accessibility-testing)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core Playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)
