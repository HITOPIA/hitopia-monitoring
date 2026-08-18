import type { Config } from "tailwindcss";

/**
 * Design tokens for the Hitopia Monitoring prototype.
 * Editorial-analytical direction: warm paper, ink, a single petrol accent,
 * and muted semantic flag colors. Monospace carries all data.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  // Tone classes are composed at runtime (e.g. `text-${tone}`), so JIT can't
  // see them in source — keep them generated.
  safelist: [
    "text-low", "text-review", "text-healthy", "text-accent", "text-accent-ink", "text-neutral", "text-ink",
    "bg-low", "bg-review", "bg-healthy", "bg-accent", "bg-neutral",
    "border-low/25", "border-review/25", "border-healthy/25", "border-accent/25",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        surface: "var(--surface)",
        raised: "var(--raised)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        "ink-muted": "var(--ink-muted)",
        "ink-faint": "var(--ink-faint)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        "accent-ink": "var(--accent-ink)",
        // semantic flags (muted / editorial, not neon)
        low: "var(--low)",
        "low-soft": "var(--low-soft)",
        review: "var(--review)",
        "review-soft": "var(--review-soft)",
        healthy: "var(--healthy)",
        "healthy-soft": "var(--healthy-soft)",
        neutral: "var(--neutralf)",
        "neutral-soft": "var(--neutralf-soft)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "14px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,26,23,0.04), 0 1px 0 rgba(26,26,23,0.02)",
        raised:
          "0 1px 2px rgba(26,26,23,0.05), 0 8px 24px -12px rgba(26,26,23,0.18)",
        pop: "0 12px 40px -12px rgba(26,26,23,0.28)",
      },
      letterSpacing: {
        tightish: "-0.01em",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        grow: {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.4s ease both",
        grow: "grow 0.7s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
