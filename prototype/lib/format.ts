import type { Flag } from "./contract/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatIDR(n: number | null | undefined, compact = true): string {
  if (n == null) return "—";
  if (compact) {
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1).replace(".", ",")} jt`;
    if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)} rb`;
  }
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export function pct(n: number | null | undefined, dp = 0): string {
  if (n == null) return "—";
  return `${n.toFixed(dp)}%`;
}

export function num(n: number | null | undefined, dp = 0): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export const FLAG_LABEL: Record<Flag, string> = {
  low: "Low",
  needs_review: "Needs review",
  healthy: "Healthy",
};

export const FLAG_TONE: Record<Flag, "low" | "review" | "healthy"> = {
  low: "low",
  needs_review: "review",
  healthy: "healthy",
};

export function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function dateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} · ${hh}:${mm} UTC`;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "—";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const days = h / 24;
  if (days < 30) return `${Math.floor(days)}d ago`;
  const mo = days / 30;
  if (mo < 12) return `${Math.floor(mo)}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function scoreTone(v: number): "low" | "review" | "healthy" {
  if (v < 60) return "low";
  if (v < 75) return "review";
  return "healthy";
}
