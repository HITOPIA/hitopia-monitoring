import { type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

/* ----------------------- link styled as a button --------------------- */
const BTN_VARIANTS: Record<string, string> = {
  primary: "bg-accent text-white border-accent hover:bg-accent-ink shadow-sm",
  secondary: "bg-raised text-ink border-line-strong hover:border-ink-faint hover:bg-surface",
  ghost: "bg-transparent text-ink-soft border-transparent hover:bg-line/60",
};
export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  icon,
  children,
  className,
}: {
  href: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-all focus-ring active:translate-y-px",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        BTN_VARIANTS[variant],
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

/* --------------------------- avatar ----------------------------------- */
const AVA_TONES = ["bg-accent-soft text-accent-ink", "bg-review-soft text-review", "bg-healthy-soft text-healthy", "bg-low-soft text-low"];
export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  // deterministic tone from the name so the same person always looks the same
  const tone = AVA_TONES[name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVA_TONES.length];
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-mono font-medium tracking-tightish", tone, className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------- page header -------------------------------- */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="font-display text-[28px] leading-[1.05] tracking-tightish text-ink sm:text-[33px]">{title}</h1>
        {description && <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------- section label ------------------------------ */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="eyebrow">{children}</h2>
      {right}
    </div>
  );
}

/* --------------------------- key / value ------------------------------ */
export function KeyVal({ k, v, mono = true }: { k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2 last:border-0">
      <dt className="text-[13px] text-ink-muted">{k}</dt>
      <dd className={cn("text-[13px] text-ink-soft", mono && "font-mono tnum")}>{v}</dd>
    </div>
  );
}

/* ----------------------------- pagination ----------------------------- */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  sizes = [50, 100, 200],
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
  sizes?: number[];
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <label className="flex items-center gap-2 text-[12.5px] text-ink-muted">
        <span>Rows per page</span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSize(Number(e.target.value));
            onPage(1);
          }}
          className="h-8 appearance-none rounded-lg border border-line-strong bg-raised pl-2.5 pr-7 text-[12.5px] text-ink focus-ring hover:border-ink-faint"
        >
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3 text-[12.5px] text-ink-muted">
        <span className="tnum">
          {from}–{to} of {total}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="h-8 rounded-lg border border-line-strong bg-raised px-3 text-ink hover:bg-surface focus-ring disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-1.5 tnum">
            {page}/{pages}
          </span>
          <button
            onClick={() => onPage(Math.min(pages, page + 1))}
            disabled={page >= pages}
            className="h-8 rounded-lg border border-line-strong bg-raised px-3 text-ink hover:bg-surface focus-ring disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------- compliance / framing note (recurring spec motif) ------------ */
export function Note({
  tone = "accent",
  icon,
  children,
  className,
}: {
  tone?: "accent" | "low" | "review" | "healthy" | "neutral";
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    accent: "border-accent/25 bg-accent-soft/50 text-accent-ink",
    low: "border-low/25 bg-low-soft/60 text-low",
    review: "border-review/25 bg-review-soft/60 text-review",
    healthy: "border-healthy/25 bg-healthy-soft/60 text-healthy",
    neutral: "border-line-strong bg-surface text-ink-soft",
  };
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[12.5px] leading-relaxed", tones[tone], className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="flex-1">{children}</div>
    </div>
  );
}
