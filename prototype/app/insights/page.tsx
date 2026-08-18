"use client";

import { useMemo, useState } from "react";
import { useApp, useToast } from "@/components/providers";
import { useAsync } from "@/lib/hooks";
import { api } from "@/lib/api/client";
import { can, allowedRolesLabel } from "@/lib/rbac";
import { PageHeader, Note } from "@/components/bits";
import { InsightCard } from "@/components/insight-card";
import { Card, Badge, Button, Tabs, Skeleton, EmptyState } from "@/components/ui";
import { formatPeriod } from "@/lib/format";
import { IconSparkle, IconShield, IconCheck } from "@/components/icons";
import type { Insight, Talent } from "@/lib/contract/types";

export default function InsightsPage() {
  const { period, user } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState("all");
  const [generating, setGenerating] = useState(false);

  const q = useAsync(
    () => Promise.all([api.insights({ period }), api.talents(), api.scores({ period })]),
    [period],
  );

  const model = useMemo(() => {
    if (!q.data) return null;
    const [insRes, tRes, sRes] = q.data;
    const tmap = new Map<string, Talent>(tRes.data.map((t) => [t.id, t]));
    const insights = insRes.data;
    const haveInsight = new Set(insights.map((i) => i.talent_id));
    const eligible = sRes.data.filter((s) => s.scorable && s.flag !== "healthy" && !haveInsight.has(s.talent_id));
    return { insights, tmap, eligible: eligible.length };
  }, [q.data]);

  const canGen = can("insight.generate", user?.role);

  async function generate() {
    setGenerating(true);
    try {
      const res = await api.generateInsights(period);
      toast(res.created ? `Generated ${res.created} insight${res.created > 1 ? "s" : ""}` : "No new insights — all flagged talents covered", res.created ? "success" : "info");
      q.reload();
    } catch (e: any) {
      toast(e.message ?? "Generation failed", "error");
    } finally {
      setGenerating(false);
    }
  }

  const counts = useMemo(() => {
    const c = { all: 0, generated: 0, in_review: 0, approved: 0, rejected: 0 } as Record<string, number>;
    model?.insights.forEach((i) => {
      c.all++;
      c[i.status]++;
    });
    return c;
  }, [model]);

  const filtered = (model?.insights ?? []).filter((i) => tab === "all" || i.status === tab);

  return (
    <div>
      <PageHeader
        eyebrow={`AI insight · ${formatPeriod(period)}`}
        title="Diagnosis & recommendations"
        description="AI explains why a talent is flagged — every claim references a source metric. Insights are decision-support and must be reviewed and approved before they inform any client-facing report."
        actions={
          canGen ? (
            <Button variant="primary" icon={<IconSparkle className="h-4 w-4" />} loading={generating} onClick={generate}>
              Generate {model?.eligible ? `(${model.eligible})` : ""}
            </Button>
          ) : (
            <Badge tone="neutral">{allowedRolesLabel("insight.generate")} only</Badge>
          )
        }
      />

      <Note tone="accent" className="mb-5" icon={<IconShield className="h-4 w-4" />}>
        <p className="font-medium">What an AI insight is</p>
        <p className="mt-1">
          For each flagged talent the model reads only aggregate metrics (Jira delivery incl. verified/reopens/bugs, Clockify
          utilization + off-hours, scores, budget) — never raw PII — and returns a grounded diagnosis: a one-line{" "}
          <strong className="font-medium">summary</strong>, a severity (<span className="text-healthy">strength</span> /{" "}
          <span className="text-review">watch</span> / <span className="text-low">risk</span>), a confidence, the contributing
          factors with weights, concrete recommendations, and a <strong className="font-medium">trace</strong> to every metric it
          cited. Nothing reaches a client until a reviewer approves it.
        </p>
      </Note>

      {model && model.eligible > 0 && (
        <Note tone="review" className="mb-5" icon={<IconSparkle className="h-3.5 w-3.5" />}>
          {model.eligible} flagged talent{model.eligible > 1 ? "s have" : " has"} no insight yet for {formatPeriod(period)}.
          {canGen ? " Use Generate to diagnose them." : ` An ${allowedRolesLabel("insight.generate")} can generate these.`}
        </Note>
      )}

      <div className="mb-5">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "all", label: "All", count: counts.all },
            { key: "generated", label: "Generated", count: counts.generated },
            { key: "in_review", label: "In review", count: counts.in_review },
            { key: "approved", label: "Approved", count: counts.approved },
            { key: "rejected", label: "Rejected", count: counts.rejected },
          ]}
        />
      </div>

      {q.loading && !q.data ? (
        <div className="flex flex-col gap-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : q.error ? (
        <Note tone="low">Failed to load insights: {q.error}</Note>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconCheck className="h-7 w-7" />}
            title={tab === "all" ? "No insights yet" : `No ${tab.replace("_", " ")} insights`}
            hint={tab === "all" ? "Generate insights for flagged talents to begin." : undefined}
          />
        </Card>
      ) : (
        filtered.map((ins: Insight) => (
          <InsightCard key={ins.id} ins={ins} talentName={model?.tmap.get(ins.talent_id)?.full_name} reviewControls onChange={q.reload} />
        ))
      )}
    </div>
  );
}
