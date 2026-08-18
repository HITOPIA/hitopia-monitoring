"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api/client";
import { getReportingYearOptions, isSelectablePeriod } from "@/lib/periods";
import type { AppUser } from "@/lib/contract/types";
import { cn } from "@/lib/cn";
import { IconCheck, IconAlert, IconX } from "./icons";

/* ------------------------------ session -------------------------------- */
interface AppCtx {
  user: AppUser | null;
  ready: boolean;
  period: string;
  yearOptions: string[];
  setPeriod: (p: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AppCtx | null>(null);

const LS_PERIOD = "hitopia.period";

function readStoredPeriod(currentDefault: string): string | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(LS_PERIOD);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { period?: unknown; defaultPeriod?: unknown };
    if (
      typeof parsed.period === "string" &&
      parsed.defaultPeriod === currentDefault &&
      isSelectablePeriod(parsed.period, currentDefault)
    ) {
      return parsed.period;
    }
  } catch {
    /* Old plain-string values are intentionally ignored. */
  }

  window.localStorage.removeItem(LS_PERIOD);
  return null;
}

function storePeriod(period: string, currentDefault: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_PERIOD, JSON.stringify({ period, defaultPeriod: currentDefault }));
}

function AppProvider({
  children,
  initialPeriod,
}: {
  children: ReactNode;
  initialPeriod: string;
}) {
  const yearOptions = getReportingYearOptions(initialPeriod);
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [period, setPeriodState] = useState(initialPeriod);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await api.me();
        if (active) setUser(me.user);
      } catch {
        /* not signed in */
      }
      const savedPeriod = readStoredPeriod(initialPeriod);
      if (active && savedPeriod) setPeriodState(savedPeriod);
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [initialPeriod]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: u } = await api.login({ email, password });
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  const setPeriod = useCallback((p: string) => {
    if (!isSelectablePeriod(p, initialPeriod)) return;
    setPeriodState(p);
    storePeriod(p, initialPeriod);
  }, [initialPeriod]);

  return (
    <Ctx.Provider value={{ user, ready, period, yearOptions, setPeriod, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used within Providers");
  return c;
}

/* ------------------------------- toasts -------------------------------- */
type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}
const ToastCtx = createContext<(message: string, tone?: ToastTone) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-raised px-3.5 py-3 shadow-pop animate-fade-up",
              t.tone === "success" && "border-healthy/30",
              t.tone === "error" && "border-low/30",
              t.tone === "info" && "border-accent/30",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white",
                t.tone === "success" && "bg-healthy",
                t.tone === "error" && "bg-low",
                t.tone === "info" && "bg-accent",
              )}
            >
              {t.tone === "error" ? <IconAlert className="h-3.5 w-3.5" /> : <IconCheck className="h-3.5 w-3.5" />}
            </span>
            <p className="flex-1 text-[13px] leading-snug text-ink-soft">{t.message}</p>
            <button
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              className="text-ink-faint hover:text-ink"
              aria-label="Dismiss"
            >
              <IconX className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Providers({
  children,
  initialPeriod,
}: {
  children: ReactNode;
  initialPeriod: string;
}) {
  return (
    <AppProvider initialPeriod={initialPeriod}>
      <ToastProvider>{children}</ToastProvider>
    </AppProvider>
  );
}
