"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useApp, useToast } from "@/components/providers";
import { useAsync } from "@/lib/hooks";
import { api } from "@/lib/api/client";
import { computeScore } from "@/lib/scoring";
import { computeRoleStandings } from "@/lib/role-standing";
import { can, allowedRolesLabel } from "@/lib/rbac";
import { Avatar, Note, SectionLabel, KeyVal } from "@/components/bits";
import { InsightCard } from "@/components/insight-card";
import { Card, CardHead, Badge, ScoreMeter, Button, Modal, Field, Textarea, Skeleton, EmptyState } from "@/components/ui";
import { CompositeGauge, ScoreTrend } from "@/components/charts";
import {
  FLAG_LABEL,
  FLAG_TONE,
  formatPeriod,
  formatIDR,
  num,
  pct,
  shortDate,
  scoreTone,
} from "@/lib/format";
import { IconBack, IconCheck, IconLock, IconSparkle, IconAlert } from "@/components/icons";
import type { IdentityMapping, LeadAssessment } from "@/lib/contract/types";

const SYSTEM_LABEL: Record<string, string> = { gsheet: "Google Sheets", jira: "Jira", clockify: "Clockify" };
const CONF_TONE: Record<string, "healthy" | "review" | "low"> = { high: "healthy", medium: "review", low: "low" };

const RUBRIC = [
  { key: "ownership", label: "Ownership & initiative", weight: 0.3 },
  { key: "collaboration", label: "Collaboration", weight: 0.25 },
  { key: "quality", label: "Craft & quality", weight: 0.25 },
  { key: "growth", label: "Growth trajectory", weight: 0.2 },
];

export function TalentDetail({ id }: { id: string }) {
  const { period, user } = useApp();
  const toast = useToast();

  const q = useAsync(
    () =>
      Promise.all([
        api.talent(id),
        api.metrics(id, period),
        api.talentScores(id),
        api.talentInsights(id, period),
        api.leadAssessments(period),
        api.scoringConfig(),
        api.talentEvidence(id, period),
        api.scores({ period }),
        api.talents(),
      ]),
    [id, period],
  );

  const [leadOpen, setLeadOpen] = useState(false);
  const [evOpen, setEvOpen] = useState<"tickets" | "entries" | null>(null);

  const model = useMemo(() => {
    if (!q.data) return null;
    const [talentRes, metricsRes, scoresRes, insightsRes, leadsRes, cfgRes, evidenceRes, periodScoresRes, allTalentsRes] = q.data;
    const score = scoresRes.data.find((s) => s.period === period) ?? null;
    const lead = leadsRes.data.find((l) => l.talent_id === id) ?? null;
    // Always resolve to a usable config; fall back to defaults on a fresh DB.
    const cfg =
      cfgRes.versions.find((c) => c.id === score?.scoring_config_id) ??
      cfgRes.current ??
      ({
        id: "",
        version: 0,
        weights: { delivery: 35, utilization: 25, efficiency: 20, overtime: 10, lead: 10 },
        thresholds: { low: 60, healthy: 75 },
        effective_from: "",
        created_by: "",
        created_at: "",
      } as NonNullable<(typeof cfgRes)["current"]>);
    const computed =
      score?.scorable && (metricsRes.utilization || metricsRes.delivery)
        ? computeScore(
            {
              util: metricsRes.utilization ?? undefined,
              delivery: metricsRes.delivery ?? undefined,
              burn: metricsRes.budget_burn ?? undefined,
              lead: lead ?? undefined,
            },
            cfg,
            talentRes.talent.role,
          )
        : null;
    const trend = scoresRes.data
      .slice()
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((s) => ({ period: formatPeriod(s.period).split(" ")[0], score: s.scorable ? s.total_score : null }));
    const standing = computeRoleStandings(periodScoresRes.data, allTalentsRes.data).get(id) ?? null;
    return { ...talentRes, metrics: metricsRes, score, lead, cfg, computed, insights: insightsRes.data, trend, allLeads: leadsRes.data, evidence: evidenceRes, standing };
  }, [q.data, id, period]);

  async function verify(mp: IdentityMapping) {
    try {
      await api.verifyMapping(mp.id);
      toast(`Verified ${SYSTEM_LABEL[mp.system]} mapping`, "success");
      q.reload();
    } catch (e: any) {
      toast(e.message ?? "Verify failed", "error");
    }
  }

  if (q.loading && !q.data) return <DetailSkeleton />;
  if (q.error || !model) return <Note tone="low">Failed to load talent: {q.error}</Note>;

  const { talent, mappings, metrics, score, lead, cfg, computed, insights, trend, evidence, standing } = model;
  const u = metrics.utilization;
  const d = metrics.delivery;
  const burn = metrics.budget_burn;
  const tone = score?.scorable ? FLAG_TONE[score.flag] : "neutral";

  return (
    <div>
      <Link href="/talents" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-ink focus-ring">
        <IconBack className="h-4 w-4" /> All talents
      </Link>

      {/* header */}
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={talent.full_name} size={64} />
          <div>
            <h1 className="font-display text-[30px] leading-none tracking-tightish text-ink">{talent.full_name}</h1>
            <p className="mt-1.5 text-[14px] text-ink-muted">
              {talent.role} · {talent.division} · <span className="capitalize">{talent.employment_type.replace("_", " ")}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={talent.status === "active" ? "healthy" : "neutral"} dot>{talent.status}</Badge>
              <span className="ref-chip">{talent.email}</span>
            </div>
          </div>
        </div>

        {score?.scorable ? (
          <div className="flex items-center gap-4 rounded-xl border border-line bg-surface px-5 py-3 shadow-card">
            <CompositeGauge value={score.total_score} tone={FLAG_TONE[score.flag]} />
            <div>
              <Badge tone={FLAG_TONE[score.flag]} dot>{FLAG_LABEL[score.flag]}</Badge>
              <p className="mt-2 text-[12px] text-ink-muted">Composite · {formatPeriod(period)}</p>
              <p className="mt-0.5 text-[11px] text-ink-faint">scoring config v{cfg.version}</p>
              {standing && standing.total > 1 && (
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  rank <span className="text-ink-soft">#{standing.rank}/{standing.total}</span> in {standing.groupLabel}
                  {" · "}
                  <span className={standing.belowMedian ? "text-low" : "text-healthy"}>
                    {standing.delta >= 0 ? "+" : ""}{standing.delta}
                  </span>{" "}vs median
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-xs rounded-xl border border-low/30 bg-low-soft/50 px-4 py-3">
            <div className="flex items-center gap-2 text-low">
              <IconLock className="h-4 w-4" />
              <span className="text-[13px] font-medium">Not scorable this period</span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{score?.not_scorable_reason}</p>
          </div>
        )}
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* LEFT column */}
        <div className="flex flex-col gap-6">
          {/* score traceability */}
          {computed && (
            <Card>
              <CardHead
                title="Score breakdown"
                sub="Each component recomputed from source metrics — this is the trace, not a stored number."
                right={<span className="ref-chip">v{cfg.version} · {cfg.thresholds.low}/{cfg.thresholds.healthy}</span>}
              />
              <div className="divide-y divide-line">
                {computed.breakdown.map((b) => (
                  <div key={b.key} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[14px] font-medium text-ink">{b.label}</span>
                        <span className="eyebrow !text-[10px]">{b.weight}% weight</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`numeral text-[16px] text-${scoreTone(b.raw)}`}>{b.raw.toFixed(0)}</span>
                        <span className="text-[11px] text-ink-faint">→ {b.weighted.toFixed(1)} pts</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <ScoreMeter value={b.raw} tone={scoreTone(b.raw)} className="flex-1" />
                    </div>
                    <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-ink-muted">{b.formula}</p>
                    {b.note && <p className="mt-0.5 text-[11px] italic text-review">{b.note}</p>}

                    {/* evidence — opens in a modal so the card never resizes (#3, #4) */}
                    {b.key === "delivery" && evidence.tickets.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEvOpen("tickets")}
                        className="mt-2 text-[11.5px] font-medium text-accent-ink hover:underline focus-ring"
                      >
                        ▸ {evidence.tickets.length} Jira tickets · evidence
                      </button>
                    )}
                    {b.key === "utilization" && evidence.time_entries.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEvOpen("entries")}
                        className="mt-2 text-[11.5px] font-medium text-accent-ink hover:underline focus-ring"
                      >
                        ▸ {evidence.time_entries.length} Clockify entries · {(evidence.time_entries.reduce((s, e) => s + e.duration_sec, 0) / 3600).toFixed(1)}h
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between bg-surface px-5 py-3">
                  <span className="text-[13px] font-medium text-ink">Composite</span>
                  <div className="flex items-baseline gap-2">
                    <span className={`numeral text-[20px] text-${tone}`}>{computed.total_score.toFixed(1)}</span>
                    <span className="text-[11px] text-ink-faint">/ 100</span>
                  </div>
                </div>
              </div>
              {lead && score && Math.abs(computed.total_score - score.total_score) > 0.6 && (
                <div className="border-t border-line px-5 py-3">
                  <Note tone="review" icon={<IconAlert className="h-3.5 w-3.5" />}>
                    Recomputed live with the latest lead assessment ({computed.total_score.toFixed(1)}). The persisted score
                    ({score.total_score.toFixed(1)}) updates on the next scoring run — config changes are never applied retroactively.
                  </Note>
                </div>
              )}
            </Card>
          )}

          {/* score evidence — modals keep the breakdown card from resizing (#3, #4) */}
          <Modal
            open={evOpen === "tickets"}
            onClose={() => setEvOpen(null)}
            wide
            title="Jira delivery evidence"
            sub={`${evidence.tickets.length} tickets · ${formatPeriod(period)} — every ticket behind the delivery score`}
          >
            <ul className="divide-y divide-line">
              {evidence.tickets.map((tk) => {
                const url = evidence.jira_base_url ? `${evidence.jira_base_url.replace(/\/+$/, "")}/browse/${tk.issue_key}` : null;
                return (
                  <li key={tk.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-accent-ink hover:underline">{tk.issue_key} ↗</a>
                        ) : (
                          <span className="font-mono text-[12px] text-ink">{tk.issue_key}</span>
                        )}
                        {tk.credit === "verified" && <Badge tone="accent">verified</Badge>}
                        {tk.completed && <Badge tone="healthy">done</Badge>}
                        {tk.overdue && <Badge tone="low">overdue</Badge>}
                        {tk.is_bug && <Badge tone="review">bug</Badge>}
                        {tk.reopen_count > 0 && <Badge tone="low">reopened ×{tk.reopen_count}</Badge>}
                      </div>
                      {tk.summary && <p className="mt-0.5 truncate text-[12px] text-ink-muted">{tk.summary}</p>}
                    </div>
                    <span className="shrink-0 text-right text-[11px] text-ink-faint">
                      {tk.status}{tk.completed && tk.aging_days ? ` · ${tk.aging_days}d` : ""}{tk.transitions ? ` · ${tk.transitions} moves` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Modal>
          <Modal
            open={evOpen === "entries"}
            onClose={() => setEvOpen(null)}
            wide
            title="Clockify time evidence"
            sub={`${evidence.time_entries.length} entries · ${(evidence.time_entries.reduce((s, e) => s + e.duration_sec, 0) / 3600).toFixed(1)}h tracked`}
          >
            <ul className="divide-y divide-line">
              {evidence.time_entries.map((e) => {
                const url = e.ticket_ref && evidence.jira_base_url ? `${evidence.jira_base_url.replace(/\/+$/, "")}/browse/${e.ticket_ref}` : null;
                const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : null);
                return (
                  <li key={e.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] text-ink-faint">{e.entry_date}</span>
                        {e.start_at && <span className="text-[11px] text-ink-faint">{hhmm(e.start_at)}{e.end_at ? `–${hhmm(e.end_at)}` : ""} WIB</span>}
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="font-mono text-[11.5px] text-accent-ink hover:underline">{e.ticket_ref} ↗</a>
                        ) : e.ticket_ref ? (
                          <span className="font-mono text-[11.5px] text-accent-ink">{e.ticket_ref}</span>
                        ) : null}
                        {e.offhours_kind && <Badge tone="review">{e.offhours_kind}</Badge>}
                        {e.project_name && <span className="text-[11px] text-ink-faint">· {e.project_name}</span>}
                      </div>
                      {e.description && <p className="mt-0.5 truncate text-[12px] text-ink-muted">{e.description}</p>}
                    </div>
                    <span className="numeral shrink-0 text-[12px] text-ink">{(e.duration_sec / 3600).toFixed(2)}h</span>
                  </li>
                );
              })}
            </ul>
          </Modal>

          {/* metrics */}
          <div>
            <SectionLabel>Source metrics · {formatPeriod(period)}</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-4">
                <div className="eyebrow mb-2">Utilization</div>
                {u ? (
                  <dl>
                    <KeyVal k="Tracked" v={`${num(u.tracked_hours)} h`} />
                    <KeyVal k="Productive" v={`${num(u.productive_hours)} h`} />
                    <KeyVal k="Target" v={`${num(u.target_hours)} h`} />
                    <KeyVal k="Overtime" v={`${num(u.overtime_hours)} h`} />
                    <KeyVal k="Off-hours" v={`${num(u.offhours_hours)} h`} />
                  </dl>
                ) : (
                  <p className="text-[12px] text-ink-faint">No record.</p>
                )}
              </Card>
              <Card className="p-4">
                <div className="eyebrow mb-2">Delivery</div>
                {d ? (
                  <dl>
                    <KeyVal k="Committed" v={num(d.tickets_committed)} />
                    <KeyVal k="Completed" v={num(d.tickets_completed)} />
                    <KeyVal k="Verified (QA)" v={num(d.tickets_verified)} />
                    <KeyVal k="Overdue" v={num(d.tickets_overdue)} />
                    <KeyVal k="Reopened" v={num(d.tickets_reopened)} />
                    <KeyVal k="Bugs" v={num(d.bugs_count)} />
                    <KeyVal k="Avg cycle" v={`${d.avg_cycle_days} d`} />
                    <KeyVal k="Transitions" v={num(d.status_transitions)} />
                  </dl>
                ) : (
                  <p className="text-[12px] text-ink-faint">No record.</p>
                )}
              </Card>
              <Card className="p-4">
                <div className="eyebrow mb-2">Budget burn</div>
                {burn && burn.cost_incurred != null ? (
                  <dl>
                    <KeyVal k="Cost" v={formatIDR(burn.cost_incurred)} />
                    <KeyVal k="Allocated" v={formatIDR(burn.budget_allocated)} />
                    <KeyVal k="Burn" v={pct(burn.burn_pct, 1)} />
                  </dl>
                ) : (
                  <div className="rounded-lg border border-dashed border-line-strong bg-surface px-3 py-3">
                    <p className="text-[12px] font-medium text-review">Tidak tersedia</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                      {burn?.unavailable_reason ?? "No cost rate for this role."}
                    </p>
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* insights */}
          <div>
            <SectionLabel>AI insight</SectionLabel>
            {insights.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<IconSparkle className="h-7 w-7" />}
                  title={score?.flag === "healthy" ? "No diagnostic needed" : "No insight generated yet"}
                  hint={score?.flag === "healthy" ? "Insights are generated for low / needs-review talents." : "Generate insights from the AI insights page."}
                />
              </Card>
            ) : (
              insights.map((ins) => <InsightCard key={ins.id} ins={ins} />)
            )}
          </div>
        </div>

        {/* RIGHT column */}
        <div className="flex flex-col gap-6">
          {/* trend */}
          <Card>
            <CardHead title="Score trend" sub="Composite across periods" />
            <div className="px-3 py-4">
              <ScoreTrend data={trend} low={cfg.thresholds.low} healthy={cfg.thresholds.healthy} />
            </div>
          </Card>

          {/* project */}
          <Card className="p-4">
            <div className="eyebrow mb-2">Assignment</div>
            <KeyVal k="Project" v={<span className="font-sans text-ink">{talent.primary_project_id ? "primary set" : "—"}</span>} mono={false} />
            <KeyVal k="Status" v={<span className="capitalize">{talent.status}</span>} mono={false} />
            <KeyVal k="Joined" v={shortDate(talent.created_at)} />
          </Card>

          {/* identity mappings */}
          <Card>
            <CardHead title="Identity mapping" sub="Cross-system match for this talent" />
            <ul className="divide-y divide-line">
              {mappings.map((mp) => {
                const unresolved = !mp.verified || mp.confidence !== "high";
                return (
                  <li key={mp.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink">{SYSTEM_LABEL[mp.system]}</p>
                        <p className="truncate font-mono text-[11.5px] text-ink-muted">{mp.external_id}</p>
                      </div>
                      <Badge tone={CONF_TONE[mp.confidence]}>{mp.confidence}</Badge>
                    </div>
                    {unresolved ? (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[11.5px] text-review">
                          <IconAlert className="h-3.5 w-3.5" /> needs verification
                        </span>
                        {can("mapping.verify", user?.role) ? (
                          <Button size="sm" variant="secondary" icon={<IconCheck className="h-3.5 w-3.5" />} onClick={() => verify(mp)}>
                            Verify
                          </Button>
                        ) : (
                          <span className="text-[11px] text-ink-faint">{allowedRolesLabel("mapping.verify")} only</span>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-healthy">
                        <IconCheck className="h-3.5 w-3.5" /> verified {shortDate(mp.verified_at)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* lead assessment */}
          <Card>
            <CardHead
              title="Lead assessment"
              sub="Qualitative rubric · 10% of composite"
              right={
                can("lead.submit", user?.role) && (
                  <Button size="sm" variant="primary" onClick={() => setLeadOpen(true)}>
                    {lead ? "Update" : "Submit"}
                  </Button>
                )
              }
            />
            <div className="px-4 py-4">
              {lead ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[12px] text-ink-muted">{lead.lead_ref}</span>
                    <span className="numeral text-[18px] text-ink">{lead.normalized_score}</span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {lead.rubric_scores.map((r) => (
                      <li key={r.key} className="flex items-center gap-2.5">
                        <span className="w-32 truncate text-[12px] text-ink-soft">{r.label}</span>
                        <div className="flex flex-1 gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= r.score ? "bg-accent" : "bg-line"}`} />
                          ))}
                        </div>
                        <span className="numeral w-4 text-[12px] text-ink">{r.score}</span>
                      </li>
                    ))}
                  </ul>
                  {lead.comment && <p className="mt-3 border-t border-line pt-2.5 text-[12px] italic text-ink-muted">“{lead.comment}”</p>}
                </div>
              ) : (
                <p className="text-[12.5px] text-ink-muted">
                  No assessment for {formatPeriod(period)}. The composite uses a neutral placeholder (65) until a lead submits.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {can("lead.submit", user?.role) && (
        <LeadModal
          open={leadOpen}
          onClose={() => setLeadOpen(false)}
          talentId={id}
          period={period}
          existing={lead}
          onDone={() => {
            setLeadOpen(false);
            q.reload();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------- lead assessment modal ---------------------- */
function LeadModal({
  open,
  onClose,
  talentId,
  period,
  existing,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  talentId: string;
  period: string;
  existing: LeadAssessment | null;
  onDone: () => void;
}) {
  const toast = useToast();
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(RUBRIC.map((r) => [r.key, existing?.rubric_scores.find((x) => x.key === r.key)?.score ?? 3])),
  );
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [saving, setSaving] = useState(false);

  const normalized = Math.round(RUBRIC.reduce((s, r) => s + (scores[r.key] / 5) * 100 * r.weight, 0));

  async function submit() {
    setSaving(true);
    try {
      await api.submitLeadAssessment({
        talent_id: talentId,
        period,
        rubric_scores: RUBRIC.map((r) => ({ key: r.key, label: r.label, score: scores[r.key], weight: r.weight })),
        comment: comment || undefined,
      });
      toast("Lead assessment submitted", "success");
      onDone();
    } catch (e: any) {
      toast(e.message ?? "Submit failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lead assessment"
      sub={`Structured rubric · ${formatPeriod(period)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={submit}>Submit · {normalized}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {RUBRIC.map((r) => (
          <div key={r.key}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink">{r.label}</span>
              <span className="eyebrow !text-[10px]">{Math.round(r.weight * 100)}%</span>
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setScores((s) => ({ ...s, [r.key]: n }))}
                  className={`h-9 flex-1 rounded-lg border text-[13px] font-mono transition-colors focus-ring ${
                    n <= scores[r.key]
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line-strong bg-raised text-ink-faint hover:border-ink-faint"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <Field label="Comment (optional)">
          <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Context for this cycle…" />
        </Field>
        <Note tone="neutral">
          Normalised to <span className="font-mono">{normalized}</span>/100 and weighted at 10% of the composite. Recorded against
          your account and written to the audit log.
        </Note>
      </div>
    </Modal>
  );
}

function DetailSkeleton() {
  return (
    <div>
      <Skeleton className="mb-4 h-5 w-24" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-40" />
        </div>
      </div>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
