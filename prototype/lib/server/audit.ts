/**
 * Append-only audit trail (R6). Every material action on a sensitive entity
 * writes one AUDIT_LOG row with actor, action, entity, and time. Sensitive
 * values are redacted by callers (we store metadata describing the action, not
 * the secret/PII payload). Append-only is enforced at the DB level in Phase 2.
 */
import { prisma } from "./db";
import type { AppUser } from "../contract/types";

export async function logAudit(
  actor: AppUser | null,
  action: string,
  entity_type: string,
  entity_id: string | null,
  metadata: Record<string, unknown> | null,
) {
  return prisma.auditLog.create({
    data: {
      actor_user_id: actor?.id ?? null,
      action,
      entity_type,
      entity_id: entity_id ?? null,
      // Prisma JSON input type doesn't accept Record<string, unknown> directly.
      metadata: (metadata ?? undefined) as any,
      ip: null,
    },
  });
}
