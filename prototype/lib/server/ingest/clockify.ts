/**
 * Clockify ingestion → UTILIZATION_RECORD (+ per-entry TIME_ENTRY evidence) per
 * talent per period. Pulls every time entry via the Detailed Reports API and sums
 * them into tracked hours (single source of truth), so the stored utilization
 * number is always reconcilable against the entries a reviewer can see.
 * Resolves Clockify users to talents by work email (D2). Unmatched users are
 * flagged, not guessed. Read-only to Clockify; writes only our own records.
 */
import { prisma } from "../db";
import { getWorkspaceUsers, detailedEntries, workdaysInMonth, type ClockifyTimeEntry } from "../adapters/clockify";
import { loadSchedule } from "../schedule";
import { classifyEntry, aggregateOffhours } from "../../overtime";
import type { IngestSummary, IngestFlag } from "./types";

const JIRA_KEY = /[A-Z][A-Z0-9]+-\d+/;

export async function ingestClockify(period: string, runId: string): Promise<IngestSummary> {
  const setting = await prisma.sourceSetting.findUnique({ where: { source: "clockify" } });
  const workspaceId = (setting?.config as any)?.workspace_id as string | undefined;
  if (!workspaceId) {
    throw new Error("No Clockify workspace selected — choose one in the data pipeline (Sources & integration) first.");
  }

  const [users, entries, talents, mappings, schedule] = await Promise.all([
    getWorkspaceUsers(workspaceId),
    detailedEntries(workspaceId, period),
    prisma.talent.findMany(),
    prisma.identityMapping.findMany({ where: { system: "clockify" } }),
    loadSchedule(),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const talentById = new Map(talents.map((t) => [t.id, t]));
  const talentByEmail = new Map(talents.map((t) => [t.email.toLowerCase().trim(), t]));
  const talentByExternal = new Map(mappings.map((m) => [m.external_id, m.talent_id]));
  const target = workdaysInMonth(period) * 8;

  // group every time entry by Clockify user → derive totals + evidence together
  const byUser = new Map<string, ClockifyTimeEntry[]>();
  for (const e of entries) {
    const arr = byUser.get(e.userId) ?? [];
    arr.push(e);
    byUser.set(e.userId, arr);
  }

  const flags: IngestFlag[] = [];
  let upserts = 0;
  let unmatched = 0;

  for (const [userId, userEntries] of byUser) {
    const u = userById.get(userId);
    const email = u?.email?.toLowerCase().trim();
    // consult verified identity mappings first, then fall back to work email
    const mappedId = talentByExternal.get(userId);
    const talent = (mappedId ? talentById.get(mappedId) : undefined) ?? (email ? talentByEmail.get(email) : undefined);
    const displayName = u?.name ?? userId;
    if (!talent) {
      unmatched++;
      flags.push({ severity: "warn", code: "CLOCKIFY_UNMAPPED", message: `Clockify user "${displayName}" (${email || "no email"}) has no matching talent.`, talent_id: null });
      continue;
    }
    const totalSec = userEntries.reduce((s, e) => s + e.durationSec, 0);
    const tracked = Math.round((totalSec / 3600) * 10) / 10;
    const overtime = Math.max(0, Math.round((tracked - target) * 10) / 10);
    const offh = aggregateOffhours(userEntries.map((e) => ({ start_at: e.start, duration_sec: e.durationSec })), schedule);
    await prisma.utilizationRecord.upsert({
      where: { talent_id_period: { talent_id: talent.id, period } },
      create: { talent_id: talent.id, period, tracked_hours: tracked, productive_hours: tracked, target_hours: target, overtime_hours: overtime, offhours_hours: offh.total, source_run_id: runId },
      update: { tracked_hours: tracked, productive_hours: tracked, target_hours: target, overtime_hours: overtime, offhours_hours: offh.total, source_run_id: runId },
    });

    // rebuild this talent's time-entry evidence for the period
    await prisma.timeEntry.deleteMany({ where: { talent_id: talent.id, period } });
    if (userEntries.length) {
      await prisma.timeEntry.createMany({
        data: userEntries.map((e) => ({
          talent_id: talent.id,
          period,
          entry_date: e.date,
          start_at: e.start,
          end_at: e.end,
          clockify_entry_id: e.entryId,
          offhours_kind: classifyEntry(e.start, e.durationSec, schedule).kind,
          description: e.description || null,
          ticket_ref: e.description.match(JIRA_KEY)?.[0] ?? null,
          project_name: e.projectName,
          duration_sec: Math.round(e.durationSec),
          source_run_id: runId,
        })),
      });
    }

    const existing = await prisma.identityMapping.findFirst({ where: { talent_id: talent.id, system: "clockify" } });
    if (!existing) {
      await prisma.identityMapping.create({
        data: { talent_id: talent.id, system: "clockify", external_id: userId, external_display_name: displayName, confidence: "high", verified: true, verified_at: new Date() },
      });
    }
    if (tracked < target * 0.4) {
      flags.push({ severity: "warn", code: "TRACKED_HOURS_LOW", message: `${talent.full_name}: tracked ${tracked}h < 40% of ${target}h target — verify Clockify entries.`, talent_id: talent.id });
    }
    upserts++;
  }

  return { upserts, unmatched, flags, note: `${upserts} utilization records (+${entries.length} time entries) from workspace; ${unmatched} unmapped users.` };
}
