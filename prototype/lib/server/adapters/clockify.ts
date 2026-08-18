/**
 * Clockify REST + Reports API adapter (read-only). Auth via CLOCKIFY_API_KEY
 * (env/secret manager only, R8). The workspace is chosen in-app and stored in
 * SourceSetting.config.workspace_id — never in env.
 */
import { getSecret } from "../env";

const API = "https://api.clockify.me/api/v1";
const REPORTS = "https://reports.api.clockify.me/v1";

async function cf(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "X-Api-Key": getSecret("CLOCKIFY_API_KEY"), "content-type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Clockify ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

export interface ClockifyWorkspace {
  id: string;
  name: string;
}
export interface ClockifyUser {
  id: string;
  email: string;
  name: string;
}
export interface ClockifyUserDuration {
  userId: string;
  name: string;
  durationSec: number;
}
export interface ClockifyTimeEntry {
  userId: string;
  date: string; // YYYY-MM-DD
  start: string | null; // ISO datetime
  end: string | null; // ISO datetime
  entryId: string | null;
  description: string;
  durationSec: number;
  projectName: string | null;
}

export async function listWorkspaces(): Promise<ClockifyWorkspace[]> {
  const ws = (await cf(`${API}/workspaces`)) as any[];
  return ws.map((w) => ({ id: w.id, name: w.name }));
}

export async function getWorkspaceUsers(wsId: string): Promise<ClockifyUser[]> {
  const out: ClockifyUser[] = [];
  for (let page = 1; page <= 40; page++) {
    const users = (await cf(`${API}/workspaces/${wsId}/users?page-size=50&page=${page}`)) as any[];
    if (!users?.length) break;
    out.push(...users.map((u) => ({ id: u.id, email: (u.email || "").toLowerCase(), name: u.name })));
    if (users.length < 50) break;
  }
  return out;
}

/** Total tracked time per user for a month, via the Summary Reports API. */
export async function summaryByUser(wsId: string, period: string): Promise<ClockifyUserDuration[]> {
  const { start, end } = monthRange(period);
  const body = {
    dateRangeStart: start,
    dateRangeEnd: end,
    summaryFilter: { groups: ["USER"] },
    amountShown: "HIDE_AMOUNT",
  };
  const data = await cf(`${REPORTS}/workspaces/${wsId}/reports/summary`, { method: "POST", body: JSON.stringify(body) });
  const groups = (data?.groupOne ?? []) as any[];
  return groups.map((g) => ({ userId: g._id, name: g.name, durationSec: g.duration || 0 }));
}

/** Clockify duration → seconds (Reports API may send a number or an ISO "PT#H#M#S"). */
function durationToSec(d: unknown): number {
  if (typeof d === "number") return d;
  if (typeof d === "string") {
    const m = d.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (m) return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  }
  return 0;
}

/**
 * Every individual time entry for a month via the Detailed Reports API — the raw
 * evidence behind a person's tracked hours (description often carries a Jira key).
 */
export async function detailedEntries(wsId: string, period: string): Promise<ClockifyTimeEntry[]> {
  const { start, end } = monthRange(period);
  const out: ClockifyTimeEntry[] = [];
  const pageSize = 1000;
  for (let page = 1; page <= 50; page++) {
    const body = {
      dateRangeStart: start,
      dateRangeEnd: end,
      detailedFilter: { page, pageSize, sortColumn: "DATE" },
      amountShown: "HIDE_AMOUNT",
    };
    const data = await cf(`${REPORTS}/workspaces/${wsId}/reports/detailed`, { method: "POST", body: JSON.stringify(body) });
    const entries = (data?.timeentries ?? []) as any[];
    for (const e of entries) {
      out.push({
        userId: e.userId,
        date: String(e?.timeInterval?.start ?? "").slice(0, 10),
        start: e?.timeInterval?.start ?? null,
        end: e?.timeInterval?.end ?? null,
        entryId: e._id ?? e.id ?? null,
        description: e.description || "",
        durationSec: durationToSec(e?.timeInterval?.duration),
        projectName: e.projectName ?? e?.project?.name ?? null,
      });
    }
    if (entries.length < pageSize) break;
  }
  return out;
}

export function monthRange(period: string) {
  const [y, m] = period.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Business days (Mon–Fri) in a YYYY-MM, for the default target-hours baseline. */
export function workdaysInMonth(period: string): number {
  const [y, m] = period.split("-").map(Number);
  let d = new Date(Date.UTC(y, m - 1, 1));
  let count = 0;
  while (d.getUTCMonth() === m - 1) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) count++;
    d = new Date(d.getTime() + 86400000);
  }
  return count;
}
