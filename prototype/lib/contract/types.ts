/**
 * Types mirroring contract/foundation.frozen.md (ERD + API).
 * Field names are snake_case to match the contract's JSON payload convention.
 * This file is the single source of truth for shapes in the prototype's
 * mock data layer — swap the mock client for `fetch` and these stay valid.
 */

export type UUID = string;
export type Period = string; // "YYYY-MM"
export type ISODate = string; // ISO-8601 UTC

export type Flag = "low" | "needs_review" | "healthy";
export type Confidence = "high" | "medium" | "low";
export type Severity = "info" | "warn" | "block";
export type SourceSystem = "gsheet" | "jira" | "clockify";
export type Role = "admin" | "analyst" | "reviewer" | "viewer";

export interface Talent {
  id: UUID;
  full_name: string;
  email: string;
  division: string;
  role: string;
  employment_type: string;
  status: "active" | "inactive";
  primary_project_id: UUID | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface IdentityMapping {
  id: UUID;
  talent_id: UUID;
  system: SourceSystem;
  external_id: string;
  external_display_name: string;
  confidence: Confidence;
  verified: boolean;
  verified_by: UUID | null;
  verified_at: ISODate | null;
}

export interface Project {
  id: UUID;
  name: string;
  client_name: string;
  jira_project_key: string | null;
  clockify_project_id: string | null;
  budget_amount: number | null;
  currency: string | null;
}

export interface IngestionRun {
  id: UUID;
  source: SourceSystem;
  period: Period;
  status: "pending" | "running" | "success" | "partial" | "failed";
  started_at: ISODate;
  finished_at: ISODate | null;
  records_ingested: number;
  quality_summary: {
    info: number;
    warn: number;
    block: number;
    note?: string;
  } | null;
}

export interface DataQualityFlag {
  id: UUID;
  ingestion_run_id: UUID;
  talent_id: UUID | null;
  severity: Severity;
  code: string;
  message: string;
}

export interface UtilizationRecord {
  id: UUID;
  talent_id: UUID;
  period: Period;
  project_id: UUID | null;
  tracked_hours: number;
  productive_hours: number;
  target_hours: number;
  overtime_hours: number;
  offhours_hours: number;
  source_run_id: UUID;
}

export interface DeliveryRecord {
  id: UUID;
  talent_id: UUID;
  period: Period;
  tickets_committed: number;
  tickets_completed: number;
  tickets_overdue: number;
  tickets_reopened: number;
  tickets_verified: number;
  avg_aging_days: number;
  avg_cycle_days: number;
  bugs_count: number;
  status_transitions: number;
  source_run_id: UUID;
}

// Per-ticket / per-entry evidence behind the delivery & utilization sub-scores.
// Extends the frozen contract (additive) — see plan note R4: foundation.frozen.md
// is unchanged; these shapes live here as the working source of truth.
export interface DeliveryTicket {
  id: UUID;
  talent_id: UUID;
  period: Period;
  issue_key: string;
  summary: string | null;
  status: string;
  status_category: string; // done | in_progress | to_do
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
  credit: string | null; // assigned | verified
  source_run_id: UUID;
}

export interface TimeEntry {
  id: UUID;
  talent_id: UUID;
  period: Period;
  entry_date: string; // YYYY-MM-DD
  description: string | null;
  ticket_ref: string | null; // Jira key parsed from the description, if any
  project_name: string | null;
  duration_sec: number;
  start_at: string | null;
  end_at: string | null;
  clockify_entry_id: string | null;
  offhours_kind: "before" | "after" | "weekend" | null;
  source_run_id: UUID;
}

export interface ScoreEvidence {
  tickets: DeliveryTicket[];
  time_entries: TimeEntry[];
  jira_base_url?: string | null; // non-secret, for client-side issue links
}

export interface CostRate {
  id: UUID;
  scope: "talent" | "role";
  ref_id: string;
  rate_amount: number;
  currency: string;
  effective_from: string;
  source: string;
}

export interface BudgetBurn {
  id: UUID;
  talent_id: UUID;
  period: Period;
  project_id: UUID | null;
  cost_incurred: number | null;
  budget_allocated: number | null;
  burn_pct: number | null;
  cost_rate_id: UUID | null;
  computed_at: ISODate | null;
  // prototype-only convenience flag (not in contract): cost rate missing
  unavailable_reason?: string | null;
}

export interface RubricItem {
  key: string;
  label: string;
  score: number; // 1..5
  weight: number;
}

export interface LeadAssessment {
  id: UUID;
  talent_id: UUID;
  period: Period;
  lead_ref: string;
  rubric_scores: RubricItem[];
  normalized_score: number; // 0..100
  comment: string | null;
  submitted_by: UUID;
  submitted_at: ISODate;
}

export type DeliverySource = "assigned" | "verified";

export interface ScoreWeights {
  delivery: number;
  utilization: number;
  efficiency: number;
  overtime: number;
  lead: number;
}

export interface ScoringProfile {
  weights: ScoreWeights;
  delivery_source: DeliverySource;
}

export interface ScoringConfig {
  id: UUID;
  version: number;
  weights: ScoreWeights;
  thresholds: { low: number; healthy: number };
  // Per-role-group overrides. A talent's role maps via role_groups → group;
  // the group's profile wins, else `weights` (the default profile) is used.
  profiles?: Record<string, ScoringProfile>;
  role_groups?: Record<string, string>;
  effective_from: string;
  created_by: UUID;
  created_at: ISODate;
  note?: string;
}

export interface PerformanceScore {
  id: UUID;
  talent_id: UUID;
  period: Period;
  delivery_score: number;
  utilization_score: number;
  efficiency_score: number;
  overtime_health_score: number;
  lead_assessment_score: number;
  total_score: number; // 0..100
  flag: Flag;
  scoring_config_id: UUID;
  computed_at: ISODate;
  scorable: boolean;
  not_scorable_reason?: string | null;
}

export interface SourceRef {
  metric: string; // e.g. "utilization", "delivery.tickets_overdue"
  period: Period;
  value: string; // human-readable resolved value
  talent_id: UUID;
}

export interface DiagnosisItem {
  cause: string;
  weight: number; // contribution 0..1
  detail: string;
}

export type InsightSeverity = "strength" | "watch" | "risk";

export interface Insight {
  id: UUID;
  talent_id: UUID;
  period: Period;
  diagnosis: DiagnosisItem[];
  narrative: string;
  summary?: string | null; // one-line headline
  severity?: InsightSeverity | null;
  confidence?: number | null; // 0..1
  recommendations: string[];
  source_refs: SourceRef[];
  model_id: string;
  status: "generated" | "in_review" | "approved" | "rejected";
  generated_at: ISODate;
}

export interface ReportMetric {
  label: string;
  value: string;
  sub?: string;
}
export interface ReportTable {
  columns: string[];
  rows: string[][];
}
export interface ReportContent {
  title: string;
  body: string;
  refs?: string[];
  metrics?: ReportMetric[];
  table?: ReportTable;
}

export interface ReportItem {
  id: UUID;
  monthly_report_id: UUID;
  talent_id: UUID | null;
  insight_id: UUID | null;
  section: string;
  content: ReportContent;
  client_visible: boolean;
}

export interface MonthlyReport {
  id: UUID;
  period: Period;
  scope: { talents: number; projects: number; clients: string[] };
  status: "draft" | "in_review" | "approved" | "published";
  audience: "internal" | "client";
  exec_summary: string | null;
  file_ref: string | null;
  generated_by: UUID;
  created_at: ISODate;
}

export interface Approval {
  id: UUID;
  subject_type: "insight" | "monthly_report";
  subject_id: UUID;
  reviewer_id: UUID;
  decision: "approve" | "reject" | "request_changes";
  comment: string | null;
  decided_at: ISODate;
}

export interface AppUser {
  id: UUID;
  email: string;
  name: string;
  role: Role;
  status: "active" | "disabled";
  created_at: ISODate;
}

export interface AuditLog {
  id: UUID;
  actor_user_id: UUID | null;
  action: string;
  entity_type: string;
  entity_id: UUID | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  created_at: ISODate;
}

/* ---------- Overtime & work-hour schedule (additive, prototype) ---------- */
export interface Schedule {
  work_start: string; // "HH:MM" local
  work_end: string; // "HH:MM" local
  timezone: string; // IANA, e.g. "Asia/Jakarta"
  workdays: number[]; // 0=Sun .. 6=Sat that count as working days
}

export interface OvertimeRow {
  talent_id: UUID;
  full_name: string;
  role: string;
  division: string;
  tracked_hours: number;
  target_hours: number;
  overtime_hours: number;
  offhours_hours: number;
  before_hours: number;
  after_hours: number;
  weekend_hours: number;
  overtime_health_score: number | null;
}

export interface OvertimeSummary {
  period: Period;
  schedule: Schedule;
  total_overtime_hours: number;
  total_offhours_hours: number;
  before_hours: number;
  after_hours: number;
  weekend_hours: number;
  talents_over_target: number;
  rows: OvertimeRow[];
}

/* ---------- API envelopes (contract "Konvensi") ---------- */
export interface Meta {
  page: number;
  limit: number;
  total: number;
}
export interface Paginated<T> {
  data: T[];
  meta: Meta;
}
export interface ApiError {
  error: { code: string; message: string; details?: Record<string, unknown> };
}
