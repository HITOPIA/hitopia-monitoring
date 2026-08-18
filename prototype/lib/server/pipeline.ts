/**
 * Scoring pipeline: turns ingested metrics (utilization, delivery) + cost rate
 * + lead assessment into BUDGET_BURN and PERFORMANCE_SCORE per talent per period.
 * Reuses the shared, traceable formula in lib/scoring.ts. Each score pins the
 * scoring_config_id used (never silently recomputed against a new config).
 *
 * Cost rate resolution (D1): per-talent override → per-role fallback → "not
 * available" (missing data is first-class, never assumed 0).
 */
import { prisma } from "./db";
import { HttpError } from "./http";
import { computeScore } from "../scoring";
import type {
  BudgetBurn,
  DeliveryRecord,
  LeadAssessment,
  ScoringConfig,
  UtilizationRecord,
} from "../contract/types";

export interface RecomputeResult {
  period: string;
  scored: number;
  not_scorable: number;
  budget_unavailable: number;
  // Identity-mapping coverage (#9): explains why some talents score 0 on a source.
  mapping: {
    total: number;
    jira_mapped: number;
    clockify_mapped: number;
    missing_delivery: number;
    missing_utilization: number;
  };
}

export async function recomputeScores(period: string): Promise<RecomputeResult> {
  const cfgRow = await prisma.scoringConfig.findFirst({ orderBy: { version: "desc" } });
  if (!cfgRow) throw new HttpError(422, "NO_SCORING_CONFIG", "Define a scoring configuration before recomputing scores.");
  const cfg = cfgRow as unknown as ScoringConfig;

  const [talents, utils, deliveries, leads, talentRates, roleRates, mappings] = await Promise.all([
    prisma.talent.findMany({ where: { status: "active" } }), // recompute only active talents (#1)
    prisma.utilizationRecord.findMany({ where: { period } }),
    prisma.deliveryRecord.findMany({ where: { period } }),
    prisma.leadAssessment.findMany({ where: { period } }),
    prisma.costRate.findMany({ where: { scope: "talent" } }),
    prisma.costRate.findMany({ where: { scope: "role" } }),
    prisma.identityMapping.findMany(),
  ]);

  const utilBy = new Map(utils.map((u) => [u.talent_id, u]));
  const delBy = new Map(deliveries.map((d) => [d.talent_id, d]));
  const leadBy = new Map(leads.map((l) => [l.talent_id, l]));
  const rateByTalent = new Map(talentRates.map((r) => [r.ref_id, r]));
  const rateByRole = new Map(roleRates.map((r) => [r.ref_id, r]));
  const jiraMapped = new Set(mappings.filter((m) => m.system === "jira").map((m) => m.talent_id));
  const clockifyMapped = new Set(mappings.filter((m) => m.system === "clockify").map((m) => m.talent_id));

  const result: RecomputeResult = {
    period, scored: 0, not_scorable: 0, budget_unavailable: 0,
    mapping: { total: talents.length, jira_mapped: 0, clockify_mapped: 0, missing_delivery: 0, missing_utilization: 0 },
  };

  for (const t of talents) {
    const util = utilBy.get(t.id) as UtilizationRecord | undefined;
    const delivery = delBy.get(t.id) as DeliveryRecord | undefined;
    const lead = leadBy.get(t.id) as LeadAssessment | undefined;
    if (jiraMapped.has(t.id)) result.mapping.jira_mapped++;
    if (clockifyMapped.has(t.id)) result.mapping.clockify_mapped++;
    if (!delivery) result.mapping.missing_delivery++;
    if (!util) result.mapping.missing_utilization++;

    // Budget burn: cost_incurred = productive_hours × hourly rate (D1).
    const rate = rateByTalent.get(t.id) ?? rateByRole.get(t.role);
    let burn: BudgetBurn;
    if (rate && util) {
      const cost = Math.round(util.productive_hours * rate.rate_amount);
      burn = {
        id: "", talent_id: t.id, period, project_id: t.primary_project_id,
        cost_incurred: cost, budget_allocated: null, burn_pct: null,
        cost_rate_id: rate.id, computed_at: new Date().toISOString(),
      };
    } else {
      result.budget_unavailable++;
      burn = {
        id: "", talent_id: t.id, period, project_id: t.primary_project_id,
        cost_incurred: null, budget_allocated: null, burn_pct: null, cost_rate_id: null,
        computed_at: null,
        unavailable_reason: !rate ? `No cost rate for "${t.role}".` : "No utilization for this period.",
      };
    }
    await prisma.budgetBurn.upsert({
      where: { talent_id_period: { talent_id: t.id, period } },
      create: {
        talent_id: t.id, period, project_id: t.primary_project_id,
        cost_incurred: burn.cost_incurred, budget_allocated: null, burn_pct: null,
        cost_rate_id: burn.cost_rate_id, computed_at: burn.computed_at ? new Date(burn.computed_at) : null,
        unavailable_reason: burn.unavailable_reason ?? null,
      },
      update: {
        cost_incurred: burn.cost_incurred, cost_rate_id: burn.cost_rate_id,
        computed_at: burn.computed_at ? new Date(burn.computed_at) : null,
        unavailable_reason: burn.unavailable_reason ?? null,
      },
    });

    // Scorable requires at least one quantitative source this period.
    const scorable = !!(util || delivery);
    if (!scorable) {
      result.not_scorable++;
      await prisma.performanceScore.upsert({
        where: { talent_id_period: { talent_id: t.id, period } },
        create: {
          talent_id: t.id, period, delivery_score: 0, utilization_score: 0, efficiency_score: 0,
          overtime_health_score: 0, lead_assessment_score: 0, total_score: 0, flag: "needs_review",
          scoring_config_id: cfg.id, scorable: false,
          not_scorable_reason: "No utilization or delivery data ingested for this period.",
        },
        update: {
          scorable: false, total_score: 0, flag: "needs_review", scoring_config_id: cfg.id,
          not_scorable_reason: "No utilization or delivery data ingested for this period.",
        },
      });
      continue;
    }

    const sr = computeScore({ util, delivery, burn, lead }, cfg, t.role);
    await prisma.performanceScore.upsert({
      where: { talent_id_period: { talent_id: t.id, period } },
      create: {
        talent_id: t.id, period,
        delivery_score: sr.delivery_score, utilization_score: sr.utilization_score,
        efficiency_score: sr.efficiency_score, overtime_health_score: sr.overtime_health_score,
        lead_assessment_score: sr.lead_assessment_score, total_score: sr.total_score,
        flag: sr.flag, scoring_config_id: cfg.id, scorable: true, not_scorable_reason: null,
      },
      update: {
        delivery_score: sr.delivery_score, utilization_score: sr.utilization_score,
        efficiency_score: sr.efficiency_score, overtime_health_score: sr.overtime_health_score,
        lead_assessment_score: sr.lead_assessment_score, total_score: sr.total_score,
        flag: sr.flag, scoring_config_id: cfg.id, scorable: true, not_scorable_reason: null,
      },
    });
    result.scored++;
  }

  return result;
}
