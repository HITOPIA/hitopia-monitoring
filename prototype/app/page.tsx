"use client";

import Link from "next/link";
import { useApp } from "@/components/providers";
import { useAsync } from "@/lib/hooks";
import { api } from "@/lib/api/client";
import { PageHeader, SectionLabel, Avatar, Note, LinkButton } from "@/components/bits";
import { Card, CardHead, Stat, Badge, ScoreMeter, Skeleton, EmptyState } from "@/components/ui";
import { FlagDonut, DivisionBars } from "@/components/charts";
import { FLAG_LABEL, FLAG_TONE, formatPeriod, scoreTone } from "@/lib/format";
import { IconArrowRight, IconAlert, IconCheck, IconSparkle, IconDatabase, IconShield, IconReport } from "@/components/icons";
import type { PerformanceScore, Talent } from "@/lib/contract/types";

const SUBS: { key: keyof PerformanceScore; label: string }[] = [
  { key: "delivery_score", label: "delivery" },
  { key: "utilization_score", label: "utilization" },
  { key: "efficiency_score", label: "efficiency" },
  { key: "overtime_health_score", label: "overtime" },
  { key: "lead_assessment_score", label: "lead" },
];

function lowestSub(s: PerformanceScore) {
  return SUBS.map((x) => ({ label: x.label, val: s[x.key] as number })).sort((a, b) => a.val - b.val)[0];
}

export default function DashboardPage() {
  const { period } = useApp();

  const q = useAsync(
    () =>
      Promise.all([
        api.scores({ period }),
        api.talents(),
        api.insights({ period }),
        api.reports(),
        api.ingestionRuns({ period }),
        api.scoringConfig(),
      ]),
    [period],
  );

  if (q.loading && !q.data) return <DashboardSkeleton period={period} />;
  if (q.error) return <Note tone="low">Failed to load dashboard: {q.error}</Note>;

  const [scoresRes, talentsRes, insightsRes, reportsRes, runsRes, cfgRes] = q.data!;
  const talents = new Map<string, Talent>(talentsRes.data.map((t) => [t.id, t]));
  const allScores = scoresRes.data;
  const scorable = allScores.filter((s) => s.scorable);
  const notScorable = allScores.filter((s) => !s.scorable);

  const counts = {
    low: scorable.filter((s) => s.flag === "low").length,
    needs_review: scorable.filter((s) => s.flag === "needs_review").length,
    healthy: scorable.filter((s) => s.flag === "healthy").length,
  };
  const avg = scorable.length ? scorable.reduce((s, x) => s + x.total_score, 0) / scorable.length : 0;

  // division averages
  const byDiv = new Map<string, number[]>();
  scorable.forEach((s) => {
    const div = talents.get(s.talent_id)?.division ?? "—";
    byDiv.set(div, [...(byDiv.get(div) ?? []), s.total_score]);
  });
  const divisionData = Array.from(byDiv.entries())
    .map(([name, arr]) => ({ name, score: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) }))
    .sort((a, b) => b.score - a.score);

  // data quality across runs this period
  const runs = runsRes.data;
  const warn = runs.reduce((s, r) => s + (r.quality_summary?.warn ?? 0), 0);
  const block = runs.reduce((s, r) => s + (r.quality_summary?.block ?? 0), 0);
  const degraded = runs.filter((r) => r.status === "partial" || r.status === "failed");

  // pending approvals
  const pendingReports = reportsRes.data.filter((r) => r.status === "in_review").length;
  const pendingInsights = insightsRes.data.filter((i) => i.status === "generated" || i.status === "in_review").length;

  // attention list
  const attention = scorable
    .filter((s) => s.flag !== "healthy")
    .sort((a, b) => a.total_score - b.total_score)
    .slice(0, 6);

  // Fall back to defaults when no scoring config exists yet (fresh/empty DB).
  const thresholds = cfgRes.current?.thresholds ?? { low: 60, healthy: 75 };

  return (
    <div>
      <PageHeader
        eyebrow={`${formatPeriod(period)} · internal view`}
        title="Performance overview"
        description="A quantitative read on every talent for the period — drawn from Sheets, Jira and Clockify. Use it to diagnose before you present."
        actions={
          <LinkButton href="/talents" icon={<IconArrowRight className="h-4 w-4" />}>
            Open roster
          </LinkButton>
        }
      />

      <Note tone="accent" className="mb-6" icon={<IconShield className="h-4 w-4" />}>
        Scores are <strong className="font-medium">decision-support, not a verdict</strong>. Every number traces to a source
        metric and a scoring-config version. Sensitive per-talent diagnostics stay internal until a report is explicitly approved.
      </Note>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Scored" value={scorable.length} sub={notScorable.length ? `${notScorable.length} not scorable` : "all mapped"} />
        <Stat label="Avg score" value={avg.toFixed(1)} tone={scoreTone(avg)} sub="weighted composite" />
        <Stat label="Low" value={counts.low} tone="low" sub={`< ${thresholds.low}`} />
        <Stat label="Needs review" value={counts.needs_review} tone="review" sub={`${thresholds.low}–${thresholds.healthy - 1}`} />
        <Stat label="Healthy" value={counts.healthy} tone="healthy" sub={`≥ ${thresholds.healthy}`} />
        <Stat
          label="Pending approval"
          value={pendingReports + pendingInsights}
          tone={pendingReports + pendingInsights ? "review" : undefined}
          sub={`${pendingReports} report · ${pendingInsights} insight`}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* distribution */}
        <Card>
          <CardHead title="Flag distribution" sub={`${scorable.length} scorable talents`} />
          <div className="px-5 py-4">
            <FlagDonut
              data={[
                { name: "Healthy", value: counts.healthy, key: "healthy" },
                { name: "Needs review", value: counts.needs_review, key: "review" },
                { name: "Low", value: counts.low, key: "low" },
              ]}
            />
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
              {(["healthy", "needs_review", "low"] as const).map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
                  <span className={`h-2 w-2 rounded-full bg-${FLAG_TONE[f]}`} />
                  {FLAG_LABEL[f]} <span className="font-mono text-ink">{counts[f]}</span>
                </span>
              ))}
            </div>
          </div>
        </Card>

        {/* division */}
        <Card>
          <CardHead title="Division averages" sub="Mean composite score" />
          <div className="px-3 py-4">
            <DivisionBars data={divisionData} />
          </div>
        </Card>

        {/* data quality */}
        <Card>
          <CardHead
            title="Data quality"
            sub={`${runs.length} ingestion runs`}
            right={
              <Link href="/ingestion" className="text-[12px] font-medium text-accent hover:underline">
                Details
              </Link>
            }
          />
          <div className="flex flex-col gap-3 px-5 py-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <QualityCell n={runs.filter((r) => r.status === "success").length} label="clean" tone="healthy" />
              <QualityCell n={warn} label="warnings" tone="review" />
              <QualityCell n={block} label="blocking" tone="low" />
            </div>
            {degraded.length > 0 ? (
              <Note tone="review" icon={<IconAlert className="h-3.5 w-3.5" />}>
                {degraded.map((r) => `${r.source} ${r.status}`).join(", ")} — some metrics may undercount this period.
              </Note>
            ) : (
              <Note tone="healthy" icon={<IconCheck className="h-3.5 w-3.5" />}>
                All sources ingested cleanly for {formatPeriod(period)}.
              </Note>
            )}
            {notScorable.length > 0 && (
              <p className="text-[12px] text-ink-muted">
                <span className="font-mono text-ink">{notScorable.length}</span> talent excluded from scoring — unresolved
                identity. <Link href="/mappings" className="text-accent hover:underline">Resolve mapping →</Link>
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* attention */}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionLabel right={<Link href="/talents" className="text-[12px] font-medium text-accent hover:underline">View all talents →</Link>}>
            Needs attention
          </SectionLabel>
          <Card>
            {attention.length === 0 ? (
              <EmptyState icon={<IconCheck className="h-7 w-7" />} title="Nothing flagged" hint="No low or needs-review talents this period." />
            ) : (
              <ul className="divide-y divide-line">
                {attention.map((s) => {
                  const t = talents.get(s.talent_id);
                  const worst = lowestSub(s);
                  return (
                    <li key={s.id}>
                      <Link href={`/talents/${s.talent_id}`} className="row-hover flex items-center gap-3 px-4 py-3 transition-colors focus-ring">
                        <Avatar name={t?.full_name ?? "?"} size={38} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-ink">{t?.full_name}</span>
                            <Badge tone={FLAG_TONE[s.flag]} dot>{FLAG_LABEL[s.flag]}</Badge>
                          </div>
                          <p className="mt-0.5 text-[12px] text-ink-muted">
                            {t?.role} · {t?.division} — weakest: <span className="font-mono text-ink-soft">{worst.label} {worst.val.toFixed(0)}</span>
                          </p>
                        </div>
                        <div className="hidden w-40 sm:block">
                          <ScoreMeter value={s.total_score} tone={FLAG_TONE[s.flag]} />
                        </div>
                        <span className="numeral w-10 text-right text-[19px] text-ink">{s.total_score.toFixed(0)}</span>
                        <IconArrowRight className="h-4 w-4 text-ink-faint" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* reporting pipeline */}
        <div>
          <SectionLabel right={<Link href="/reports" className="text-[12px] font-medium text-accent hover:underline">Reports →</Link>}>
            Reporting pipeline
          </SectionLabel>
          <Card className="p-4">
            <div className="flex flex-col gap-3">
              <PipelineRow icon={<IconSparkle className="h-4 w-4" />} label="AI insights" value={`${insightsRes.data.length} this period`} href="/insights" sub={`${pendingInsights} awaiting review`} />
              <PipelineRow icon={<IconReport className="h-4 w-4" />} label="Monthly reports" value={`${reportsRes.data.length} total`} href="/reports" sub={`${pendingReports} in review`} />
              <PipelineRow icon={<IconDatabase className="h-4 w-4" />} label="Last ingestion" value={runs.length ? `${runs.length} runs` : "none"} href="/ingestion" sub={formatPeriod(period)} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QualityCell({ n, label, tone }: { n: number; label: string; tone: "healthy" | "review" | "low" }) {
  return (
    <div className="rounded-lg border border-line bg-surface py-2.5">
      <div className={`numeral text-[22px] text-${tone}`}>{n}</div>
      <div className="eyebrow mt-0.5 !text-[9.5px]">{label}</div>
    </div>
  );
}

function PipelineRow({ icon, label, value, sub, href }: { icon: React.ReactNode; label: string; value: string; sub: string; href: string }) {
  return (
    <Link href={href} className="row-hover flex items-center gap-3 rounded-lg px-2 py-2 transition-colors focus-ring">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-ink">{label}</span>
        <span className="block text-[11.5px] text-ink-muted">{sub}</span>
      </span>
      <span className="text-right text-[12px] font-mono text-ink-soft">{value}</span>
    </Link>
  );
}

function DashboardSkeleton({ period }: { period: string }) {
  return (
    <div>
      <PageHeader eyebrow={`${formatPeriod(period)} · internal view`} title="Performance overview" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[86px]" />
        ))}
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[240px]" />
        ))}
      </div>
    </div>
  );
}
