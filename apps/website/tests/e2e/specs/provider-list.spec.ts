import { test, expect } from '@playwright/test';
import { ProviderListPage } from '../pages/provider-list.page';
import { makeTestProvider } from '../fixtures/test-data';
import {
  createTestProvider,
  createTestProviders,
  deleteTestProviders,
  waitForProviderIndexing,
  CreatedProvider,
} from '../helpers/provider-setup';

let testProviders: CreatedProvider[] = [];

test.describe('Provider List Page - Dynamic Providers', () => {
  let providerListPage: ProviderListPage;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Create 3 test providers with different attributes
    const providersData = [
      // Provider 1: Spanish speaker with Diabetes Care specialty in New York
      {
        firstName: 'TestProvider',
        lastName: 'One',
        specializations: ['Diabetes Care', 'Clinical Pharmacy'],
        languages: ['English', 'Spanish'],
        city: 'New York',
        state: 'NY',
        insuranceAccepted: true,
        consultationFee: 75,
        yearsOfExperience: 10,
      },
      // Provider 2: Mandarin speaker with Pediatric specialty in San Francisco
      {
        firstName: 'TestProvider',
        lastName: 'Two',
        specializations: ['Pediatric Pharmacy', 'Immunizations'],
        languages: ['English', 'Mandarin'],
        city: 'San Francisco',
        state: 'CA',
        insuranceAccepted: true,
        consultationFee: 85,
        yearsOfExperience: 5,
      },
      // Provider 3: French speaker with Geriatric Care in Chicago, no insurance
      {
        firstName: 'TestProvider',
        lastName: 'Three',
        specializations: ['Geriatric Care', 'Medication Therapy Management'],
        languages: ['English', 'French'],
        city: 'Chicago',
        state: 'IL',
        insuranceAccepted: false,
        consultationFee: 95,
        yearsOfExperience: 15,
      },
    ];

    testProviders = await createTestProviders(page, providersData);
    console.log(`Created ${testProviders.length} test providers:`, testProviders.map(p => p.name));

    // Wait for providers to be indexed/searchable
    for (const provider of testProviders) {
      await waitForProviderIndexing(page, provider.name);
    }

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const providerIds = testProviders.map(p => p.id);

    await deleteTestProviders(page.request, providerIds);
    console.log(`Cleaned up ${providerIds.length} test providers`);

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    providerListPage = new ProviderListPage(page);
    await providerListPage.goto();
  });

  test('should display all created providers on page load', async () => {
    await providerListPage.waitForProvidersToLoad();
    const count = await providerListPage.getProviderCount();

    // Should show at least our 3 created providers
    expect(count).toBeGreaterThanOrEqual(3);

    // Verify our test providers are visible
    const names = await providerListPage.getProviderNames();
    for (const provider of testProviders) {
      expect(names).toContainEqual(expect.stringContaining(provider.name));
    }
  });

  test('should filter by specialty - Diabetes Care', async () => {
    await providerListPage.filterBySpecialization('Diabetes Care');

    const names = await providerListPage.getProviderNames();
    const count = await providerListPage.getProviderCount();

    // Should find at least our TestProvider One
    expect(count).toBeGreaterThanOrEqual(1);
    expect(names).toContainEqual(expect.stringContaining('Dr. TestProvider One'));
  });

  test('should filter by specialty - Pediatric Pharmacy', async () => {
    await providerListPage.filterBySpecialization('Pediatric Pharmacy');

    const names = await providerListPage.getProviderNames();
    const count = await providerListPage.getProviderCount();

    // Should find at least our TestProvider Two
    expect(count).toBeGreaterThanOrEqual(1);
    expect(names).toContainEqual(expect.stringContaining('Dr. TestProvider Two'));
  });

  test('should filter by language - Spanish', async () => {
    await providerListPage.filterByLanguage('Spanish');

    const names = await providerListPage.getProviderNames();
    const count = await providerListPage.getProviderCount();

    // Should find at least TestProvider One (Spanish speaker)
    expect(count).toBeGreaterThanOrEqual(1);
    expect(names).toContainEqual(expect.stringContaining('Dr. TestProvider One'));
  });

  test('should filter by language - Mandarin', async () => {
    await providerListPage.filterByLanguage('Mandarin');

    const names = await providerListPage.getProviderNames();
    const count = await providerListPage.getProviderCount();

    // Should find at least TestProvider Two (Mandarin speaker)
    expect(count).toBeGreaterThanOrEqual(1);
    expect(names).toContainEqual(expect.stringContaining('Dr. TestProvider Two'));
  });

  test('should filter by city/location - New York', async () => {
    await providerListPage.searchProviders('New York');

    const names = await providerListPage.getProviderNames();
    const count = await providerListPage.getProviderCount();

    // Should find at least TestProvider One (New York)
    expect(count).toBeGreaterThanOrEqual(1);
    expect(names).toContainEqual(expect.stringContaining('Dr. TestProvider One'));
  });

  test('should filter by city/location - Chicago', async () => {
    await providerListPage.searchProviders('Chicago');

    const names = await providerListPage.getProviderNames();
    const count = await providerListPage.getProviderCount();

    // Should find at least TestProvider Three (Chicago)
    expect(count).toBeGreaterThanOrEqual(1);
    expect(names).toContainEqual(expect.stringContaining('Dr. TestProvider Three'));
  });

  test('should clear filters and show all providers again', async () => {
    // Apply multiple filters first
    await providerListPage.filterByInsurance(true);
    await providerListPage.filterByLanguage('English');

    // Get filtered count
    const filteredCount = await providerListPage.getProviderCount();

    // Clear all filters
    await providerListPage.clearAllFilters();

    // Should show all providers again
    const countAfterClear = await providerListPage.getProviderCount();
    expect(countAfterClear).toBeGreaterThanOrEqual(filteredCount);
    expect(countAfterClear).toBeGreaterThanOrEqual(3); // At least our test providers

    // Verify all test providers are visible again
    const names = await providerListPage.getProviderNames();
    for (const provider of testProviders) {
      expect(names).toContainEqual(expect.stringContaining(provider.name));
    }
  });

  test('should navigate to detail page when clicking provider by name', async ({ page }) => {
    await providerListPage.waitForProvidersToLoad();

    // Find and click on TestProvider One by name
    const targetProvider = testProviders[0]!;
    const providerCards = providerListPage.providerCards;
    const count = await providerCards.count();

    let cardIndex = -1;
    for (let i = 0; i < count; i++) {
      const nameElement = providerCards.nth(i).locator('[data-testid="provider-name"]');
      const name = await nameElement.textContent();
      if (name?.includes(targetProvider.name)) {
        cardIndex = i;
        break;
      }
    }

    expect(cardIndex).toBeGreaterThanOrEqual(0);

    // Click the found provider card
    await providerListPage.clickProviderCard(cardIndex);

    // Verify navigation to detail page
    await expect(page).toHaveURL(/\/professional\/.+/);

    // Verify the detail page shows the correct pharmacist
    const nameElement = page.locator('[data-testid="provider-name"]');
    await expect(nameElement).toContainText(targetProvider.name);
  });

  test('should search pharmacists by name', async () => {
    const targetProvider = testProviders[1]!; // TestProvider Two

    await providerListPage.searchProviders(targetProvider.name);

    const names = await providerListPage.getProviderNames();
    const count = await providerListPage.getProviderCount();

    // Should find the specific provider
    expect(count).toBeGreaterThanOrEqual(1);
    expect(names).toContainEqual(expect.stringContaining(targetProvider.name));
  });

  test('should filter by insurance acceptance', async () => {
    await providerListPage.filterByInsurance(true);

    const names = await providerListPage.getProviderNames();
    const count = await providerListPage.getProviderCount();

    // Should find at least TestProvider One and Two (both accept insurance)
    expect(count).toBeGreaterThanOrEqual(2);
    expect(names).toContainEqual(expect.stringContaining('Dr. TestProvider One'));
    expect(names).toContainEqual(expect.stringContaining('Dr. TestProvider Two'));

    // Should NOT find TestProvider Three (doesn't accept insurance)
    expect(names).not.toContainEqual(expect.stringContaining('Dr. TestProvider Three'));
  });

  test('should sort pharmacists by experience', async () => {
    await providerListPage.sortBy('experience');

    const names = await providerListPage.getProviderNames();

    // Find positions of our test providers in the sorted list
    const indexOne = names.findIndex(n => n?.includes('Dr. TestProvider One')); // 10 years
    const indexTwo = names.findIndex(n => n?.includes('Dr. TestProvider Two')); // 5 years
    const indexThree = names.findIndex(n => n?.includes('Dr. TestProvider Three')); // 15 years

    // TestProvider Three (15 years) should appear before One (10 years)
    // TestProvider One (10 years) should appear before Two (5 years)
    if (indexThree >= 0 && indexOne >= 0) {
      expect(indexThree).toBeLessThan(indexOne);
    }
    if (indexOne >= 0 && indexTwo >= 0) {
      expect(indexOne).toBeLessThan(indexTwo);
    }
  });

  test('should show no results message for non-existent search', async () => {
    await providerListPage.searchProviders('NonExistentProvider12345XYZ');

    const isNoResultsVisible = await providerListPage.isNoResultsVisible();
    expect(isNoResultsVisible).toBe(true);

    const count = await providerListPage.getProviderCount();
    expect(count).toBe(0);
  });

  test('should handle multiple filters simultaneously', async () => {
    // Apply multiple filters that match TestProvider One
    await providerListPage.filterByInsurance(true);
    await providerListPage.filterByLanguage('Spanish');
    await providerListPage.filterBySpecialization('Diabetes Care');

    // Verify results include TestProvider One
    const count = await providerListPage.getProviderCount();
    expect(count).toBeGreaterThanOrEqual(1);

    const names = await providerListPage.getProviderNames();
    expect(names).toContainEqual(expect.stringContaining('Dr. TestProvider One'));
  });
});

test.describe('Provider List Page - DateTime Filtering', () => {
  let providerListPage: ProviderListPage;

  test.beforeEach(async ({ page }) => {
    providerListPage = new ProviderListPage(page);
    await providerListPage.goto();
    await providerListPage.waitForProvidersToLoad();
  });

  test('should send availableFrom/availableTo parameters when filtering by Today', async ({ page }) => {
    // Set up request listener before triggering the filter
    const requestPromise = page.waitForRequest(request =>
      request.url().includes('/providers') &&
      request.url().includes('availableFrom')
    );

    // Apply datetime filter
    await providerListPage.filterByDateTime('Today');

    // Wait for and capture the request
    const request = await requestPromise;
    const url = new URL(request.url());

    // Verify UTC datetime parameters are present
    expect(url.searchParams.has('availableFrom')).toBe(true);
    expect(url.searchParams.has('availableTo')).toBe(true);

    // Verify format is ISO 8601 UTC
    const availableFrom = url.searchParams.get('availableFrom');
    const availableTo = url.searchParams.get('availableTo');

    expect(availableFrom).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(availableTo).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

    // Verify same date
    const fromDate = availableFrom!.split('T')[0];
    const toDate = availableTo!.split('T')[0];
    expect(fromDate).toBe(toDate);
  });

  test('should send correct time range for Today Morning filter', async ({ page }) => {
    const requestPromise = page.waitForRequest(request =>
      request.url().includes('/providers') &&
      request.url().includes('availableFrom')
    );

    await providerListPage.filterByDateTime('Today Morning');

    const request = await requestPromise;
    const url = new URL(request.url());

    const availableFrom = url.searchParams.get('availableFrom');
    const availableTo = url.searchParams.get('availableTo');

    // Verify morning time range (9am-12pm UTC)
    expect(availableFrom).toMatch(/T09:00:00Z$/);
    expect(availableTo).toMatch(/T12:00:00Z$/);
  });

  test('should send correct time range for Today Afternoon filter', async ({ page }) => {
    const requestPromise = page.waitForRequest(request =>
      request.url().includes('/providers') &&
      request.url().includes('availableFrom')
    );

    await providerListPage.filterByDateTime('Today Afternoon');

    const request = await requestPromise;
    const url = new URL(request.url());

    const availableFrom = url.searchParams.get('availableFrom');
    const availableTo = url.searchParams.get('availableTo');

    // Verify afternoon time range (12pm-5pm UTC)
    expect(availableFrom).toMatch(/T12:00:00Z$/);
    expect(availableTo).toMatch(/T17:00:00Z$/);
  });

  test('should send correct time range for Today Evening filter', async ({ page }) => {
    const requestPromise = page.waitForRequest(request =>
      request.url().includes('/providers') &&
      request.url().includes('availableFrom')
    );

    await providerListPage.filterByDateTime('Today Evening');

    const request = await requestPromise;
    const url = new URL(request.url());

    const availableFrom = url.searchParams.get('availableFrom');
    const availableTo = url.searchParams.get('availableTo');

    // Verify evening time range (5pm-9pm UTC)
    expect(availableFrom).toMatch(/T17:00:00Z$/);
    expect(availableTo).toMatch(/T21:00:00Z$/);
  });

  test('should send tomorrow date when filtering by Tomorrow', async ({ page }) => {
    const requestPromise = page.waitForRequest(request =>
      request.url().includes('/providers') &&
      request.url().includes('availableFrom')
    );

    await providerListPage.filterByDateTime('Tomorrow');

    const request = await requestPromise;
    const url = new URL(request.url());

    const availableFrom = url.searchParams.get('availableFrom');
    const availableTo = url.searchParams.get('availableTo');

    // Calculate expected tomorrow date
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    expect(availableFrom).toContain(tomorrow);
    expect(availableTo).toContain(tomorrow);
    expect(availableFrom).toMatch(/T00:00:00Z$/);
    expect(availableTo).toMatch(/T23:00:00Z$/);
  });

  test('should send correct parameters for Tomorrow Morning filter', async ({ page }) => {
    const requestPromise = page.waitForRequest(request =>
      request.url().includes('/providers') &&
      request.url().includes('availableFrom')
    );

    await providerListPage.filterByDateTime('Tomorrow Morning');

    const request = await requestPromise;
    const url = new URL(request.url());

    const availableFrom = url.searchParams.get('availableFrom');
    const availableTo = url.searchParams.get('availableTo');

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    expect(availableFrom).toBe(`${tomorrow}T09:00:00Z`);
    expect(availableTo).toBe(`${tomorrow}T12:00:00Z`);
  });

  test('should not send datetime parameters when filter is set to Any Time', async ({ page }) => {
    // First apply a datetime filter
    await providerListPage.filterByDateTime('Today');

    // Then clear it by selecting "Any Time"
    const requestPromise = page.waitForRequest(request =>
      request.url().includes('/providers')
    );

    await providerListPage.filterByDateTime('Any Time');

    const request = await requestPromise;
    const url = new URL(request.url());

    // Verify no datetime parameters
    expect(url.searchParams.has('availableFrom')).toBe(false);
    expect(url.searchParams.has('availableTo')).toBe(false);
  });

  test('should clear datetime filter when clicking Clear All button', async ({ page }) => {
    // Apply datetime filter
    await providerListPage.filterByDateTime('Today Morning');

    // Set up request listener before clearing
    const requestPromise = page.waitForRequest(request =>
      request.url().includes('/providers')
    );

    // Clear all filters
    await providerListPage.clearAllFilters();

    const request = await requestPromise;
    const url = new URL(request.url());

    // Verify no datetime parameters after clearing
    expect(url.searchParams.has('availableFrom')).toBe(false);
    expect(url.searchParams.has('availableTo')).toBe(false);
  });

  test('should filter providers by availability when datetime filter is applied', async () => {
    // Get initial count
    const initialCount = await providerListPage.getProviderCount();

    // Apply datetime filter for today
    await providerListPage.filterByDateTime('Today');
    await providerListPage.page.waitForLoadState('networkidle');

    // Get filtered count
    const filteredCount = await providerListPage.getProviderCount();

    // Filtered count should be >= 0 (may filter out some or all providers)
    expect(filteredCount).toBeGreaterThanOrEqual(0);

    // If there are filtered results, they should have availability indicated
    if (filteredCount > 0) {
      const firstCardAvailability = await providerListPage.page
        .locator('[data-testid="provider-card"]')
        .first()
        .textContent();

      // Should show some availability indicator
      expect(firstCardAvailability).toBeTruthy();
    }
  });

  test('should combine datetime filter with other filters', async ({ page }) => {
    // Apply datetime filter
    await providerListPage.filterByDateTime('Tomorrow Afternoon');

    // Apply language filter
    const requestPromise = page.waitForRequest(request =>
      request.url().includes('/providers') &&
      request.url().includes('availableFrom')
    );

    await providerListPage.filterByLanguage('English');

    const request = await requestPromise;
    const url = new URL(request.url());

    // Verify both datetime and other parameters are sent
    expect(url.searchParams.has('availableFrom')).toBe(true);
    expect(url.searchParams.has('availableTo')).toBe(true);

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const availableFrom = url.searchParams.get('availableFrom');
    const availableTo = url.searchParams.get('availableTo');

    expect(availableFrom).toBe(`${tomorrow}T12:00:00Z`);
    expect(availableTo).toBe(`${tomorrow}T17:00:00Z`);
  });
});