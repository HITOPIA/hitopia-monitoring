/**
 * Pure helpers for off-hours / overtime classification (no Prisma — safe to import
 * from server ingest, the /overtime API, and client components). An entry is
 * "off-hours" when it falls outside the configured work-hour window on a workday,
 * or on a non-workday (weekend). Timezone-aware via Intl (default Asia/Jakarta).
 */
import type { Schedule } from "./contract/types";

export const DEFAULT_SCHEDULE: Schedule = {
  work_start: "09:00",
  work_end: "18:00",
  timezone: "Asia/Jakarta",
  workdays: [1, 2, 3, 4, 5], // Mon–Fri
};

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Local weekday (0=Sun) + minutes-since-midnight for an ISO instant in a timezone. */
export function localParts(iso: string, timezone: string): { weekday: number; minutes: number } | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return { weekday: WD[wd] ?? 1, minutes: hour * 60 + minute };
  } catch {
    return null;
  }
}

export interface EntryClassification {
  kind: "before" | "after" | "weekend" | null;
  before: number; // hours
  after: number;
  weekend: number;
}

/** Classify one time entry's off-hours split against the schedule. */
export function classifyEntry(startIso: string | null, durationSec: number, schedule: Schedule): EntryClassification {
  const hours = durationSec / 3600;
  if (!startIso || durationSec <= 0) return { kind: null, before: 0, after: 0, weekend: 0 };
  const lp = localParts(startIso, schedule.timezone);
  if (!lp) return { kind: null, before: 0, after: 0, weekend: 0 };

  if (!schedule.workdays.includes(lp.weekday)) {
    return { kind: "weekend", before: 0, after: 0, weekend: r2(hours) };
  }

  const ws = toMin(schedule.work_start);
  const we = toMin(schedule.work_end);
  const s = lp.minutes;
  const e = lp.minutes + durationSec / 60;
  const beforeMin = Math.max(0, Math.min(e, ws) - s);
  const afterMin = Math.max(0, e - Math.max(s, we));
  const before = r2(beforeMin / 60);
  const after = r2(afterMin / 60);

  let kind: "before" | "after" | null = null;
  if (after > 0 && after >= before) kind = "after";
  else if (before > 0) kind = "before";
  else if (after > 0) kind = "after";
  return { kind, before, after, weekend: 0 };
}

export interface OffhoursTotals {
  before: number;
  after: number;
  weekend: number;
  total: number;
}

/** Sum the off-hours split across a talent's entries. */
export function aggregateOffhours(
  entries: { start_at: string | null; duration_sec: number }[],
  schedule: Schedule,
): OffhoursTotals {
  let before = 0,
    after = 0,
    weekend = 0;
  for (const en of entries) {
    const c = classifyEntry(en.start_at, en.duration_sec, schedule);
    before += c.before;
    after += c.after;
    weekend += c.weekend;
  }
  return { before: r1(before), after: r1(after), weekend: r1(weekend), total: r1(before + after + weekend) };
}
