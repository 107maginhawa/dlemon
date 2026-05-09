/**
 * Root-level test setup for monorepo-wide `bun test` runs.
 *
 * Registers happy-dom globals (window, document, navigator, etc.) so
 * React Testing Library component tests work when run from the repo root.
 * Wrapped in try/catch so backend tests (services/api-ts) that don't need
 * a DOM are unaffected.
 */
try {
  const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
  if (!GlobalRegistrator.isRegistered) {
    GlobalRegistrator.register({ url: 'http://localhost/' })
  }
} catch {
  // happy-dom not available in this context — backend tests don't need it
}
