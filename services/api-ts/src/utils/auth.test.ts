/**
 * Unit tests for Better-Auth configuration and access control
 * Tests admin plugin, role definitions, and permission system
 */

import { describe, it, test, expect, beforeEach, afterEach } from 'bun:test';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { permissionStatements, userHasRole, ensureAdminUsers } from '@/utils/auth';
import { openTestTx } from '@/core/test-tx';
import { user as userTable } from '@/generated/better-auth/schema';

describe('Better-Auth Access Control', () => {
  describe('Permission Definitions', () => {
    it('should have correct patient permissions', () => {
      const patientPermissions = permissionStatements.patient;
      
      expect(patientPermissions).toContain('patient:read');
      expect(patientPermissions).toContain('patient:update');
      expect(patientPermissions).toContain('patient:consent:manage');
      expect(patientPermissions).toContain('communication:send');
      expect(patientPermissions).toContain('communication:read');
      expect(patientPermissions).toContain('file:upload');
      expect(patientPermissions).toContain('file:read');
    });

    it('should have correct provider permissions', () => {
      const providerPermissions = permissionStatements.provider;
      
      expect(providerPermissions).toContain('provider:read');
      expect(providerPermissions).toContain('provider:update');
      expect(providerPermissions).toContain('patient:read');
      expect(providerPermissions).toContain('patient:search');
      expect(providerPermissions).toContain('communication:send');
      expect(providerPermissions).toContain('communication:read');
      expect(providerPermissions).toContain('file:upload');
      expect(providerPermissions).toContain('file:read');
      expect(providerPermissions).toContain('file:download');
    });

    it('should have correct admin permissions', () => {
      const adminPermissions = permissionStatements.admin;
      
      expect(adminPermissions).toContain('admin:read');
      expect(adminPermissions).toContain('admin:update');
      expect(adminPermissions).toContain('patient:*');
      expect(adminPermissions).toContain('provider:*');
      expect(adminPermissions).toContain('communication:*');
      expect(adminPermissions).toContain('file:*');
      expect(adminPermissions).toContain('audit:read');
      expect(adminPermissions).toContain('system:manage');
      expect(adminPermissions).toContain('user:impersonate');
    });

    // Note: support and user roles are not defined in the access control statements
    // These are system roles checked directly in the middleware
  });

  describe('Permission Checking', () => {
    it('should check if a role has a specific permission', () => {
      // Patient should have file:read permission
      const hasPatientPermission = permissionStatements.patient.includes('file:read');
      expect(hasPatientPermission).toBe(true);

      // Patient should not have file:download permission
      const lacksDownloadPermission = !(permissionStatements.patient as readonly string[]).includes('file:download');
      expect(lacksDownloadPermission).toBe(true);

      // Provider should have file:download permission
      const hasProviderPermission = permissionStatements.provider.includes('file:download');
      expect(hasProviderPermission).toBe(true);
    });

    it('should allow admin to have wildcard permissions', () => {
      const adminPermissions = permissionStatements.admin;
      
      // Admin has wildcard permissions for resources
      expect(adminPermissions).toContain('patient:*');
      expect(adminPermissions).toContain('provider:*');
      
      // Admin also has specific permissions for clarity
      expect(adminPermissions).toContain('system:manage');
    });

    it('should distinguish between similar permissions', () => {
      // Patient can upload files
      expect(permissionStatements.patient).toContain('file:upload');

      // Provider can download files (more than patient)
      expect(permissionStatements.provider).toContain('file:download');

      // Patient cannot download files
      expect(permissionStatements.patient).not.toContain('file:download');
    });
  });

  describe('Role Hierarchy', () => {
    it('should have appropriate permissions for each role', () => {
      const patientPermCount = permissionStatements.patient.length;
      const providerPermCount = permissionStatements.provider.length;
      const adminPermCount = permissionStatements.admin.length;
      
      // Each role has permissions
      expect(patientPermCount).toBeGreaterThan(0);
      expect(providerPermCount).toBeGreaterThan(0);
      expect(adminPermCount).toBeGreaterThan(0);
      
      // Provider has more permissions than patient
      expect(providerPermCount).toBeGreaterThan(patientPermCount);
    });

    it('should have non-overlapping specialized permissions', () => {
      // Patient-specific permissions not in provider
      const patientOnly = (permissionStatements.patient as readonly string[]).filter(
        p => !(permissionStatements.provider as readonly string[]).includes(p)
      );

      // Provider-specific permissions not in patient
      const providerOnly = (permissionStatements.provider as readonly string[]).filter(
        p => !(permissionStatements.patient as readonly string[]).includes(p)
      );
      
      // Each role should have some unique permissions
      expect(patientOnly.length).toBeGreaterThan(0);
      expect(providerOnly.length).toBeGreaterThan(0);
      
      // Check specific unique permissions
      expect(patientOnly).toContain('patient:consent:manage');
      expect(providerOnly).toContain('provider:update');
      expect(providerOnly).toContain('file:download');
    });
  });

  describe('Permission Naming Conventions', () => {
    it('should follow resource:action naming pattern', () => {
      const allPermissions = [
        ...(permissionStatements.patient as readonly string[]),
        ...(permissionStatements.provider as readonly string[]),
        ...(permissionStatements.admin as readonly string[]),
      ].filter(p => p !== '*' && p.includes(':'));
      
      for (const permission of allPermissions) {
        // Should have at least one colon (can have nested like patient:consent:manage)
        const parts = permission.split(':');
        expect(parts.length).toBeGreaterThanOrEqual(2);
        
        // Should have non-empty parts
        parts.forEach(part => {
          expect(part.length).toBeGreaterThan(0);
        });
      }
    });

    it('should use consistent action verbs', () => {
      const commonActions = ['read', 'create', 'update', 'delete', 'manage', 'search', 'cancel', 'complete', 'send', 'upload', 'download', 'impersonate', '*'];
      const allPermissions = [
        ...(permissionStatements.patient as readonly string[]),
        ...(permissionStatements.provider as readonly string[]),
        ...(permissionStatements.admin as readonly string[]),
      ].filter(p => p.includes(':'));
      
      for (const permission of allPermissions) {
        const parts = permission.split(':');
        const action = parts[parts.length - 1]; // Last part is the action

        // Action should be a known verb or wildcard
        if (action) {
          const isKnownAction = commonActions.includes(action);
          expect(isKnownAction).toBe(true);
        }
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// userHasRole — admin superuser, exact/any-of match, deny controls.
//
// Pure async predicate (src/utils/auth.ts). Its first `auth` param is UNUSED
// (pass `{} as any`). `admin` is a SUPERUSER (satisfies any standard role
// requirement); other roles need exact / any-of match; comma-separated role
// strings are split + trimmed. The admin-superuser ACCEPT cases together with
// the explicit DENY controls prove non-vacuity for a pure function.
// ─────────────────────────────────────────────────────────────────────────────

describe('userHasRole — admin superuser, exact/any-of match, deny controls', () => {
  type Case = {
    name: string;
    role: string | null;
    require: string | string[];
    expected: boolean;
  };

  const cases: Case[] = [
    // (a) ADMIN is a superuser — satisfies any NON-admin requirement.
    { name: 'admin on a single non-admin requirement (user)', role: 'admin', require: 'user', expected: true },
    {
      name: 'admin on an any-of requirement it does not literally contain',
      role: 'admin',
      require: ['provider', 'clinician'],
      expected: true,
    },
    // (b) comma-separated roles split + trim; admin anywhere in the list wins.
    { name: 'comma-separated "user,admin" on provider (admin wins)', role: 'user,admin', require: 'provider', expected: true },
    // (d) exact match for a non-admin role.
    { name: 'provider on provider (exact match)', role: 'provider', require: 'provider', expected: true },
    // (c) DENY controls — the non-vacuity proof for the accept cases above.
    { name: 'user on admin (no privilege escalation)', role: 'user', require: 'admin', expected: false },
    {
      name: 'provider on any-of [clinician, registrar] (no overlap)',
      role: 'provider',
      require: ['clinician', 'registrar'],
      expected: false,
    },
    { name: 'null role denies everything', role: null, require: 'user', expected: false },
  ];

  for (const c of cases) {
    test(c.name, async () => {
      // First `auth` param is unused by the implementation.
      const result = await userHasRole({} as any, { role: c.role }, c.require);
      expect(result).toBe(c.expected);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ensureAdminUsers — promotes allowlisted emails only, idempotently.
//
// Driven against REAL Postgres via openTestTx() (auto-rollback). The
// ALLOWLIST-SCOPING case (a user NOT on the allowlist is NOT promoted) is the
// security assertion and the non-vacuity proof.
// ─────────────────────────────────────────────────────────────────────────────

// Fixed IDs (namespace: auth-ensure-admin). `user.id` is a text PK.
const OWNER_USER_ID = 'ed000000-0000-4000-8000-0000000c0001';
const EVIL_USER_ID = 'ed000000-0000-4000-8000-0000000c0002';
const ALREADY_ADMIN_USER_ID = 'ed000000-0000-4000-8000-0000000c0003';

const OWNER_EMAIL = 'owner@clinic.test';
const EVIL_EMAIL = 'evil@clinic.test';
const ADMIN_EMAIL = 'boss@clinic.test';

describe('ensureAdminUsers — promotes allowlisted emails only, idempotently', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const tx = await openTestTx();
    db = tx.db;
    teardown = tx.rollback;

    await db
      .insert(userTable)
      .values([
        {
          id: OWNER_USER_ID,
          name: 'Clinic Owner',
          email: OWNER_EMAIL,
          emailVerified: true,
          role: 'user',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: EVIL_USER_ID,
          name: 'Not Allowlisted',
          email: EVIL_EMAIL,
          emailVerified: true,
          role: 'user',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: ALREADY_ADMIN_USER_ID,
          name: 'Existing Admin',
          email: ADMIN_EMAIL,
          emailVerified: true,
          role: 'admin',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as never)
      .onConflictDoNothing();
  });

  afterEach(() => teardown());

  test('(a) PROMOTE: an allowlisted user is granted the admin role', async () => {
    const promoted = await ensureAdminUsers(db, [OWNER_EMAIL]);
    expect(promoted).toContain(OWNER_EMAIL);

    const [row] = await db.select().from(userTable).where(eq(userTable.id, OWNER_USER_ID)).limit(1);
    expect(row?.role).toBeTruthy();
    expect(row!.role!.split(',').map(r => r.trim())).toContain('admin');
  });

  test('(b) ALLOWLIST-SCOPING: a user NOT on the allowlist is NOT promoted', async () => {
    // Allowlist names a DIFFERENT email than `evil`.
    const promoted = await ensureAdminUsers(db, [OWNER_EMAIL]);
    expect(promoted).not.toContain(EVIL_EMAIL);

    const [evil] = await db.select().from(userTable).where(eq(userTable.id, EVIL_USER_ID)).limit(1);
    expect(evil?.role).toBe('user');
    expect(evil!.role!.split(',').map(r => r.trim())).not.toContain('admin');
  });

  test('(c) IDEMPOTENT: re-running on an existing admin keeps a single admin role', async () => {
    const promoted = await ensureAdminUsers(db, [ADMIN_EMAIL]);
    // Already an admin → nothing to promote.
    expect(promoted).not.toContain(ADMIN_EMAIL);

    const [row] = await db.select().from(userTable).where(eq(userTable.id, ALREADY_ADMIN_USER_ID)).limit(1);
    expect(row?.role).toBe('admin');
    expect(row!.role!.split(',').map(r => r.trim()).filter(r => r === 'admin')).toHaveLength(1);
  });
});