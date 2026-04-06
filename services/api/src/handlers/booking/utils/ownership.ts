/**
 * Ownership validation utilities for booking module
 */

import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import type { Booking } from '../repos/booking.schema';

/**
 * Check if user has ownership of a booking (either as client or provider)
 * @param db Database instance
 * @param logger Logger instance
 * @param user Authenticated user
 * @param booking Booking to check ownership for
 * @returns Promise<boolean> true if user owns the booking
 */
export async function checkBookingOwnership(
  db: DatabaseInstance,
  logger: any,
  user: User,
  booking: Booking
): Promise<boolean> {
  // Check if user is the client (booking.client stores person ID)
  if (booking.client && booking.client === user.id) {
    return true;
  }

  // Check if user is the provider (booking.provider stores person ID)
  if (booking.provider && booking.provider === user.id) {
    return true;
  }

  return false;
}

/**
 * Check if user is the provider for a booking
 * @param db Database instance
 * @param logger Logger instance
 * @param user Authenticated user
 * @param booking Booking to check provider ownership for
 * @returns Promise<boolean> true if user is the provider
 */
export async function checkBookingProviderOwnership(
  db: DatabaseInstance,
  logger: any,
  user: User,
  booking: Booking
): Promise<boolean> {
  logger?.debug({
    userId: user.id,
    bookingId: booking.id,
    bookingProvider: booking.provider,
    action: 'checkBookingProviderOwnership_start'
  }, 'Starting provider ownership check');

  if (!booking.provider) {
    logger?.debug({ bookingId: booking.id }, 'Booking has no provider - ownership denied');
    return false;
  }

  // Direct comparison: booking.provider now stores person ID
  const isOwner = booking.provider === user.id;

  logger?.debug({
    userId: user.id,
    bookingProviderId: booking.provider,
    isOwner,
    bookingId: booking.id,
    action: 'checkBookingProviderOwnership_result'
  }, `Provider ownership check: ${isOwner ? 'GRANTED' : 'DENIED'}`);

  return isOwner;
}

/**
 * Check if user is the client for a booking
 * @param db Database instance
 * @param logger Logger instance
 * @param user Authenticated user
 * @param booking Booking to check client ownership for
 * @returns Promise<boolean> true if user is the client
 */
export async function checkBookingClientOwnership(
  db: DatabaseInstance,
  logger: any,
  user: User,
  booking: Booking
): Promise<boolean> {
  // booking.client stores person ID directly, so just compare
  return booking.client === user.id;
}

/**
 * Get user type for booking (client or provider)
 * @param db Database instance
 * @param logger Logger instance
 * @param user Authenticated user
 * @param booking Booking to check
 * @returns Promise<'client' | 'provider' | null> user type or null if no ownership
 */
export async function getBookingUserType(
  db: DatabaseInstance,
  logger: any,
  user: User,
  booking: Booking
): Promise<'client' | 'provider' | null> {
  // Check if user is the client first
  if (await checkBookingClientOwnership(db, logger, user, booking)) {
    return 'client';
  }

  // Check if user is the provider
  if (await checkBookingProviderOwnership(db, logger, user, booking)) {
    return 'provider';
  }

  return null;
}

/**
 * Check if user owns a booking event
 * @param user Authenticated user  
 * @param eventOwnerId The owner ID of the booking event
 * @returns boolean true if user owns the event
 */
export function checkEventOwnership(
  user: User,
  eventOwnerId: string
): boolean {
  return user.id === eventOwnerId;
}