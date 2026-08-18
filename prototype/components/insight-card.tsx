"use client";

import { useState } from "react";
import Link from "next/link";
import { useApp, useToast } from "./providers";
import { api } from "@/lib/api/client";
import { can } from "@/lib/rbac";
import { Card, CardHead, Badge, Button, Modal, Field, Textarea } from "./ui";
import { Note } from "./bits";
import { formatPeriod } from "@/lib/format";
import { IconSparkle, IconShield, IconCheck, IconX, IconArrowRight } from "./icons";
import type { Insight } from "@/lib/contract/types";

const STATUS_TONE: Record<Insight["status"], "healthy" | "review" | "neutral" | "low"> = {
  approved: "healthy",
  in_review: "review",
  generated: "neutral",
  rejected: "low",
};
const SEVERITY_TONE: Record<string, "healthy" | "review" | "low"> = { strength: "healthy", watch: "review", risk: "low" };

export function InsightCard({
  ins,
  talentName,
  reviewControls = false,
  onChange,
}: {
  ins: Insight;
  talentName?: string;
  reviewControls?: boolean;
  onChange?: () => void;
}) {
  const { user } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");

  const canReview = can("insight.approve", user?.role);
  const canSubmit = can("insight.submit", user?.role);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast(ok, "success");
      onChange?.();
    } catch (e: any) {
      toast(e.message ?? "Action failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4">
      <CardHead
        title={
          <span className="inline-flex items-center gap-2">
            <IconSparkle className="h-4 w-4 text-accent" />
            {talentName ? (
              <Link href={`/talents/${ins.talent_id}`} className="hover:underline focus-ring">{talentName}</Link>
            ) : (
              "Diagnosis"
            )}
          </span>
        }
        sub={`${ins.model_id} · ${formatPeriod(ins.period)}`}
        right={
          <div className="flex items-center gap-1.5">
            {ins.severity && <Badge tone={SEVERITY_TONE[ins.severity]}>{ins.severity}</Badge>}
            {ins.confidence != null && <span className="ref-chip" title="model confidence">{Math.round(ins.confidence * 100)}% conf</span>}
            <Badge tone={STATUS_TONE[ins.status]} dot>{ins.status.replace("_", " ")}</Badge>
          </div>
        }
      />
      <div className="px-5 py-4">
        {ins.summary && <p className="mb-2 font-display text-[15px] leading-snug text-ink">{ins.summary}</p>}
        <p className="text-[13.5px] leading-relaxed text-ink-soft">{ins.narrative}</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="eyebrow mb-2">Diagnosis · contribution</div>
            <ul className="flex flex-col gap-2">
              {ins.diagnosis.map((dg, i) => (
                <li key={i} className="rounded-lg border border-line bg-surface px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-ink">{dg.cause}</span>
                    <span className="numeral text-[12px] text-low">{Math.round(dg.weight * 100)}%</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-muted">{dg.detail}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-2">Recommendations</div>
            <ul className="flex flex-col gap-1.5">
              {ins.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-ink-soft">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" /> {r}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <div className="eyebrow mb-2">Traces to</div>
              <div className="flex flex-wrap gap-1.5">
                {ins.source_refs.map((r, i) => (
                  <span key={i} className="ref-chip" title={r.value}>
                    {r.metric} · {r.period}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Note tone="accent" className="mt-4" icon={<IconShield className="h-3.5 w-3.5" />}>
          Decision-support, not a verdict — every claim points at a source metric and must be confirmed with the lead before action.
        </Note>

        {reviewControls && (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
            {ins.status === "generated" && canSubmit && (
              <Button size="sm" variant="secondary" icon={<IconArrowRight className="h-3.5 w-3.5" />} loading={busy}
                onClick={() => act(() => api.submitInsight(ins.id), "Sent for review")}>
                Submit for review
              </Button>
            )}
            {ins.status === "in_review" && canReview && (
              <>
                <Button size="sm" variant="danger" icon={<IconX className="h-3.5 w-3.5" />} disabled={busy} onClick={() => setRejectOpen(true)}>
                  Reject
                </Button>
                <Button size="sm" variant="primary" icon={<IconCheck className="h-3.5 w-3.5" />} loading={busy}
                  onClick={() => act(() => api.approveInsight(ins.id), "Insight approved")}>
                  Approve
                </Button>
              </>
            )}
            {ins.status === "in_review" && !canReview && (
              <span className="text-[11.5px] text-ink-faint">Awaiting a reviewer</span>
            )}
            {ins.status === "approved" && (
              <span className="inline-flex items-center gap-1 text-[12px] text-healthy"><IconCheck className="h-3.5 w-3.5" /> Approved for internal use</span>
            )}
            {ins.status === "rejected" && (
              <span className="text-[12px] text-low">Rejected — changes requested</span>
            )}
          </div>
        )}
      </div>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Request changes"
        sub="A comment is required and is written to the audit log."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                act(() => api.rejectInsight(ins.id, comment), "Insight rejected").then(() => {
                  setRejectOpen(false);
                  setComment("");
                })
              }
            >
              Reject insight
            </Button>
          </>
        }
      >
        <Field label="Reason">
          <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What needs to change before this can be approved?" />
        </Field>
      </Modal>
    </Card>
  );
}
