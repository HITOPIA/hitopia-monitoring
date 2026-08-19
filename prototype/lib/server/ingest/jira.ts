/**
 * Jira ingestion → DELIVERY_RECORD (+ per-ticket DELIVERY_TICKET evidence) per
 * talent per period. Aggregates issues touched in the period per assignee, and
 * mines the issue changelog for richer signals: reopens (done → not-done),
 * status-transition volume, and VERIFICATION credit — when someone other than the
 * assignee moves a ticket into a verify/QA/done state (so QA, who often isn't the
 * Jira assignee, still earns measurable delivery). Bugs come from issuetype.
 * Identity is resolved verified-mapping → email → display name (Jira Cloud hides
 * emails). All counts are auditable via the per-ticket evidence (#14).
 */
import { prisma } from "../db";
import { searchIssues, getIssueChangelog, type JiraUser } from "../adapters/jira";
import { normName, type IngestSummary, type IngestFlag } from "./types";

function monthBounds(period: string) {
  const [y, m] = period.split("-").map(Number);
  const start = `${period}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start, next, startMs: Date.parse(start), nextMs: Date.parse(next) };
}
const daysBetween = (a: string, b: string) => Math.max(0, (Date.parse(b) - Date.parse(a)) / 86400000);

const DONE_RE = /(done|closed|resolved|complete|verified)/i;
const OPEN_RE = /(progress|reopen|re-open|open|to ?do|todo|backlog|selected|dev)/i;
const VERIFY_RE = /(verif|qa|test\s*pass|tested|done|accept|uat)/i;

interface Agg {
  committed: number;
  completed: number;
  overdue: number;
  reopened: number;
  verified: number;
  bugs: number;
  transitions: number;
  agingSum: number;
  agingN: number;
}

interface TicketRow {
  issue_key: string;
  summary: string | null;
  status: string;
  status_category: string;
  completed: boolean;
  overdue: boolean;
  created: string | null;
  resolved_date: string | null;
  due_date: string | null;
  aging_days: number;
  issue_type: string | null;
  is_bug: boolean;
  reopen_count: number;
  transitions: number;
  credit: string;
}

export async function ingestJira(period: string, runId: string): Promise<IngestSummary> {
  const { start, next, startMs, nextMs } = monthBounds(period);
  const [talents, mappings] = await Promise.all([
    prisma.talent.findMany(),
    prisma.identityMapping.findMany({ where: { system: "jira" } }),
  ]);
  const talentById = new Map(talents.map((t) => [t.id, t]));
  const byExternal = new Map(mappings.map((m) => [m.external_id, m.talent_id]));
  const byEmail = new Map(talents.map((t) => [t.email.toLowerCase().trim(), t]));
  const byName = new Map(talents.map((t) => [normName(t.full_name), t]));

  const resolve = (u?: JiraUser | null) => {
    if (!u) return undefined;
    const ext = byExternal.get(u.accountId);
    if (ext) return talentById.get(ext);
    const email = (u.emailAddress || "").toLowerCase().trim();
    let t = email ? byEmail.get(email) : undefined;
    if (!t && u.displayName) t = byName.get(normName(u.displayName));
    return t;
  };

  const jql = `updated >= "${start}" AND updated < "${next}" AND assignee IS NOT EMPTY ORDER BY updated DESC`;
  // NOTE: the enhanced /search/jql endpoint does NOT accept expand=changelog
  // (and rejects an array) — that 400s the whole search. Changelog is fetched
  // per-issue below instead.
  const issues = await searchIssues(
    jql,
    ["assignee", "status", "summary", "created", "resolutiondate", "duedate", "issuetype"],
  );

  // Per-issue changelog (bounded) — powers the reopens / transitions / verified signals.
  let fallbacks = 0;
  for (const it of issues) {
    if ((!it.changelog || !it.changelog.histories?.length) && fallbacks < 200) {
      try {
        it.changelog = { histories: await getIssueChangelog(it.key) };
      } catch {
        /* leave changelog empty — reopen/transition signals degrade to 0 */
      }
      fallbacks++;
    }
  }

  const agg = new Map<string, Agg>();
  const tickets = new Map<string, TicketRow[]>();
  const matched = new Map<string, { accountId: string; displayName: string }>();
  const flags: IngestFlag[] = [];
  const unmatchedAssignees = new Set<string>();
  const blank = (): Agg => ({ committed: 0, completed: 0, overdue: 0, reopened: 0, verified: 0, bugs: 0, transitions: 0, agingSum: 0, agingN: 0 });
  const pushTicket = (id: string, row: TicketRow) => {
    const arr = tickets.get(id) ?? [];
    arr.push(row);
    tickets.set(id, arr);
  };

  for (const it of issues) {
    const a = it.fields.assignee;
    const assignee = resolve(a);
    if (!assignee) {
      if (a) unmatchedAssignees.add(a.displayName || a.accountId);
      continue;
    }
    if (a) matched.set(assignee.id, { accountId: a.accountId, displayName: a.displayName || assignee.full_name });

    const resolved = it.fields.resolutiondate || null;
    const due = it.fields.duedate || null;
    const statusDone = it.fields.status?.statusCategory?.key === "done";
    // Definition of Done (DoD) — per CEO 2026-08-18 (updated 2026-08-18 session 2 & 3).
    // Whitelist of Jira status names that count as "completed" for the green
    // badge + tickets_completed. Anything not listed defaults to NOT done;
    // new statuses discovered later can be added to DOD_DONE_STATUSES below.
    //   Approved                 → 0
    //   Closed                   → 1
    //   Resolved                 → 1
    //   Resolved with notes      → 1
    //   Cannot be Test           → 1  (NEW — was 0, CEO updated)
    //   Released                 → 1  (NEW — added by CEO)
    //   Verified + Done          → 1  (NEW — added by CEO; literal status name match)
    //   Done + Bug               → 1  (NEW — added by CEO for bug-ticket-specific done states)
    //   Waiting for Feedback     → 0
    //   Ready for Testing        → 0
    //   In Progress              → 0
    //   Cancelled                → 0
    const DOD_DONE_STATUSES = new Set<string>([
      "Done", "Closed", "Resolved", "Resolved with notes",
      "Cannot be Test", "Released", "Verified + Done",
      "Done + Bug",
    ]);
    const currentStatusName = (it.fields.status?.name ?? "").trim();
    const completedInPeriod = !!(resolved && Date.parse(resolved) >= startMs && Date.parse(resolved) < nextMs);
    const completedByStatus = DOD_DONE_STATUSES.has(currentStatusName);
    // Final completed = resolutiondate in period (legacy rule, kept) OR current status in DoD whitelist (new rule)
    const completed = completedInPeriod || completedByStatus;
    const overdue = !!(due && Date.parse(due) < nextMs && !statusDone);
    const aging = completed && it.fields.created ? Math.round(daysBetween(it.fields.created, resolved!) * 10) / 10 : 0;
    const isBug = /bug/i.test(it.fields.issuetype?.name || "");

    // mine changelog for reopens, transition volume, and verifiers
    let transitions = 0;
    let reopened = 0;
    const verifiers = new Map<string, { accountId: string; displayName: string }>();
    for (const h of it.changelog?.histories ?? []) {
      for (const ci of h.items) {
        if (ci.field !== "status") continue;
        transitions++;
        const from = ci.fromString || "";
        const to = ci.toString || "";
        if (DONE_RE.test(from) && OPEN_RE.test(to) && !DONE_RE.test(to)) reopened++;
        if (VERIFY_RE.test(to) && h.author) {
          const vt = resolve(h.author);
          if (vt && vt.id !== assignee.id) {
            verifiers.set(vt.id, { accountId: h.author.accountId, displayName: h.author.displayName || vt.full_name });
          }
        }
      }
    }

    // assignee (delivery_source="assigned") credit
    const rec = agg.get(assignee.id) ?? blank();
    rec.committed++;
    if (completed) {
      rec.completed++;
      if (it.fields.created) {
        rec.agingSum += daysBetween(it.fields.created, resolved!);
        rec.agingN++;
      }
    }
    if (overdue) rec.overdue++;
    rec.reopened += reopened;
    rec.transitions += transitions;
    if (isBug) rec.bugs++;
    agg.set(assignee.id, rec);

    const base: Omit<TicketRow, "credit"> = {
      issue_key: it.key,
      summary: it.fields.summary ?? null,
      status: it.fields.status?.name ?? "",
      status_category: it.fields.status?.statusCategory?.key ?? "",
      completed,
      overdue,
      created: it.fields.created ?? null,
      resolved_date: resolved,
      due_date: due,
      aging_days: aging,
      issue_type: it.fields.issuetype?.name ?? null,
      is_bug: isBug,
      reopen_count: reopened,
      transitions,
    };
    pushTicket(assignee.id, { ...base, credit: "assigned" });

    // verifier (delivery_source="verified") credit — QA/lead who closed/verified
    for (const [vtId, meta] of verifiers) {
      const vrec = agg.get(vtId) ?? blank();
      vrec.verified++;
      agg.set(vtId, vrec);
      pushTicket(vtId, { ...base, credit: "verified" });
      if (!matched.has(vtId)) matched.set(vtId, meta);
    }
  }

  let upserts = 0;
  for (const [talentId, rec] of agg) {
    const avgAging = rec.agingN ? Math.round((rec.agingSum / rec.agingN) * 10) / 10 : 0;
    const data = {
      tickets_committed: rec.committed,
      tickets_completed: rec.completed,
      tickets_overdue: rec.overdue,
      tickets_reopened: rec.reopened,
      tickets_verified: rec.verified,
      avg_aging_days: avgAging,
      avg_cycle_days: avgAging,
      bugs_count: rec.bugs,
      status_transitions: rec.transitions,
      source_run_id: runId,
    };
    await prisma.deliveryRecord.upsert({
      where: { talent_id_period: { talent_id: talentId, period } },
      create: { talent_id: talentId, period, ...data },
      update: data,
    });

    const trows = tickets.get(talentId) ?? [];
    await prisma.deliveryTicket.deleteMany({ where: { talent_id: talentId, period } });
    if (trows.length) {
      await prisma.deliveryTicket.createMany({
        data: trows.map((t) => ({ ...t, talent_id: talentId, period, source_run_id: runId })),
      });
    }

    const map = matched.get(talentId);
    if (map) {
      const existing = await prisma.identityMapping.findFirst({ where: { talent_id: talentId, system: "jira" } });
      if (!existing) {
        await prisma.identityMapping.create({
          data: { talent_id: talentId, system: "jira", external_id: map.accountId, external_display_name: map.displayName, confidence: "high", verified: true, verified_at: new Date() },
        });
      }
    }
    upserts++;
  }

  for (const name of Array.from(unmatchedAssignees).slice(0, 100)) {
    flags.push({ severity: "warn", code: "JIRA_UNMAPPED", message: `Jira assignee "${name}" has no matching talent (email hidden or name mismatch).`, talent_id: null });
  }

  return {
    upserts,
    unmatched: unmatchedAssignees.size,
    flags,
    note: `${upserts} delivery records from ${issues.length} issues; ${unmatchedAssignees.size} unmapped assignees.`,
  };
}
