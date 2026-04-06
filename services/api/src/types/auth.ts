/**
 * Auth type definitions for Monobase Application Platform
 * Contains all authentication and authorization related types
 */

import type { User as BetterAuthUser, Session as BetterAuthSession } from 'better-auth';

/**
 * User roles in the healthcare platform
 */
export type UserRole = 'patient' | 'provider' | 'admin' | 'user';

/**
 * Admin privilege levels
 */
export type AdminLevel = 'super' | 'admin' | 'support';

/**
 * User type alias for Better Auth user
 */
export interface User extends BetterAuthUser {
  role: UserRole | string;
}

/**
 * Extended session type
 */
export interface Session extends BetterAuthSession {
  user: User;
}

/**
 * Auth configuration
 */
export interface AuthConfig {
  baseUrl: string;
  secret: string;
  sessionExpiresIn?: number; // seconds
  rateLimitEnabled?: boolean;
  rateLimitWindow?: number; // seconds
  rateLimitMax?: number; // max attempts
  adminEmails?: string[]; // emails to automatically promote to admin
  cookieSameSite?: 'strict' | 'lax' | 'none';
  secureCookies?: boolean;
  socialProviders?: {
    google?: {
      clientId: string;
      clientSecret: string;
    };
  };
}
