import { describe, test, expect } from 'bun:test';
import { parseUserRoles } from './parse-user-roles';

describe('parseUserRoles', () => {
  test('returns [] when user is undefined', () => {
    expect(parseUserRoles(undefined)).toEqual([]);
  });
  test('returns [] when role is empty/absent', () => {
    expect(parseUserRoles({ role: '' })).toEqual([]);
    expect(parseUserRoles({ role: undefined as unknown as string })).toEqual([]);
  });
  test('parses a single role', () => {
    expect(parseUserRoles({ role: 'dentist_owner' })).toEqual(['dentist_owner']);
  });
  test('splits and trims a comma-separated list', () => {
    expect(parseUserRoles({ role: 'dentist_owner, front_desk ,admin' }))
      .toEqual(['dentist_owner', 'front_desk', 'admin']);
  });
});
