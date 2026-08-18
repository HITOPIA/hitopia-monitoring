"use client";

import { useState, type FormEvent } from "react";
import { useApp } from "./providers";
import { IconArrowRight, IconLock, IconShield, IconSparkle } from "./icons";

export function LoginScreen() {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch {
      setError("Invalid email or password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      {/* atmosphere: layered petrol wash + grid + oversized serif watermark */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute -bottom-48 -right-24 h-[460px] w-[460px] rounded-full bg-review/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 75%)",
          }}
        />
      </div>

      <div className="w-full max-w-5xl">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          {/* left — editorial intro */}
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line-strong bg-raised px-3 py-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
                <IconShield className="h-3 w-3" />
              </span>
              <span className="eyebrow !text-ink-soft">Hitopia · Internal</span>
            </div>
            <h1 className="font-display text-[40px] italic leading-[0.98] tracking-tightish text-ink sm:text-[54px]">
              Monitoring &amp;
              <br />
              <span className="not-italic">Monthly Report</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-muted">
              One quantitative view of talent performance — utilization, delivery, overtime and
              cost burn — woven from talent master data, Jira and Clockify, and turned into a
              client-ready monthly narrative. Every score traces back to its source.
            </p>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <IconSparkle className="h-3.5 w-3.5 text-accent" /> AI insight with traceability
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IconLock className="h-3.5 w-3.5 text-accent" /> Review &amp; approve before client
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IconShield className="h-3.5 w-3.5 text-accent" /> RBAC &amp; full audit trail
              </span>
            </div>
          </div>

          {/* right — email/password sign-in */}
          <div className="rounded-2xl border border-line bg-raised p-6 shadow-raised">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-[19px] tracking-tightish text-ink">Sign in</h2>
              <span className="eyebrow">internal access</span>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-ink-soft">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@hitopia.id"
                  className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-accent focus-ring"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-ink-soft">Password</span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-accent focus-ring"
                />
              </label>

              {error && (
                <p className="rounded-lg border border-low/30 bg-low/5 px-3 py-2 text-[12.5px] text-low">{error}</p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[14px] font-medium text-paper transition-opacity hover:opacity-90 focus-ring disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Sign in"}
                {!busy && <IconArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <p className="mt-4 text-center text-[11.5px] text-ink-faint">
              Internal access only. Contact an admin if you need an account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
