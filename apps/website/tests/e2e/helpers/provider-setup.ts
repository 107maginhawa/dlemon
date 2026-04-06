import { Page, APIRequestContext } from '@playwright/test';
import { faker } from '@faker-js/faker';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:7213';

// TypeScript interfaces for test data
export interface TestProviderData {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  specializations?: string[];
  yearsOfExperience?: number;
  languages?: string[];
  location?: string;
  city?: string;
  state?: string;
  address?: string;
  phone?: string;
  bio?: string;
  consultationFee?: number;
  insuranceAccepted?: boolean;
  npiNumber?: string;
  licenseNumber?: string;
  licenseState?: string;
}

export interface TestSlot {
  date: string;
  startTime: string;
  endTime: string;
  available?: boolean;
  slotType?: 'in-person' | 'telehealth' | 'both';
}

export interface CreatedProvider {
  id: string;
  email: string;
  password: string;
  name: string;
  slug: string;
  data: TestProviderData;
}

/**
 * Generate random provider data for testing
 */
export function generateProviderData(overrides?: Partial<TestProviderData>): TestProviderData {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    password: 'TestPassword123!',
    firstName,
    lastName,
    title: faker.helpers.arrayElement(['PharmD', 'PharmD, BCPS', 'PharmD, CGP', 'PharmD, BCACP']),
    specializations: faker.helpers.arrayElements([
      'Clinical Pharmacy',
      'Immunizations',
      'Diabetes Care',
      'Pediatric Pharmacy',
      'Compounding',
      'Geriatric Care',
      'Medication Therapy Management',
      'Oncology Pharmacy',
      'Psychiatric Pharmacy',
      'Cardiovascular Pharmacy',
    ], { min: 1, max: 3 }),
    yearsOfExperience: faker.number.int({ min: 1, max: 25 }),
    languages: faker.helpers.arrayElements([
      'English',
      'Spanish',
      'Mandarin',
      'Cantonese',
      'Portuguese',
      'French',
      'German',
      'Russian',
      'Arabic',
      'Hindi',
    ], { min: 1, max: 3 }),
    location: faker.location.city() + ', ' + faker.location.state({ abbreviated: true }),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    address: faker.location.streetAddress(),
    phone: '+1' + faker.string.numeric(10), // E.164 format: +1 followed by 10 digits
    bio: faker.lorem.paragraph({ min: 2, max: 3 }),
    consultationFee: faker.number.int({ min: 50, max: 150 }),
    insuranceAccepted: faker.datatype.boolean(),
    npiNumber: faker.string.numeric(10),
    licenseNumber: faker.string.alphanumeric(10).toUpperCase(),
    licenseState: faker.location.state({ abbreviated: true }),
    ...overrides
  };
}

/**
 * Generate test time slots
 */
export function generateTestSlots(options?: {
  date?: string;
  count?: number;
  startHour?: number;
  endHour?: number;
  duration?: number; // in minutes
}): TestSlot[] {
  const {
    count = 8,
    startHour = 9,
    endHour = 17,
    duration = 30
  } = options || {};
  
  const date: string = options?.date ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]!; // Tomorrow

  const slots: TestSlot[] = [];
  const slotsPerHour = 60 / duration;
  const totalPossibleSlots = (endHour - startHour) * slotsPerHour;
  const slotsToGenerate = Math.min(count, totalPossibleSlots);

  let currentHour = startHour;
  let currentMinute = 0;

  for (let i = 0; i < slotsToGenerate; i++) {
    const startTimeHour = currentHour.toString().padStart(2, '0');
    const startTimeMinute = currentMinute.toString().padStart(2, '0');

    currentMinute += duration;
    if (currentMinute >= 60) {
      currentMinute = 0;
      currentHour++;
    }

    const endTimeHour = currentHour.toString().padStart(2, '0');
    const endTimeMinute = currentMinute.toString().padStart(2, '0');

    slots.push({
      date,
      startTime: `${startTimeHour}:${startTimeMinute}`,
      endTime: `${endTimeHour}:${endTimeMinute}`,
      available: faker.datatype.boolean({ probability: 0.7 }), // 70% availability
      slotType: faker.helpers.arrayElement(['in-person', 'telehealth', 'both'])
    });
  }

  return slots;
}

/**
 * Create a test provider through the API (signup + profile creation)
 */
export async function createTestProvider(
  page: Page,
  providerData?: Partial<TestProviderData>
): Promise<CreatedProvider> {
  const data = generateProviderData(providerData);
  const fullName = `Dr. ${data.firstName} ${data.lastName}`;
  const slug = `${data.firstName}-${data.lastName}`.toLowerCase().replace(/\s+/g, '-');

  // Step 1: Sign up user via Better-Auth API
  const signupResponse = await page.request.post(`${API_BASE_URL}/auth/sign-up/email`, {
    data: {
      email: data.email!,
      password: data.password!,
      name: fullName,
    },
  });

  if (!signupResponse.ok()) {
    const errorBody = await signupResponse.text();
    throw new Error(`Failed to sign up user: ${signupResponse.status()} ${errorBody}`);
  }

  // Step 2: Sign in to get session cookies
  const signinResponse = await page.request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: {
      email: data.email!,
      password: data.password!,
    },
  });

  if (!signinResponse.ok()) {
    const errorBody = await signinResponse.text();
    throw new Error(`Failed to sign in user: ${signinResponse.status()} ${errorBody}`);
  }

  // Extract cookies from signin response
  const cookies = await page.context().cookies();

  // Step 3: Create provider profile via API (authenticated request)
  const providerPayload = {
    providerType: 'pharmacist' as const,
    person: {
      firstName: data.firstName!,
      lastName: data.lastName!,
      primaryAddress: {
        street1: data.address!,
        city: data.city!,
        state: data.state!,
        postalCode: faker.location.zipCode(),
        country: 'US' as const,
      },
      contactInfo: {
        email: data.email!,
        phone: data.phone!,
      },
      languagesSpoken: data.languages?.map(lang =>
        lang.toLowerCase().substring(0, 2) as any
      ),
    },
    yearsOfExperience: data.yearsOfExperience!,
    biography: data.bio!,
    minorAilmentsSpecialties: data.specializations,
    minorAilmentsPracticeLocations: [`${data.city}, ${data.state}`],
  };

  const providerResponse = await page.request.post(`${API_BASE_URL}/providers`, {
    data: providerPayload,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!providerResponse.ok()) {
    const errorBody = await providerResponse.text();
    throw new Error(`Failed to create provider: ${providerResponse.status()} ${errorBody}`);
  }

  const providerResult = await providerResponse.json();

  if (!providerResult.id) {
    throw new Error('Failed to create provider: No ID returned');
  }

  console.log('Created provider ID:', providerResult.id);
  console.log('Provider user ID:', providerResult.userId);

  return {
    id: providerResult.id,
    email: data.email!,
    password: data.password!,
    name: fullName,
    slug,
    data
  };
}

/**
 * Create multiple test providers
 */
export async function createTestProviders(
  page: Page,
  providersData: Partial<TestProviderData>[]
): Promise<CreatedProvider[]> {
  const providers: CreatedProvider[] = [];

  for (const data of providersData) {
    const provider = await createTestProvider(page, data);
    providers.push(provider);
  }

  return providers;
}

/**
 * Add availability slots to a provider via API
 */
export async function addTestSlots(
  page: Page,
  providerId: string,
  slots: TestSlot[]
): Promise<void> {
  if (slots.length === 0) {
    throw new Error('No slots provided');
  }

  // Group slots by day of week
  const dayMap = new Map<string, { start: string; end: string }[]>();

  // Sort slots by date and time
  const sortedSlots = [...slots].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.startTime.localeCompare(b.startTime);
  });

  for (const slot of sortedSlots) {
    const date = new Date(slot.date);
    const dayIndex = date.getDay();
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayKey = dayNames[dayIndex]!;

    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, []);
    }

    dayMap.get(dayKey)!.push({
      start: slot.startTime,
      end: slot.endTime
    });
  }

  // Build dailyConfigs with consolidated time ranges
  const dailyConfigs: Record<string, any> = {};

  for (const [day, slotTimes] of dayMap.entries()) {
    if (slotTimes.length === 0) continue;

    // Find the earliest start and latest end to create one time range
    const startTime = slotTimes[0]!.start;
    const endTime = slotTimes[slotTimes.length - 1]!.end;

    dailyConfigs[day] = {
      enabled: true,
      timeBlocks: [{
        startTime,
        endTime,
        slotDuration: 30,
        bufferTime: 0
      }]
    };
  }

  const bookingEventPayload = {
    dailyConfigs,
    timezone: 'America/New_York',
    locationTypes: ['video', 'in-person'] as const,
    maxBookingDays: 30,
  };

  console.log('Creating booking event with payload:', JSON.stringify(bookingEventPayload, null, 2));

  const response = await page.request.post(`${API_BASE_URL}/booking/events`, {
    data: bookingEventPayload,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  console.log('Booking event response status:', response.status());
  const responseBody = await response.text();
  console.log('Booking event response body:', responseBody);

  if (!response.ok()) {
    throw new Error(`Failed to create booking events: ${response.status()} ${responseBody}`);
  }

  let bookingEvent;
  try {
    bookingEvent = JSON.parse(responseBody);
  } catch (e) {
    console.error('Failed to parse booking event response:', e);
  }

  // Wait a bit for slots to be generated
  await page.waitForTimeout(2000);

  // Verify slots were actually generated
  const slotsResponse = await page.request.get(
    `${API_BASE_URL}/booking/providers/${providerId}?expand=slots`
  );
  const slotsData = await slotsResponse.json();
  console.log(`Slots generated: ${slotsData.slots?.length || 0} slots`);

  if (!slotsData.slots || slotsData.slots.length === 0) {
    console.error('WARNING: No slots were generated!');
    console.error('Booking event ID:', bookingEvent?.id);
    console.error('Provider ID:', providerId);
  }
}

/**
 * Delete a test provider through API
 */
export async function deleteTestProvider(
  request: APIRequestContext,
  providerId: string
): Promise<void> {
  try {
    await request.delete(`${API_BASE_URL}/providers/${providerId}`);
  } catch (error) {
    console.warn(`Failed to delete provider ${providerId}:`, error);
  }
}

/**
 * Batch delete test providers
 */
export async function deleteTestProviders(
  request: APIRequestContext,
  providerIds: string[]
): Promise<void> {
  await Promise.all(
    providerIds.map(id => deleteTestProvider(request, id))
  );
}

/**
 * Wait for provider to be indexed/available in search
 */
export async function waitForProviderIndexing(
  page: Page,
  providerName: string,
  maxWaitTime: number = 60000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    await page.goto('/pharmacists');
    await page.getByPlaceholder('Search by name, specialty, or city...').fill(providerName);
    // Search is auto-triggered on input change (no search button)
    await page.waitForTimeout(300); // Brief delay for filtering to apply

    const cards = page.locator('[data-testid="pharmacist-card"]');
    const count = await cards.count();

    if (count > 0) {
      const names = [];
      for (let i = 0; i < count; i++) {
        const name = await cards.nth(i).locator('[data-testid="pharmacist-name"]').textContent();
        if (name?.includes(providerName)) {
          return true;
        }
      }
    }

    await page.waitForTimeout(500); // Wait 500ms before retry (reduced from 1000ms)
  }

  return false;
}
