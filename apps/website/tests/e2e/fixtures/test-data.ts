// Test data for E2E tests
import { faker } from '@faker-js/faker';

export interface Pharmacist {
  id: string;
  name: string;
  title: string;
  specializations: string[];
  rating: number;
  reviewCount: number;
  imageUrl: string;
  location: string;
  address: string;
  yearsOfExperience: number;
  languages: string[];
  insuranceAccepted: boolean;
  consultationFee: number;
  bio: string;
  slug: string;
}

export interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
  startTime: string;
  endTime: string;
}

/**
 * Factory function to create a test pharmacist/provider
 */
export function makeTestProvider(overrides?: Partial<Pharmacist>): Pharmacist {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const name = `Dr. ${firstName} ${lastName}`;
  const slug = `${firstName}-${lastName}`.toLowerCase().replace(/\s+/g, '-');

  return {
    id: faker.string.uuid(),
    name,
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
    rating: faker.number.float({ min: 4.0, max: 5.0, multipleOf: 0.1 }),
    reviewCount: faker.number.int({ min: 10, max: 300 }),
    imageUrl: `/pharmacist-${faker.number.int({ min: 1, max: 10 })}.jpg`,
    location: `${faker.location.city()}, ${faker.location.state({ abbreviated: true })}`,
    address: faker.location.streetAddress(),
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
    insuranceAccepted: faker.datatype.boolean(),
    consultationFee: faker.number.int({ min: 50, max: 150 }),
    bio: faker.lorem.paragraph({ min: 2, max: 3 }),
    slug,
    ...overrides
  };
}

/**
 * Factory function to create a test time slot
 */
export function makeTestSlot(overrides?: Partial<TimeSlot>): TimeSlot {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
  const hour = faker.number.int({ min: 9, max: 16 });
  const minute = faker.helpers.arrayElement([0, 30]);

  const startTime = new Date(date);
  startTime.setHours(hour, minute, 0, 0);

  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + 30);

  return {
    id: `slot-${faker.string.uuid()}`,
    time: `${hour > 12 ? hour - 12 : hour}:${minute.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`,
    available: faker.datatype.boolean({ probability: 0.7 }), // 70% chance of being available
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    ...overrides
  };
}

/**
 * Generate multiple test slots for a day
 */
export function makeTestSlotsForDay(options?: {
  date?: string;
  count?: number;
  startHour?: number;
  endHour?: number;
}): TimeSlot[] {
  const {
    date = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    count = 8,
    startHour = 9,
    endHour = 17
  } = options || {};

  const slots: TimeSlot[] = [];
  const slotsPerHour = 2; // 30-minute slots
  const totalPossibleSlots = (endHour - startHour) * slotsPerHour;
  const slotsToGenerate = Math.min(count, totalPossibleSlots);

  let currentHour = startHour;
  let currentMinute = 0;

  for (let i = 0; i < slotsToGenerate; i++) {
    const startTime = new Date(`${date}T${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:00`);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 30);

    slots.push({
      id: `slot-${i + 1}`,
      time: `${currentHour > 12 ? currentHour - 12 : currentHour}:${currentMinute.toString().padStart(2, '0')} ${currentHour >= 12 ? 'PM' : 'AM'}`,
      available: faker.datatype.boolean({ probability: 0.7 }),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    });

    // Move to next slot
    currentMinute += 30;
    if (currentMinute >= 60) {
      currentMinute = 0;
      currentHour++;
    }
  }

  return slots;
}

/**
 * Booking form data interface
 */
export interface BookingFormData {
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  reason: string;
  notes: string;
}

/**
 * Factory function to create booking form data
 */
export function makeBookingFormData(overrides?: Partial<BookingFormData>): BookingFormData {
  return {
    patientName: faker.person.fullName(),
    patientEmail: faker.internet.email(),
    patientPhone: faker.phone.number(),
    reason: faker.helpers.arrayElement([
      'Medication consultation',
      'Vaccine administration',
      'Prescription review',
      'Drug interaction check',
      'Side effects discussion',
      'Dosage adjustment',
    ]),
    notes: faker.lorem.sentence({ min: 10, max: 20 }),
    ...overrides
  };
}

/**
 * Factory function to create invalid booking data for testing validation
 */
export function makeInvalidBookingData(): BookingFormData {
  return {
    patientName: '',
    patientEmail: faker.helpers.arrayElement(['invalid-email', 'not.an.email', '@example.com', 'test@']),
    patientPhone: faker.helpers.arrayElement(['123', '1', 'abc-def-ghij', '']),
    reason: '',
    notes: '',
  };
}

// Export for backward compatibility (will be removed after migration)
export const bookingFormData = makeBookingFormData();
export const invalidBookingData = makeInvalidBookingData();