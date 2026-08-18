"use client";

import { useMemo } from "react";
import { useApp } from "@/components/providers";
import { useAsync } from "@/lib/hooks";
import { api } from "@/lib/api/client";
import { can } from "@/lib/rbac";
import { PageHeader, Avatar, Note } from "@/components/bits";
import { Card, Badge, Skeleton, EmptyState } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { IconScroll, IconLock } from "@/components/icons";
import type { AppUser, AuditLog } from "@/lib/contract/types";

export default function AuditPage() {
  const { user } = useApp();
  const allowed = can("audit.view", user?.role);

  const q = useAsync(
    () => (allowed ? Promise.all([api.auditLogs({}), api.users()]) : Promise.resolve(null)),
    [allowed],
  );

  const { rows, umap } = useMemo(() => {
    if (!q.data) return { rows: [] as AuditLog[], umap: new Map<string, AppUser>() };
    const [logs, users] = q.data;
    return { rows: logs.data, umap: new Map<string, AppUser>(users.data.map((u) => [u.id, u])) };
  }, [q.data]);

  if (!allowed) {
    return (
      <div>
        <PageHeader eyebrow="Governance" title="Audit log" />
        <Card>
          <EmptyState
            icon={<IconLock className="h-8 w-8 text-low" />}
            title="Admin only"
            hint="The audit log records access to sensitive entities and is restricted to administrators. Switch to the Admin role to view it."
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Governance · PDP"
        title="Audit log"
        description="Every material action against a sensitive entity is recorded immutably. Sensitive values are redacted in metadata — the log proves who did what, without leaking the contents."
      />

      <Note tone="accent" className="mb-5" icon={<IconScroll className="h-4 w-4" />}>
        This is the accountability backbone for UU PDP compliance: ingestion triggers, scoring changes, insight generation,
        approvals and mapping verifications all land here.
      </Note>

      {q.loading && !q.data ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : q.error ? (
        <Note tone="low">Failed to load audit log: {q.error}</Note>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={<IconScroll className="h-7 w-7" />} title="No audit entries" /></Card>
      ) : (
        <Card>
          <div className="hidden grid-cols-[150px_1.2fr_1fr_1.3fr] gap-3 border-b border-line px-4 py-2.5 md:grid">
            {["When", "Actor", "Action", "Entity / detail"].map((h) => <span key={h} className="eyebrow !text-[10px]">{h}</span>)}
          </div>
          <ul className="divide-y divide-line">
            {rows.map((log) => {
              const actor = log.actor_user_id ? umap.get(log.actor_user_id) : null;
              return (
                <li key={log.id} className="grid grid-cols-1 gap-1.5 px-4 py-3 md:grid-cols-[150px_1.2fr_1fr_1.3fr] md:items-center md:gap-3">
                  <span className="font-mono text-[11.5px] text-ink-muted">{dateTime(log.created_at)}</span>
                  <span className="flex items-center gap-2">
                    {actor ? <Avatar name={actor.name} size={26} /> : <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-line text-[10px] text-ink-faint">sys</span>}
                    <span className="text-[12.5px] text-ink-soft">{actor?.name ?? "system"}</span>
                  </span>
                  <span><span className="ref-chip">{log.action}</span></span>
                  <span className="min-w-0 text-[12px] text-ink-muted">
                    <span className="text-ink-soft">{log.entity_type}</span>
                    {log.metadata && (
                      <span className="ml-1.5 font-mono text-[11px] text-ink-faint">
                        {Object.entries(log.metadata).map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join(" · ")}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
