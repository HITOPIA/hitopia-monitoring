/**
 * Plain-language descriptions of each scoring component — the single source of
 * truth for "what does Delivery/Utilization/Efficiency/Overtime health/Lead
 * assessment mean?" (#8). Rendered on the scoring page and reused to ground AI
 * insights and the client report. Formulas mirror lib/scoring.ts.
 */
import type { ScoreWeights } from "./contract/types";

export interface ScoreComponentMeta {
  key: keyof ScoreWeights;
  label: string;
  what: string;
  inputs: string;
  formula: string;
  why: string;
}

export const SCORE_COMPONENTS: ScoreComponentMeta[] = [
  {
    key: "delivery",
    label: "Delivery",
    what: "How much committed work shipped, and how cleanly.",
    inputs: "Jira tickets — assigned (engineers) or VERIFIED (QA) — plus reopens, due dates, cycle time, and bug count.",
    formula:
      "Assigned: completion% − overdue×4 − reopened×5 − aging(>5d)×2.2 − bugs(≤5)×1.2.  Verified (QA): min(1, verified÷15)×80 + 20 − reopened×4.",
    why: "Output is the core of performance — but role-aware: engineers are scored on tickets assigned to them, QA on tickets they moved to verified/done.",
  },
  {
    key: "utilization",
    label: "Utilization",
    what: "Share of target capacity that went to productive, tracked work.",
    inputs: "Clockify productive hours vs the month's working-day target (working days × 8h).",
    formula: "productive_hours ÷ target_hours × 100 (capped at 100).",
    why: "Flags both idle capacity and — read with overtime health — unsustainable load.",
  },
  {
    key: "efficiency",
    label: "Efficiency",
    what: "Throughput per productive hour, adjusted for budget burn.",
    inputs: "Tickets completed (or verified, for QA) ÷ productive hours; budget burn % when a cost rate exists.",
    formula: "(throughput ÷ 0.075 ref) × 60 + 25, minus a penalty when budget burn exceeds 100%.",
    why: "Separates 'busy' from 'effective' — long hours with little output score lower.",
  },
  {
    key: "overtime",
    label: "Overtime health",
    what: "Sustainability of the workload — a wellbeing/burnout signal (higher is healthier).",
    inputs: "Overtime hours AND off-hours hours (logged before/after the work window or on weekends) vs target.",
    formula: "100 − overtime_ratio×200 − offhours_ratio×120 − low-output penalty.",
    why: "Protects against burnout: consistent off-hours/weekend work lowers the score even when output is high.",
  },
  {
    key: "lead",
    label: "Lead assessment",
    what: "The reporting lead's qualitative rubric — ownership, collaboration, craft, growth.",
    inputs: "Manual rubric submission, normalized to 0–100.",
    formula: "Σ(rubric_item ÷ 5 × 100 × weight). Neutral 65 when the lead hasn't submitted.",
    why: "Captures judgement metrics can't — mentoring, reliability, initiative.",
  },
];

export const SCORE_COMPONENT_BY_KEY = Object.fromEntries(
  SCORE_COMPONENTS.map((c) => [c.key, c]),
) as Record<keyof ScoreWeights, ScoreComponentMeta>;
