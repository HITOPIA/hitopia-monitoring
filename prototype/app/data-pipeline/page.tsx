"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp, useToast } from "@/components/providers";
import { useAsync } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api/client";
import { can, allowedRolesLabel } from "@/lib/rbac";
import { PageHeader, Note } from "@/components/bits";
import Link from "next/link";
import { Card, CardHead, Badge, Button, Select, Field, Skeleton, Modal, EmptyState, Tabs, Spinner } from "@/components/ui";
import { formatPeriod, dateTime, timeAgo, num } from "@/lib/format";
import { PeriodPicker } from "@/components/period-picker";
import { IconDatabase, IconAlert, IconCheck, IconLock, IconClock } from "@/components/icons";
import type { IngestionRun, Paginated, Schedule } from "@/lib/contract/types";

const SOURCES = ["gsheet", "jira", "clockify"] as const;
const SOURCE_LABEL: Record<string, string> = { gsheet: "Google Sheets", jira: "Jira", clockify: "Clockify" };
const STATUS_TONE: Record<IngestionRun["status"], "healthy" | "review" | "low" | "neutral"> = {
  success: "healthy",
  partial: "review",
  failed: "low",
  running: "review",
  pending: "neutral",
};

interface RunsQuery {
  data: Paginated<IngestionRun> | null;
  loading: boolean;
  error: string | null;
  code: string | null;
  reload: () => void;
}

export default function DataPipelinePage() {
  const { user } = useApp();
  const canTrigger = can("ingestion.trigger", user?.role);
  const [tab, setTab] = useState<string>(canTrigger ? "setup" : "history");
  const runsQ = useAsync(() => api.ingestionRuns({}), []);

  return (
    <div>
      <PageHeader
        eyebrow="Data pipeline"
        title="Sources & integration"
        description="Connect Jira and Clockify, import the talent master and run ingestion — then review every ingestion run, all in one place."
      />

      <Note tone="accent" className="mb-5" icon={<IconLock className="h-4 w-4" />}>
        <strong className="font-medium">Read-only</strong> to external sources — nothing is ever written back to Jira, Clockify or Sheets.
        Credentials live only in the secret manager, never in the app, logs or this prototype.
      </Note>

      <div className="mb-5">
        <Tabs
          tabs={[
            { key: "setup", label: "Setup & run" },
            { key: "history", label: "Run history", count: runsQ.data?.data.length },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "setup" ? <SetupTab canTrigger={canTrigger} onChanged={runsQ.reload} /> : <HistoryTab q={runsQ} />}
    </div>
  );
}

/* ------------------------- setup & run (admin) ------------------------- */
function SetupTab({ canTrigger, onChanged }: { canTrigger: boolean; onChanged: () => void }) {
  const { period } = useApp();
  const toast = useToast();

  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [selectedWs, setSelectedWs] = useState("");
  const [loadingWs, setLoadingWs] = useState(true);
  const [savingWs, setSavingWs] = useState(false);
  const [ingPeriod, setIngPeriod] = useState(period);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lastRecompute, setLastRecompute] = useState<Awaited<ReturnType<typeof api.recomputeScores>> | null>(null);
  const [schedule, setSchedule] = useState<Schedule>({ work_start: "09:00", work_end: "18:00", timezone: "Asia/Jakarta", workdays: [1, 2, 3, 4, 5] });
  const [savingSch, setSavingSch] = useState(false);
  const latestQ = useAsync(() => api.latestIngestion(ingPeriod), [ingPeriod]);

  useEffect(() => {
    setIngPeriod(period);
  }, [period]);

  useEffect(() => {
    if (!canTrigger) return;
    let active = true;
    api
      .sourceSetting("schedule")
      .then((s) => {
        if (!active) return;
        const c = s.setting?.config as Partial<Schedule> | undefined;
        if (c) setSchedule((prev) => ({ ...prev, ...c, workdays: c.workdays?.length ? c.workdays : prev.workdays }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [canTrigger]);

  useEffect(() => {
    if (!canTrigger) return;
    let active = true;
    (async () => {
      try {
        const [ws, setting] = await Promise.all([api.clockifyWorkspaces(), api.sourceSetting("clockify")]);
        if (!active) return;
        setWorkspaces(ws.data);
        const saved = (setting.setting?.config as any)?.workspace_id as string | undefined;
        setSelectedWs(saved || ws.data[0]?.id || "");
      } catch (e) {
        if (active) toast(e instanceof ApiClientError ? e.message : "Could not load Clockify workspaces.", "error");
      } finally {
        if (active) setLoadingWs(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [toast, canTrigger]);

  async function saveWorkspace() {
    setSavingWs(true);
    try {
      const name = workspaces.find((w) => w.id === selectedWs)?.name;
      await api.saveSourceSetting("clockify", { workspace_id: selectedWs, workspace_name: name });
      toast(`Clockify workspace set to "${name}".`);
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Failed to save workspace.", "error");
    } finally {
      setSavingWs(false);
    }
  }

  async function runIngestion(source: "clockify" | "jira") {
    setBusy(source);
    try {
      const { run } = await api.triggerIngestion(source, ingPeriod);
      const qs = run.quality_summary;
      toast(`${source} ${run.status}: ${run.records_ingested} records${qs?.note ? ` — ${qs.note}` : ""}`, run.status === "failed" ? "error" : "success");
      onChanged();
      latestQ.reload();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : `${source} ingestion failed.`, "error");
    } finally {
      setBusy(null);
    }
  }

  async function recompute() {
    setBusy("score");
    try {
      const r = await api.recomputeScores(ingPeriod);
      setLastRecompute(r);
      toast(`Scored ${r.scored} talents (${r.not_scorable} not scorable, ${r.budget_unavailable} no cost rate).`);
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Recompute failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function saveSchedule() {
    setSavingSch(true);
    try {
      await api.saveSourceSetting("schedule", schedule as unknown as Record<string, unknown>);
      toast("Work-hour schedule saved — applies on the next Clockify ingestion.");
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Failed to save schedule.", "error");
    } finally {
      setSavingSch(false);
    }
  }

  async function uploadCsv() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast("Choose a CSV file first.", "error");
      return;
    }
    setBusy("csv");
    try {
      const r = await api.uploadTalentCsv(file, ingPeriod);
      toast(`Talent CSV imported: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped, ${r.cost_rates} rates.`);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "CSV import failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (!canTrigger) {
    return (
      <Card>
        <div className="px-5 py-8 text-center">
          <p className="font-display text-[15px] text-ink-soft">Setup is admin-only</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-ink-muted">
            Only {allowedRolesLabel("ingestion.trigger")} can configure sources and run ingestion. You can still review the run history.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Clockify workspace */}
      <Card>
        <CardHead title="Clockify workspace" sub="Choose the workspace whose tracked time feeds utilization." right={<Badge tone="accent" dot>live</Badge>} />
        <div className="flex items-end gap-3 px-5 py-4">
          {loadingWs ? (
            <Spinner className="h-5 w-5 text-ink-faint" />
          ) : (
            <>
              <Select
                label="Workspace"
                className="flex-1"
                value={selectedWs}
                onChange={(e) => setSelectedWs(e.target.value)}
                options={workspaces.map((w) => ({ value: w.id, label: w.name }))}
              />
              <Button variant="primary" loading={savingWs} onClick={saveWorkspace} disabled={!selectedWs}>
                Save
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Talent CSV */}
      <Card>
        <CardHead title="Talent master (CSV)" sub="Upload the master roster export. Name, email, role, status, client and hourly rate are imported; sensitive PII is ignored." />
        <div className="flex items-end gap-3 px-5 py-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="flex-1 text-[13px] text-ink-soft file:mr-3 file:rounded-lg file:border file:border-line-strong file:bg-raised file:px-3 file:py-2 file:text-[13px] file:text-ink hover:file:border-ink-faint"
          />
          <Button variant="primary" loading={busy === "csv"} onClick={uploadCsv}>
            Import
          </Button>
        </div>
      </Card>

      {/* Work-hour schedule (#6) */}
      <Card>
        <CardHead
          title="Work-hour schedule"
          sub="Defines the work window. Clockify time logged before/after it — or on weekends — is flagged off-hours and feeds overtime health."
          right={<Badge tone="accent" dot>overtime</Badge>}
        />
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <Field label="Work start">
            <input type="time" value={schedule.work_start} onChange={(e) => setSchedule((s) => ({ ...s, work_start: e.target.value }))} className="h-9 rounded-lg border border-line-strong bg-raised px-3 text-[13px] text-ink focus-ring" />
          </Field>
          <Field label="Work end">
            <input type="time" value={schedule.work_end} onChange={(e) => setSchedule((s) => ({ ...s, work_end: e.target.value }))} className="h-9 rounded-lg border border-line-strong bg-raised px-3 text-[13px] text-ink focus-ring" />
          </Field>
          <Select
            label="Timezone"
            className="w-[200px]"
            value={schedule.timezone}
            onChange={(e) => setSchedule((s) => ({ ...s, timezone: e.target.value }))}
            options={[
              { value: "Asia/Jakarta", label: "Asia/Jakarta (WIB)" },
              { value: "Asia/Makassar", label: "Asia/Makassar (WITA)" },
              { value: "Asia/Jayapura", label: "Asia/Jayapura (WIT)" },
              { value: "UTC", label: "UTC" },
            ]}
          />
          <Button variant="primary" loading={savingSch} onClick={saveSchedule}>Save schedule</Button>
        </div>
      </Card>

      {/* Ingestion + scoring */}
      <Card>
        <CardHead
          title="Run ingestion"
          sub="Pull the latest data for a period, then recompute scores. Idempotent per (source, period)."
          right={<PeriodPicker className="w-[200px]" value={ingPeriod} onChange={setIngPeriod} aria-label="Ingestion period" />}
        />
        {/* latest ingestion status per source (#2) */}
        <div className="grid gap-3 border-b border-line px-5 py-4 sm:grid-cols-3">
          {SOURCES.map((s) => {
            const run = latestQ.data?.latest?.[s];
            return (
              <div key={s} className="rounded-lg border border-line bg-surface px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-medium text-ink">{SOURCE_LABEL[s]}</span>
                  {run ? <Badge tone={STATUS_TONE[run.status]} dot>{run.status}</Badge> : <Badge tone="neutral">never</Badge>}
                </div>
                <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-ink-muted">
                  <IconClock className="h-3 w-3" />
                  {run ? `${num(run.records_ingested)} rec · ${timeAgo(run.finished_at ?? run.started_at)}` : "not run this period"}
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 px-5 py-4">
          <Button icon={<IconDatabase className="h-4 w-4" />} loading={busy === "clockify"} onClick={() => runIngestion("clockify")}>
            Run Clockify
          </Button>
          <Button icon={<IconDatabase className="h-4 w-4" />} loading={busy === "jira"} onClick={() => runIngestion("jira")}>
            Run Jira
          </Button>
          <Button variant="primary" loading={busy === "score"} onClick={recompute}>
            Recompute scores
          </Button>
        </div>
        {lastRecompute && (
          <div className="border-t border-line px-5 py-4">
            <div className="eyebrow mb-2">Last recompute · identity-mapping coverage</div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-soft">
              <span>Scored <strong className="text-ink">{lastRecompute.scored}</strong></span>
              <span>Jira-mapped <strong className="text-ink">{lastRecompute.mapping.jira_mapped}</strong>/{lastRecompute.mapping.total}</span>
              <span>Clockify-mapped <strong className="text-ink">{lastRecompute.mapping.clockify_mapped}</strong>/{lastRecompute.mapping.total}</span>
              <span className={lastRecompute.mapping.missing_delivery ? "text-review" : "text-ink-muted"}>missing delivery {lastRecompute.mapping.missing_delivery}</span>
              <span className={lastRecompute.mapping.missing_utilization ? "text-review" : "text-ink-muted"}>missing utilization {lastRecompute.mapping.missing_utilization}</span>
              <Link href="/mappings" className="text-accent-ink hover:underline">Resolve identity mappings →</Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------ run history ---------------------------- */
function HistoryTab({ q }: { q: RunsQuery }) {
  const [openRun, setOpenRun] = useState<IngestionRun | null>(null);

  const grouped = useMemo(() => {
    const runs = q.data?.data ?? [];
    const byPeriod = new Map<string, IngestionRun[]>();
    runs.forEach((r) => byPeriod.set(r.period, [...(byPeriod.get(r.period) ?? []), r]));
    return Array.from(byPeriod.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [q.data]);

  if (q.loading && !q.data) {
    return <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>;
  }
  if (q.error) return <Note tone="low">Failed to load runs: {q.error}</Note>;
  if (grouped.length === 0) {
    return (
      <Card>
        <EmptyState icon={<IconDatabase className="h-7 w-7" />} title="No ingestion runs" hint="Trigger a run from the Setup & run tab." />
      </Card>
    );
  }

  return (
    <>
      {grouped.map(([p, runs]) => (
        <div key={p} className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="font-display text-[18px] tracking-tightish text-ink">{formatPeriod(p)}</h2>
            <span className="text-[12px] text-ink-faint">{runs.length} sources</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SOURCES.map((s) => {
              const run = runs.find((r) => r.source === s);
              if (!run) return null;
              const qs = run.quality_summary;
              return (
                <button
                  key={run.id}
                  onClick={() => setOpenRun(run)}
                  className="rounded-xl border border-line bg-surface p-4 text-left shadow-card transition-all hover:border-ink-faint hover:shadow-raised focus-ring"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13.5px] font-medium text-ink">{SOURCE_LABEL[s]}</span>
                    <Badge tone={STATUS_TONE[run.status]} dot>{run.status}</Badge>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="numeral text-[22px] text-ink">{num(run.records_ingested)}</span>
                    <span className="text-[11px] text-ink-muted">records</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[11.5px]">
                    {qs && qs.warn > 0 && <span className="inline-flex items-center gap-1 text-review"><IconAlert className="h-3 w-3" /> {qs.warn} warn</span>}
                    {qs && qs.block > 0 && <span className="inline-flex items-center gap-1 text-low"><IconAlert className="h-3 w-3" /> {qs.block} block</span>}
                    {qs && qs.warn === 0 && qs.block === 0 && <span className="inline-flex items-center gap-1 text-healthy"><IconCheck className="h-3 w-3" /> clean</span>}
                  </div>
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-ink-faint"><IconClock className="h-3 w-3" /> {dateTime(run.finished_at)}</p>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <RunModal run={openRun} onClose={() => setOpenRun(null)} />
    </>
  );
}

function RunModal({ run, onClose }: { run: IngestionRun | null; onClose: () => void }) {
  const q = useAsync(() => (run ? api.ingestionRun(run.id) : Promise.resolve(null)), [run?.id]);
  if (!run) return null;
  const flags = q.data?.quality_flags ?? [];
  const sevTone: Record<string, "neutral" | "review" | "low"> = { info: "neutral", warn: "review", block: "low" };
  return (
    <Modal open={!!run} onClose={onClose} title={`${SOURCE_LABEL[run.source]} · ${formatPeriod(run.period)}`} sub={`Run finished ${dateTime(run.finished_at)}`} wide>
      <div className="grid grid-cols-3 gap-2">
        <Mini label="Records" value={num(run.records_ingested)} />
        <Mini label="Warnings" value={String(run.quality_summary?.warn ?? 0)} tone="review" />
        <Mini label="Blocking" value={String(run.quality_summary?.block ?? 0)} tone="low" />
      </div>
      {run.quality_summary?.note && (
        <Note tone="review" className="mt-4" icon={<IconAlert className="h-3.5 w-3.5" />}>{run.quality_summary.note}</Note>
      )}
      <div className="mt-4">
        <div className="eyebrow mb-2">Data quality flags</div>
        {q.loading ? (
          <Skeleton className="h-16" />
        ) : flags.length === 0 ? (
          <p className="text-[13px] text-ink-muted">No flags recorded for this run.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {flags.map((f) => (
              <li key={f.id} className="flex items-start gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5">
                <Badge tone={sevTone[f.severity]}>{f.severity}</Badge>
                <div className="min-w-0">
                  <p className="font-mono text-[11.5px] text-ink-soft">{f.code}</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">{f.message}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "review" | "low" }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5 text-center">
      <div className={`numeral text-[20px] ${tone ? `text-${tone}` : "text-ink"}`}>{value}</div>
      <div className="eyebrow mt-0.5 !text-[9.5px]">{label}</div>
    </div>
  );
}
