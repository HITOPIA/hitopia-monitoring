"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useApp, useToast } from "@/components/providers";
import { useAsync } from "@/lib/hooks";
import { api } from "@/lib/api/client";
import { can, allowedRolesLabel } from "@/lib/rbac";
import { PageHeader, Avatar, Note } from "@/components/bits";
import { Card, Badge, Button, Skeleton, EmptyState, Stat } from "@/components/ui";
import { IconCheck, IconLink, IconAlert, IconArrowRight } from "@/components/icons";
import type { IdentityMapping, Talent } from "@/lib/contract/types";

const SYSTEM_LABEL: Record<string, string> = { gsheet: "Google Sheets", jira: "Jira", clockify: "Clockify" };
const SYSTEM_FEEDS: Record<string, string> = { jira: "feeds delivery score", clockify: "feeds utilization & overtime", gsheet: "feeds the talent master" };
const CONF_TONE: Record<string, "healthy" | "review" | "low"> = { high: "healthy", medium: "review", low: "low" };

export default function MappingsPage() {
  const { user } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const q = useAsync(() => Promise.all([api.unresolvedMappings(), api.talents()]), []);

  const { rows, tmap } = useMemo(() => {
    if (!q.data) return { rows: [] as IdentityMapping[], tmap: new Map<string, Talent>() };
    const [mres, tres] = q.data;
    const tmap = new Map<string, Talent>(tres.data.map((t) => [t.id, t]));
    return { rows: mres.data, tmap };
  }, [q.data]);

  async function verify(mp: IdentityMapping) {
    setBusy(mp.id);
    try {
      await api.verifyMapping(mp.id);
      toast(`Verified ${tmap.get(mp.talent_id)?.full_name ?? "talent"} · ${SYSTEM_LABEL[mp.system]}`, "success");
      q.reload();
    } catch (e: any) {
      toast(e.message ?? "Verify failed", "error");
    } finally {
      setBusy(null);
    }
  }

  const canVerify = can("mapping.verify", user?.role);
  const lowConf = rows.filter((r) => r.confidence === "low").length;

  return (
    <div>
      <PageHeader
        eyebrow="Identity mapping"
        title="Unresolved identities"
        description="Talent is matched across Sheets, Jira and Clockify into one canonical registry. Anything the system is unsure about is held here for a human to confirm — this mapping is the foundation every score rests on."
      />

      <Note tone="accent" className="mb-5" icon={<IconLink className="h-4 w-4" />}>
        <p>A wrong match silently corrupts every downstream metric. Talents with no confident match are <strong className="font-medium">excluded from scoring</strong> rather than guessed.</p>
        <p className="mt-1">Each mapping links a talent to an external account: <strong className="font-medium">Jira</strong> → delivery score, <strong className="font-medium">Clockify</strong> → utilization &amp; overtime. Unmapped talents appear as “missing delivery / utilization” on the recompute summary.</p>
      </Note>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Unresolved" value={rows.length} tone={rows.length ? "review" : "healthy"} sub="awaiting verification" />
        <Stat label="Low confidence" value={lowConf} tone={lowConf ? "low" : undefined} sub="no confident candidate" />
        <Stat label="Systems" value={3} sub="Sheets · Jira · Clockify" />
      </div>

      {q.loading && !q.data ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : q.error ? (
        <Note tone="low">Failed to load mappings: {q.error}</Note>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={<IconCheck className="h-8 w-8 text-healthy" />} title="All identities resolved" hint="Every cross-system mapping is verified at high confidence." />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {rows.map((mp) => {
              const t = tmap.get(mp.talent_id);
              return (
                <li key={mp.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                  <Avatar name={t?.full_name ?? "?"} size={40} />
                  <div className="min-w-[160px] flex-1">
                    <div className="flex items-center gap-2">
                      {t ? (
                        <Link href={`/talents/${t.id}`} className="font-medium text-ink hover:text-accent hover:underline">
                          {t.full_name}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink-muted">Unknown talent</span>
                      )}
                      <Badge tone="neutral">{SYSTEM_LABEL[mp.system]}</Badge>
                    </div>
                    <p className="mt-0.5 text-[12px] text-ink-muted">
                      {t?.role} · candidate <span className="font-mono text-ink-soft">{mp.external_id}</span> · <span className="text-ink-faint">{SYSTEM_FEEDS[mp.system]}</span>
                    </p>
                  </div>
                  <Badge tone={CONF_TONE[mp.confidence]} dot>{mp.confidence} confidence</Badge>
                  <span className="inline-flex items-center gap-1 text-[11.5px] text-review">
                    <IconAlert className="h-3.5 w-3.5" /> {mp.verified ? "low confidence" : "unverified"}
                  </span>
                  {canVerify ? (
                    <Button size="sm" variant="primary" icon={<IconCheck className="h-3.5 w-3.5" />} loading={busy === mp.id} onClick={() => verify(mp)}>
                      Confirm match
                    </Button>
                  ) : (
                    <span className="text-[11px] text-ink-faint">{allowedRolesLabel("mapping.verify")} only</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="mt-4 text-center">
        <Link href="/talents" className="inline-flex items-center gap-1 text-[13px] text-accent hover:underline">
          See the full roster <IconArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
