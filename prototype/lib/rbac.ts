import type { Role } from "./contract/types";

/** Capability → roles allowed. Mirrors the server-side checks in lib/server/handler.ts.
 *  In production RBAC is authoritative server-side; the UI uses this only to
 *  pre-disable actions and explain why (contract: "RBAC ditegakkan server-side"). */
export const CAPS: Record<string, Role[]> = {
  "ingestion.trigger": ["admin"],
  "scoring.edit": ["admin"],
  "mapping.verify": ["admin", "analyst"],
  "insight.generate": ["admin", "analyst"],
  "lead.submit": ["admin", "analyst"],
  "report.generate": ["admin", "analyst"],
  "report.submit": ["admin", "analyst"],
  "report.approve": ["admin", "reviewer"],
  "report.reject": ["admin", "reviewer"],
  "insight.submit": ["admin", "analyst"],
  "insight.approve": ["admin", "reviewer"],
  "insight.reject": ["admin", "reviewer"],
  "audit.view": ["admin"],
};

export function can(action: string, role: Role | undefined | null): boolean {
  if (!role) return false;
  const allowed = CAPS[action];
  return allowed ? allowed.includes(role) : true;
}

export function allowedRolesLabel(action: string): string {
  return (CAPS[action] ?? []).join(", ");
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  analyst: "Analyst",
  reviewer: "Reviewer",
  viewer: "Viewer",
};

export const ROLE_BLURB: Record<Role, string> = {
  admin: "Full access — ingestion, scoring config, audit log.",
  analyst: "Diagnose talent, generate insight, draft & submit reports.",
  reviewer: "Review & approve/reject insight and client reports.",
  viewer: "Read-only dashboard access.",
};
