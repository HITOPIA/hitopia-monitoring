"use client";

import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* Concrete hexes mirroring the CSS design tokens (Recharts needs real colors). */
export const PALETTE = {
  low: "#a8362f",
  review: "#9a6a12",
  healthy: "#2f6b4f",
  accent: "#0e6b63",
  ink: "#1b1a16",
  inkMuted: "#6f6c5f",
  line: "#e4e0d4",
  lineStrong: "#d3cebd",
  paper: "#f6f4ee",
};

const FONT = "var(--font-mono), monospace";

function ChartTip({ active, payload, label, suffix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line-strong bg-raised px-2.5 py-1.5 shadow-pop">
      {label != null && <div className="eyebrow mb-0.5">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-[12px] text-ink">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
          <span className="text-ink-muted">{p.name}</span>
          <span className="font-mono tnum">
            {typeof p.value === "number" ? p.value.toFixed(p.value % 1 ? 1 : 0) : p.value}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------- flag distribution donut ----------------------- */
export function FlagDonut({
  data,
}: {
  data: { name: string; value: number; key: "low" | "review" | "healthy" }[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative h-[180px] w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={56}
            outerRadius={80}
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.key} fill={PALETTE[d.key]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="numeral text-[30px] leading-none text-ink">{total}</span>
        <span className="eyebrow mt-1">scored</span>
      </div>
    </div>
  );
}

/* ------------------------- score trend (area) ------------------------- */
export function ScoreTrend({
  data,
  low = 60,
  healthy = 75,
}: {
  data: { period: string; score: number | null }[];
  low?: number;
  healthy?: number;
}) {
  return (
    <div className="h-[160px] w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PALETTE.accent} stopOpacity={0.22} />
              <stop offset="100%" stopColor={PALETTE.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="period"
            tick={{ fontSize: 10, fill: PALETTE.inkMuted, fontFamily: FONT }}
            tickLine={false}
            axisLine={{ stroke: PALETTE.line }}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tick={{ fontSize: 10, fill: PALETTE.inkMuted, fontFamily: FONT }}
            tickLine={false}
            axisLine={false}
          />
          <ReferenceLine y={low} stroke={PALETTE.low} strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={healthy} stroke={PALETTE.healthy} strokeDasharray="3 3" strokeOpacity={0.5} />
          <Tooltip content={<ChartTip />} />
          <Area
            type="monotone"
            dataKey="score"
            name="Score"
            stroke={PALETTE.accent}
            strokeWidth={2}
            fill="url(#trendFill)"
            connectNulls
            dot={{ r: 3, fill: PALETTE.accent, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --------------------- single composite radial gauge ------------------ */
export function CompositeGauge({ value, tone }: { value: number; tone: "low" | "review" | "healthy" }) {
  return (
    <div className="relative h-[150px] w-[150px]">
      <ResponsiveContainer>
        <RadialBarChart
          innerRadius="76%"
          outerRadius="100%"
          data={[{ value }]}
          startAngle={220}
          endAngle={-40}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: PALETTE.line }} dataKey="value" cornerRadius={20} fill={PALETTE[tone]} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="numeral text-[34px] leading-none text-ink">{value.toFixed(0)}</span>
        <span className="eyebrow mt-1">/ 100</span>
      </div>
    </div>
  );
}

/* ----------------------- division averages bars ----------------------- */
export function DivisionBars({ data }: { data: { name: string; score: number }[] }) {
  return (
    <div className="h-[170px] w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -18 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9.5, fill: PALETTE.inkMuted, fontFamily: FONT }}
            tickLine={false}
            axisLine={{ stroke: PALETTE.line }}
            interval={0}
          />
          <YAxis hide domain={[0, 100]} />
          <Tooltip content={<ChartTip />} cursor={{ stroke: PALETTE.lineStrong }} />
          <defs>
            <linearGradient id="divFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PALETTE.accent} stopOpacity={0.18} />
              <stop offset="100%" stopColor={PALETTE.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="score"
            name="Avg score"
            stroke={PALETTE.accent}
            strokeWidth={2}
            fill="url(#divFill)"
            dot={{ r: 3, fill: PALETTE.accent, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
