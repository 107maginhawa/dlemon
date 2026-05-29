/**
 * EMR audit helpers.
 *
 * The `consultation_note` table's `tenant_id` is nullable and is NOT the
 * isolation mechanism for this platform-level module (isolation is by
 * provider/patient ownership — see MODULE_SPEC §7). Older code fell back to the
 * patient UUID when `tenantId` was null, which leaked a PHI identifier into the
 * audit log's tenant slot (V-EMR-005). Use this non-PHI sentinel instead so the
 * tenant column never carries a patient identifier.
 */
export const EMR_AUDIT_TENANT_SENTINEL = '00000000-0000-0000-0000-000000000000';
