/**
 * Real API dispatcher — Postgres/Prisma backed. Mirrors the foundation contract
 * (contract/foundation.frozen.md) and ports the proven route table that the
 * prototype's mock used, swapping the in-memory store for Prisma and the faked
 * actor for a real server-verified session. RBAC is enforced here (server-side,
 * authoritative) and every material action writes an AUDIT_LOG row.
 *
 * Auth endpoints (/auth/login, /auth/logout) are handled in the route file
 * because they set/clear cookies; everything else flows through `handle`.
 */
import { prisma } from "./db";
import { HttpError, paginate, num } from "./http";
import { logAudit } from "./audit";
import { getOptional } from "./env";
import type { AppUser, Insight, Role } from "../contract/types";

type Query = Record<string, string | undefined>;

export interface ServerResponse<T = unknown> {
  status: number;
  body: T;
}

function requireAuth(actor: AppUser | null): AppUser {
  if (!actor) throw new HttpError(401, "UNAUTHENTICATED", "Sign in required.");
  return actor;
}

function requireRole(actor: AppUser | null, ...roles: Role[]): AppUser {
  const a = requireAuth(actor);
  if (!roles.includes(a.role)) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      `Role "${a.role}" cannot perform this action. Allowed: ${roles.join(", ")}.`,
    );
  }
  return a;
}

/** Heuristic insight builder used by POST /insights/generate.
 *  Phase 5 replaces this with Anthropic Claude (structured outputs + source-ref
 *  validation); the contract shape it returns stays identical. */
async function buildInsightFor(talentId: string, period: string): Promise<Insight | null> {
  const [t, score, u, del] = await Promise.all([
    prisma.talent.findUnique({ where: { id: talentId } }),
    prisma.performanceScore.findFirst({ where: { talent_id: talentId, period, scorable: true } }),
    prisma.utilizationRecord.findFirst({ where: { talent_id: talentId, period } }),
    prisma.deliveryRecord.findFirst({ where: { talent_id: talentId, period } }),
  ]);
  if (!t || !score || !u || !del) return null;
  const subs: [string, number, string][] = [
    ["delivery", score.delivery_score, `${del.tickets_completed}/${del.tickets_committed} tickets, ${del.tickets_overdue} overdue`],
    ["utilization", score.utilization_score, `${u.productive_hours}h of ${u.target_hours}h target`],
    ["efficiency", score.efficiency_score, `throughput ${(del.tickets_completed / Math.max(u.productive_hours, 1)).toFixed(3)} tkt/h`],
    ["overtime_health", score.overtime_health_score, `${u.overtime_hours}h overtime`],
  ];
  const low = subs.filter(([, v]) => v < 62).sort((a, b) => a[1] - b[1]).slice(0, 3);
  const picked = low.length ? low : [["total_score", score.total_score, `total ${score.total_score}`] as [string, number, string]];
  const created = await prisma.insight.create({
    data: {
      talent_id: t.id,
      period,
      diagnosis: picked.map(([metric, val, detail]) => ({
        cause:
          metric === "delivery" ? "Delivery slippage" :
          metric === "utilization" ? "Under-utilization" :
          metric === "efficiency" ? "Low throughput" :
          metric === "overtime_health" ? "Overtime / burnout risk" : "Borderline composite",
        weight: Math.round((1 - val / 100) * 100) / 100,
        detail,
      })),
      narrative: `${t.full_name} — ${score.flag.replace("_", " ")} (${score.total_score}) for ${period}. Decision-support only; verify with the lead before acting.`,
      summary: `${t.full_name}: ${score.flag.replace("_", " ")} composite ${score.total_score} (${period}).`,
      severity: score.flag === "low" ? "risk" : score.flag === "needs_review" ? "watch" : "strength",
      confidence: 0.55,
      recommendations: ["Review with the division lead this cycle.", "Confirm source-data completeness before any action."],
      source_refs: picked.map(([metric, , value]) => ({ metric, period, value, talent_id: t.id })),
      model_id: "heuristic-v0",
      status: "generated",
    },
  });
  return created as unknown as Insight;
}

async function pushApproval(
  subject_type: "insight" | "monthly_report",
  subject_id: string,
  reviewer_id: string,
  decision: "approve" | "reject" | "request_changes",
  comment: string | null,
) {
  return prisma.approval.create({
    data: { subject_type, subject_id, reviewer_id, decision, comment: comment ?? null },
  });
}

export async function handle(
  method: string,
  rawPath: string,
  query: Query,
  body: any,
  actor: AppUser | null,
): Promise<ServerResponse> {
  const path = rawPath.replace(/\/+$/g, "") || "/";
  const seg = path.replace(/^\/+|\/+$/g, "").split("/");
  const M = method.toUpperCase();
  const q = query;

  // ---- self / users ----
  if (path === "/me" && M === "GET") {
    return { status: 200, body: { user: requireAuth(actor) } };
  }
  if (path === "/users" && M === "GET") {
    requireAuth(actor);
    const data = await prisma.appUser.findMany({
      orderBy: { created_at: "asc" },
      omit: { password_hash: true },
    });
    return { status: 200, body: { data } };
  }

  // ---- talents ----
  if (seg[0] === "talents") {
    if (seg.length === 1 && M === "GET") {
      requireAuth(actor);
      const where: any = {};
      if (q.division) where.division = q.division;
      if (q.project) where.primary_project_id = q.project;
      if (q.q) where.OR = [
        { full_name: { contains: q.q, mode: "insensitive" } },
        { role: { contains: q.q, mode: "insensitive" } },
      ];
      const list = await prisma.talent.findMany({ where, orderBy: { full_name: "asc" } });
      return { status: 200, body: paginate(list, num(q.page, 1), num(q.limit, 500)) };
    }
    const id = seg[1];
    const talent = await prisma.talent.findUnique({ where: { id } });
    if (!talent) throw new HttpError(404, "NOT_FOUND", "Talent not found.");
    if (seg.length === 2 && M === "GET") {
      requireAuth(actor);
      const mappings = await prisma.identityMapping.findMany({ where: { talent_id: id } });
      return { status: 200, body: { talent, mappings } };
    }
    if (seg[2] === "metrics" && M === "GET") {
      requireAuth(actor);
      const period = q.period;
      const [utilization, delivery, budget_burn] = await Promise.all([
        prisma.utilizationRecord.findFirst({ where: { talent_id: id, period } }),
        prisma.deliveryRecord.findFirst({ where: { talent_id: id, period } }),
        prisma.budgetBurn.findFirst({ where: { talent_id: id, period } }),
      ]);
      return { status: 200, body: { utilization, delivery, budget_burn } };
    }
    if (seg[2] === "scores" && M === "GET") {
      requireAuth(actor);
      const data = await prisma.performanceScore.findMany({
        where: { talent_id: id, ...(q.period ? { period: q.period } : {}) },
        orderBy: { period: "asc" },
      });
      return { status: 200, body: { data } };
    }
    if (seg[2] === "insights" && M === "GET") {
      requireAuth(actor);
      const data = await prisma.insight.findMany({
        where: { talent_id: id, ...(q.period ? { period: q.period } : {}) },
        orderBy: { generated_at: "desc" },
      });
      return { status: 200, body: { data } };
    }
    if (seg[2] === "evidence" && M === "GET") {
      requireAuth(actor);
      const where = { talent_id: id, ...(q.period ? { period: q.period } : {}) };
      const [tickets, time_entries, jiraSetting] = await Promise.all([
        prisma.deliveryTicket.findMany({ where, orderBy: [{ completed: "desc" }, { issue_key: "asc" }] }),
        prisma.timeEntry.findMany({ where, orderBy: [{ entry_date: "asc" }] }),
        prisma.sourceSetting.findUnique({ where: { source: "jira" } }),
      ]);
      // Jira base URL is non-secret — surface it so the UI can deep-link tickets (#3).
      const jira_base_url =
        ((jiraSetting?.config as any)?.base_url as string | undefined) || getOptional("JIRA_BASE_URL") || null;
      return { status: 200, body: { tickets, time_entries, jira_base_url } };
    }
  }

  // ---- scores ----
  if (path === "/scores/recompute" && M === "POST") {
    const a = requireRole(actor, "admin", "analyst");
    const period = body?.period as string | undefined;
    if (!period) throw new HttpError(422, "VALIDATION", "period is required.");
    const { recomputeScores } = await import("./pipeline");
    const result = await recomputeScores(period);
    await logAudit(a, "scores.recompute", "performance_score", null, result as any);
    return { status: 200, body: result };
  }
  if (path === "/scores" && M === "GET") {
    requireAuth(actor);
    const where: any = {};
    if (q.period) where.period = q.period;
    if (q.flag) where.flag = q.flag;
    const list = await prisma.performanceScore.findMany({ where });
    return { status: 200, body: paginate(list, num(q.page, 1), num(q.limit, 500)) };
  }

  // ---- overtime (#5) ----
  if (path === "/overtime" && M === "GET") {
    requireAuth(actor);
    const period = q.period;
    if (!period) throw new HttpError(422, "VALIDATION", "period is required.");
    const { loadSchedule } = await import("./schedule");
    const { aggregateOffhours } = await import("../overtime");
    const [schedule, talents, utils, entries, scores] = await Promise.all([
      loadSchedule(),
      prisma.talent.findMany({ where: { status: "active" } }),
      prisma.utilizationRecord.findMany({ where: { period } }),
      prisma.timeEntry.findMany({ where: { period } }),
      prisma.performanceScore.findMany({ where: { period } }),
    ]);
    const utilBy = new Map(utils.map((u) => [u.talent_id, u]));
    const scoreBy = new Map(scores.map((s) => [s.talent_id, s]));
    const entriesBy = new Map<string, { start_at: string | null; duration_sec: number }[]>();
    for (const e of entries) {
      const arr = entriesBy.get(e.talent_id) ?? [];
      arr.push({ start_at: e.start_at, duration_sec: e.duration_sec });
      entriesBy.set(e.talent_id, arr);
    }
    const r1 = (v: number) => Math.round(v * 10) / 10;
    const rows = [];
    let totOt = 0, totOff = 0, before = 0, after = 0, weekend = 0, overTarget = 0;
    for (const t of talents) {
      const u = utilBy.get(t.id);
      if (!u) continue;
      const off = aggregateOffhours(entriesBy.get(t.id) ?? [], schedule);
      const score = scoreBy.get(t.id);
      totOt += u.overtime_hours;
      totOff += off.total;
      before += off.before;
      after += off.after;
      weekend += off.weekend;
      if (u.overtime_hours > 0) overTarget++;
      rows.push({
        talent_id: t.id, full_name: t.full_name, role: t.role, division: t.division,
        tracked_hours: u.tracked_hours, target_hours: u.target_hours, overtime_hours: u.overtime_hours,
        offhours_hours: off.total, before_hours: off.before, after_hours: off.after, weekend_hours: off.weekend,
        overtime_health_score: score?.scorable ? score.overtime_health_score : null,
      });
    }
    rows.sort((a, b) => b.overtime_hours - a.overtime_hours);
    return {
      status: 200,
      body: {
        period, schedule,
        total_overtime_hours: r1(totOt), total_offhours_hours: r1(totOff),
        before_hours: r1(before), after_hours: r1(after), weekend_hours: r1(weekend),
        talents_over_target: overTarget, rows,
      },
    };
  }

  // ---- mappings ----
  if (path === "/mappings/unresolved" && M === "GET") {
    requireAuth(actor);
    const data = await prisma.identityMapping.findMany({
      where: { OR: [{ verified: false }, { confidence: { not: "high" } }] },
    });
    return { status: 200, body: { data } };
  }
  if (seg[0] === "mappings" && seg[2] === "verify" && M === "POST") {
    const a = requireRole(actor, "admin", "analyst");
    const existing = await prisma.identityMapping.findUnique({ where: { id: seg[1] } });
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Mapping not found.");
    const mapping = await prisma.identityMapping.update({
      where: { id: seg[1] },
      data: {
        verified: true,
        confidence: "high",
        verified_by: a.id,
        verified_at: new Date(),
        ...(body?.external_id ? { external_id: body.external_id } : {}),
      },
    });
    await logAudit(a, "mapping.verify", "identity_mapping", mapping.id, { system: mapping.system });
    return { status: 200, body: { mapping } };
  }

  // ---- ingestion ----
  if (path === "/ingestion/runs" && M === "GET") {
    requireAuth(actor);
    const where: any = {};
    if (q.source) where.source = q.source;
    if (q.period) where.period = q.period;
    const list = await prisma.ingestionRun.findMany({ where, orderBy: { started_at: "desc" } });
    return { status: 200, body: paginate(list, num(q.page, 1), num(q.limit, 100)) };
  }
  if (path === "/ingestion/latest" && M === "GET") {
    requireAuth(actor);
    const where: any = {};
    if (q.period) where.period = q.period;
    const runs = await prisma.ingestionRun.findMany({ where, orderBy: { started_at: "desc" } });
    const latest: Record<string, unknown> = {};
    for (const r of runs) if (!latest[r.source]) latest[r.source] = r; // newest per source
    return { status: 200, body: { latest } };
  }
  if (path === "/ingestion/runs" && M === "POST") {
    const a = requireRole(actor, "admin");
    const source = body?.source as string | undefined;
    const period = body?.period as string | undefined;
    if (!source || !period) throw new HttpError(422, "VALIDATION", "source and period are required.");
    if (source === "gsheet") {
      throw new HttpError(400, "USE_CSV", "Talent master is imported via CSV upload (Settings → Sources), not this trigger.");
    }
    if (source !== "jira" && source !== "clockify") {
      throw new HttpError(422, "VALIDATION", `Unknown source "${source}".`);
    }
    // Live ingestion runs inline (read-only external calls → our own records).
    const run = await prisma.ingestionRun.create({ data: { source, period, status: "running" } });
    try {
      const summary =
        source === "clockify"
          ? await (await import("./ingest/clockify")).ingestClockify(period, run.id)
          : await (await import("./ingest/jira")).ingestJira(period, run.id);
      const flags = summary.flags ?? [];
      for (const f of flags.slice(0, 300)) {
        await prisma.dataQualityFlag.create({
          data: { ingestion_run_id: run.id, talent_id: f.talent_id ?? null, severity: f.severity, code: f.code, message: f.message },
        });
      }
      const blocks = flags.filter((f) => f.severity === "block").length;
      const warns = flags.filter((f) => f.severity === "warn").length;
      const updated = await prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          status: blocks > 0 ? "partial" : "success",
          finished_at: new Date(),
          records_ingested: summary.upserts,
          quality_summary: { info: 0, warn: warns, block: blocks, note: summary.note } as any,
        },
      });
      await logAudit(a, "ingestion.trigger", "ingestion_run", run.id, { source, period, records: summary.upserts, unmatched: summary.unmatched });
      return { status: 201, body: { run: updated, summary: { upserts: summary.upserts, unmatched: summary.unmatched } } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.ingestionRun.update({
        where: { id: run.id },
        data: { status: "failed", finished_at: new Date(), quality_summary: { info: 0, warn: 0, block: 1, note: msg.slice(0, 200) } as any },
      });
      throw new HttpError(502, "INGESTION_FAILED", `Ingestion failed: ${msg.slice(0, 200)}`);
    }
  }
  if (seg[0] === "ingestion" && seg[1] === "runs" && seg[2] && M === "GET") {
    requireAuth(actor);
    const run = await prisma.ingestionRun.findUnique({ where: { id: seg[2] } });
    if (!run) throw new HttpError(404, "NOT_FOUND", "Run not found.");
    const quality_flags = await prisma.dataQualityFlag.findMany({ where: { ingestion_run_id: run.id } });
    return { status: 200, body: { run, quality_flags } };
  }

  // ---- sources (data-integration connection config) ----
  if (seg[0] === "sources") {
    if (seg[1] === "clockify" && seg[2] === "workspaces" && M === "GET") {
      requireRole(actor, "admin", "analyst");
      const { listWorkspaces } = await import("./adapters/clockify");
      const data = await listWorkspaces();
      return { status: 200, body: { data } };
    }
    if (seg[1] && seg.length === 2 && M === "GET") {
      requireAuth(actor);
      const setting = await prisma.sourceSetting.findUnique({ where: { source: seg[1] } });
      return { status: 200, body: { setting } };
    }
    if (seg[1] && seg.length === 2 && M === "PUT") {
      const a = requireRole(actor, "admin");
      const setting = await prisma.sourceSetting.upsert({
        where: { source: seg[1] },
        create: { source: seg[1], config: (body?.config ?? {}) as any, updated_by: a.id },
        update: { config: (body?.config ?? {}) as any, updated_by: a.id },
      });
      await logAudit(a, "source.update", "source_setting", setting.id, { source: seg[1] });
      return { status: 200, body: { setting } };
    }
  }

  // ---- scoring config ----
  if (path === "/scoring-config" && M === "GET") {
    requireAuth(actor);
    const versions = await prisma.scoringConfig.findMany({ orderBy: { version: "desc" } });
    return { status: 200, body: { current: versions[0] ?? null, versions } };
  }
  if (path === "/scoring-config" && M === "PUT") {
    const a = requireRole(actor, "admin");
    const weights = body?.weights;
    const sumOf = (w: any) => (w ? Object.values(w).reduce((s: number, n: any) => s + Number(n), 0) : 0);
    const sum = sumOf(weights);
    if (!weights || Math.round(sum) !== 100) {
      throw new HttpError(422, "VALIDATION", `Weights must sum to 100 (got ${sum}).`);
    }
    // Per-role profiles (#13): each profile's weights must also sum to 100.
    const profiles = body?.profiles ?? null;
    if (profiles) {
      for (const [group, p] of Object.entries<any>(profiles)) {
        const ps = sumOf(p?.weights);
        if (Math.round(ps) !== 100) {
          throw new HttpError(422, "VALIDATION", `Profile "${group}" weights must sum to 100 (got ${ps}).`);
        }
        if (p?.delivery_source && !["assigned", "verified"].includes(p.delivery_source)) {
          throw new HttpError(422, "VALIDATION", `Profile "${group}" delivery_source must be "assigned" or "verified".`);
        }
      }
    }
    const agg = await prisma.scoringConfig.aggregate({ _max: { version: true } });
    const nextVersion = (agg._max.version ?? 0) + 1;
    const config = await prisma.scoringConfig.create({
      data: {
        version: nextVersion,
        weights,
        thresholds: body.thresholds ?? { low: 60, healthy: 75 },
        profiles: profiles ?? undefined,
        role_groups: body?.role_groups ?? undefined,
        effective_from: body.effective_from ?? new Date().toISOString().slice(0, 10),
        created_by: a.id,
        note: body.note ?? "New version — not applied retroactively to existing scores.",
      },
    });
    await logAudit(a, "scoring_config.update", "scoring_config", config.id, { version: config.version });
    return { status: 200, body: { config } };
  }

  // ---- lead assessments ----
  if (path === "/lead-assessments" && M === "GET") {
    requireAuth(actor);
    const data = await prisma.leadAssessment.findMany({
      where: q.period ? { period: q.period } : {},
      orderBy: { submitted_at: "desc" },
    });
    return { status: 200, body: { data } };
  }
  if (path === "/lead-assessments" && M === "POST") {
    const a = requireRole(actor, "admin", "analyst");
    const { talent_id, period, rubric_scores, comment } = body || {};
    if (!talent_id || !period || !Array.isArray(rubric_scores)) {
      throw new HttpError(422, "VALIDATION", "talent_id, period and rubric_scores are required.");
    }
    const normalized = Math.round(
      rubric_scores.reduce((s: number, r: any) => s + (Number(r.score) / 5) * 100 * Number(r.weight), 0),
    );
    const assessment = await prisma.leadAssessment.create({
      data: {
        talent_id,
        period,
        lead_ref: a.name,
        rubric_scores,
        normalized_score: normalized,
        comment: comment ?? null,
        submitted_by: a.id,
      },
    });
    await logAudit(a, "lead_assessment.submit", "lead_assessment", assessment.id, { talent_id, period });
    return { status: 201, body: { assessment } };
  }

  // ---- insights ----
  if (path === "/insights" && M === "GET") {
    requireAuth(actor);
    const where: any = {};
    if (q.period) where.period = q.period;
    if (q.status) where.status = q.status;
    const data = await prisma.insight.findMany({ where, orderBy: { generated_at: "desc" } });
    return { status: 200, body: { data } };
  }
  if (path === "/insights/generate" && M === "POST") {
    const a = requireRole(actor, "admin", "analyst");
    const period = body?.period;
    if (!period) throw new HttpError(422, "VALIDATION", "period is required.");
    const flaggedScores = await prisma.performanceScore.findMany({
      where: { period, scorable: true, flag: { not: "healthy" } },
    });
    const existing = await prisma.insight.findMany({ where: { period }, select: { talent_id: true } });
    const existingSet = new Set(existing.map((i) => i.talent_id));
    const targets = flaggedScores
      .filter((s) => (body?.talent_ids ? body.talent_ids.includes(s.talent_id) : true))
      .filter((s) => !existingSet.has(s.talent_id));
    const { aiConfigured, generateInsightForTalent } = await import("./ai/insights");
    const useAI = aiConfigured();
    let created = 0;
    let failed = 0;
    for (const s of targets) {
      let ins: Insight | null = null;
      try {
        ins = useAI ? await generateInsightForTalent(s.talent_id, period) : await buildInsightFor(s.talent_id, period);
      } catch {
        // AI failed for this talent — fall back to the heuristic so the batch progresses.
        try {
          ins = await buildInsightFor(s.talent_id, period);
        } catch {
          failed++;
        }
      }
      if (ins) created++;
    }
    const job = await prisma.job.create({
      data: { type: "insight_generation", status: "succeeded", period, created_by: a.id, finished_at: new Date(), progress: { total: targets.length, completed: created, failed, engine: useAI ? "ai" : "heuristic" } },
    });
    await logAudit(a, "insight.generate", "insight", null, { period, created });
    return { status: 202, body: { jobId: job.id, created } };
  }
  if (seg[0] === "insights" && seg[1] && ["submit", "approve", "reject"].includes(seg[2]) && M === "POST") {
    const ins = await prisma.insight.findUnique({ where: { id: seg[1] } });
    if (!ins) throw new HttpError(404, "NOT_FOUND", "Insight not found.");
    if (seg[2] === "submit") {
      const a = requireRole(actor, "admin", "analyst");
      const insight = await prisma.insight.update({ where: { id: ins.id }, data: { status: "in_review" } });
      await logAudit(a, "insight.submit", "insight", ins.id, null);
      return { status: 200, body: { insight } };
    }
    const a = requireRole(actor, "admin", "reviewer");
    if (seg[2] === "approve") {
      const insight = await prisma.insight.update({ where: { id: ins.id }, data: { status: "approved" } });
      const approval = await pushApproval("insight", ins.id, a.id, "approve", body?.comment ?? null);
      await logAudit(a, "insight.approve", "insight", ins.id, null);
      return { status: 200, body: { insight, approval } };
    }
    if (!body?.comment) throw new HttpError(422, "VALIDATION", "A comment is required when rejecting.");
    const insight = await prisma.insight.update({ where: { id: ins.id }, data: { status: "rejected" } });
    const approval = await pushApproval("insight", ins.id, a.id, "reject", body.comment);
    await logAudit(a, "insight.reject", "insight", ins.id, { comment: "[redacted]" });
    return { status: 200, body: { insight, approval } };
  }

  // ---- reports ----
  if (path === "/reports" && M === "GET") {
    requireAuth(actor);
    const where: any = {};
    if (q.period) where.period = q.period;
    if (q.status) where.status = q.status;
    const list = await prisma.monthlyReport.findMany({ where, orderBy: { created_at: "desc" } });
    return { status: 200, body: paginate(list, num(q.page, 1), num(q.limit, 50)) };
  }
  if (path === "/reports/generate" && M === "POST") {
    const a = requireRole(actor, "admin", "analyst");
    const period = body?.period;
    if (!period) throw new HttpError(422, "VALIDATION", "period is required.");
    const [scorable, projects] = await Promise.all([
      prisma.performanceScore.count({ where: { period, scorable: true } }),
      prisma.project.findMany(),
    ]);
    const report = await prisma.monthlyReport.create({
      data: {
        period,
        scope: { talents: scorable, projects: projects.length, clients: Array.from(new Set(projects.map((p) => p.client_name))) },
        status: "draft",
        audience: "internal",
        generated_by: a.id,
      },
    });
    const { composeReportItems } = await import("./report/compose");
    await composeReportItems(report.id, period);
    await logAudit(a, "report.generate", "monthly_report", report.id, { period });
    return { status: 201, body: { report } };
  }
  if (seg[0] === "reports" && seg[1]) {
    const report = await prisma.monthlyReport.findUnique({ where: { id: seg[1] } });
    if (!report) throw new HttpError(404, "NOT_FOUND", "Report not found.");
    if (seg.length === 2 && M === "GET") {
      requireAuth(actor);
      const items = await prisma.reportItem.findMany({ where: { monthly_report_id: report.id } });
      return { status: 200, body: { report, items } };
    }
    if (seg[2] === "submit" && M === "POST") {
      const a = requireRole(actor, "admin", "analyst");
      if (report.status !== "draft") throw new HttpError(409, "INVALID_TRANSITION", `Cannot submit a report in status "${report.status}".`);
      const updated = await prisma.monthlyReport.update({ where: { id: report.id }, data: { status: "in_review" } });
      await logAudit(a, "report.submit", "monthly_report", report.id, null);
      return { status: 200, body: { report: updated } };
    }
    if (seg[2] === "approve" && M === "POST") {
      const a = requireRole(actor, "admin", "reviewer");
      if (report.status !== "in_review") throw new HttpError(409, "INVALID_TRANSITION", `Only in_review reports can be approved (got "${report.status}").`);
      const updated = await prisma.monthlyReport.update({ where: { id: report.id }, data: { status: "approved" } });
      const approval = await pushApproval("monthly_report", report.id, a.id, "approve", body?.comment ?? null);
      await logAudit(a, "report.approve", "monthly_report", report.id, null);
      return { status: 200, body: { report: updated, approval } };
    }
    if (seg[2] === "reject" && M === "POST") {
      const a = requireRole(actor, "admin", "reviewer");
      if (!body?.comment) throw new HttpError(422, "VALIDATION", "A comment is required when requesting changes.");
      const updated = await prisma.monthlyReport.update({ where: { id: report.id }, data: { status: "draft" } });
      const approval = await pushApproval("monthly_report", report.id, a.id, "request_changes", body.comment);
      await logAudit(a, "report.reject", "monthly_report", report.id, { comment: "[redacted]" });
      return { status: 200, body: { report: updated, approval } };
    }
    if (seg[2] === "export" && M === "GET") {
      requireAuth(actor);
      if (report.status !== "approved" && report.status !== "published") {
        throw new HttpError(409, "REPORT_NOT_APPROVED", "Export blocked — report must be approved first (approval-workflow gate).");
      }
      const clientItems = await prisma.reportItem.findMany({ where: { monthly_report_id: report.id, client_visible: true } });
      // Phase 6 renders an actual PDF (Puppeteer) and stores file_ref.
      const updated = await prisma.monthlyReport.update({
        where: { id: report.id },
        data: { status: "published", audience: "client", file_ref: `reports/${report.period}-client-deck.pdf` },
      });
      await logAudit(actor, "report.export", "monthly_report", report.id, { audience: "client", slides: clientItems.length });
      return { status: 200, body: { report: updated, slides: clientItems } };
    }
  }

  // ---- approvals history ----
  if (path === "/approvals" && M === "GET") {
    requireAuth(actor);
    const data = await prisma.approval.findMany({
      where: q.subject ? { subject_id: q.subject } : {},
      orderBy: { decided_at: "desc" },
    });
    return { status: 200, body: { data } };
  }

  // ---- audit ----
  if (path === "/audit-logs" && M === "GET") {
    requireRole(actor, "admin");
    const where: any = {};
    if (q.entity) where.entity_type = q.entity;
    if (q.actor) where.actor_user_id = q.actor;
    const list = await prisma.auditLog.findMany({ where, orderBy: { created_at: "desc" } });
    return { status: 200, body: paginate(list, num(q.page, 1), num(q.limit, 100)) };
  }

  throw new HttpError(404, "NO_ROUTE", `No route for ${M} ${path}.`);
}
