"use client";

import { useState } from "react";
import { useApp, useToast } from "@/components/providers";
import { useAsync } from "@/lib/hooks";
import { api } from "@/lib/api/client";
import { can, allowedRolesLabel } from "@/lib/rbac";
import { PageHeader, Note, KeyVal, SectionLabel } from "@/components/bits";
import { Card, CardHead, Badge, Button, Field, Textarea, Skeleton } from "@/components/ui";
import { shortDate, dateTime } from "@/lib/format";
import { SCORE_COMPONENTS } from "@/lib/scoring-meta";
import { IconSliders, IconCheck, IconAlert } from "@/components/icons";
import type { ScoringConfig, ScoringProfile, DeliverySource, ScoreWeights } from "@/lib/contract/types";

const WEIGHT_KEYS: { key: keyof ScoreWeights; label: string }[] = [
  { key: "delivery", label: "Delivery" },
  { key: "utilization", label: "Utilization" },
  { key: "efficiency", label: "Efficiency" },
  { key: "overtime", label: "Overtime health" },
  { key: "lead", label: "Lead assessment" },
];
const DESC_BY_KEY = Object.fromEntries(SCORE_COMPONENTS.map((c) => [c.key, c]));

type ConfigEditorBase = Pick<ScoringConfig, "version" | "weights" | "thresholds" | "profiles" | "role_groups">;

const FIRST_CONFIG_BASE: ConfigEditorBase = {
  version: 0,
  weights: { delivery: 35, utilization: 25, efficiency: 20, overtime: 10, lead: 10 },
  thresholds: { low: 60, healthy: 80 },
};

export default function ScoringPage() {
  const { user } = useApp();
  const q = useAsync(() => api.scoringConfig(), []);
  const [editing, setEditing] = useState(false);

  const canEdit = can("scoring.edit", user?.role);

  if (q.loading && !q.data) return <PageSkeleton />;
  if (q.error || !q.data) return <Note tone="low">Failed to load scoring config: {q.error}</Note>;

  const { current, versions } = q.data;

  if (!current) {
    return (
      <div>
        <PageHeader
          eyebrow="Metrics & scoring"
          title="Scoring configuration"
          description="Versioned weights and thresholds for the hybrid score."
          actions={
            canEdit ? (
              <Button variant="primary" icon={<IconSliders className="h-4 w-4" />} onClick={() => setEditing((e) => !e)}>
                {editing ? "Cancel" : "Create first config"}
              </Button>
            ) : (
              <Badge tone="neutral">{allowedRolesLabel("scoring.edit")} only</Badge>
            )
          }
        />
        <Note tone="review" className="mt-6" icon={<IconAlert className="h-4 w-4" />}>
          No scoring configuration exists yet. Admins can create the first version here to begin scoring.
        </Note>
        {editing && canEdit && <ConfigEditor base={FIRST_CONFIG_BASE} mode="create" onSaved={() => { setEditing(false); q.reload(); }} />}
      </div>
    );
  }

  const groups = current.profiles ? Object.keys(current.profiles) : [];

  return (
    <div>
      <PageHeader
        eyebrow="Metrics & scoring"
        title="Scoring configuration"
        description="The hybrid composite weights five components and flags each talent against two thresholds. Per-role profiles let each job type be scored fairly — e.g. QA on tickets they VERIFY, engineers on tickets ASSIGNED. Versioned; never applied retroactively."
        actions={
          canEdit ? (
            <Button variant="primary" icon={<IconSliders className="h-4 w-4" />} onClick={() => setEditing((e) => !e)}>
              {editing ? "Cancel" : "New version"}
            </Button>
          ) : (
            <Badge tone="neutral">{allowedRolesLabel("scoring.edit")} only</Badge>
          )
        }
      />

      <Note tone="neutral" className="mb-6">
        The <strong className="font-medium">default</strong> weights apply to any role without a profile. Each role is mapped to a{" "}
        <strong className="font-medium">scoring group</strong> (e.g. Engineering, QA), and the group&apos;s profile sets its own weights and
        which Jira signal feeds delivery. Within-role ranking still appears on the roster for peer comparison.
      </Note>

      {editing && canEdit && <ConfigEditor base={current} onSaved={() => { setEditing(false); q.reload(); }} />}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* default weights */}
        <Card>
          <CardHead title={`Default weights — v${current.version}`} sub={`Effective ${shortDate(current.effective_from)}`} right={<Badge tone="healthy" dot>active</Badge>} />
          <div className="px-5 py-4">
            <div className="eyebrow mb-3">Component weights</div>
            <ul className="flex flex-col gap-3.5">
              {WEIGHT_KEYS.map((w) => {
                const val = current.weights[w.key];
                const meta = DESC_BY_KEY[w.key];
                return (
                  <li key={w.key}>
                    <div className="mb-1 flex items-center justify-between text-[13px]">
                      <span className="text-ink-soft">{w.label}</span>
                      <span className="numeral text-ink">{val}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${val}%` }} />
                    </div>
                    {meta && <p className="mt-1 text-[11.5px] leading-snug text-ink-muted">{meta.what}</p>}
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <ThreshCell label="Low" range={`< ${current.thresholds.low}`} tone="low" />
              <ThreshCell label="Needs review" range={`${current.thresholds.low}–${current.thresholds.healthy - 1}`} tone="review" />
              <ThreshCell label="Healthy" range={`≥ ${current.thresholds.healthy}`} tone="healthy" />
            </div>

            {current.note && <Note tone="neutral" className="mt-4">{current.note}</Note>}
          </div>
        </Card>

        {/* history */}
        <div>
          <SectionLabel>Version history</SectionLabel>
          <Card>
            <ul className="divide-y divide-line">
              {versions.map((v) => (
                <li key={v.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink">v{v.version}</span>
                    {v.version === current.version ? <Badge tone="healthy">current</Badge> : <Badge tone="neutral">superseded</Badge>}
                  </div>
                  <dl className="mt-1.5">
                    <KeyVal k="Effective" v={shortDate(v.effective_from)} />
                    <KeyVal k="Created" v={dateTime(v.created_at)} />
                    <KeyVal k="Weights" v={WEIGHT_KEYS.map((w) => v.weights[w.key]).join("/")} />
                  </dl>
                  {v.note && <p className="mt-1.5 text-[11.5px] italic leading-relaxed text-ink-muted">{v.note}</p>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* per-role profiles (#13) */}
      {groups.length > 0 && (
        <div className="mt-6">
          <SectionLabel>Per-role scoring profiles</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => {
              const p = current.profiles![g];
              const roles = Object.entries(current.role_groups ?? {}).filter(([, grp]) => grp === g).map(([r]) => r);
              return (
                <Card key={g} className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[15px] text-ink">{g}</span>
                    <Badge tone={p.delivery_source === "verified" ? "accent" : "neutral"}>
                      delivery: {p.delivery_source}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11.5px] text-ink-muted">{roles.join(" · ") || "—"}</p>
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {WEIGHT_KEYS.map((w) => (
                      <li key={w.key} className="flex items-center gap-2 text-[12px]">
                        <span className="w-24 shrink-0 text-ink-muted">{w.label}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${p.weights[w.key]}%` }} />
                        </div>
                        <span className="numeral w-8 text-right text-ink">{p.weights[w.key]}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* component reference (#8) */}
      <div className="mt-6">
        <SectionLabel>What each component measures</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2">
          {SCORE_COMPONENTS.map((c) => (
            <Card key={c.key} className="p-4">
              <div className="font-display text-[15px] text-ink">{c.label}</div>
              <p className="mt-1 text-[13px] text-ink-soft">{c.what}</p>
              <dl className="mt-2.5">
                <KeyVal k="Inputs" v={<span className="text-right">{c.inputs}</span>} mono={false} />
                <KeyVal k="Formula" v={<span className="font-mono text-[11px] text-right">{c.formula}</span>} mono={false} />
              </dl>
              <p className="mt-2 text-[12px] italic leading-relaxed text-ink-muted">{c.why}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- editor --------------------------------- */
function ConfigEditor({ base, mode = "version", onSaved }: { base: ConfigEditorBase; mode?: "create" | "version"; onSaved: () => void }) {
  const toast = useToast();
  const [weights, setWeights] = useState<ScoreWeights>({ ...base.weights });
  const [low, setLow] = useState(base.thresholds.low);
  const [healthy, setHealthy] = useState(base.thresholds.healthy);
  const [effective, setEffective] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, ScoringProfile>>(
    base.profiles ? JSON.parse(JSON.stringify(base.profiles)) : {},
  );
  const groups = Object.keys(profiles);

  const sumOf = (w: ScoreWeights) => WEIGHT_KEYS.reduce((s, k) => s + Number(w[k.key] || 0), 0);
  const sum = sumOf(weights);
  const profilesValid = groups.every((g) => sumOf(profiles[g].weights) === 100);
  const valid = sum === 100 && low < healthy && low > 0 && healthy <= 100 && profilesValid;

  function setProfileWeight(g: string, key: keyof ScoreWeights, v: number) {
    setProfiles((s) => ({ ...s, [g]: { ...s[g], weights: { ...s[g].weights, [key]: v } } }));
  }
  function setProfileSource(g: string, src: DeliverySource) {
    setProfiles((s) => ({ ...s, [g]: { ...s[g], delivery_source: src } }));
  }

  async function save() {
    setSaving(true);
    try {
      await api.updateScoringConfig({
        weights,
        thresholds: { low, healthy },
        profiles: groups.length ? profiles : undefined,
        role_groups: base.role_groups,
        effective_from: effective,
        note: note || undefined,
      });
      toast(mode === "create" ? "Scoring configuration created" : "New scoring version created — not applied retroactively", "success");
      onSaved();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6 border-accent/30">
      <CardHead
        title={mode === "create" ? "Create first scoring config" : "Draft a new version"}
        sub="Default weights and every profile must each sum to 100. Existing scores keep their original config."
        right={<Badge tone="accent">draft</Badge>}
      />
      <div className="grid gap-5 px-5 py-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow">Default weights</span>
            <span className={`text-[12px] font-mono ${sum === 100 ? "text-healthy" : "text-low"}`}>Σ {sum} / 100</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {WEIGHT_KEYS.map((w) => (
              <label key={w.key} className="flex items-center gap-3">
                <span className="w-28 text-[13px] text-ink-soft">{w.label}</span>
                <input type="range" min={0} max={60} value={weights[w.key]} onChange={(e) => setWeights((s) => ({ ...s, [w.key]: Number(e.target.value) }))} className="flex-1 accent-[var(--accent)]" />
                <span className="numeral w-10 text-right text-[13px] text-ink">{weights[w.key]}%</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Low threshold (<)">
              <input type="number" value={low} onChange={(e) => setLow(Number(e.target.value))} className="h-9 w-full rounded-lg border border-line-strong bg-raised px-3 text-[13px] text-ink focus-ring" />
            </Field>
            <Field label="Healthy threshold (≥)">
              <input type="number" value={healthy} onChange={(e) => setHealthy(Number(e.target.value))} className="h-9 w-full rounded-lg border border-line-strong bg-raised px-3 text-[13px] text-ink focus-ring" />
            </Field>
          </div>
          <Field label="Effective from">
            <input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} className="h-9 w-full rounded-lg border border-line-strong bg-raised px-3 text-[13px] text-ink focus-ring" />
          </Field>
          <Field label="Change note">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why is this changing?" />
          </Field>
        </div>
      </div>

      {/* per-role profile editor */}
      {groups.length > 0 && (
        <div className="border-t border-line px-5 py-4">
          <span className="eyebrow">Per-role profiles</span>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {groups.map((g) => {
              const psum = sumOf(profiles[g].weights);
              return (
                <div key={g} className="rounded-lg border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink">{g}</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={profiles[g].delivery_source}
                        onChange={(e) => setProfileSource(g, e.target.value as DeliverySource)}
                        className="h-7 appearance-none rounded-md border border-line-strong bg-raised px-2 text-[11.5px] text-ink focus-ring"
                      >
                        <option value="assigned">delivery: assigned</option>
                        <option value="verified">delivery: verified</option>
                      </select>
                      <span className={`font-mono text-[11px] ${psum === 100 ? "text-healthy" : "text-low"}`}>Σ {psum}</span>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-5 gap-1.5">
                    {WEIGHT_KEYS.map((w) => (
                      <label key={w.key} className="flex flex-col gap-0.5">
                        <span className="text-[9.5px] uppercase tracking-wide text-ink-faint" title={w.label}>{w.label.slice(0, 4)}</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={profiles[g].weights[w.key]}
                          onChange={(e) => setProfileWeight(g, w.key, Number(e.target.value))}
                          className="h-8 w-full rounded-md border border-line-strong bg-raised px-1.5 text-center text-[12px] text-ink focus-ring"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line bg-paper/60 px-5 py-3">
        {!valid ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-low"><IconAlert className="h-3.5 w-3.5" /> Default & each profile must sum to 100; low &lt; healthy.</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-healthy"><IconCheck className="h-3.5 w-3.5" /> Ready — will be saved as v{base.version + 1}.</span>
        )}
        <Button variant="primary" disabled={!valid} loading={saving} onClick={save}>{mode === "create" ? "Save first config" : "Save version"}</Button>
      </div>
    </Card>
  );
}

function ThreshCell({ label, range, tone }: { label: string; range: string; tone: "low" | "review" | "healthy" }) {
  return (
    <div className={`rounded-lg border bg-surface px-3 py-2.5 text-center border-${tone}/25`}>
      <div className={`text-[12px] font-medium text-${tone}`}>{label}</div>
      <div className="numeral mt-1 text-[14px] text-ink">{range}</div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-10 w-72" />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
