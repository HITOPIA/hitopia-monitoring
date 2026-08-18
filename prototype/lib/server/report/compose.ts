/**
 * Assemble REPORT_ITEMs for a monthly report from real scores + metrics + insights.
 * Client-facing items are AGGREGATES only (client_visible=true) and now carry
 * structured content (metrics + tables) so the deck export renders presentable
 * slides, not bare paragraphs (#11). Per-talent diagnostics stay internal-only
 * (client_visible=false) — the export gate filters on this flag server-side, so
 * sensitive content can never leak into a client deck (D8 fail-safe).
 */
import { prisma } from "../db";
import type { ReportContent } from "../../contract/types";

const r1 = (v: number) => Math.round(v * 10) / 10;

export async function composeReportItems(reportId: string, period: string): Promise<number> {
  await prisma.reportItem.deleteMany({ where: { monthly_report_id: reportId } });

  const [scores, talents, insights, utils, deliveries] = await Promise.all([
    prisma.performanceScore.findMany({ where: { period, scorable: true } }),
    prisma.talent.findMany(),
    prisma.insight.findMany({ where: { period }, orderBy: { generated_at: "desc" } }),
    prisma.utilizationRecord.findMany({ where: { period } }),
    prisma.deliveryRecord.findMany({ where: { period } }),
  ]);
  const talentById = new Map(talents.map((t) => [t.id, t]));
  const talentCount = talents.length;

  const healthy = scores.filter((s) => s.flag === "healthy").length;
  const review = scores.filter((s) => s.flag === "needs_review").length;
  const low = scores.filter((s) => s.flag === "low").length;
  const n = scores.length || 1;
  const pct = (x: number) => Math.round((x / n) * 100);
  const avg = (arr: number[]) => (arr.length ? r1(arr.reduce((s, x) => s + x, 0) / arr.length) : 0);

  const items: {
    section: string;
    talent_id?: string | null;
    insight_id?: string | null;
    content: ReportContent;
    client_visible: boolean;
  }[] = [];

  // 1) Executive summary — headline metrics
  items.push({
    section: "Executive summary",
    client_visible: true,
    content: {
      title: `Performance overview — ${period}`,
      body: `Across ${scores.length} scored talents: ${healthy} healthy, ${review} need review, ${low} flagged low. Every figure traces to source metrics from Jira, Clockify and the talent master; per-individual diagnostics remain internal-only.`,
      metrics: [
        { label: "Scored talents", value: String(scores.length), sub: `of ${talentCount}` },
        { label: "Healthy", value: `${healthy}`, sub: `${pct(healthy)}%` },
        { label: "Needs review", value: `${review}`, sub: `${pct(review)}%` },
        { label: "Flagged low", value: `${low}`, sub: `${pct(low)}%` },
        { label: "Avg composite", value: String(avg(scores.map((s) => s.total_score))), sub: "/ 100" },
      ],
    },
  });

  // 2) Division performance — table
  const byDivision = new Map<string, typeof scores>();
  for (const s of scores) {
    const div = talentById.get(s.talent_id)?.division ?? "—";
    const arr = byDivision.get(div) ?? [];
    arr.push(s);
    byDivision.set(div, arr);
  }
  items.push({
    section: "Division performance",
    client_visible: true,
    content: {
      title: "Performance by division",
      body: "Average composite score and health distribution per division this period.",
      table: {
        columns: ["Division", "Talents", "Avg score", "Healthy", "Review", "Low"],
        rows: Array.from(byDivision.entries())
          .sort((a, b) => b[1].length - a[1].length)
          .map(([div, arr]) => [
            div,
            String(arr.length),
            String(avg(arr.map((s) => s.total_score))),
            String(arr.filter((s) => s.flag === "healthy").length),
            String(arr.filter((s) => s.flag === "needs_review").length),
            String(arr.filter((s) => s.flag === "low").length),
          ]),
      },
    },
  });

  // 3) Workload & utilization — overtime / off-hours summary
  const totalOvertime = r1(utils.reduce((s, u) => s + u.overtime_hours, 0));
  const totalOffhours = r1(utils.reduce((s, u) => s + (u.offhours_hours ?? 0), 0));
  const overTarget = utils.filter((u) => u.overtime_hours > 0).length;
  const avgUtil = avg(scores.map((s) => s.utilization_score));
  items.push({
    section: "Workload & utilization",
    client_visible: true,
    content: {
      title: "Capacity & sustainability",
      body: `Average utilization score ${avgUtil}/100. ${overTarget} talents logged time above their monthly target; ${totalOffhours}h was logged outside standard work hours (a burnout signal we track, not a target).`,
      metrics: [
        { label: "Avg utilization", value: String(avgUtil), sub: "/ 100" },
        { label: "Overtime", value: `${totalOvertime}h`, sub: "above target" },
        { label: "Off-hours", value: `${totalOffhours}h`, sub: "before/after/weekend" },
        { label: "Over target", value: String(overTarget), sub: "talents" },
      ],
    },
  });

  // 4) Delivery output — aggregate ticket throughput
  const sum = (f: (d: (typeof deliveries)[number]) => number) => deliveries.reduce((s, d) => s + f(d), 0);
  items.push({
    section: "Delivery output",
    client_visible: true,
    content: {
      title: "Delivery throughput",
      body: "Aggregate Jira delivery across the cohort. Verified counts credit QA for tickets they signed off; reopens and bugs are quality signals.",
      metrics: [
        { label: "Completed", value: String(sum((d) => d.tickets_completed)), sub: "assigned" },
        { label: "Verified", value: String(sum((d) => d.tickets_verified)), sub: "QA sign-off" },
        { label: "Reopened", value: String(sum((d) => d.tickets_reopened)), sub: "bounced back" },
        { label: "Bugs", value: String(sum((d) => d.bugs_count)), sub: "in scope" },
      ],
    },
  });

  // 5) Coverage & data quality
  items.push({
    section: "Coverage & data quality",
    client_visible: true,
    content: {
      title: "Coverage",
      body: `${scores.length} of ${talentCount} talents scored this period. Talents without a verified Jira/Clockify identity mapping are excluded from client-facing scoring rather than scored on partial data.`,
    },
  });

  // 6) Internal-only per-talent diagnostics (sensitive — never client_visible)
  for (const ins of insights.slice(0, 80)) {
    const t = talentById.get(ins.talent_id);
    items.push({
      section: "Per-talent diagnostic (internal)",
      talent_id: ins.talent_id,
      insight_id: ins.id,
      client_visible: false,
      content: {
        title: `${t?.full_name ?? "Talent"} — ${t?.role ?? ""}`,
        body: ins.narrative,
        refs: (ins.source_refs as any[])?.map((r) => `${r.metric} ${r.period}`),
      },
    });
  }

  // 7) Recommendations
  items.push({
    section: "Recommendations",
    client_visible: true,
    content: {
      title: "Forward actions",
      body: "Coaching and allocation actions for next cycle. Client-safe phrasing only; specifics stay in the internal diagnostics.",
    },
  });

  await prisma.reportItem.createMany({
    data: items.map((it) => ({
      monthly_report_id: reportId,
      talent_id: it.talent_id ?? null,
      insight_id: it.insight_id ?? null,
      section: it.section,
      content: it.content as any,
      client_visible: it.client_visible,
    })),
  });

  return items.length;
}
