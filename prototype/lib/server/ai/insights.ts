/**
 * AI insight generation via an OpenAI-COMPATIBLE endpoint (any provider exposing
 * the OpenAI chat API). Configured purely by env: AI_BASE_URL, AI_API_KEY,
 * AI_MODEL. Output is strict JSON carrying source_refs for traceability; every
 * numeric claim must map to a metric we supplied (anti-hallucination). We send
 * aggregated metrics + role, minimizing PII in the prompt (R8). All insights
 * land in status "generated" and must pass human approval before client use.
 */
import OpenAI from "openai";
import { prisma } from "../db";
import { getOptional, getSecret } from "../env";
import { resolveProfile } from "../../scoring";
import type { Insight, ScoringConfig } from "../../contract/types";

export function aiConfigured(): boolean {
  return !!getOptional("AI_API_KEY") && !!getOptional("AI_BASE_URL");
}

function client(): OpenAI {
  return new OpenAI({ baseURL: getSecret("AI_BASE_URL"), apiKey: getSecret("AI_API_KEY") });
}

const SYSTEM = `You are a performance-analytics assistant for an internal talent-monitoring tool.
You receive ONLY structured metrics for one talent in one month. Produce a concise,
fair, decision-support diagnosis. Rules:
- Use ONLY the numbers provided. Never invent metrics or values.
- Every item in source_refs must reference a metric you were given.
- Tone: neutral, constructive, non-judgmental. This is decision-support, not a verdict.
- Output STRICT JSON matching the requested schema. No prose outside JSON.`;

interface MetricContext {
  talent_id: string;
  period: string;
  name: string;
  role: string;
  role_group: string;
  delivery_source: string;
  division: string;
  scores: Record<string, number>;
  flag: string;
  utilization: Record<string, number> | null;
  delivery: Record<string, number> | null;
  budget: { cost_incurred: number | null; unavailable_reason?: string | null } | null;
}

function buildPrompt(ctx: MetricContext): string {
  return `Talent metrics (period ${ctx.period}):
role: ${ctx.role} — scoring group ${ctx.role_group}, delivery scored on ${ctx.delivery_source.toUpperCase()} tickets (${ctx.division})
performance scores (0-100): ${JSON.stringify(ctx.scores)}
overall flag: ${ctx.flag}
utilization (incl. off-hours/burnout signal): ${JSON.stringify(ctx.utilization)}
delivery (incl. verified, reopens, bugs, cycle time): ${JSON.stringify(ctx.delivery)}
budget: ${JSON.stringify(ctx.budget)}

Write a fair, evidence-grounded diagnosis. For QA-style talents (delivery_source=verified),
judge delivery by tickets VERIFIED, not assigned. Treat off-hours hours as a wellbeing risk,
not productivity. Be specific about which metric drives each point.

Return JSON with this exact shape:
{
  "summary": string (one-sentence headline),
  "severity": "strength" | "watch" | "risk",
  "confidence": number (0..1, how strongly the data supports the read),
  "diagnosis": [{"cause": string, "weight": number (0..1), "detail": string}],
  "narrative": string,
  "recommendations": [string],
  "source_refs": [{"metric": string, "period": "${ctx.period}", "value": string, "talent_id": "${ctx.talent_id}"}]
}`;
}

/** Generate + persist one insight using the configured AI endpoint. */
export async function generateInsightForTalent(talentId: string, period: string): Promise<Insight | null> {
  const [t, score, u, del, budget, cfgRow] = await Promise.all([
    prisma.talent.findUnique({ where: { id: talentId } }),
    prisma.performanceScore.findFirst({ where: { talent_id: talentId, period, scorable: true } }),
    prisma.utilizationRecord.findFirst({ where: { talent_id: talentId, period } }),
    prisma.deliveryRecord.findFirst({ where: { talent_id: talentId, period } }),
    prisma.budgetBurn.findFirst({ where: { talent_id: talentId, period } }),
    prisma.scoringConfig.findFirst({ orderBy: { version: "desc" } }),
  ]);
  if (!t || !score) return null;
  const profile = resolveProfile((cfgRow as unknown as ScoringConfig) ?? ({ weights: {} } as any), t.role);

  const ctx: MetricContext = {
    talent_id: t.id,
    period,
    name: t.full_name,
    role: t.role,
    role_group: profile.group,
    delivery_source: profile.delivery_source,
    division: t.division,
    scores: {
      delivery: score.delivery_score,
      utilization: score.utilization_score,
      efficiency: score.efficiency_score,
      overtime_health: score.overtime_health_score,
      lead: score.lead_assessment_score,
      total: score.total_score,
    },
    flag: score.flag,
    utilization: u ? { tracked_hours: u.tracked_hours, productive_hours: u.productive_hours, target_hours: u.target_hours, overtime_hours: u.overtime_hours, offhours_hours: u.offhours_hours } : null,
    delivery: del ? { tickets_committed: del.tickets_committed, tickets_completed: del.tickets_completed, tickets_verified: del.tickets_verified, tickets_overdue: del.tickets_overdue, tickets_reopened: del.tickets_reopened, bugs_count: del.bugs_count, status_transitions: del.status_transitions, avg_cycle_days: del.avg_cycle_days, avg_aging_days: del.avg_aging_days } : null,
    budget: budget ? { cost_incurred: budget.cost_incurred, unavailable_reason: budget.unavailable_reason } : null,
  };

  const resp = await client().chat.completions.create({
    model: getOptional("AI_MODEL") || "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: buildPrompt(ctx) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // Validate / sanitize structured output.
  const diagnosis = Array.isArray(parsed.diagnosis)
    ? parsed.diagnosis.slice(0, 5).map((d: any) => ({ cause: String(d.cause ?? "").slice(0, 200), weight: Math.max(0, Math.min(1, Number(d.weight) || 0)), detail: String(d.detail ?? "").slice(0, 400) }))
    : [];
  const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 6).map((r: any) => String(r).slice(0, 300)) : [];
  const source_refs = Array.isArray(parsed.source_refs)
    ? parsed.source_refs.slice(0, 12).map((r: any) => ({ metric: String(r.metric ?? "").slice(0, 80), period, value: String(r.value ?? "").slice(0, 120), talent_id: t.id }))
    : [];
  const narrative = String(parsed.narrative ?? "").slice(0, 2000);
  if (!narrative || source_refs.length === 0) return null; // require grounded output
  const summary = parsed.summary ? String(parsed.summary).slice(0, 300) : null;
  const severity = ["strength", "watch", "risk"].includes(parsed.severity) ? parsed.severity : null;
  const confidence = Number.isFinite(Number(parsed.confidence)) ? Math.max(0, Math.min(1, Number(parsed.confidence))) : null;

  const created = await prisma.insight.create({
    data: {
      talent_id: t.id,
      period,
      diagnosis,
      narrative,
      summary,
      severity,
      confidence,
      recommendations,
      source_refs,
      model_id: getOptional("AI_MODEL") || "openai-compatible",
      status: "generated",
    },
  });
  return created as unknown as Insight;
}
