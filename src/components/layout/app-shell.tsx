"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldIcon } from "@/components/brand/shield-icon";
import { NAV_ITEMS, NAV_SECTION_LABEL } from "./nav-items";
import { NAV_ICON_BY_HREF, IconEmpresa } from "./nav-icons";
import { logout } from "@/app/(app)/actions";

// Selo da empresa ativa, acima do nome e abaixo da marca "MorSafe" (pedido
// do Rafael, 05/10/2026). Três estados: logo da empresa (PNG em data URL,
// ver logo-empresa-form.tsx) quando existe; o mesmo ícone de prédio usado no
// menu/cabeçalho de "Dados da empresa" (ver IconEmpresa, em nav-icons.tsx)
// quando a empresa ainda não cadastrou um; e a marca do MorSafe quando quem
// está logado é o super_admin (não tem empresa — "Administrador MorSafe").
// A bolinha no canto reaproveita o mesmo tratamento "presença" já usado em
// usuarios/page.tsx (AvatarComPresenca) — aqui sempre verde, só reforçando
// visualmente "ativo/conectado", já que não existe um estado de presença
// real pra uma empresa.
function EmpresaBadge({
  isSuperAdmin,
  logoUrl,
}: {
  isSuperAdmin: boolean;
  logoUrl: string | null;
}) {
  return (
    <span className="relative inline-flex h-9 w-9 shrink-0">
      {isSuperAdmin ? (
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500">
          <ShieldIcon className="h-5 w-5" />
        </span>
      ) : logoUrl ? (
        <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL, não um asset do Next */}
          <img
            src={logoUrl}
            alt=""
            className="h-full w-full object-contain p-1"
          />
        </span>
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
          <IconEmpresa className="h-[18px] w-[18px]" />
        </span>
      )}
      <span
        className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-brand-500"
        style={{ boxShadow: "0 0 0 2px var(--brand-950)" }}
      />
    </span>
  );
}

function NavLinks({
  onNavigate,
  isSuperAdmin,
  isAdmin,
}: {
  onNavigate?: () => void;
  isSuperAdmin: boolean;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  // super_admin nunca pertence a uma empresa (não tem empresa_id), então a
  // maioria das telas operacionais (Colaboradores, EPIs, Movimentações,
  // Estoque, Estações...) não faz sentido pra ele — mostram listas vazias
  // à toa. Por isso o filtro é diferente dos dois papéis: super_admin vê os
  // itens marcados superAdminOnly MAIS os marcados superAdminVisible (hoje
  // só o Dashboard, que tem sua própria versão pra cada público); todo o
  // resto vê tudo que não é superAdminOnly, filtrado como antes por
  // adminOnly.
  const items = NAV_ITEMS.filter((item) =>
    isSuperAdmin
      ? Boolean(item.superAdminOnly) || Boolean(item.superAdminVisible)
      : !item.superAdminOnly && (!item.adminOnly || isAdmin),
  );

  return (
    <>
      {items.map((item, index) => {
        const active = pathname.startsWith(item.href);
        const Icon = NAV_ICON_BY_HREF[item.href];
        const novaSecao = index === 0 || item.section !== items[index - 1].section;

        return (
          <div key={item.href}>
            {novaSecao && (
              <p
                className={`mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/30 ${
                  index === 0 ? "" : "mt-4"
                }`}
              >
                {NAV_SECTION_LABEL[item.section]}
              </p>
            )}

            {item.comingSoon ? (
              <div
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-white/35"
                title={`${item.label} — em breve`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap rounded-full border border-white/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-white/40">
                  Em breve
                </span>
              </div>
            ) : (
              <Link
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white/90"
                }`}
              >
                {Icon && (
                  <Icon
                    className={`h-4 w-4 shrink-0 ${active ? "text-brand-400" : "text-white/40"}`}
                  />
                )}
                <span className="leading-tight">{item.label}</span>
              </Link>
            )}
          </div>
        );
      })}
    </>
  );
}

export function AppShell({
  children,
  userNome,
  empresaNome,
  empresaLogoUrl = null,
  isSuperAdmin = false,
  isAdmin = false,
}: {
  children: React.ReactNode;
  userNome: string;
  empresaNome: string | null;
  empresaLogoUrl?: string | null;
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="mx-auto min-h-screen max-w-[1180px] p-4 lg:p-8">
      <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-[0_1px_2px_rgba(18,53,36,0.06),0_4px_16px_rgba(18,53,36,0.06)] lg:grid lg:min-h-[640px] lg:grid-cols-[236px_1fr]">
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
              <NavLinks
                onNavigate={() => setMenuOpen(false)}
                isSuperAdmin={isSuperAdmin}
                isAdmin={isAdmin}
              />
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

          <div className="mb-5 mt-1 flex items-center gap-2.5 rounded-xl bg-white/[0.06] p-2.5">
            <EmpresaBadge isSuperAdmin={isSuperAdmin} logoUrl={empresaLogoUrl} />
            <div className="min-w-0 text-[11.5px] leading-tight text-white/60">
              {isSuperAdmin ? "Acesso" : "Empresa ativa"}
              <p className="truncate text-[12.5px] font-semibold leading-tight text-white">
                {isSuperAdmin ? "Administrador MorSafe" : (empresaNome ?? "—")}
              </p>
            </div>
          </div>

          <NavLinks isSuperAdmin={isSuperAdmin} isAdmin={isAdmin} />

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

        {/* min-w-0 é essencial aqui: esta coluna do grid (lg:grid-cols-[236px_1fr])
            tem conteúdo que pode ficar largo (tabela do Colaboradores, por
            exemplo, agora com avatar + ícones em cada célula). Sem min-w-0, o
            tamanho mínimo "automático" de um item de grid é o min-content dos
            filhos — ou seja, o grid tenta esticar essa coluna pra caber o
            conteúdo inteiro, em vez de deixar a tabela rolar no próprio
            `overflow-x-auto` dela (ver colaboradores/page.tsx). Como o card
            pai tem `overflow-hidden` (pro border-radius funcionar), esse
            estouro não vira barra de rolagem — ele simplesmente é cortado na
            borda, cortando colunas/ícones do lado direito. min-w-0 devolve
            pro navegador a liberdade de encolher esta coluna até a largura
            real disponível, e aí quem rola o excesso é o `overflow-x-auto`
            de dentro, não o grid inteiro. (Bug relatado pelo Rafael,
            05/10/2026 — "cortou as laterais, cards cortados" na tela de
            Colaboradores, depois de os ícones/avatar deixarem as linhas mais
            largas.) */}
        <main className="min-w-0 bg-surface-muted p-[18px] lg:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
