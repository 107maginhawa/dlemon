/**
 * buildPermissionGrid — assemble the effective (role × feature) grid for an org
 * from the catalog defaults plus the org's override rows (P2-17).
 */

import type { DatabaseInstance } from '@/core/database';
import { FeaturePermissionRepository } from '@/handlers/dental-org/repos/feature-permission.repo';
import { VALID_MEMBER_ROLES, type MemberRole } from '@/handlers/dental-org/repos/membership.schema';
import { PERMISSION_CATALOG, PERMISSION_FEATURES, defaultAllows } from './catalog';

export interface GridCell {
  role: MemberRole;
  feature: string;
  allowed: boolean;
  source: 'override' | 'default';
}

export interface PermissionGrid {
  organizationId: string;
  catalog: typeof PERMISSION_CATALOG;
  cells: GridCell[];
}

export async function buildPermissionGrid(
  db: DatabaseInstance,
  organizationId: string,
): Promise<PermissionGrid> {
  const repo = new FeaturePermissionRepository(db);
  const overrides = await repo.listByOrg(organizationId);

  // Index overrides by `${role}::${feature}`.
  const overrideMap = new Map<string, boolean>();
  for (const o of overrides) {
    overrideMap.set(`${o.role}::${o.feature}`, o.allowed);
  }

  const cells: GridCell[] = [];
  for (const role of VALID_MEMBER_ROLES) {
    for (const feature of PERMISSION_FEATURES) {
      const key = `${role}::${feature}`;
      if (overrideMap.has(key)) {
        cells.push({ role, feature, allowed: overrideMap.get(key)!, source: 'override' });
      } else {
        cells.push({ role, feature, allowed: defaultAllows(role, feature), source: 'default' });
      }
    }
  }

  return { organizationId, catalog: PERMISSION_CATALOG, cells };
}
