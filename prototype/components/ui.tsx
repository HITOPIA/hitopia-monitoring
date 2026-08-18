"use client";

import { type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes, useEffect } from "react";
import { cn } from "@/lib/cn";
import { IconChevron, IconX } from "./icons";

/* ------------------------------- tones --------------------------------- */
type Tone = "low" | "review" | "healthy" | "neutral" | "accent";
const TONE_BADGE: Record<Tone, string> = {
  low: "bg-low-soft text-low border-low/25",
  review: "bg-review-soft text-review border-review/25",
  healthy: "bg-healthy-soft text-healthy border-healthy/25",
  neutral: "bg-neutral-soft text-neutral border-line-strong",
  accent: "bg-accent-soft text-accent-ink border-accent/25",
};
const TONE_BAR: Record<Tone, string> = {
  low: "bg-low",
  review: "bg-review",
  healthy: "bg-healthy",
  neutral: "bg-neutral",
  accent: "bg-accent",
};

/* ------------------------------- button -------------------------------- */
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
  icon?: ReactNode;
}
export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: BtnProps) {
  const variants = {
    primary: "bg-accent text-white border-accent hover:bg-accent-ink shadow-sm",
    secondary: "bg-raised text-ink border-line-strong hover:border-ink-faint hover:bg-surface",
    ghost: "bg-transparent text-ink-soft border-transparent hover:bg-line/60",
    danger: "bg-raised text-low border-low/30 hover:bg-low-soft",
  };
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-all focus-ring disabled:opacity-45 disabled:cursor-not-allowed active:translate-y-px",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        variants[variant],
        className,
      )}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
}

/* ------------------------------- spinner ------------------------------- */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* -------------------------------- card --------------------------------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface shadow-card", className)}>{children}</div>
  );
}
export function CardHead({
  title,
  sub,
  right,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line px-5 py-4", className)}>
      <div>
        <h3 className="font-display text-[17px] leading-tight text-ink tracking-tightish">{title}</h3>
        {sub && <p className="mt-1 text-[13px] text-ink-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/* ------------------------------- badge --------------------------------- */
export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium tracking-tightish",
        TONE_BADGE[tone],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", TONE_BAR[tone])} />}
      {children}
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("eyebrow", className)}>{children}</div>;
}

/* ------------------------------ score meter ---------------------------- */
export function ScoreMeter({ value, tone, className }: { value: number; tone: Tone; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full meter-track", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", TONE_BAR[tone])}
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* -------------------------------- stat --------------------------------- */
export function Stat({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface px-4 py-3.5 shadow-card", className)}>
      <Eyebrow>{label}</Eyebrow>
      <div
        className={cn(
          "mt-1.5 font-mono text-[26px] leading-none tracking-tightish tnum",
          tone ? `text-${tone === "neutral" ? "ink" : tone}` : "text-ink",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-ink-muted">{sub}</div>}
    </div>
  );
}

/* ------------------------------- select -------------------------------- */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  label?: string;
}
export function Select({ options, label, className, ...rest }: SelectProps) {
  return (
    <label className={cn("relative block", className)}>
      {label && <span className="mb-1 block eyebrow">{label}</span>}
      <select
        {...rest}
        className="h-9 w-full appearance-none rounded-lg border border-line-strong bg-raised pl-3 pr-8 text-[13px] text-ink focus-ring hover:border-ink-faint"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <IconChevron className="pointer-events-none absolute bottom-2.5 right-2.5 h-4 w-4 rotate-90 text-ink-faint" />
    </label>
  );
}

/* ------------------------------- tabs ---------------------------------- */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: ReactNode; count?: number }[];
  active: string;
  onChange: (k: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "relative -mb-px flex items-center gap-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors focus-ring",
            active === t.key ? "text-ink" : "text-ink-muted hover:text-ink-soft",
          )}
        >
          {t.label}
          {t.count != null && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10.5px] font-mono tnum",
                active === t.key ? "bg-accent-soft text-accent-ink" : "bg-line text-ink-muted",
              )}
            >
              {t.count}
            </span>
          )}
          {active === t.key && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ empty state ---------------------------- */
export function EmptyState({
  icon,
  title,
  hint,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && <div className="mb-3 text-ink-faint">{icon}</div>}
      <p className="font-display text-[15px] text-ink-soft">{title}</p>
      {hint && <p className="mt-1.5 max-w-sm text-[13px] text-ink-muted">{hint}</p>}
    </div>
  );
}

/* -------------------------------- modal -------------------------------- */
export function Modal({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-ink/35 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-pop animate-fade-up sm:rounded-2xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h3 className="font-display text-lg text-ink tracking-tightish">{title}</h3>
            {sub && <p className="mt-1 text-[13px] text-ink-muted">{sub}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-muted hover:bg-line focus-ring" aria-label="Close">
            <IconX className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-paper/60 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------ skeleton ------------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-line/70", className)} />;
}

/* ------------------------------ field ---------------------------------- */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block eyebrow">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-ink-muted">{hint}</span>}
    </label>
  );
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={cn(
        "w-full rounded-lg border border-line-strong bg-raised px-3 py-2 text-[13.5px] text-ink focus-ring placeholder:text-ink-faint",
        className,
      )}
    />
  );
}
