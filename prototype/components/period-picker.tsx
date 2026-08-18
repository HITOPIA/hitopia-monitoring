"use client";

import { cn } from "@/lib/cn";
import { isPeriod } from "@/lib/periods";
import { useApp } from "@/components/providers";

const MONTHS = [
  { value: "01", label: "Jan" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Apr" },
  { value: "05", label: "May" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Aug" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];

interface PeriodPickerProps {
  value: string;
  onChange: (period: string) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

function splitPeriod(period: string): { year: string; month: string } {
  if (!isPeriod(period)) return { year: "2000", month: "01" };
  return { year: period.slice(0, 4), month: period.slice(5, 7) };
}

/**
 * Year/month picker for reporting periods (`YYYY-MM`).
 * Both controls are selects; years are current year through 10 years back.
 */
export function PeriodPicker({ value, onChange, label, className, disabled, "aria-label": ariaLabel }: PeriodPickerProps) {
  const { yearOptions } = useApp();
  const { year, month } = splitPeriod(value);

  function emit(nextYear: string, nextMonth: string) {
    onChange(`${nextYear}-${nextMonth}`);
  }

  return (
    <label className={cn("block", className)} aria-label={ariaLabel}>
      {label && <span className="mb-1 block eyebrow">{label}</span>}
      <span className="grid grid-cols-[1fr_86px] gap-2">
        <select
          value={month}
          onChange={(e) => emit(year, e.target.value)}
          disabled={disabled}
          className="h-9 w-full rounded-lg border border-line-strong bg-raised px-2.5 text-[13px] text-ink focus-ring hover:border-ink-faint disabled:opacity-45"
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => emit(e.target.value, month)}
          disabled={disabled}
          className="h-9 w-full rounded-lg border border-line-strong bg-raised px-2.5 text-[13px] text-ink focus-ring hover:border-ink-faint disabled:opacity-45"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </span>
    </label>
  );
}
