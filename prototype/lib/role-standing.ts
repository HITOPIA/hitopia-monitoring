/**
 * Within-role standing — "balance each role" without changing the scoring weights.
 *
 * The composite weights stay global (one ScoringConfig for everyone). To compare
 * people fairly, we rank each scorable talent against PEERS IN THE SAME ROLE for
 * the period. Roles are free-text and often tiny, so a role group with fewer than
 * `minPeers` members falls back to the coarser `division` (role family) for a
 * meaningful comparison. Pure presentation/analysis — never feeds the stored score.
 */
import type { PerformanceScore, Talent } from "./contract/types";

export interface RoleStanding {
  rank: number; // 1 = top of group (ties share a rank)
  total: number; // group size (scorable peers)
  percentile: number; // 0..100, higher = better
  median: number; // group median total_score
  delta: number; // talent total_score − group median
  groupKey: string; // role or division used for the group
  groupLabel: string; // human label for the group
  groupBy: "role" | "division";
  belowMedian: boolean;
}

const push = (m: Map<string, PerformanceScore[]>, k: string, v: PerformanceScore) => {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
};

function medianOf(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function computeRoleStandings(
  scores: PerformanceScore[],
  talents: Talent[],
  opts: { minPeers?: number } = {},
): Map<string, RoleStanding> {
  const minPeers = opts.minPeers ?? 3;
  const talentById = new Map(talents.map((t) => [t.id, t]));
  const scorable = scores.filter((s) => s.scorable);

  const byRole = new Map<string, PerformanceScore[]>();
  const byDivision = new Map<string, PerformanceScore[]>();
  for (const s of scorable) {
    const t = talentById.get(s.talent_id);
    if (!t) continue;
    push(byRole, t.role, s);
    push(byDivision, t.division, s);
  }

  const out = new Map<string, RoleStanding>();
  for (const s of scorable) {
    const t = talentById.get(s.talent_id);
    if (!t) continue;
    const roleGroup = byRole.get(t.role) ?? [];
    const useRole = roleGroup.length >= minPeers;
    const group = useRole ? roleGroup : byDivision.get(t.division) ?? [];
    const groupKey = useRole ? t.role : t.division;

    const sortedDesc = group.map((g) => g.total_score).sort((a, b) => b - a);
    const rank = sortedDesc.findIndex((v) => v <= s.total_score) + 1; // ties share the first rank
    const lower = group.filter((g) => g.total_score < s.total_score).length;
    const percentile = group.length > 1 ? Math.round((lower / (group.length - 1)) * 100) : 100;
    const median = medianOf(group.map((g) => g.total_score));

    out.set(s.talent_id, {
      rank,
      total: group.length,
      percentile,
      median: r1(median),
      delta: r1(s.total_score - median),
      groupKey,
      groupLabel: groupKey,
      groupBy: useRole ? "role" : "division",
      belowMedian: s.total_score < median,
    });
  }
  return out;
}
