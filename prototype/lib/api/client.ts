/**
 * API client — the single boundary the UI uses. Every call goes over `fetch`
 * to the real backend (Next.js route handlers under /api, Postgres-backed).
 * Contract shapes match lib/contract/types.ts.
 */
import type {
  ApiError,
  Approval,
  AppUser,
  AuditLog,
  BudgetBurn,
  DataQualityFlag,
  DeliveryRecord,
  IdentityMapping,
  IngestionRun,
  Insight,
  LeadAssessment,
  MonthlyReport,
  OvertimeSummary,
  Paginated,
  PerformanceScore,
  ReportItem,
  ScoreEvidence,
  ScoringConfig,
  Talent,
  UtilizationRecord,
} from "../contract/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export class ApiClientError extends Error {
  constructor(public status: number, public payload: ApiError) {
    super(payload.error?.message ?? `HTTP ${status}`);
  }
  get code() {
    return this.payload.error?.code ?? "ERROR";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiClientError(res.status, json as ApiError);
  return json as T;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== "all") u.set(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : "";
};

export const api = {
  // auth
  login: (p: { email: string; password: string }) =>
    request<{ token: string; user: AppUser }>("POST", "/auth/login", p),
  logout: () => request<{ ok: true }>("POST", "/auth/logout"),
  me: () => request<{ user: AppUser }>("GET", "/me"),
  users: () => request<{ data: AppUser[] }>("GET", "/users"),

  // talents / scores
  talents: (p: { period?: string; division?: string; project?: string; q?: string } = {}) =>
    request<Paginated<Talent>>("GET", `/talents${qs(p)}`),
  talent: (id: string) => request<{ talent: Talent; mappings: IdentityMapping[] }>("GET", `/talents/${id}`),
  metrics: (id: string, period: string) =>
    request<{ utilization: UtilizationRecord | null; delivery: DeliveryRecord | null; budget_burn: BudgetBurn | null }>(
      "GET",
      `/talents/${id}/metrics${qs({ period })}`,
    ),
  talentScores: (id: string, period?: string) =>
    request<{ data: PerformanceScore[] }>("GET", `/talents/${id}/scores${qs({ period })}`),
  talentInsights: (id: string, period?: string) =>
    request<{ data: Insight[] }>("GET", `/talents/${id}/insights${qs({ period })}`),
  talentEvidence: (id: string, period?: string) =>
    request<ScoreEvidence>("GET", `/talents/${id}/evidence${qs({ period })}`),
  scores: (p: { period?: string; flag?: string } = {}) =>
    request<Paginated<PerformanceScore>>("GET", `/scores${qs(p)}`),
  overtime: (period: string) => request<OvertimeSummary>("GET", `/overtime${qs({ period })}`),

  // mappings
  unresolvedMappings: () => request<{ data: IdentityMapping[] }>("GET", "/mappings/unresolved"),
  verifyMapping: (id: string, external_id?: string) =>
    request<{ mapping: IdentityMapping }>("POST", `/mappings/${id}/verify`, { external_id }),

  // ingestion
  ingestionRuns: (p: { source?: string; period?: string } = {}) =>
    request<Paginated<IngestionRun>>("GET", `/ingestion/runs${qs(p)}`),
  latestIngestion: (period?: string) =>
    request<{ latest: Record<string, IngestionRun> }>("GET", `/ingestion/latest${qs({ period })}`),
  ingestionRun: (id: string) =>
    request<{ run: IngestionRun; quality_flags: DataQualityFlag[] }>("GET", `/ingestion/runs/${id}`),
  triggerIngestion: (source: string, period: string) =>
    request<{ run: IngestionRun }>("POST", "/ingestion/runs", { source, period }),

  // scoring config
  scoringConfig: () => request<{ current: ScoringConfig | null; versions: ScoringConfig[] }>("GET", "/scoring-config"),
  updateScoringConfig: (p: { weights: ScoringConfig["weights"]; thresholds: ScoringConfig["thresholds"]; profiles?: ScoringConfig["profiles"]; role_groups?: ScoringConfig["role_groups"]; effective_from?: string; note?: string }) =>
    request<{ config: ScoringConfig }>("PUT", "/scoring-config", p),

  // lead assessments
  leadAssessments: (period?: string) =>
    request<{ data: LeadAssessment[] }>("GET", `/lead-assessments${qs({ period })}`),
  submitLeadAssessment: (p: { talent_id: string; period: string; rubric_scores: LeadAssessment["rubric_scores"]; comment?: string }) =>
    request<{ assessment: LeadAssessment }>("POST", "/lead-assessments", p),

  // insights
  insights: (p: { period?: string; status?: string } = {}) =>
    request<{ data: Insight[] }>("GET", `/insights${qs(p)}`),
  generateInsights: (period: string, talent_ids?: string[]) =>
    request<{ jobId: string; created: number }>("POST", "/insights/generate", { period, talent_ids }),
  submitInsight: (id: string) => request<{ insight: Insight }>("POST", `/insights/${id}/submit`),
  approveInsight: (id: string, comment?: string) =>
    request<{ insight: Insight; approval: Approval }>("POST", `/insights/${id}/approve`, { comment }),
  rejectInsight: (id: string, comment: string) =>
    request<{ insight: Insight; approval: Approval }>("POST", `/insights/${id}/reject`, { comment }),

  // reports
  reports: (p: { period?: string; status?: string } = {}) =>
    request<Paginated<MonthlyReport>>("GET", `/reports${qs(p)}`),
  report: (id: string) => request<{ report: MonthlyReport; items: ReportItem[] }>("GET", `/reports/${id}`),
  generateReport: (period: string) => request<{ report: MonthlyReport }>("POST", "/reports/generate", { period }),
  submitReport: (id: string) => request<{ report: MonthlyReport }>("POST", `/reports/${id}/submit`),
  approveReport: (id: string, comment?: string) =>
    request<{ report: MonthlyReport; approval: Approval }>("POST", `/reports/${id}/approve`, { comment }),
  rejectReport: (id: string, comment: string) =>
    request<{ report: MonthlyReport; approval: Approval }>("POST", `/reports/${id}/reject`, { comment }),
  exportReport: (id: string) =>
    request<{ report: MonthlyReport; slides: ReportItem[] }>("GET", `/reports/${id}/export`),

  // approvals / audit
  approvals: (subject?: string) => request<{ data: Approval[] }>("GET", `/approvals${qs({ subject })}`),
  auditLogs: (p: { entity?: string; actor?: string } = {}) =>
    request<Paginated<AuditLog>>("GET", `/audit-logs${qs(p)}`),

  // sources / data integration config
  sourceSetting: (source: string) =>
    request<{ setting: { source: string; config: Record<string, unknown>; updated_at: string } | null }>("GET", `/sources/${source}`),
  saveSourceSetting: (source: string, config: Record<string, unknown>) =>
    request<{ setting: unknown }>("PUT", `/sources/${source}`, { config }),
  clockifyWorkspaces: () => request<{ data: { id: string; name: string }[] }>("GET", "/sources/clockify/workspaces"),
  recomputeScores: (period: string) =>
    request<{
      period: string; scored: number; not_scorable: number; budget_unavailable: number;
      mapping: { total: number; jira_mapped: number; clockify_mapped: number; missing_delivery: number; missing_utilization: number };
    }>("POST", "/scores/recompute", { period }),
  uploadTalentCsv: async (file: File, period?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/ingestion/talent${period ? `?period=${period}` : ""}`, {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiClientError(res.status, json as ApiError);
    return json as { created: number; updated: number; skipped: number; cost_rates: number; projects: number };
  },
};
