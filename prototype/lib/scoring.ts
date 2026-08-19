/**
 * Hybrid performance scoring — illustrative formula for the PROTOTYPE.
 *
 * The numbers shown in the dashboard are DERIVED from the source metrics by
 * this function (not hard-coded), so drill-down traceability is real: the
 * talent detail page recomputes the same breakdown the seed used.
 *
 * Per-role profiles (#13): a talent's role maps (via cfg.role_groups) to a group
 * whose profile sets the weights AND the delivery_source — "assigned" (engineers,
 * scored on tickets assigned to them) or "verified" (QA, scored on tickets they
 * moved into a verify/done state). When no profile matches, the default `weights`
 * + "assigned" apply. Delivery also folds in richer Jira signals (reopens, cycle
 * time, bugs) and overtime-health now factors off-hours/weekend work (#14, #6).
 */
import type {
  BudgetBurn,
  DeliveryRecord,
  DeliverySource,
  Flag,
  LeadAssessment,
  ScoreWeights,
  ScoringConfig,
  UtilizationRecord,
} from "./contract/types";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

export const VERIFIED_REF = 15; // verifications/month for a full QA volume score

export interface ScoreInputs {
  util?: UtilizationRecord;
  delivery?: DeliveryRecord;
  burn?: BudgetBurn;
  lead?: LeadAssessment;
}

export interface SubBreakdown {
  key: keyof ScoreWeights;
  label: string;
  weight: number; // percent
  raw: number; // 0..100 sub-score
  weighted: number; // raw * weight / 100
  formula: string;
  note?: string;
}

export interface ScoreResult {
  delivery_score: number;
  utilization_score: number;
  efficiency_score: number;
  overtime_health_score: number;
  lead_assessment_score: number;
  total_score: number;
  flag: Flag;
  redCount: number;
  group: string;
  delivery_source: DeliverySource;
  breakdown: SubBreakdown[];
}

/** Resolve which weight set + delivery source apply to a talent's role. */
export function resolveProfile(
  cfg: ScoringConfig,
  role?: string,
): { group: string; weights: ScoreWeights; delivery_source: DeliverySource } {
  const group = role ? cfg.role_groups?.[role] : undefined;
  const profile = group ? cfg.profiles?.[group] : undefined;
  return {
    group: group ?? "Default",
    weights: profile?.weights ?? cfg.weights,
    delivery_source: profile?.delivery_source ?? "assigned",
  };
}

export function computeUtilization(u?: UtilizationRecord) {
  if (!u || u.target_hours <= 0) return 0;
  return clamp((u.productive_hours / u.target_hours) * 100);
}

export function computeOvertimeHealth(u?: UtilizationRecord, completion = 0.85) {
  if (!u || u.target_hours <= 0) return 60;
  const ratio = u.overtime_hours / u.target_hours;
  const offRatio = (u.offhours_hours ?? 0) / u.target_hours;
  // overtime is a RISK signal; off-hours/weekend work is a sharper burnout signal.
  const outputPenalty = completion < 0.8 ? (0.8 - completion) * 80 : 0;
  return clamp(100 - ratio * 200 - offRatio * 120 - outputPenalty, 0, 100);
}

export function computeDelivery(d?: DeliveryRecord, source: DeliverySource = "assigned") {
  if (!d) return 0;
  if (source === "verified") {
    // QA-style: credit for verifications, lightly penalized by reopens (work that
    // bounced back after sign-off). Volume scales to a reference, with a floor.
    if (d.tickets_verified <= 0) return 0;
    const volume = Math.min(1, d.tickets_verified / VERIFIED_REF) * 80 + 20;
    return clamp(volume - d.tickets_reopened * 4);
  }
  if (d.tickets_committed <= 0) return 0;
  const completion = d.tickets_completed / d.tickets_committed;
  const overdue = d.tickets_overdue * 4;
  const reopened = d.tickets_reopened * 5;
  // FORMULA A (experiment 2026-08-18): aging penalty removed per CEO request —
  // Hitopia/Prodia uses multi-sprint "umbrella tickets" where long aging is by
  // design, not reflective of effort. See [[hitopia-delivery-formula-redesign-backlog]].
  // To restore: const aging = Math.max(0, d.avg_aging_days - 5) * 2.2;
  const bugs = Math.min(d.bugs_count ?? 0, 5) * 1.2; // capped: open defects in scope
  return clamp(completion * 100 - overdue - reopened - bugs);
}

export function computeEfficiency(
  d?: DeliveryRecord,
  u?: UtilizationRecord,
  burn?: BudgetBurn,
  source: DeliverySource = "assigned",
) {
  if (!d || !u || u.productive_hours <= 0) return 0;
  const output = source === "verified" ? d.tickets_verified : d.tickets_completed;
  const throughput = output / u.productive_hours; // tickets/hr
  const ref = 0.075;
  const base = clamp((throughput / ref) * 60 + 25);
  const burnPenalty =
    burn && burn.burn_pct != null ? Math.max(0, burn.burn_pct - 100) * 0.6 : 0;
  return clamp(base - burnPenalty);
}

export function computeScore(
  inputs: ScoreInputs,
  cfg: ScoringConfig,
  role?: string,
): ScoreResult {
  const { util, delivery, burn, lead } = inputs;
  const { group, weights: w, delivery_source } = resolveProfile(cfg, role);

  const completion = delivery
    ? delivery_source === "verified"
      ? Math.min(1, delivery.tickets_verified / VERIFIED_REF)
      : delivery.tickets_committed > 0
        ? delivery.tickets_completed / delivery.tickets_committed
        : 0.85
    : 0.85;

  const utilization_score = r1(computeUtilization(util));
  const overtime_health_score = r1(computeOvertimeHealth(util, completion));
  const delivery_score = r1(computeDelivery(delivery, delivery_source));
  const efficiency_score = r1(computeEfficiency(delivery, util, burn, delivery_source));
  const leadKnown = !!lead;
  const lead_assessment_score = r1(lead ? lead.normalized_score : 65);

  const deliveryFormula = delivery
    ? delivery_source === "verified"
      ? `verified ${delivery.tickets_verified}/${VERIFIED_REF} ref − reopened ${delivery.tickets_reopened} (QA credit)`
      : `completion ${(completion * 100).toFixed(0)}% − overdue ${delivery.tickets_overdue} − reopened ${delivery.tickets_reopened} − aging ${delivery.avg_aging_days}d − bugs ${delivery.bugs_count}`
    : "no delivery record";

  const breakdown: SubBreakdown[] = [
    {
      key: "delivery",
      label: "Delivery",
      weight: w.delivery,
      raw: delivery_score,
      weighted: r1((delivery_score * w.delivery) / 100),
      formula: deliveryFormula,
      note: delivery_source === "verified" ? "scored on VERIFIED tickets (QA profile)" : undefined,
    },
    {
      key: "utilization",
      label: "Utilization",
      weight: w.utilization,
      raw: utilization_score,
      weighted: r1((utilization_score * w.utilization) / 100),
      formula: util ? `productive ${util.productive_hours}h ÷ target ${util.target_hours}h` : "no utilization record",
    },
    {
      key: "efficiency",
      label: "Efficiency",
      weight: w.efficiency,
      raw: efficiency_score,
      weighted: r1((efficiency_score * w.efficiency) / 100),
      formula:
        util && delivery
          ? `throughput ${((delivery_source === "verified" ? delivery.tickets_verified : delivery.tickets_completed) / Math.max(util.productive_hours, 1)).toFixed(3)} tkt/h${burn?.burn_pct != null ? ` · burn ${burn.burn_pct}%` : " · burn n/a"}`
          : "insufficient data",
    },
    {
      key: "overtime",
      label: "Overtime health",
      weight: w.overtime,
      raw: overtime_health_score,
      weighted: r1((overtime_health_score * w.overtime) / 100),
      formula: util
        ? `overtime ${util.overtime_hours}h · off-hours ${util.offhours_hours ?? 0}h vs target ${util.target_hours}h (risk signal)`
        : "no utilization record",
    },
    {
      key: "lead",
      label: "Lead assessment",
      weight: w.lead,
      raw: lead_assessment_score,
      weighted: r1((lead_assessment_score * w.lead) / 100),
      formula: leadKnown ? `rubric → normalized ${lead!.normalized_score}` : "no lead input",
      note: leadKnown ? undefined : "neutral placeholder (65) — lead has not submitted",
    },
  ];

  const total_score = r1(breakdown.reduce((s, b) => s + b.weighted, 0));
  // redCount: only consider sub-scores that actually contribute to the total
  // (weight > 0). Otherwise Formula A (delivery=100%, others=0%) always shows
  // redCount=2 because util=0/eff=0 (no Clockify data), dragging healthy
  // talents down to "needs_review" — see [[hitopia-delivery-formula-redesign-backlog]].
  const redCount = breakdown.filter((b) => b.weight > 0 && b.raw < 50).length;

  let flag: Flag;
  if (total_score < cfg.thresholds.low) flag = "low";
  else if (total_score >= cfg.thresholds.healthy) flag = "healthy";
  else flag = "needs_review";
  // "two red indicators" nuance: never present a red-laden profile as healthy
  if (flag === "healthy" && redCount >= 2) flag = "needs_review";

  return {
    delivery_score,
    utilization_score,
    efficiency_score,
    overtime_health_score,
    lead_assessment_score,
    total_score,
    flag,
    redCount,
    group,
    delivery_source,
    breakdown,
  };
}
