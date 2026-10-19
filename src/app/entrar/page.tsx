import Link from "next/link";
import { ShieldIcon } from "@/components/brand/shield-icon";

// Tela de boas-vindas do app (rota pública "/entrar", antes do login — ver
// PUBLIC_PATHS em src/lib/supabase/middleware.ts). Sempre aparece primeiro,
// pra quem ainda não está logado — o botão "Entrar" é que leva pro
// formulário de login de verdade (ver /login/page.tsx).
//
// Importante: isto é DIFERENTE da landing page pública de divulgação ("/",
// morsafe.com.br — ver page.tsx) — aquela é o site de marketing, esta é
// a porta de entrada do app em si. Dois propósitos diferentes, a pedido
// do Rafael (19/10/2026): "a tela de boas vindas é no APP, antes da tela
// de login, o morsafe.com.br vai ser outra coisa".
//
// Texto sempre opaco, sem nenhum padrão/elemento por trás reduzindo o
// contraste — a primeira versão disso (na antiga landing page) usava texto
// semi-transparente sobre um padrão diagonal e ficou ilegível no celular
// (reportado pelo Rafael com print, 19/10/2026).

const TAGLINE = "Protegendo pessoas. Comprovando conformidade.";

export default function EntrarPage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-5 py-12 text-center"
      style={{
        background:
          "radial-gradient(circle at 20% 15%, rgba(52,160,94,0.16), transparent 45%), radial-gradient(circle at 85% 85%, rgba(52,160,94,0.12), transparent 45%), var(--brand-950)",
      }}
    >
      <ShieldIcon className="h-20 w-20 sm:h-24 sm:w-24" />

      <h1 className="mt-6 text-[30px] font-bold tracking-tight text-white sm:text-[36px]">
        MorSafe
      </h1>
      <p className="mt-2 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand-200 sm:text-[13.5px]">
        {TAGLINE}
      </p>

      <p className="mt-7 max-w-md text-[15px] leading-relaxed text-white/90 sm:text-[16px]">
        Bem-vindo à MorSafe — a plataforma que centraliza a gestão de
        Equipamentos de Proteção Individual (EPI) da sua empresa: cadastro,
        entrega assinada eletronicamente e acompanhamento do vencimento de
        cada Certificado de Aprovação (C.A.), para a conformidade com a
        NR-06 acontecer sem esforço manual.
      </p>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/90 sm:text-[16px]">
        Cada entrega, devolução e recusa fica registrada numa trilha de
        auditoria imutável — pronta pra uma fiscalização ou ação
        trabalhista, sem precisar reconstruir nada de memória.
      </p>

      <Link
        href="/login"
        className="mt-9 rounded-lg bg-white px-8 py-3 text-[14px] font-semibold text-brand-900 shadow-btn transition hover:bg-brand-50"
      >
        Entrar
      </Link>
    </div>
  );
}
