"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/providers";
import { useAsync } from "@/lib/hooks";
import { api } from "@/lib/api/client";
import { PageHeader, Avatar, Note, Pagination } from "@/components/bits";
import { Card, Badge, ScoreMeter, Select, Skeleton, EmptyState } from "@/components/ui";
import { FLAG_LABEL, FLAG_TONE, formatPeriod } from "@/lib/format";
import { IconSearch, IconArrowRight, IconAlert, IconLock } from "@/components/icons";
import { computeRoleStandings, type RoleStanding } from "@/lib/role-standing";
import type { PerformanceScore, Talent } from "@/lib/contract/types";

const SUBS: { key: keyof PerformanceScore; label: string }[] = [
  { key: "delivery_score", label: "delivery" },
  { key: "utilization_score", label: "utilization" },
  { key: "efficiency_score", label: "efficiency" },
  { key: "overtime_health_score", label: "overtime" },
  { key: "lead_assessment_score", label: "lead" },
];
const worstSub = (s: PerformanceScore) =>
  SUBS.map((x) => ({ label: x.label, val: s[x.key] as number })).sort((a, b) => a.val - b.val)[0];

type Sort = "score_desc" | "score_asc" | "name";

export default function TalentsPage() {
  const { period } = useApp();
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState("all");
  const [role, setRole] = useState("all");
  const [flag, setFlag] = useState("all");
  const [sort, setSort] = useState<Sort>("score_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const q = useAsync(() => Promise.all([api.scores({ period }), api.talents()]), [period]);

  useEffect(() => setPage(1), [search, division, role, flag, sort, period]);

  const { rows, divisions, roles, standings } = useMemo(() => {
    const empty = { rows: [] as { s: PerformanceScore; t: Talent }[], divisions: [] as string[], roles: [] as string[], standings: new Map<string, RoleStanding>() };
    if (!q.data) return empty;
    const [scoresRes, talentsRes] = q.data;
    const tmap = new Map<string, Talent>(talentsRes.data.map((t) => [t.id, t]));
    const divisions = Array.from(new Set(talentsRes.data.map((t) => t.division))).sort();
    const roles = Array.from(new Set(talentsRes.data.map((t) => t.role))).sort();
    // within-role standing is computed over the full scored set (before filtering)
    const standings = computeRoleStandings(scoresRes.data, talentsRes.data);
    let rows = scoresRes.data.map((s) => ({ s, t: tmap.get(s.talent_id)! })).filter((r) => r.t);
    if (search.trim()) {
      const n = search.toLowerCase();
      rows = rows.filter((r) => r.t.full_name.toLowerCase().includes(n) || r.t.role.toLowerCase().includes(n));
    }
    if (division !== "all") rows = rows.filter((r) => r.t.division === division);
    if (role !== "all") rows = rows.filter((r) => r.t.role === role);
    if (flag !== "all") rows = rows.filter((r) => r.s.scorable && r.s.flag === flag);
    rows.sort((a, b) => {
      if (sort === "name") return a.t.full_name.localeCompare(b.t.full_name);
      // unscorable always sink to the bottom
      if (a.s.scorable !== b.s.scorable) return a.s.scorable ? -1 : 1;
      return sort === "score_desc" ? b.s.total_score - a.s.total_score : a.s.total_score - b.s.total_score;
    });
    return { rows, divisions, roles, standings };
  }, [q.data, search, division, role, flag, sort]);

  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <PageHeader
        eyebrow={`${formatPeriod(period)} · ${rows.length} shown`}
        title="Talent roster"
        description="Every talent's composite score for the period. Sorted weakest-first by default so low performers surface for diagnosis. Role rank compares each person against same-role peers. Click a row to trace the score to its source."
      />

      {/* filter bar */}
      <Card className="mb-5 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="relative min-w-[200px] flex-1">
            <span className="mb-1 block eyebrow">Search</span>
            <IconSearch className="pointer-events-none absolute bottom-2.5 left-2.5 h-4 w-4 text-ink-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or role…"
              className="h-9 w-full rounded-lg border border-line-strong bg-raised pl-8 pr-3 text-[13px] text-ink focus-ring placeholder:text-ink-faint hover:border-ink-faint"
            />
          </label>
          <Select
            label="Division"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            className="w-[150px]"
            options={[{ value: "all", label: "All divisions" }, ...divisions.map((d) => ({ value: d, label: d }))]}
          />
          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-[180px]"
            options={[{ value: "all", label: "All roles" }, ...roles.map((r) => ({ value: r, label: r }))]}
          />
          <Select
            label="Flag"
            value={flag}
            onChange={(e) => setFlag(e.target.value)}
            className="w-[150px]"
            options={[
              { value: "all", label: "All flags" },
              { value: "low", label: "Low" },
              { value: "needs_review", label: "Needs review" },
              { value: "healthy", label: "Healthy" },
            ]}
          />
          <Select
            label="Sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="w-[160px]"
            options={[
              { value: "score_asc", label: "Score · low → high" },
              { value: "score_desc", label: "Score · high → low" },
              { value: "name", label: "Name · A → Z" },
            ]}
          />
        </div>
      </Card>

      {q.loading && !q.data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : q.error ? (
        <Note tone="low">Failed to load roster: {q.error}</Note>
      ) : (
        <Card>
          {/* header row (desktop) */}
          <div className="hidden grid-cols-[2rem_1.7fr_0.8fr_1.3fr_0.8fr_0.7fr_auto] gap-3 border-b border-line px-4 py-2.5 md:grid">
            {["#", "Talent", "Division", "Composite", "Role rank", "Flag", ""].map((h, i) => (
              <span key={i} className="eyebrow !text-[10px]">{h}</span>
            ))}
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={<IconSearch className="h-7 w-7" />} title="No talents match" hint="Adjust the filters above." />
          ) : (
            <>
            <ul className="divide-y divide-line">
              {pageRows.map(({ s, t }, i) => {
                const st = standings.get(t.id);
                return (
                <li key={s.id}>
                  <Link
                    href={`/talents/${t.id}`}
                    className="row-hover grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors focus-ring md:grid-cols-[2rem_1.7fr_0.8fr_1.3fr_0.8fr_0.7fr_auto]"
                  >
                    <span className="numeral hidden text-[12px] text-ink-faint md:block">{(page - 1) * pageSize + i + 1}</span>

                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={t.full_name} size={38} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-ink">{t.full_name}</p>
                          <Badge tone={t.status === "active" ? "healthy" : "neutral"} className="shrink-0" dot>
                            {t.status}
                          </Badge>
                        </div>
                        <p className="truncate text-[12px] text-ink-muted">{t.role}</p>
                      </div>
                    </div>
                    <div className="hidden text-[13px] text-ink-soft md:block">{t.division}</div>

                    {s.scorable ? (
                      <div className="hidden items-center gap-3 md:flex">
                        <ScoreMeter value={s.total_score} tone={FLAG_TONE[s.flag]} className="w-24" />
                        <span className="numeral w-9 text-[17px] text-ink">{s.total_score.toFixed(0)}</span>
                        <span className="hidden text-[11px] text-ink-faint xl:inline">↓ {worstSub(s).label} {worstSub(s).val.toFixed(0)}</span>
                      </div>
                    ) : (
                      <div className="hidden items-center gap-1.5 text-[12px] text-ink-faint md:flex">
                        <IconLock className="h-3.5 w-3.5" /> not scorable
                      </div>
                    )}

                    {/* within-role standing */}
                    <div className="hidden md:block" title={st ? `vs ${st.total} ${st.groupLabel} peers · median ${st.median}` : undefined}>
                      {s.scorable && st && st.total > 1 ? (
                        <div className="text-[12.5px]">
                          <span className="numeral text-ink">#{st.rank}</span>
                          <span className="text-ink-faint">/{st.total}</span>
                          <span className={`ml-1.5 text-[11px] ${st.belowMedian ? "text-low" : "text-healthy"}`}>
                            {st.delta >= 0 ? "+" : ""}{st.delta}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-ink-faint">—</span>
                      )}
                    </div>

                    <div className="hidden md:block">
                      {s.scorable ? (
                        <Badge tone={FLAG_TONE[s.flag]} dot>{FLAG_LABEL[s.flag]}</Badge>
                      ) : (
                        <Badge tone="neutral">excluded</Badge>
                      )}
                    </div>

                    {/* mobile compact score + flag */}
                    <div className="flex items-center gap-2 md:hidden">
                      {s.scorable ? (
                        <>
                          <span className="numeral text-[17px] text-ink">{s.total_score.toFixed(0)}</span>
                          <Badge tone={FLAG_TONE[s.flag]}>{FLAG_LABEL[s.flag]}</Badge>
                        </>
                      ) : (
                        <Badge tone="neutral">excluded</Badge>
                      )}
                    </div>

                    <IconArrowRight className="hidden h-4 w-4 justify-self-end text-ink-faint md:block" />
                  </Link>
                </li>
              );})}
            </ul>
            <Pagination page={page} pageSize={pageSize} total={rows.length} onPage={setPage} onPageSize={setPageSize} />
            </>
          )}
        </Card>
      )}

      <Note tone="neutral" className="mt-4" icon={<IconAlert className="h-3.5 w-3.5" />}>
        Talents marked <strong className="font-medium">not scorable</strong> have no confident cross-system identity for this
        period and are excluded from scoring rather than scored as zero — missing data must never penalise a person.
      </Note>
    </div>
  );
}
