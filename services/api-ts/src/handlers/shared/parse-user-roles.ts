import type { User } from '@/types/auth';

/**
 * Split the comma-separated `user.role` string into trimmed role tokens.
 * Returns [] when the user or role is absent. Behavior-preserving extraction
 * of the inline expression previously copy-pasted across handlers.
 */
export function parseUserRoles(user: Pick<User, 'role'> | undefined | null): string[] {
  if (!user?.role) return [];
  return user.role.split(',').map((r) => r.trim());
}
