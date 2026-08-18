"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { useAsync } from "@/lib/hooks";
import { api } from "@/lib/api/client";
import { PageHeader, Avatar, Note, Pagination } from "@/components/bits";
import { Card, CardHead, Badge, Stat, ScoreMeter, Skeleton, EmptyState } from "@/components/ui";
import { formatPeriod, num, scoreTone } from "@/lib/format";
import { IconClock, IconAlert } from "@/components/icons";
import type { OvertimeRow } from "@/lib/contract/types";

function groupSum(rows: OvertimeRow[], key: "division" | "role") {
  const m = new Map<string, { overtime: number; n: number }>();
  for (const r of rows) {
    const g = (r[key] as string) || "—";
    const cur = m.get(g) ?? { overtime: 0, n: 0 };
    cur.overtime += r.overtime_hours;
    cur.n++;
    m.set(g, cur);
  }
  return Array.from(m.entries())
    .map(([label, v]) => ({ label, overtime: Math.round(v.overtime * 10) / 10, n: v.n }))
    .sort((a, b) => b.overtime - a.overtime);
}

function GroupBars({ title, sub, data }: { title: string; sub: string; data: { label: string; overtime: number; n: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.overtime));
  return (
    <Card>
      <CardHead title={title} sub={sub} />
      <div className="px-5 py-4">
        {data.length === 0 ? (
          <EmptyState icon={<IconClock className="h-7 w-7" />} title="No overtime" hint="Nothing logged above target this period." />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.map((d) => (
              <li key={d.label}>
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="truncate font-medium text-ink">
                    {d.label} <span className="text-ink-faint">· {d.n}</span>
                  </span>
                  <span className="numeral text-review">{num(d.overtime)}h</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-review" style={{ width: `${(d.overtime / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export default function OvertimePage() {
  const { period } = useApp();
  const q = useAsync(() => api.overtime(period), [period]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => setPage(1), [period]);

  if (q.loading && !q.data)
    return (
      <div>
        <Skeleton className="mb-6 h-10 w-72" />
        <div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      </div>
    );
  if (q.error || !q.data) return <Note tone="low">Failed to load overtime: {q.error}</Note>;

  const o = q.data;
  const rows = o.rows;
  const maxOt = Math.max(1, ...rows.map((r) => r.overtime_hours));
  const top = rows.filter((r) => r.overtime_hours > 0).slice(0, 8);
  const byDivision = groupSum(rows, "division");
  const byRole = groupSum(rows, "role");
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <PageHeader
        eyebrow={`${formatPeriod(period)} · overtime & off-hours`}
        title="Overtime dashboard"
        description="Hours logged above the monthly target, and work logged outside the work-hour window — a wellbeing/burnout signal, not a productivity target."
      />

      <Note tone="neutral" className="mb-6" icon={<IconClock className="h-3.5 w-3.5" />}>
        Work window <strong className="font-medium">{o.schedule.work_start}–{o.schedule.work_end}</strong> ({o.schedule.timezone}),
        Mon–Fri. Time logged before/after this window or on weekends counts as <strong className="font-medium">off-hours</strong>. Change it
        in Sources &amp; integration → Schedule.
      </Note>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total overtime" value={`${num(o.total_overtime_hours)} h`} sub="above monthly target" tone="review" />
        <Stat label="Off-hours work" value={`${num(o.total_offhours_hours)} h`} sub={`before ${num(o.before_hours)} · after ${num(o.after_hours)} · weekend ${num(o.weekend_hours)}`} tone="low" />
        <Stat label="Over target" value={String(o.talents_over_target)} sub="talents with overtime" />
        <Stat label="Scored talents" value={String(rows.length)} sub={formatPeriod(period)} />
      </div>

      {/* by division / by role */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <GroupBars title="Overtime by division" sub="Summed overtime per division" data={byDivision} />
        <GroupBars title="Overtime by role" sub="Summed overtime per role" data={byRole} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* top overtime */}
        <Card className="self-start">
          <CardHead title="Highest overtime" sub="Top contributors this period" />
          <div className="px-5 py-4">
            {top.length === 0 ? (
              <EmptyState icon={<IconClock className="h-7 w-7" />} title="No overtime logged" hint="Everyone stayed within target this period." />
            ) : (
              <ul className="flex flex-col gap-3">
                {top.map((r) => (
                  <li key={r.talent_id} className="flex items-center gap-3">
                    <Avatar name={r.full_name} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-ink">{r.full_name}</span>
                        <span className="numeral text-[13px] text-review">{num(r.overtime_hours)}h</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-review" style={{ width: `${(r.overtime_hours / maxOt) * 100}%` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* per-talent table */}
        <Card className="self-start">
          <CardHead title="Per-talent breakdown" sub="Overtime, off-hours split, and overtime-health score" />
          <div className="hidden grid-cols-[1.6fr_0.8fr_0.8fr_1.2fr_0.8fr] gap-3 border-b border-line px-4 py-2.5 md:grid">
            {["Talent", "Tracked", "Overtime", "Off-hours (b/a/wk)", "Health"].map((h, i) => (
              <span key={i} className="eyebrow !text-[10px]">{h}</span>
            ))}
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={<IconAlert className="h-7 w-7" />} title="No utilization data" hint="Run Clockify ingestion for this period." />
          ) : (
            <>
              <ul className="divide-y divide-line">
                {pageRows.map((r) => (
                  <li key={r.talent_id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5 md:grid-cols-[1.6fr_0.8fr_0.8fr_1.2fr_0.8fr]">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={r.full_name} size={30} />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">{r.full_name}</p>
                        <p className="truncate text-[11px] text-ink-muted">{r.role}</p>
                      </div>
                    </div>
                    <div className="numeral hidden text-[12.5px] text-ink-soft md:block">{num(r.tracked_hours)}/{num(r.target_hours)}h</div>
                    <div className="hidden md:block">
                      {r.overtime_hours > 0 ? <Badge tone="review">{num(r.overtime_hours)}h</Badge> : <span className="text-[12px] text-ink-faint">—</span>}
                    </div>
                    <div className="numeral hidden text-[12px] text-ink-muted md:block">
                      {num(r.before_hours)} / {num(r.after_hours)} / {num(r.weekend_hours)}
                    </div>
                    <div className="flex items-center justify-end gap-2 md:justify-start">
                      {r.overtime_health_score != null ? (
                        <>
                          <ScoreMeter value={r.overtime_health_score} tone={scoreTone(r.overtime_health_score)} className="hidden w-12 md:block" />
                          <span className={`numeral text-[13px] text-${scoreTone(r.overtime_health_score)}`}>{r.overtime_health_score.toFixed(0)}</span>
                        </>
                      ) : (
                        <span className="text-[11px] text-ink-faint">n/a</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination page={page} pageSize={pageSize} total={rows.length} onPage={setPage} onPageSize={setPageSize} />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
