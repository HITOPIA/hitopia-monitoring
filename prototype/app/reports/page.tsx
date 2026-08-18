"use client";

import { useEffect, useState } from "react";
import { useApp, useToast } from "@/components/providers";
import { useAsync } from "@/lib/hooks";
import { api } from "@/lib/api/client";
import { can, allowedRolesLabel } from "@/lib/rbac";
import { PageHeader, Note } from "@/components/bits";
import { Card, Badge, Button, Modal, Field, Textarea, Skeleton, EmptyState } from "@/components/ui";
import { formatPeriod, dateTime, shortDate } from "@/lib/format";
import { IconReport, IconLock, IconCheck, IconX, IconDownload, IconEye, IconEyeOff, IconShield, IconArrowRight } from "@/components/icons";
import { PeriodPicker } from "@/components/period-picker";
import type { MonthlyReport, ReportItem } from "@/lib/contract/types";

const STATUS_TONE: Record<MonthlyReport["status"], "neutral" | "review" | "healthy" | "accent"> = {
  draft: "neutral",
  in_review: "review",
  approved: "healthy",
  published: "accent",
};
const FLOW: MonthlyReport["status"][] = ["draft", "in_review", "approved", "published"];

export default function ReportsPage() {
  const { user, period } = useApp();
  const toast = useToast();
  const [genPeriod, setGenPeriod] = useState(period);
  const [generating, setGenerating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const q = useAsync(() => api.reports(), []);
  const canGen = can("report.generate", user?.role);

  useEffect(() => {
    setGenPeriod(period);
  }, [period]);

  async function generate() {
    setGenerating(true);
    try {
      const res = await api.generateReport(genPeriod);
      toast(`Draft report created for ${formatPeriod(genPeriod)}`, "success");
      q.reload();
      setOpenId(res.report.id);
    } catch (e: any) {
      toast(e.message ?? "Generate failed", "error");
    } finally {
      setGenerating(false);
    }
  }

  const reports = q.data?.data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Monthly reporting"
        title="Client decks"
        description="Each month assembles into a client-ready deck — but only approved, client-safe content can ever be exported. Internal diagnostics and per-talent scores never leave the building without an explicit human approval."
        actions={
          canGen ? (
            <div className="flex items-end gap-2">
              <PeriodPicker value={genPeriod} onChange={setGenPeriod} className="w-[190px]" aria-label="Report period" />
              <Button variant="primary" icon={<IconReport className="h-4 w-4" />} loading={generating} onClick={generate}>Generate</Button>
            </div>
          ) : (
            <Badge tone="neutral">{allowedRolesLabel("report.generate")} only</Badge>
          )
        }
      />

      <Note tone="accent" className="mb-5" icon={<IconShield className="h-4 w-4" />}>
        <strong className="font-medium">Two walls.</strong> Content is marked client-visible or internal-only, and export is hard-gated
        on approval — a report that isn’t approved cannot produce a client file.
      </Note>

      {q.loading && !q.data ? (
        <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : q.error ? (
        <Note tone="low">Failed to load reports: {q.error}</Note>
      ) : reports.length === 0 ? (
        <Card><EmptyState icon={<IconReport className="h-7 w-7" />} title="No reports yet" hint="Generate a draft to begin." /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => setOpenId(r.id)}
              className="rounded-xl border border-line bg-surface p-4 text-left shadow-card transition-all hover:border-ink-faint hover:shadow-raised focus-ring"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-[18px] tracking-tightish text-ink">{formatPeriod(r.period)}</span>
                <Badge tone={STATUS_TONE[r.status]} dot>{r.status.replace("_", " ")}</Badge>
              </div>
              <p className="mt-2 text-[12.5px] text-ink-muted">
                {r.scope.talents} talents · {r.scope.projects} projects · {r.scope.clients.length} clients
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11.5px]">
                  {r.audience === "client" ? (
                    <Badge tone="accent">client</Badge>
                  ) : (
                    <Badge tone="neutral">internal</Badge>
                  )}
                </span>
                <span className="inline-flex items-center gap-1 text-[12px] text-accent">Open <IconArrowRight className="h-3.5 w-3.5" /></span>
              </div>
              <p className="mt-2 text-[11px] text-ink-faint">created {shortDate(r.created_at)}</p>
            </button>
          ))}
        </div>
      )}

      <ReportModal id={openId} onClose={() => setOpenId(null)} onChanged={q.reload} />
    </div>
  );
}

/* ----------------------------- detail --------------------------------- */
function ReportModal({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const { user } = useApp();
  const toast = useToast();
  const q = useAsync(() => (id ? api.report(id) : Promise.resolve(null)), [id]);
  const [busy, setBusy] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [comment, setComment] = useState("");
  const [exported, setExported] = useState<ReportItem[] | null>(null);

  if (!id) return null;
  const report = q.data?.report;
  const items = q.data?.items ?? [];
  const clientItems = items.filter((it) => it.client_visible);
  const internalItems = items.filter((it) => !it.client_visible);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast(ok, "success");
      q.reload();
      onChanged();
    } catch (e: any) {
      toast(e.message ?? "Action failed", "error");
    } finally {
      setBusy(false);
    }
  }

  const canApprove = can("report.approve", user?.role);
  const canSubmit = can("report.submit", user?.role);
  const isApproved = report?.status === "approved" || report?.status === "published";

  return (
    <Modal
      open={!!id}
      onClose={() => {
        setExported(null);
        setRejectMode(false);
        onClose();
      }}
      title={report ? `${formatPeriod(report.period)} report` : "Report"}
      sub={report ? `${report.scope.talents} talents · ${report.scope.clients.join(", ")}` : undefined}
      wide
      footer={
        report && (
          <div className="flex w-full items-center justify-between gap-2">
            <StatusFlow status={report.status} />
            <div className="flex items-center gap-2">
              {report.status === "draft" && canSubmit && (
                <Button size="sm" variant="primary" loading={busy} icon={<IconArrowRight className="h-3.5 w-3.5" />} onClick={() => act(() => api.submitReport(report.id), "Submitted for review")}>
                  Submit for review
                </Button>
              )}
              {report.status === "in_review" && canApprove && (
                <>
                  <Button size="sm" variant="danger" icon={<IconX className="h-3.5 w-3.5" />} disabled={busy} onClick={() => setRejectMode((m) => !m)}>Request changes</Button>
                  <Button size="sm" variant="primary" icon={<IconCheck className="h-3.5 w-3.5" />} loading={busy} onClick={() => act(() => api.approveReport(report.id), "Report approved")}>Approve</Button>
                </>
              )}
              <Button
                size="sm"
                variant={isApproved ? "primary" : "secondary"}
                icon={isApproved ? <IconDownload className="h-3.5 w-3.5" /> : <IconLock className="h-3.5 w-3.5" />}
                disabled={!isApproved || busy}
                onClick={() => act(() => api.exportReport(report.id).then((r) => setExported(r.slides)), `Exported ${clientItems.length} client slides`)}
                title={isApproved ? "Export client deck" : "Export blocked until approved"}
              >
                Export deck
              </Button>
              {(isApproved || report.status === "published") && (
                <>
                  <Button size="sm" variant="secondary" icon={<IconDownload className="h-3.5 w-3.5" />} onClick={() => window.open(`/api/reports/${report.id}/pdf`, "_blank")} title="Download client PDF (landscape)">PDF</Button>
                  <Button size="sm" variant="secondary" icon={<IconDownload className="h-3.5 w-3.5" />} onClick={() => window.open(`/api/reports/${report.id}/html`, "_blank")} title="Download client HTML deck (landscape)">HTML</Button>
                  <Button size="sm" variant="secondary" icon={<IconDownload className="h-3.5 w-3.5" />} onClick={() => window.open(`/api/reports/${report.id}/pptx`, "_blank")} title="Download client PPTX deck (landscape)">PPTX</Button>
                </>
              )}
            </div>
          </div>
        )
      }
    >
      {q.loading && !q.data ? (
        <Skeleton className="h-64" />
      ) : !report ? (
        <Note tone="low">Report not found.</Note>
      ) : (
        <div className="flex flex-col gap-4">
          {!isApproved && (
            <Note tone="review" icon={<IconLock className="h-3.5 w-3.5" />}>
              Export is disabled — a deck can only be produced once this report is <strong className="font-medium">approved</strong>.
            </Note>
          )}
          {exported && (
            <Note tone="healthy" icon={<IconCheck className="h-3.5 w-3.5" />}>
              Exported <span className="font-mono">{exported.length}</span> client-safe slides to <span className="font-mono">{report.file_ref}</span>.
              The {internalItems.length} internal diagnostic item{internalItems.length !== 1 ? "s were" : " was"} excluded.
            </Note>
          )}
          {rejectMode && report.status === "in_review" && (
            <div className="rounded-lg border border-low/30 bg-low-soft/40 p-3">
              <Field label="What needs to change?">
                <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Required — written to the audit log." />
              </Field>
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setRejectMode(false)}>Cancel</Button>
                <Button size="sm" variant="danger" loading={busy} disabled={!comment.trim()} onClick={() => act(() => api.rejectReport(report.id, comment).then(() => { setRejectMode(false); setComment(""); }), "Sent back for changes")}>
                  Send back
                </Button>
              </div>
            </div>
          )}

          {report.exec_summary && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="eyebrow mb-1.5">Executive summary</div>
              <p className="text-[13.5px] leading-relaxed text-ink-soft">{report.exec_summary}</p>
            </div>
          )}

          {/* client-visible */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <IconEye className="h-4 w-4 text-healthy" />
              <h3 className="text-[13px] font-medium text-ink">Client-facing ({clientItems.length})</h3>
              <span className="text-[11.5px] text-ink-faint">— included in the exported deck</span>
            </div>
            <ul className="flex flex-col gap-2">
              {clientItems.map((it) => (
                <li key={it.id} className="rounded-lg border border-healthy/25 bg-healthy-soft/30 px-3.5 py-2.5">
                  <p className="text-[12.5px] font-medium text-ink">{it.content.title}</p>
                  <ItemContent content={it.content} />
                </li>
              ))}
            </ul>
          </div>

          {/* internal-only */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <IconEyeOff className="h-4 w-4 text-low" />
              <h3 className="text-[13px] font-medium text-ink">Internal only ({internalItems.length})</h3>
              <span className="text-[11.5px] text-ink-faint">— never exported to client</span>
            </div>
            <ul className="flex flex-col gap-2">
              {internalItems.map((it) => (
                <li key={it.id} className="hatch-internal rounded-lg border border-low/25 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <IconLock className="h-3.5 w-3.5 text-low" />
                    <p className="text-[12.5px] font-medium text-ink">{it.content.title}</p>
                  </div>
                  <ItemContent content={it.content} />
                  {it.content.refs && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {it.content.refs.map((r, i) => <span key={i} className="ref-chip">{r}</span>)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-center text-[11px] text-ink-faint">Last updated {dateTime(report.created_at)}</p>
        </div>
      )}
    </Modal>
  );
}

function ItemContent({ content }: { content: ReportItem["content"] }) {
  return (
    <>
      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">{content.body}</p>
      {content.metrics && content.metrics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {content.metrics.map((m, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface px-2.5 py-1.5">
              <div className="numeral text-[15px] leading-none text-accent-ink">{m.value}</div>
              <div className="mt-0.5 text-[10px] text-ink-muted">{m.label}{m.sub ? ` · ${m.sub}` : ""}</div>
            </div>
          ))}
        </div>
      )}
      {content.table && content.table.rows.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr>{content.table.columns.map((c, i) => <th key={i} className="border-b border-line px-2 py-1 text-left font-medium text-ink-muted">{c}</th>)}</tr>
            </thead>
            <tbody>
              {content.table.rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border-b border-line/60 px-2 py-1 text-ink-soft">{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function StatusFlow({ status }: { status: MonthlyReport["status"] }) {
  const idx = FLOW.indexOf(status);
  return (
    <div className="hidden items-center gap-1.5 sm:flex">
      {FLOW.map((s, i) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${i <= idx ? "bg-accent" : "bg-line"}`} />
          <span className={`text-[10.5px] ${i === idx ? "font-medium text-ink" : "text-ink-faint"}`}>{s.replace("_", " ")}</span>
          {i < FLOW.length - 1 && <span className="text-ink-faint">·</span>}
        </span>
      ))}
    </div>
  );
}
