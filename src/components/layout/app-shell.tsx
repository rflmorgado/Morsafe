"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldIcon } from "@/components/brand/shield-icon";
import { NAV_ITEMS } from "./nav-items";
import { logout } from "@/app/(app)/actions";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);

        if (item.comingSoon) {
          return (
            <div
              key={item.href}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-white/35"
              title="Em breve"
            >
              <span className="truncate">{item.label}</span>
              <span className="shrink-0 whitespace-nowrap rounded-full border border-white/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-white/40">
                Em breve
              </span>
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition ${
              active ? "bg-white/10 text-white" : "text-white/70 hover:text-white/90"
            }`}
          >
            <span className="flex items-center gap-2.5">
              {item.href === "/dashboard" && (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    active ? "bg-brand-500" : "bg-transparent"
                  }`}
                />
              )}
              {item.label}
            </span>
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({
  children,
  userNome,
  empresaNome,
}: {
  children: React.ReactNode;
  userNome: string;
  empresaNome: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="mx-auto min-h-screen max-w-[1180px] p-4 lg:p-8">
      <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-[0_1px_2px_rgba(18,53,36,0.06),0_4px_16px_rgba(18,53,36,0.06)] lg:grid lg:min-h-[640px] lg:grid-cols-[220px_1fr]">
        {/* Topbar — mobile */}
        <div className="lg:hidden" style={{ background: "var(--brand-950)" }}>
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <ShieldIcon className="h-6 w-6" />
              <span className="text-base font-bold tracking-tight text-brand-300">
                Mor<span className="font-extrabold text-brand-500">Safe</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Abrir menu"
              className="flex h-[34px] w-[34px] flex-col items-center justify-center gap-[3px] rounded-lg bg-white/10"
            >
              <span className="h-0.5 w-4 rounded-full bg-white" />
              <span className="h-0.5 w-4 rounded-full bg-white" />
              <span className="h-0.5 w-4 rounded-full bg-white" />
            </button>
          </div>

          {menuOpen && (
            <div className="flex flex-col gap-0.5 px-3.5 pb-4">
              <NavLinks onNavigate={() => setMenuOpen(false)} />
            </div>
          )}
        </div>

        {/* Sidebar — desktop */}
        <aside
          className="hidden flex-col gap-1 p-3.5 lg:flex"
          style={{ background: "var(--brand-950)" }}
        >
          <div className="flex items-center gap-2.5 px-2.5 py-1">
            <ShieldIcon className="h-[30px] w-[30px]" />
            <span className="text-[19px] font-bold tracking-tight text-brand-300">
              Mor<span className="font-extrabold text-brand-500">Safe</span>
            </span>
          </div>

          <div className="mb-5 mt-1 flex items-center gap-2 rounded-lg bg-white/[0.06] px-2.5 py-2">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-brand-500" />
            <div className="text-[11.5px] leading-tight text-white/70">
              Empresa ativa
              <span className="block text-[12.5px] font-semibold text-white">
                {empresaNome ?? "—"}
              </span>
            </div>
          </div>

          <NavLinks />

          <div className="mt-auto space-y-2 border-t border-white/10 pt-4">
            <div className="px-2.5">
              <p className="truncate text-[13px] font-medium text-white">
                {userNome}
              </p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-white/50 transition hover:bg-white/5 hover:text-white/80"
              >
                Sair
              </button>
            </form>
          </div>
        </aside>

        <main className="bg-surface-muted p-[18px] lg:p-7">{children}</main>
      </div>
    </div>
  );
}
