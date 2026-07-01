import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts', // Only run .spec.ts files (E2E tests)

  // AI Agent Optimizations
  maxFailures: process.env.CI ? 0 : 0, // Run all tests to see full picture
  fullyParallel: false, // Sequential execution for predictable debugging
  forbidOnly: !!process.env.CI,
  // Single retry everywhere. The self-seed specs drive a real signup → email-verify
  // → onboarding flow whose client redirects + heavy DOM are timing/resource
  // sensitive (a loaded dev machine can even OS-kill the browser mid-flow). One
  // retry self-heals those transient failures without hiding deterministic bugs
  // (a real break fails both attempts). Matches CI.
  retries: 1,
  workers: 1, // Single worker for consistent execution order
  
  // Reporting optimized for AI parsing
  reporter: process.env.CI 
    ? [['json', { outputFile: 'test-results.json' }], ['github']]
    : [
        ['json', { outputFile: 'test-results.json' }],
        ['line'], // Minimal console output
        ['html', { open: 'never' }] // Generate but don't auto-open
      ],
  
  // Faster timeouts for quicker feedback
  timeout: 30000, // 30s per test
  expect: {
    timeout: 10000 // 10s for assertions
  },
  
  use: {
    baseURL: 'http://localhost:3003',

    // Pin the browser to the clinic's timezone (the seed onboards branches as
    // 'Asia/Manila'). Without this, time-of-day the test types into the UI is
    // interpreted in the RUNNER's local tz: on a UTC CI runner "10:00" becomes
    // 10:00Z = 18:00 Manila, which the working-hours validator (createAppointment
    // checks startAt against branch.timezone) rejects as OUTSIDE_WORKING_HOURS —
    // a 422 that left J17's appointment modal open. Pinning makes the wall-clock
    // the test types match the clinic hours in CI and locally alike.
    timezoneId: 'Asia/Manila',

    // Smart artifact capture - only on failure for debugging
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Reasonable timeouts for faster failure detection
    actionTimeout: 10000, // 10s for actions
    navigationTimeout: 30000, // 30s for navigation
  },
  
  // Output directory for test artifacts
  outputDir: './test-results',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Journeys are a separate audit harness (need `bun run db:reseed`); they run
      // via the dedicated `journeys` project / `bun run test:journeys`, not the
      // default E2E sweep. (Playwright 1.59 removed the old `--ignore-glob` CLI flag,
      // so the exclusion lives here in config.)
      testIgnore: '**/journeys/**',
    },
    {
      name: 'ipad-portrait',
      use: { ...devices['iPad (gen 7)'], viewport: { width: 1024, height: 768 } },
      testMatch: '**/ipad-*.spec.ts',
    },
    {
      name: 'ipad-landscape',
      use: { ...devices['iPad (gen 7) landscape'], viewport: { width: 1366, height: 1024 } },
      testMatch: '**/ipad-*.spec.ts',
    },
    {
      name: 'journeys',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/journeys/**/*.spec.ts',
    },
  ],

  // Boot BOTH the API (services/api-ts on :7213) and the web app (:3003) so
  // `bun run test:e2e` runs the full stack with one command. Imaging specs mock
  // the API via page.route and ignore the live one; the self-seed specs (perio,
  // reminders, recall, insurance, voice) drive the real API. reuseExistingServer
  // locally so an already-running dev server / API is reused instead of re-spawned.
  webServer: [
    {
      command: 'bun run dev',
      cwd: '../../services/api-ts',
      url: 'http://localhost:7213/livez',
      // Always reuse an already-running API. The journey-verification CI job
      // boots api-ts itself (so it can seed before the specs run); without this
      // Playwright would try to spawn a second api-ts on :7213 and fail with
      // "address already in use". When no API is running (the e2e job) Playwright
      // still boots one, so this is safe in both jobs and locally.
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
    {
      command: 'bun run dev',
      url: 'http://localhost:3003',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
})