# ADR-003: Session Expiry Behavior

**Status**: Accepted  
**Date**: 2026-05-08  
**Context**: V2 Audit Gate #5 — 7-day server session was configured but frontend behavior on expiry was undefined. Expired sessions silently caused broken UI with no redirect or user feedback.

---

## Decision

Add a 401 response interceptor in the SDK client (`packages/sdk-ts/src/react/provider.tsx`) that redirects to the sign-in page when the cloud session expires. The interceptor clears the PIN session before redirecting.

---

## Current State (Before Fix)

### Server

- Session duration: 7 days (`services/api-ts/src/core/config.ts:142` — `sessionExpiresIn = 60*60*24*7`)
- Storage: `storeSessionInDatabase: true` (`services/api-ts/src/core/auth.ts:244`)
- Cleanup: `cleanupAfter: '7d'`
- Revoking a session in the DB causes **immediate 401** on next request

### Frontend (Before)

1. API returns 401 (session expired or revoked)
2. hey-api client throws as non-ok response
3. `errorInterceptor` wraps into `SdkError { status: 401 }`
4. TanStack Query `shouldRetry` returns `false` for 4xx errors
5. **Query enters error state. User sees: broken/empty UI. No redirect. No toast.**

The only 401 handling was `if (error.status === 401) return false` in `app.tsx:39` — which suppresses retry but does nothing else.

### PIN Session (Separate Concern)

`apps/dentalemon/src/utils/pin-session.ts` manages a 5-minute in-memory inactivity session for staff PIN auth. This is entirely separate from the cloud session. A cloud 401 means the PIN session should also be cleared (PIN operations depend on the cloud session being valid).

---

## Implementation

### Interceptor Registration

**File**: `packages/sdk-ts/src/react/provider.tsx`

Add a response interceptor alongside the existing error interceptor (line 124). Use `interceptors.response.use` (NOT `interceptors.error.use`) — response interceptors run **before** the error path, allowing us to inspect every response including 401s.

```typescript
// Module-level dedup flag — prevents thundering herd (N concurrent 401s → 1 redirect)
let sessionExpiredRedirecting = false;

// In ApiProvider, alongside errorInterceptor registration:
if (!interceptorInstalledRef.current) {
  generatedClient.interceptors.error.use(errorInterceptor);

  generatedClient.interceptors.response.use((response, request) => {
    if (response.status === 401 && !sessionExpiredRedirecting) {
      const url = new URL(request.url);
      // Skip auth endpoints — 401 is expected on login/signup paths
      if (!url.pathname.startsWith('/api/auth/')) {
        sessionExpiredRedirecting = true;
        // Clear PIN session — cloud session gone means PIN is also invalid
        import('@/utils/pin-session').then(({ pinSession }) => pinSession.clearSession());
        window.location.assign('/auth/sign-in?session_expired=1');
      }
    }
    return response;
  });

  interceptorInstalledRef.current = true;
}
```

### Edge Cases

| Scenario | Handling |
|----------|----------|
| N concurrent 401s (thundering herd) | `sessionExpiredRedirecting` flag deduplicates — only one redirect |
| 401 on `/api/auth/*` paths | Skipped — expected on login/signup flows |
| Tauri/embedded mode | `window.location.assign` is safe in Tauri WebView; if IPC-only mode is added, guard with `isTauriEmbeddedIPC()` |
| PIN session on 401 | Cleared before redirect — cloud session expiry invalidates PIN session |
| Better-Auth session refresh | Better-Auth does not auto-refresh on 401 in this configuration — redirect is correct |

### Sign-In Page

The sign-in page should detect `?session_expired=1` and display: "Your session has expired. Please sign in again."

### Reset on Successful Auth

`sessionExpiredRedirecting` is a module-level flag. It resets automatically when the page reloads after redirect (module re-initializes).

---

## iPad / Clinical Workflow Consideration

For mid-visit forms on iPad, a hard redirect may cause data loss. **Deferred to Phase 5**: show a modal "Session expired — sign in to continue" that allows the user to sign in via a popup and resume without losing form state.

---

## Consequences

- Users with expired sessions are redirected to sign-in (immediate, visible feedback)
- No data auto-save before redirect (Phase 5 concern)
- PIN session is cleared — staff must re-select and re-enter PIN after cloud sign-in
- The `sessionExpiredRedirecting` flag is not reset between SPA navigations within a session — this is fine because a 401 indicates the session is truly invalid
