"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./providers";
import { LoginScreen } from "./login";
import { Avatar } from "./bits";
import { Spinner } from "./ui";
import { api } from "@/lib/api/client";
import { useAsync } from "@/lib/hooks";
import { PeriodPicker } from "./period-picker";
import { ROLE_LABEL, can } from "@/lib/rbac";
import { cn } from "@/lib/cn";
import {
  IconGrid,
  IconUsers,
  IconLink,
  IconDatabase,
  IconSliders,
  IconSparkle,
  IconReport,
  IconScroll,
  IconClock,
  IconLogout,
  IconShield,
  IconX,
} from "./icons";

interface NavItem {
  href: string;
  label: string;
  icon: (p: any) => ReactNode;
  cap?: string; // capability gate (audit is admin-only)
  badge?: number;
}

const SECTIONS: { title: string; items: Omit<NavItem, "badge">[] }[] = [
  {
    title: "Monitor",
    items: [
      { href: "/", label: "Dashboard", icon: IconGrid },
      { href: "/talents", label: "Talent roster", icon: IconUsers },
      { href: "/overtime", label: "Overtime", icon: IconClock },
    ],
  },
  {
    title: "Data pipeline",
    items: [
      { href: "/talent-master", label: "Talent master", icon: IconUsers },
      { href: "/data-pipeline", label: "Sources & integration", icon: IconDatabase },
      { href: "/mappings", label: "Identity mapping", icon: IconLink },
      { href: "/scoring", label: "Scoring config", icon: IconSliders },
    ],
  },
  {
    title: "Reporting",
    items: [
      { href: "/insights", label: "AI insights", icon: IconSparkle },
      { href: "/reports", label: "Monthly reports", icon: IconReport },
    ],
  },
  {
    title: "Governance",
    items: [{ href: "/audit", label: "Audit log", icon: IconScroll, cap: "audit.view" }],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Shell({ children }: { children: ReactNode }) {
  const { user, ready, period, setPeriod, logout } = useApp();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // unresolved-mapping count for the sidebar badge (only once signed in)
  const unresolved = useAsync(
    () => (user ? api.unresolvedMappings() : Promise.resolve({ data: [] })),
    [user?.id],
  );
  const unresolvedCount = unresolved.data?.data.length ?? 0;

  useEffect(() => setMobileOpen(false), [pathname]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-faint">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (!user) return <LoginScreen />;

  const SidebarBody = (
    <div className="flex h-full flex-col">
      {/* brand */}
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5 focus-ring">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-paper">
          <IconShield className="h-4 w-4" />
        </span>
        <span className="leading-tight">
          <span className="block font-display text-[15px] tracking-tightish text-ink">Hitopia</span>
          <span className="block text-[10.5px] uppercase tracking-[0.16em] text-ink-faint">Monitoring</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {SECTIONS.map((section) => {
          const items = section.items.filter((it) => !it.cap || can(it.cap, user.role));
          if (!items.length) return null;
          return (
            <div key={section.title} className="mb-5">
              <p className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-faint">
                {section.title}
              </p>
              <ul className="flex flex-col gap-0.5">
                {items.map((it) => {
                  const active = isActive(pathname, it.href);
                  const badge = it.href === "/mappings" && unresolvedCount > 0 ? unresolvedCount : undefined;
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors focus-ring",
                          active ? "bg-accent-soft text-accent-ink" : "text-ink-soft hover:bg-line/50 hover:text-ink",
                        )}
                      >
                        {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />}
                        <it.icon className={cn("h-[18px] w-[18px]", active ? "text-accent" : "text-ink-faint group-hover:text-ink-muted")} />
                        <span className="flex-1 font-medium">{it.label}</span>
                        {badge != null && (
                          <span className="rounded-full bg-review-soft px-1.5 py-0.5 text-[10px] font-mono font-medium text-review">
                            {badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[244px] shrink-0 border-r border-line bg-surface/70 lg:block">
        {SidebarBody}
      </aside>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/35 backdrop-blur-[2px] animate-fade-in" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[260px] border-r border-line bg-paper shadow-pop animate-fade-up">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-ink-muted hover:bg-line focus-ring"
              aria-label="Close menu"
            >
              <IconX className="h-4 w-4" />
            </button>
            {SidebarBody}
          </aside>
        </div>
      )}

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-line focus-ring lg:hidden"
            aria-label="Open menu"
          >
            <IconGrid className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="hidden text-[12px] text-ink-muted sm:inline">Reporting period</span>
            <PeriodPicker
              value={period}
              onChange={setPeriod}
              className="w-[190px]"
              aria-label="Reporting period"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full border border-line-strong bg-raised py-1 pl-1 pr-2.5 transition-colors hover:border-ink-faint focus-ring"
              >
                <Avatar name={user.name} size={28} />
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-[12.5px] font-medium text-ink">{user.name.split(" ")[0]}</span>
                  <span className="block text-[10px] uppercase tracking-wide text-ink-faint">{ROLE_LABEL[user.role]}</span>
                </span>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-xl border border-line bg-raised shadow-pop animate-fade-up">
                    <div className="border-b border-line px-3.5 py-3">
                      <p className="text-[13px] font-medium text-ink">{user.name}</p>
                      <p className="text-[11.5px] text-ink-muted">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 border-t border-line px-3.5 py-3 text-left text-[13px] text-ink-soft transition-colors hover:bg-line/50 focus-ring"
                    >
                      <IconLogout className="h-4 w-4 text-ink-faint" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-7 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
