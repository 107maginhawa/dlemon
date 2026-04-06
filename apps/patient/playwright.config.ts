import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts', // Only run .spec.ts files (E2E tests)

  // AI Agent Optimizations
  maxFailures: process.env.CI ? 0 : 1, // Exit on first failure for immediate feedback
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
    baseURL: 'http://localhost:3002',
    
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
    },
    // Simplified to single project for faster execution
    // Uncomment for mobile testing
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 7'] },
    // },
  ],

  // Temporarily disabled - manually start dev server or rely on existing one
  // webServer: {
  //   command: 'bun run dev --port 3002',
  //   url: 'http://localhost:3002',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
})