"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAsync } from "@/lib/hooks";
import { api } from "@/lib/api/client";
import { PageHeader, Avatar, Note, Pagination } from "@/components/bits";
import { Card, Badge, Select, Skeleton, EmptyState } from "@/components/ui";
import { IconSearch } from "@/components/icons";
import type { Talent } from "@/lib/contract/types";

export default function TalentMasterPage() {
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState("all");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const q = useAsync(() => api.talents(), []);

  useEffect(() => setPage(1), [search, division, role, status]);

  const { rows, divisions, roles } = useMemo(() => {
    if (!q.data) return { rows: [] as Talent[], divisions: [] as string[], roles: [] as string[] };
    const all = q.data.data;
    const divisions = Array.from(new Set(all.map((t) => t.division))).sort();
    const roles = Array.from(new Set(all.map((t) => t.role))).sort();
    let rows = all;
    if (search.trim()) {
      const n = search.toLowerCase();
      rows = rows.filter(
        (t) => t.full_name.toLowerCase().includes(n) || t.email.toLowerCase().includes(n) || t.role.toLowerCase().includes(n),
      );
    }
    if (division !== "all") rows = rows.filter((t) => t.division === division);
    if (role !== "all") rows = rows.filter((t) => t.role === role);
    if (status !== "all") rows = rows.filter((t) => t.status === status);
    rows = [...rows].sort((a, b) => a.full_name.localeCompare(b.full_name));
    return { rows, divisions, roles };
  }, [q.data, search, division, role, status]);

  const total = q.data?.data.length ?? 0;
  const activeCount = q.data?.data.filter((t) => t.status === "active").length ?? 0;
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <PageHeader
        eyebrow={q.data ? `${total} talents · ${activeCount} active` : "Talent master"}
        title="Talent master"
        description="The imported talent roster — the source of truth the pipeline matches Jira and Clockify against. Read-only here; import or update it from Sources & integration."
      />

      <Card className="mb-5 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="relative min-w-[200px] flex-1">
            <span className="mb-1 block eyebrow">Search</span>
            <IconSearch className="pointer-events-none absolute bottom-2.5 left-2.5 h-4 w-4 text-ink-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email or role…"
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
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-[140px]"
            options={[
              { value: "all", label: "All status" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </div>
      </Card>

      {q.loading && !q.data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : q.error ? (
        <Note tone="low">Failed to load talents: {q.error}</Note>
      ) : (
        <Card>
          <div className="hidden grid-cols-[2rem_1.8fr_1.1fr_1fr_0.9fr_0.7fr] gap-3 border-b border-line px-4 py-2.5 md:grid">
            {["#", "Talent", "Role", "Division", "Type", "Status"].map((h, i) => (
              <span key={i} className="eyebrow !text-[10px]">{h}</span>
            ))}
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={<IconSearch className="h-7 w-7" />} title="No talents match" hint="Adjust the filters above." />
          ) : (
            <>
            <ul className="divide-y divide-line">
              {pageRows.map((t, i) => (
                <li
                  key={t.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 md:grid-cols-[2rem_1.8fr_1.1fr_1fr_0.9fr_0.7fr]"
                >
                  <span className="numeral hidden text-[12px] text-ink-faint md:block">{(page - 1) * pageSize + i + 1}</span>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={t.full_name} size={36} />
                    <div className="min-w-0">
                      <Link href={`/talents/${t.id}`} className="block truncate font-medium text-ink hover:underline focus-ring">
                        {t.full_name}
                      </Link>
                      <p className="truncate text-[12px] text-ink-muted">{t.email}</p>
                    </div>
                  </div>
                  <div className="hidden text-[13px] text-ink-soft md:block">{t.role}</div>
                  <div className="hidden text-[13px] text-ink-soft md:block">{t.division}</div>
                  <div className="hidden text-[12px] capitalize text-ink-muted md:block">{t.employment_type.replace(/_/g, " ")}</div>
                  <div className="justify-self-end md:justify-self-start">
                    <Badge tone={t.status === "active" ? "healthy" : "neutral"} dot>
                      {t.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={pageSize} total={rows.length} onPage={setPage} onPageSize={setPageSize} />
            </>
          )}
        </Card>
      )}
    </div>
  );
}
