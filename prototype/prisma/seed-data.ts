/**
 * Deterministic mock dataset for the Hitopia Monitoring prototype.
 * Shapes match contract/foundation.frozen.md. Scores are DERIVED from the
 * generated metrics via lib/scoring.ts, so dashboard drill-down is traceable.
 *
 * This is fixtures only — NO real Jira/Clockify/Sheet calls, NO secrets.
 */
import { makeRng, uuidFactory } from "./prng";
import { computeScore } from "../lib/scoring";
import type {
  AppUser,
  Approval,
  AuditLog,
  BudgetBurn,
  CostRate,
  DataQualityFlag,
  DeliveryRecord,
  DeliveryTicket,
  IdentityMapping,
  IngestionRun,
  Insight,
  LeadAssessment,
  MonthlyReport,
  PerformanceScore,
  Project,
  ReportItem,
  ScoringConfig,
  Talent,
  TimeEntry,
  UtilizationRecord,
} from "../lib/contract/types";

export const PERIODS = ["2026-03", "2026-04", "2026-05"] as const;
export const DEFAULT_PERIOD = "2026-05";
const PERIOD_WORKDAYS: Record<string, number> = {
  "2026-03": 21,
  "2026-04": 22,
  "2026-05": 21,
};

// Pools for synthesising demo evidence (Jira tickets + Clockify entries).
const TICKET_SUMMARIES = [
  "Implement feature flag for rollout",
  "Fix regression in checkout flow",
  "Refactor API client error handling",
  "Add unit tests for payment module",
  "Update design tokens to v2",
  "Optimise slow dashboard query",
  "Handle empty-state edge cases",
  "Write DB migration for evidence",
  "Address PR review feedback",
  "Accessibility pass on forms",
  "Wire up audit logging",
  "Polish loading skeletons",
];
const ENTRY_TASKS = ["development", "code review", "pairing session", "bugfix", "spec & planning", "manual testing", "deployment", "design sync"];

// Reassigned at the start of buildSeed() so EVERY call (build-time
// generateStaticParams and the browser store alike) yields identical ids.
let uid = uuidFactory(424242);
const iso = (y: number, m: number, d: number, h = 9) =>
  new Date(Date.UTC(y, m - 1, d, h, 0, 0)).toISOString();

/* ----------------------------- users ----------------------------- */
function buildUsers(): AppUser[] {
  const mk = (name: string, email: string, role: AppUser["role"]): AppUser => ({
    id: uid(),
    email,
    name,
    role,
    status: "active",
    created_at: iso(2026, 1, 5),
  });
  return [
    mk("Dewi Anggraini", "dewi@hitopia.id", "admin"),
    mk("Rangga Pratama", "rangga@hitopia.id", "analyst"),
    mk("Sari Wijaya", "sari@hitopia.id", "reviewer"),
    mk("Bima Saputra", "bima@hitopia.id", "viewer"),
  ];
}

/* --------------------------- projects ---------------------------- */
function buildProjects(): Project[] {
  const mk = (
    name: string,
    client: string,
    jira: string | null,
    clock: string | null,
    budget: number | null,
  ): Project => ({
    id: uid(),
    name,
    client_name: client,
    jira_project_key: jira,
    clockify_project_id: clock,
    budget_amount: budget,
    currency: budget ? "IDR" : null,
  });
  return [
    mk("Nusantara Bank Mobile", "Bank Nusantara", "NBM", "ckp_nbm", 980_000_000),
    mk("RuangAjar LMS", "RuangAjar", "RAL", "ckp_ral", 540_000_000),
    mk("TaniLink Marketplace", "TaniLink", "TLM", "ckp_tlm", 610_000_000),
    mk("MediCare Portal", "MediCare ID", "MCP", "ckp_mcp", 720_000_000),
    mk("Logistik One Dashboard", "Logistik One", "LOD", "ckp_lod", 430_000_000),
    mk("Hitopia Internal Platform", "Hitopia", "HIP", "ckp_hip", null),
  ];
}

/* --------------------------- cost rates -------------------------- */
// Intentionally NO rate for Data roles → budget burn "tidak tersedia" (F5).
const ROLE_RATES: Record<string, number> = {
  "Frontend Engineer": 220_000,
  "Backend Engineer": 245_000,
  "UI Designer": 200_000,
  "QA Engineer": 180_000,
  "Product Manager": 285_000,
  "Engineering Lead": 360_000,
};

function buildCostRates(): CostRate[] {
  return Object.entries(ROLE_RATES).map(([role, rate]) => ({
    id: uid(),
    scope: "role",
    ref_id: role,
    rate_amount: rate,
    currency: "IDR",
    effective_from: "2026-01-01",
    source: "Finance master rate card v2026",
  }));
}

/* ---------------------------- talents ---------------------------- */
type Tier = "strong" | "mid" | "weak";
interface TalentSpec {
  name: string;
  division: string;
  role: string;
  employment: string;
  tier: Tier;
  projectIdx: number;
  // mapping integrity for the LATEST period
  integrity: "ok" | "unresolved" | "not_scorable";
}

const TALENT_SPECS: TalentSpec[] = [
  { name: "Aditya Nugroho", division: "Engineering", role: "Frontend Engineer", employment: "full_time", tier: "strong", projectIdx: 0, integrity: "ok" },
  { name: "Bunga Lestari", division: "Engineering", role: "Backend Engineer", employment: "full_time", tier: "mid", projectIdx: 0, integrity: "ok" },
  { name: "Cahya Ramadhan", division: "Engineering", role: "Backend Engineer", employment: "contract", tier: "weak", projectIdx: 3, integrity: "ok" },
  { name: "Dimas Prabowo", division: "Engineering", role: "Frontend Engineer", employment: "full_time", tier: "mid", projectIdx: 1, integrity: "unresolved" },
  { name: "Eka Fitriani", division: "Engineering", role: "Engineering Lead", employment: "full_time", tier: "strong", projectIdx: 2, integrity: "ok" },
  { name: "Fajar Maulana", division: "Engineering", role: "Backend Engineer", employment: "full_time", tier: "weak", projectIdx: 4, integrity: "ok" },
  { name: "Gita Permata", division: "Design", role: "UI Designer", employment: "full_time", tier: "strong", projectIdx: 1, integrity: "ok" },
  { name: "Hadi Kurniawan", division: "Design", role: "UI Designer", employment: "contract", tier: "mid", projectIdx: 3, integrity: "ok" },
  { name: "Indah Puspita", division: "Design", role: "UI Designer", employment: "full_time", tier: "weak", projectIdx: 0, integrity: "unresolved" },
  { name: "Joko Santoso", division: "QA", role: "QA Engineer", employment: "full_time", tier: "mid", projectIdx: 2, integrity: "ok" },
  { name: "Kirana Dewanti", division: "QA", role: "QA Engineer", employment: "full_time", tier: "strong", projectIdx: 0, integrity: "ok" },
  { name: "Lukman Hakim", division: "QA", role: "QA Engineer", employment: "contract", tier: "weak", projectIdx: 4, integrity: "ok" },
  { name: "Maya Anjani", division: "Data", role: "Data Analyst", employment: "full_time", tier: "mid", projectIdx: 2, integrity: "ok" },
  { name: "Nanda Wibowo", division: "Data", role: "Data Engineer", employment: "full_time", tier: "strong", projectIdx: 3, integrity: "ok" },
  { name: "Oka Mahendra", division: "Data", role: "Data Analyst", employment: "contract", tier: "weak", projectIdx: 1, integrity: "ok" },
  { name: "Putri Handayani", division: "Product", role: "Product Manager", employment: "full_time", tier: "strong", projectIdx: 0, integrity: "ok" },
  { name: "Reza Aditama", division: "Product", role: "Product Manager", employment: "full_time", tier: "mid", projectIdx: 4, integrity: "ok" },
  { name: "Salsa Maharani", division: "Engineering", role: "Frontend Engineer", employment: "full_time", tier: "mid", projectIdx: 2, integrity: "ok" },
  { name: "Taufik Hidayat", division: "Engineering", role: "Backend Engineer", employment: "contract", tier: "weak", projectIdx: 3, integrity: "ok" },
  { name: "Uli Simbolon", division: "Design", role: "UI Designer", employment: "full_time", tier: "mid", projectIdx: 4, integrity: "ok" },
  { name: "Vino Aprilio", division: "Engineering", role: "Frontend Engineer", employment: "full_time", tier: "strong", projectIdx: 1, integrity: "not_scorable" },
  { name: "Winda Oktavia", division: "QA", role: "QA Engineer", employment: "full_time", tier: "mid", projectIdx: 0, integrity: "ok" },
];

/* --------------------------- the seed ---------------------------- */
export interface SeedData {
  users: AppUser[];
  projects: Project[];
  costRates: CostRate[];
  talents: Talent[];
  mappings: IdentityMapping[];
  utilization: UtilizationRecord[];
  delivery: DeliveryRecord[];
  deliveryTickets: DeliveryTicket[];
  timeEntries: TimeEntry[];
  budgetBurn: BudgetBurn[];
  leadAssessments: LeadAssessment[];
  scoringConfigs: ScoringConfig[];
  scores: PerformanceScore[];
  ingestionRuns: IngestionRun[];
  qualityFlags: DataQualityFlag[];
  insights: Insight[];
  reports: MonthlyReport[];
  reportItems: ReportItem[];
  approvals: Approval[];
  auditLogs: AuditLog[];
}

export function buildSeed(): SeedData {
  uid = uuidFactory(424242); // reset so ids are identical on every build/run
  const rng = makeRng(987654);
  const users = buildUsers();
  const projects = buildProjects();
  const costRates = buildCostRates();
  const admin = users.find((u) => u.role === "admin")!;
  const analyst = users.find((u) => u.role === "analyst")!;
  const reviewer = users.find((u) => u.role === "reviewer")!;

  // scoring configs (versioned) — per-role profiles (#13): QA scores on VERIFIED
  // Jira work (delivery_source), engineers on ASSIGNED; weights differ per group.
  const ROLE_GROUPS: Record<string, string> = {
    "Backend Engineer": "Engineering",
    "Frontend Engineer": "Engineering",
    "Data Engineer": "Engineering",
    "Engineering Lead": "Engineering",
    "QA Engineer": "QA",
    "UI Designer": "Design",
    "Product Manager": "Product",
    "Data Analyst": "Data",
  };
  const PROFILES = {
    Engineering: { weights: { delivery: 35, utilization: 25, efficiency: 20, overtime: 10, lead: 10 }, delivery_source: "assigned" as const },
    QA: { weights: { delivery: 25, utilization: 25, efficiency: 15, overtime: 15, lead: 20 }, delivery_source: "verified" as const },
    Design: { weights: { delivery: 30, utilization: 30, efficiency: 15, overtime: 10, lead: 15 }, delivery_source: "assigned" as const },
    Product: { weights: { delivery: 20, utilization: 25, efficiency: 15, overtime: 15, lead: 25 }, delivery_source: "assigned" as const },
    Data: { weights: { delivery: 30, utilization: 25, efficiency: 20, overtime: 10, lead: 15 }, delivery_source: "assigned" as const },
  };
  const cfgV1: ScoringConfig = {
    id: uid(),
    version: 1,
    weights: { delivery: 35, utilization: 25, efficiency: 20, overtime: 10, lead: 10 },
    thresholds: { low: 60, healthy: 75 },
    profiles: PROFILES,
    role_groups: ROLE_GROUPS,
    effective_from: "2026-01-01",
    created_by: admin.id,
    created_at: iso(2026, 1, 6),
    note: "Initial calibration proposal — pending validation against lead judgement.",
  };
  const cfgV2: ScoringConfig = {
    id: uid(),
    version: 2,
    weights: { delivery: 35, utilization: 25, efficiency: 20, overtime: 10, lead: 10 },
    thresholds: { low: 60, healthy: 75 },
    profiles: PROFILES,
    role_groups: ROLE_GROUPS,
    effective_from: "2026-05-01",
    created_by: admin.id,
    created_at: iso(2026, 5, 2),
    note: "Recalibrated efficiency reference throughput after Apr sample review. Weights unchanged. Not applied retroactively to ≤Apr scores.",
  };
  const scoringConfigs = [cfgV1, cfgV2];
  const cfgFor = (period: string) => (period >= "2026-05" ? cfgV2 : cfgV1);

  // talents
  const talents: Talent[] = TALENT_SPECS.map((s, i) => ({
    id: uid(),
    full_name: s.name,
    email: `${s.name.toLowerCase().replace(/[^a-z]+/g, ".")}@hitopia.id`,
    division: s.division,
    role: s.role,
    employment_type: s.employment,
    status: "active",
    primary_project_id: projects[s.projectIdx].id,
    created_at: iso(2025, 9, 1 + (i % 20)),
    updated_at: iso(2026, 5, 30),
  }));

  // identity mappings
  const mappings: IdentityMapping[] = [];
  talents.forEach((t, i) => {
    const spec = TALENT_SPECS[i];
    const proj = projects[spec.projectIdx];
    const handle = t.full_name.toLowerCase().split(" ")[0];
    // gsheet — master, always high+verified (source of truth for identity)
    mappings.push({
      id: uid(),
      talent_id: t.id,
      system: "gsheet",
      external_id: `row-${100 + i}`,
      external_display_name: t.full_name,
      confidence: "high",
      verified: true,
      verified_by: admin.id,
      verified_at: iso(2026, 5, 3),
    });
    // jira
    const jiraWeak = spec.integrity !== "ok";
    mappings.push({
      id: uid(),
      talent_id: t.id,
      system: "jira",
      external_id: jiraWeak ? `${handle}${rng.int(1, 9)}@ext` : `${handle}@hitopia.id`,
      external_display_name: jiraWeak ? `${t.full_name} (?)` : t.full_name,
      confidence: spec.integrity === "not_scorable" ? "low" : jiraWeak ? "medium" : "high",
      verified: !jiraWeak,
      verified_by: jiraWeak ? null : admin.id,
      verified_at: jiraWeak ? null : iso(2026, 5, 3),
    });
    // clockify
    const clockWeak = spec.integrity === "not_scorable";
    mappings.push({
      id: uid(),
      talent_id: t.id,
      system: "clockify",
      external_id: clockWeak ? `unknown-${rng.int(1000, 9999)}` : `ck_${handle}_${proj.jira_project_key?.toLowerCase()}`,
      external_display_name: clockWeak ? "— no confident match —" : t.full_name,
      confidence: clockWeak ? "low" : "high",
      verified: !clockWeak,
      verified_by: clockWeak ? null : admin.id,
      verified_at: clockWeak ? null : iso(2026, 5, 3),
    });
  });

  // ingestion runs + quality flags
  const ingestionRuns: IngestionRun[] = [];
  const qualityFlags: DataQualityFlag[] = [];
  const runIdByKey: Record<string, string> = {};
  const sources: IngestionRun["source"][] = ["gsheet", "jira", "clockify"];
  PERIODS.forEach((period) => {
    const [y, m] = period.split("-").map(Number);
    sources.forEach((source) => {
      const id = uid();
      runIdByKey[`${source}:${period}`] = id;
      const isLatest = period === DEFAULT_PERIOD;
      const partial = isLatest && source === "jira";
      const status: IngestionRun["status"] = partial ? "partial" : "success";
      const recs = source === "gsheet" ? talents.length : rng.int(180, 240);
      const warn = source === "clockify" ? 2 : partial ? 3 : 1;
      const block = source === "gsheet" && isLatest ? 1 : 0;
      ingestionRuns.push({
        id,
        source,
        period,
        status,
        started_at: iso(y, m === 12 ? 1 : m + 1, 1, 2),
        finished_at: iso(y, m === 12 ? 1 : m + 1, 1, partial ? 3 : 2),
        records_ingested: recs,
        quality_summary: {
          info: rng.int(1, 4),
          warn,
          block,
          note: partial
            ? "Jira REST rate-limited at 12:04 UTC; 2 boards retried, 1 board incomplete."
            : undefined,
        },
      });
      if (isLatest && source === "jira") {
        qualityFlags.push(
          {
            id: uid(),
            ingestion_run_id: id,
            talent_id: null,
            severity: "warn",
            code: "RATE_LIMIT_PARTIAL",
            message: "Board MCP not fully paginated — delivery for MediCare may undercount.",
          },
          {
            id: uid(),
            ingestion_run_id: id,
            talent_id: talents.find((t) => TALENT_SPECS[talents.indexOf(t)].integrity === "unresolved")?.id ?? null,
            severity: "warn",
            code: "ASSIGNEE_UNRESOLVED",
            message: "Tickets assigned to an account with no confident talent mapping.",
          },
        );
      }
      if (isLatest && source === "clockify") {
        const zeroT = talents[2];
        qualityFlags.push({
          id: uid(),
          ingestion_run_id: id,
          talent_id: zeroT.id,
          severity: "warn",
          code: "TRACKED_HOURS_LOW",
          message: "Tracked hours < 40% of target — verify Clockify entries before scoring.",
        });
      }
      if (isLatest && source === "gsheet") {
        const ns = talents.find((t) => TALENT_SPECS[talents.indexOf(t)].integrity === "not_scorable");
        qualityFlags.push({
          id: uid(),
          ingestion_run_id: id,
          talent_id: ns?.id ?? null,
          severity: "block",
          code: "NO_MAPPABLE_IDENTITY",
          message: "Master row present but no confident Jira/Clockify match — excluded from scoring.",
        });
      }
    });
  });

  // per talent / period metrics + scores + lead assessments
  const utilization: UtilizationRecord[] = [];
  const delivery: DeliveryRecord[] = [];
  const deliveryTickets: DeliveryTicket[] = [];
  const timeEntries: TimeEntry[] = [];
  const budgetBurn: BudgetBurn[] = [];
  const leadAssessments: LeadAssessment[] = [];
  const scores: PerformanceScore[] = [];

  const tierBand = (tier: Tier) => {
    if (tier === "strong") return { compl: [0.9, 1.0], prod: [0.86, 0.95], util: [0.92, 1.08], otBase: [0, 8], aging: [2, 5], overdue: [0, 1], reopened: [0, 1], lead: [78, 92] };
    if (tier === "mid") return { compl: [0.78, 0.92], prod: [0.78, 0.9], util: [0.85, 1.05], otBase: [4, 16], aging: [4, 9], overdue: [1, 3], reopened: [0, 2], lead: [62, 80] };
    return { compl: [0.5, 0.78], prod: [0.66, 0.84], util: [0.7, 1.15], otBase: [14, 34], aging: [9, 20], overdue: [2, 6], reopened: [1, 4], lead: [45, 66] };
  };

  talents.forEach((t, i) => {
    const spec = TALENT_SPECS[i];
    const proj = projects[spec.projectIdx];
    const hasRate = ROLE_RATES[t.role] != null;
    PERIODS.forEach((period) => {
      const [y, m] = period.split("-").map(Number);
      const workdays = PERIOD_WORKDAYS[period];
      const target = workdays * 8;
      const b = tierBand(spec.tier);
      // not-scorable only for the latest period (recently added, unverified)
      const notScorable = spec.integrity === "not_scorable" && period === DEFAULT_PERIOD;

      const trackedFactor = rng.float(b.util[0], b.util[1], 2);
      const tracked = Math.round(target * trackedFactor);
      const prodRatio = rng.float(b.prod[0], b.prod[1], 2);
      const productive = Math.round(tracked * prodRatio);
      const overtime = Math.max(0, tracked - target) + (spec.tier === "weak" ? rng.int(b.otBase[0], b.otBase[1]) : rng.int(0, b.otBase[1]));
      const offhours = Math.max(0, Math.round(overtime * (spec.tier === "weak" ? rng.float(0.5, 0.9, 2) : rng.float(0.1, 0.4, 2)) * 10) / 10);
      const runIdClock = runIdByKey[`clockify:${period}`];
      const u: UtilizationRecord = {
        id: uid(),
        talent_id: t.id,
        period,
        project_id: proj.id,
        tracked_hours: tracked,
        productive_hours: productive,
        target_hours: target,
        overtime_hours: overtime,
        offhours_hours: offhours,
        source_run_id: runIdClock,
      };

      const committed = rng.int(8, 16);
      const compl = rng.float(b.compl[0], b.compl[1], 2);
      const completed = Math.min(committed, Math.round(committed * compl));
      const isQA = /qa|test/i.test(t.role);
      const verified = isQA ? rng.int(10, 22) : rng.int(0, 4);
      const bugs = rng.int(0, spec.tier === "weak" ? 5 : 3);
      const avgAging = rng.float(b.aging[0], b.aging[1], 1);
      const transitions = committed * rng.int(2, 4) + rng.int(0, 6);
      const runIdJira = runIdByKey[`jira:${period}`];
      const d: DeliveryRecord = {
        id: uid(),
        talent_id: t.id,
        period,
        tickets_committed: committed,
        tickets_completed: completed,
        tickets_overdue: rng.int(b.overdue[0], b.overdue[1]),
        tickets_reopened: rng.int(b.reopened[0], b.reopened[1]),
        tickets_verified: verified,
        avg_aging_days: avgAging,
        avg_cycle_days: avgAging,
        bugs_count: bugs,
        status_transitions: transitions,
        source_run_id: runIdJira,
      };

      const burn: BudgetBurn = hasRate
        ? (() => {
            const cost = Math.round(productive * ROLE_RATES[t.role]);
            const alloc = proj.budget_amount ? Math.round(proj.budget_amount / 14) : null;
            return {
              id: uid(),
              talent_id: t.id,
              period,
              project_id: proj.id,
              cost_incurred: cost,
              budget_allocated: alloc,
              burn_pct: alloc ? Math.round((cost / alloc) * 1000) / 10 : null,
              cost_rate_id: costRates.find((c) => c.ref_id === t.role)?.id ?? null,
              computed_at: iso(y, m === 12 ? 1 : m + 1, 1, 4),
            };
          })()
        : {
            id: uid(),
            talent_id: t.id,
            period,
            project_id: proj.id,
            cost_incurred: null,
            budget_allocated: null,
            burn_pct: null,
            cost_rate_id: null,
            computed_at: null,
            unavailable_reason: `No COST_RATE for role "${t.role}" — budget burn marked tidak tersedia (not assumed).`,
          };

      // lead assessment for ~65% of talent-periods
      let lead: LeadAssessment | undefined;
      if (rng.chance(0.65) && !notScorable) {
        const base = rng.int(b.lead[0], b.lead[1]);
        const rubric = [
          { key: "ownership", label: "Ownership & initiative", score: Math.max(1, Math.min(5, Math.round(base / 20))), weight: 0.3 },
          { key: "collaboration", label: "Collaboration", score: Math.max(1, Math.min(5, Math.round(base / 20) + rng.int(-1, 1))), weight: 0.25 },
          { key: "quality", label: "Craft & quality", score: Math.max(1, Math.min(5, Math.round(base / 20) + rng.int(-1, 0))), weight: 0.25 },
          { key: "growth", label: "Growth trajectory", score: Math.max(1, Math.min(5, Math.round(base / 20) + rng.int(-1, 1))), weight: 0.2 },
        ];
        const normalized = Math.round(
          rubric.reduce((s, r) => s + (r.score / 5) * 100 * r.weight, 0),
        );
        lead = {
          id: uid(),
          talent_id: t.id,
          period,
          lead_ref: spec.division + " Lead",
          rubric_scores: rubric,
          normalized_score: normalized,
          comment: spec.tier === "weak" ? "Needs closer support on delivery commitments this cycle." : null,
          submitted_by: analyst.id,
          submitted_at: iso(y, m === 12 ? 1 : m + 1, 2, 10),
        };
        leadAssessments.push(lead);
      }

      utilization.push(u);
      delivery.push(d);
      budgetBurn.push(burn);

      // --- demo evidence: synthesise the tickets & time entries behind d and u ---
      const jiraKey = proj.jira_project_key ?? "TASK";
      const overdueCount = Math.min(d.tickets_overdue, committed - completed);
      for (let k = 0; k < committed; k++) {
        const done = k < completed;
        const overdue = !done && k < completed + overdueCount;
        const createdDay = rng.int(1, 18);
        const aging = done ? Math.max(1, Math.round(rng.float(b.aging[0], b.aging[1], 1))) : 0;
        const isBugTk = rng.chance(0.2);
        deliveryTickets.push({
          id: uid(),
          talent_id: t.id,
          period,
          issue_key: `${jiraKey}-${1000 + i * 100 + k}`,
          summary: TICKET_SUMMARIES[rng.int(0, TICKET_SUMMARIES.length - 1)],
          status: done ? "Done" : overdue ? "In Progress" : rng.chance(0.5) ? "In Progress" : "To Do",
          status_category: done ? "done" : overdue ? "in_progress" : "to_do",
          completed: done,
          overdue,
          created: iso(y, m, createdDay, 10),
          resolved_date: done ? iso(y, m, Math.min(28, createdDay + aging), 15) : null,
          due_date: iso(y, m, rng.int(10, 28), 17),
          aging_days: aging,
          issue_type: isBugTk ? "Bug" : rng.chance(0.5) ? "Story" : "Task",
          is_bug: isBugTk,
          reopen_count: done ? rng.int(0, 1) : 0,
          transitions: rng.int(1, 5),
          credit: "assigned",
          source_run_id: runIdJira,
        });
      }
      // QA-style verified-credit evidence — tickets this person verified, not assigned
      if (verified > 0) {
        for (let v = 0; v < Math.min(verified, 14); v++) {
          const vBug = rng.chance(0.3);
          deliveryTickets.push({
            id: uid(),
            talent_id: t.id,
            period,
            issue_key: `${jiraKey}-${5000 + i * 100 + v}`,
            summary: TICKET_SUMMARIES[rng.int(0, TICKET_SUMMARIES.length - 1)],
            status: "Done",
            status_category: "done",
            completed: true,
            overdue: false,
            created: iso(y, m, rng.int(1, 14), 10),
            resolved_date: iso(y, m, rng.int(15, 28), 16),
            due_date: iso(y, m, rng.int(15, 28), 17),
            aging_days: rng.int(2, 9),
            issue_type: vBug ? "Bug" : "Story",
            is_bug: vBug,
            reopen_count: rng.int(0, 1),
            transitions: rng.int(2, 6),
            credit: "verified",
            source_run_id: runIdJira,
          });
        }
      }
      const entryCount = Math.min(workdays, 22);
      const perEntrySec = Math.round((tracked * 3600) / entryCount);
      const firstTicketIdx = deliveryTickets.length - committed;
      for (let e = 0; e < entryCount; e++) {
        const ref = committed > 0 ? deliveryTickets[firstTicketIdx + (e % committed)] : null;
        const dateStr = `${period}-${String(Math.min(28, e + 1)).padStart(2, "0")}`;
        const offEntry = rng.chance(spec.tier === "weak" ? 0.35 : 0.12);
        const startHour = offEntry ? (rng.chance(0.5) ? 6 : 20) : 9;
        const startIso = `${dateStr}T${String(startHour).padStart(2, "0")}:00:00+07:00`;
        const endIso = new Date(Date.parse(startIso) + perEntrySec * 1000).toISOString();
        const offhoursKind: "before" | "after" | null = startHour < 9 ? "before" : startHour >= 18 ? "after" : null;
        timeEntries.push({
          id: uid(),
          talent_id: t.id,
          period,
          entry_date: dateStr,
          start_at: startIso,
          end_at: endIso,
          clockify_entry_id: uid(),
          offhours_kind: offhoursKind,
          description: ref
            ? `${ref.issue_key} — ${ENTRY_TASKS[rng.int(0, ENTRY_TASKS.length - 1)]}`
            : ENTRY_TASKS[rng.int(0, ENTRY_TASKS.length - 1)],
          ticket_ref: ref ? ref.issue_key : null,
          project_name: proj.name,
          duration_sec: perEntrySec,
          source_run_id: runIdClock,
        });
      }

      const cfg = cfgFor(period);
      const sr = computeScore({ util: u, delivery: d, burn, lead }, cfg, t.role);
      scores.push({
        id: uid(),
        talent_id: t.id,
        period,
        delivery_score: sr.delivery_score,
        utilization_score: sr.utilization_score,
        efficiency_score: sr.efficiency_score,
        overtime_health_score: sr.overtime_health_score,
        lead_assessment_score: sr.lead_assessment_score,
        total_score: notScorable ? 0 : sr.total_score,
        flag: sr.flag,
        scoring_config_id: cfg.id,
        computed_at: iso(y, m === 12 ? 1 : m + 1, 1, 5),
        scorable: !notScorable,
        not_scorable_reason: notScorable
          ? "No confident Jira/Clockify identity mapping for this period — excluded from scoring (identity-mapping)."
          : null,
      });
    });
  });

  // insights for flagged (low / needs_review) scorable talents in the latest period
  const insights: Insight[] = [];
  const latestScores = scores.filter((s) => s.period === DEFAULT_PERIOD && s.scorable);
  latestScores
    .filter((s) => s.flag !== "healthy")
    .forEach((s, idx) => {
      const t = talents.find((x) => x.id === s.talent_id)!;
      const u = utilization.find((x) => x.talent_id === t.id && x.period === DEFAULT_PERIOD)!;
      const d = delivery.find((x) => x.talent_id === t.id && x.period === DEFAULT_PERIOD)!;
      const diagnosis: Insight["diagnosis"] = [];
      const refs: Insight["source_refs"] = [];
      const recs: string[] = [];
      const subs: [string, number, string][] = [
        ["delivery", s.delivery_score, `${d.tickets_completed}/${d.tickets_committed} tickets, ${d.tickets_overdue} overdue, aging ${d.avg_aging_days}d`],
        ["utilization", s.utilization_score, `${u.productive_hours}h productive of ${u.target_hours}h target`],
        ["efficiency", s.efficiency_score, `throughput ${(d.tickets_completed / Math.max(u.productive_hours, 1)).toFixed(3)} tkt/h`],
        ["overtime_health", s.overtime_health_score, `${u.overtime_hours}h overtime`],
      ];
      subs
        .filter(([, v]) => v < 62)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3)
        .forEach(([metric, val, detail]) => {
          const cause =
            metric === "delivery"
              ? "Delivery slippage — overdue & aging tickets"
              : metric === "utilization"
                ? "Under-utilization against target hours"
                : metric === "efficiency"
                  ? "Low throughput per productive hour"
                  : "Overtime without matching output (burnout risk)";
          diagnosis.push({ cause, weight: Math.round((1 - val / 100) * 100) / 100, detail });
          refs.push({ metric, period: DEFAULT_PERIOD, value: detail, talent_id: t.id });
          recs.push(
            metric === "delivery"
              ? "Re-scope sprint commitment and clear the two oldest aging tickets first."
              : metric === "utilization"
                ? "Confirm Clockify capture is complete, then rebalance allocation."
                : metric === "efficiency"
                  ? "Pair on the slowest workflow; review blockers in standup."
                  : "Cap overtime this cycle; redistribute load with the lead.",
          );
        });
      if (diagnosis.length === 0) {
        diagnosis.push({ cause: "Borderline composite — no single dominant cause", weight: 0.4, detail: `total ${s.total_score}` });
        refs.push({ metric: "total_score", period: DEFAULT_PERIOD, value: String(s.total_score), talent_id: t.id });
        recs.push("Hold for one more period and confirm with lead assessment.");
      }
      const status: Insight["status"] = idx === 0 ? "approved" : idx === 1 ? "in_review" : "generated";
      insights.push({
        id: uid(),
        talent_id: t.id,
        period: DEFAULT_PERIOD,
        diagnosis,
        narrative: `${t.full_name} scored ${s.total_score} (${s.flag.replace("_", " ")}) for ${DEFAULT_PERIOD}. The composite is driven mainly by ${diagnosis[0].cause.toLowerCase()}; ${d.tickets_completed} of ${d.tickets_committed} committed tickets closed with ${u.overtime_hours}h overtime logged. Treat as decision-support, not a verdict — verify against the lead's view before any action.`,
        summary: `${t.full_name}: ${s.flag.replace("_", " ")} composite ${s.total_score} for ${DEFAULT_PERIOD}.`,
        severity: s.flag === "low" ? "risk" : s.flag === "needs_review" ? "watch" : "strength",
        confidence: idx === 0 ? 0.82 : 0.68,
        recommendations: recs,
        source_refs: refs,
        model_id: idx === 0 ? "claude-opus-4-8" : "claude-sonnet-4-6",
        status,
        generated_at: iso(2026, 6, 1, 6),
      });
    });

  // monthly reports + items + approvals
  const reports: MonthlyReport[] = [];
  const items: ReportItem[] = [];
  const approvals: Approval[] = [];

  const clientsFor = (period: string) => {
    const ids = new Set(
      utilization
        .filter((x) => x.period === period)
        .map((x) => projects.find((p) => p.id === x.project_id)?.client_name)
        .filter(Boolean) as string[],
    );
    return Array.from(ids);
  };

  const mkReport = (
    period: string,
    status: MonthlyReport["status"],
    audience: MonthlyReport["audience"],
    createdBy: string,
    createdAt: string,
  ): MonthlyReport => ({
    id: uid(),
    period,
    scope: {
      talents: scores.filter((s) => s.period === period && s.scorable).length,
      projects: projects.length,
      clients: clientsFor(period),
    },
    status,
    audience,
    exec_summary:
      status === "draft"
        ? null
        : `In ${period}, ${scores.filter((s) => s.period === period && s.flag === "healthy").length} talents tracked healthy and ${scores.filter((s) => s.period === period && s.flag === "low").length} flagged low. Recommendations focus on delivery aging and overtime balance. All figures trace to source metrics; sensitive per-talent diagnostics remain internal-only.`,
    file_ref: status === "published" ? `reports/${period}-client-deck.pdf` : null,
    generated_by: createdBy,
    created_at: createdAt,
  });

  const addItems = (report: MonthlyReport) => {
    items.push({
      id: uid(),
      monthly_report_id: report.id,
      talent_id: null,
      insight_id: null,
      section: "Executive summary",
      content: {
        title: `Performance overview — ${report.period}`,
        body: report.exec_summary ?? "Draft — exec summary not yet generated.",
      },
      client_visible: true,
    });
    items.push({
      id: uid(),
      monthly_report_id: report.id,
      talent_id: null,
      insight_id: null,
      section: "Delivery health (aggregate)",
      content: {
        title: "Aggregate delivery & utilization",
        body: "Team-level throughput and utilization trends, anonymised. No individual scores shown to client.",
      },
      client_visible: true,
    });
    // internal-only per-talent diagnostics (sensitive)
    insights.slice(0, 3).forEach((ins) => {
      const t = talents.find((x) => x.id === ins.talent_id)!;
      items.push({
        id: uid(),
        monthly_report_id: report.id,
        talent_id: t.id,
        insight_id: ins.id,
        section: "Per-talent diagnostic (internal)",
        content: {
          title: `${t.full_name} — ${t.role}`,
          body: ins.narrative,
          refs: ins.source_refs.map((r) => `${r.metric} ${r.period}`),
        },
        client_visible: false,
      });
    });
    items.push({
      id: uid(),
      monthly_report_id: report.id,
      talent_id: null,
      insight_id: null,
      section: "Recommendations",
      content: {
        title: "Forward actions",
        body: "Coaching and allocation actions for next cycle. Client-safe phrasing only.",
      },
      client_visible: true,
    });
  };

  const rDraft = mkReport("2026-05", "draft", "internal", analyst.id, iso(2026, 6, 2, 8));
  const rReview = mkReport("2026-04", "in_review", "internal", analyst.id, iso(2026, 5, 4, 8));
  const rApproved = mkReport("2026-03", "published", "client", analyst.id, iso(2026, 4, 3, 8));
  [rDraft, rReview, rApproved].forEach((r) => {
    reports.push(r);
    addItems(r);
  });

  approvals.push({
    id: uid(),
    subject_type: "monthly_report",
    subject_id: rApproved.id,
    reviewer_id: reviewer.id,
    decision: "approve",
    comment: "Client-safe. Internal diagnostics correctly excluded from export.",
    decided_at: iso(2026, 4, 4, 11),
  });
  const approvedInsight = insights.find((i) => i.status === "approved");
  if (approvedInsight) {
    approvals.push({
      id: uid(),
      subject_type: "insight",
      subject_id: approvedInsight.id,
      reviewer_id: reviewer.id,
      decision: "approve",
      comment: "Diagnosis traces to source metrics; no over-claim. Approved for internal use.",
      decided_at: iso(2026, 6, 3, 9),
    });
  }

  // audit log (seed)
  const auditLogs: AuditLog[] = [
    audit(admin, "ingestion.trigger", "ingestion_run", runIdByKey[`jira:${DEFAULT_PERIOD}`], { source: "jira", period: DEFAULT_PERIOD }, iso(2026, 6, 1, 2)),
    audit(admin, "scoring_config.update", "scoring_config", cfgV2.id, { version: 2 }, iso(2026, 5, 2, 9)),
    audit(analyst, "insight.generate", "insight", insights[0]?.id ?? null, { period: DEFAULT_PERIOD, count: insights.length }, iso(2026, 6, 1, 6)),
    audit(reviewer, "report.approve", "monthly_report", rApproved.id, { period: "2026-03" }, iso(2026, 4, 4, 11)),
    audit(admin, "mapping.verify", "identity_mapping", mappings[1]?.id ?? null, { system: "jira" }, iso(2026, 5, 3, 10)),
    audit(analyst, "auth.login", "app_user", analyst.id, { provider: "google" }, iso(2026, 6, 10, 8)),
  ];

  return {
    users,
    projects,
    costRates,
    talents,
    mappings,
    utilization,
    delivery,
    deliveryTickets,
    timeEntries,
    budgetBurn,
    leadAssessments,
    scoringConfigs,
    scores,
    ingestionRuns,
    qualityFlags,
    insights,
    reports,
    reportItems: items,
    approvals,
    auditLogs,
  };
}

function audit(
  actor: AppUser,
  action: string,
  entity_type: string,
  entity_id: string | null,
  metadata: Record<string, unknown>,
  at: string,
): AuditLog {
  return {
    id: uid(),
    actor_user_id: actor.id,
    action,
    entity_type,
    entity_id,
    metadata,
    ip: "10.20.0.x",
    created_at: at,
  };
}
