import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts', // Only run .spec.ts files (E2E tests)

  // AI Agent Optimizations
  maxFailures: process.env.CI ? 0 : 0, // Run all tests to see full picture
  fullyParallel: false, // Sequential execution for predictable debugging
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, // Single retry in CI, none locally
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