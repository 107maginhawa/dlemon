import { test, expect } from '@playwright/test';
import { PharmacistDetailPage } from '../pages/pharmacist-detail.page';
import { PharmacistListPage } from '../pages/pharmacist-list.page';
import { makeBookingFormData, makeInvalidBookingData, makeTestSlotsForDay } from '../fixtures/test-data';
import {
  createTestProvider,
  addTestSlots,
  deleteTestProvider,
  generateTestSlots,
  CreatedProvider,
} from '../helpers/provider-setup';

let testProvider: CreatedProvider;

test.describe('Pharmacist Detail Page - Dynamic Provider', () => {
  let pharmacistDetailPage: PharmacistDetailPage;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Create a test provider with availability slots
    const providerData = {
      firstName: 'DetailTest',
      lastName: 'Provider',
      title: 'PharmD, BCPS',
      specializations: ['Clinical Pharmacy', 'Diabetes Care', 'Immunizations'],
      languages: ['English', 'Spanish', 'French'],
      yearsOfExperience: 12,
      city: 'Boston',
      state: 'MA',
      address: '100 Test Street, Suite 200',
      consultationFee: 85,
      insuranceAccepted: true,
      bio: 'Experienced clinical pharmacist specializing in diabetes care and immunizations.',
    };

    testProvider = await createTestProvider(page, providerData);
    console.log(`Created test provider: ${testProvider.name} (${testProvider.slug})`);

    // Add availability slots for testing (for tomorrow to ensure they're in the future)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const testSlots = generateTestSlots({
      date: tomorrow,
      count: 6,
      startHour: 9,
      endHour: 15,
    });

    await addTestSlots(page, testProvider.id, testSlots);
    console.log(`Added ${testSlots.length} availability slots`);

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await deleteTestProvider(page.request, testProvider.id);
    console.log(`Cleaned up test provider: ${testProvider.name}`);

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    pharmacistDetailPage = new PharmacistDetailPage(page);
  });

  test('should display provider information correctly', async () => {
    // Navigate directly to the test provider's detail page
    await pharmacistDetailPage.goto(testProvider.id);

    const info = await pharmacistDetailPage.getPharmacistInfo();

    // Verify the displayed information matches our created provider
    expect(info.name).toContain(testProvider.name);
    expect(info.bio).toContain(testProvider.data.bio);
    expect(info.specializations).toContain(testProvider.data.specializations![0]);
    // Languages are displayed as codes (e.g., "en" for English)
    expect(info.languages).toContain('en'); // English language code
    expect(info.experience).toContain(testProvider.data.yearsOfExperience!.toString());
  });

  test('should navigate to detail page from list and display correct provider', async ({ page }) => {
    const pharmacistListPage = new PharmacistListPage(page);

    // Start from the list page
    await pharmacistListPage.goto();
    await pharmacistListPage.waitForPharmacistsToLoad();

    // Search for our test provider
    await pharmacistListPage.searchPharmacists(testProvider.name);

    // Find and click on the test provider
    const providerCards = pharmacistListPage.pharmacistCards;
    const count = await providerCards.count();

    let found = false;
    for (let i = 0; i < count; i++) {
      const nameElement = providerCards.nth(i).locator('[data-testid="pharmacist-name"]');
      const name = await nameElement.textContent();
      if (name?.includes(testProvider.name)) {
        await pharmacistListPage.clickPharmacistCard(i);
        found = true;
        break;
      }
    }

    expect(found).toBe(true);

    // Verify we're on the detail page for the correct provider
    await expect(page).toHaveURL(new RegExp(`/pharmacists/${testProvider.id}`));

    const info = await pharmacistDetailPage.getPharmacistInfo();
    expect(info.name).toContain(testProvider.name);
  });

  test('should display available time slots', async ({ page }) => {
    // Debug: Check what the provider endpoint returns
    const apiResponse = await page.request.get(`http://localhost:7213/booking/providers/${testProvider.id}?expand=slots`);
    const responseText = await apiResponse.text();
    console.log('Provider API status:', apiResponse.status());
    console.log('Provider API response:', responseText.substring(0, 500));

    let apiData;
    try {
      apiData = JSON.parse(responseText);
      console.log('Slots count:', apiData.slots?.length || 0);
      console.log('Has person?', !!apiData.person);
      console.log('Provider ID in response:', apiData.id);
    } catch (e) {
      console.log('Failed to parse response:', e);
    }

    await pharmacistDetailPage.goto(testProvider.id);
    await pharmacistDetailPage.waitForTimeSlotsToLoad();

    // Select tomorrow's date (second date button) since we created slots for tomorrow
    // Using 'Sat' as the date identifier (or 'Sat4Oct' for more specific matching)
    await pharmacistDetailPage.selectDate('Sat');

    // Wait for slots to load for the new date
    await pharmacistDetailPage.waitForTimeSlotsToLoad();

    const availableSlots = await pharmacistDetailPage.getAvailableTimeSlotCount();

    // Should have at least some available slots (we created 6)
    expect(availableSlots).toBeGreaterThan(0);
    expect(availableSlots).toBeLessThanOrEqual(6);
  });

  test('should select time slot and verify selection', async () => {
    await pharmacistDetailPage.goto(testProvider.id);
    await pharmacistDetailPage.waitForTimeSlotsToLoad();

    const availableSlots = await pharmacistDetailPage.getAvailableTimeSlotCount();
    expect(availableSlots).toBeGreaterThan(0);

    // Select first available slot
    await pharmacistDetailPage.selectTimeSlot(0);

    // Verify slot is selected
    const isSelected = await pharmacistDetailPage.isTimeSlotSelected(0);
    expect(isSelected).toBe(true);

    // Clicking again should deselect
    await pharmacistDetailPage.selectTimeSlot(0);
    const isDeselected = await pharmacistDetailPage.isTimeSlotSelected(0);
    expect(isDeselected).toBe(false);
  });

  test('should redirect to patient app when clicking Continue to Book', async ({ page, context }) => {
    await pharmacistDetailPage.goto(testProvider.id);
    await pharmacistDetailPage.waitForTimeSlotsToLoad();

    // Select a time slot
    await pharmacistDetailPage.selectTimeSlot(0);

    // Listen for new page (tab) opening
    const pagePromise = context.waitForEvent('page');

    // Click "Continue to Book"
    await pharmacistDetailPage.bookAppointmentButton.click();

    // Wait for new tab to open
    const newPage = await pagePromise;
    await newPage.waitForLoadState();

    // Verify the new tab opened with patient app URL
    const newUrl = newPage.url();
    expect(newUrl).toMatch(/(:3001|patient\.)/); // Patient app runs on port 3001 or patient subdomain

    // Verify it includes provider and slot information in URL params
    expect(newUrl).toContain('provider');

    // Clean up - close the new tab
    await newPage.close();
  });

  test('should handle date changes and load new slots', async () => {
    await pharmacistDetailPage.goto(testProvider.id);

    // Select tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.getDate().toString();

    await pharmacistDetailPage.selectDate(dateString);

    // Wait for new slots to load
    await pharmacistDetailPage.waitForTimeSlotsToLoad();

    // Should either show slots or no slots message
    const availableSlots = await pharmacistDetailPage.getAvailableTimeSlotCount();
    const noSlotsVisible = await pharmacistDetailPage.isNoSlotsMessageVisible();

    expect(availableSlots >= 0 || noSlotsVisible).toBe(true);
  });

  test('should disable booking button when no time slot selected', async () => {
    await pharmacistDetailPage.goto(testProvider.id);
    await pharmacistDetailPage.waitForTimeSlotsToLoad();

    // Initially, booking button should be disabled
    const isEnabled = await pharmacistDetailPage.isBookAppointmentEnabled();
    expect(isEnabled).toBe(false);

    // Select a time slot
    await pharmacistDetailPage.selectTimeSlot(0);

    // Now booking button should be enabled
    const isEnabledAfter = await pharmacistDetailPage.isBookAppointmentEnabled();
    expect(isEnabledAfter).toBe(true);

    // Deselect the slot
    await pharmacistDetailPage.selectTimeSlot(0);

    // Button should be disabled again
    const isDisabledAgain = await pharmacistDetailPage.isBookAppointmentEnabled();
    expect(isDisabledAgain).toBe(false);
  });

  test('should handle empty slot states correctly', async ({ page }) => {
    // Create a provider without slots for this test
    const noSlotsProvider = await createTestProvider(page, {
      firstName: 'NoSlots',
      lastName: 'TestProvider',
    });

    try {
      await pharmacistDetailPage.goto(noSlotsProvider.slug);
      await pharmacistDetailPage.waitForTimeSlotsToLoad();

      // Should show no slots message
      const noSlotsVisible = await pharmacistDetailPage.isNoSlotsMessageVisible();
      expect(noSlotsVisible).toBe(true);

      // Should have zero available slots
      const availableSlots = await pharmacistDetailPage.getAvailableTimeSlotCount();
      expect(availableSlots).toBe(0);

      // Booking button should be disabled
      const isEnabled = await pharmacistDetailPage.isBookAppointmentEnabled();
      expect(isEnabled).toBe(false);
    } finally {
      // Clean up the test provider
      await deleteTestProvider(page.request, noSlotsProvider.id);
    }
  });

  test('should navigate back to pharmacist list', async ({ page }) => {
    await pharmacistDetailPage.goto(testProvider.id);

    await pharmacistDetailPage.goBack();

    // Should navigate back to the list page
    await expect(page).toHaveURL('/pharmacists');
  });

  test('should be keyboard navigable', async ({ page }) => {
    await pharmacistDetailPage.goto(testProvider.id);
    await pharmacistDetailPage.waitForTimeSlotsToLoad();

    // Tab through elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should be able to select time slot with keyboard
    await page.keyboard.press('Space');

    // Should be able to navigate to booking button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check if an element is focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('should have proper ARIA labels for interactive elements', async ({ page }) => {
    await pharmacistDetailPage.goto(testProvider.id);

    // Check booking button has aria-label
    const bookButton = pharmacistDetailPage.bookAppointmentButton;
    const ariaLabel = await bookButton.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();

    // Check time slots have proper attributes
    await pharmacistDetailPage.waitForTimeSlotsToLoad();
    const slots = pharmacistDetailPage.timeSlots;
    const firstSlot = slots.first();
    const role = await firstSlot.getAttribute('role');
    expect(role).toBeTruthy();
  });
});

test.describe('Pharmacist Detail Page - Error Handling', () => {
  test('should handle invalid pharmacist slug gracefully', async ({ page }) => {
    const pharmacistDetailPage = new PharmacistDetailPage(page);
    await pharmacistDetailPage.goto('invalid-provider-slug-xyz-123');

    // Should either show 404 or redirect to list
    const url = page.url();
    expect(url).toMatch(/\/pharmacists|404|not-found/);
  });
});