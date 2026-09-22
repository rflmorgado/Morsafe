import { ShieldIcon } from "@/components/brand/shield-icon";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-[0_1px_2px_rgba(18,53,36,0.06),0_4px_16px_rgba(18,53,36,0.06)] md:grid-cols-2">
        {/* Painel de marca */}
        <div
          className="flex flex-col items-center justify-center gap-5 p-10 text-center text-white md:p-12"
          style={{
            background:
              "radial-gradient(circle at 20% 15%, rgba(52,160,94,0.14), transparent 45%), radial-gradient(circle at 85% 85%, rgba(52,160,94,0.10), transparent 45%), var(--brand-950)",
          }}
        >
          <ShieldIcon className="h-24 w-24 md:h-[104px] md:w-[104px]" />

          <div>
            <div className="text-[34px] font-bold tracking-tight">
              <span className="text-brand-300">Mor</span>
              <span className="font-extrabold text-brand-500">Safe</span>
            </div>
            <div className="mx-auto mt-2.5 h-0.5 w-10 rounded-full bg-brand-600" />
          </div>

          <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white">
            Controle de EPI na prática
          </div>

          <p className="mt-1 max-w-[280px] text-[13px] leading-relaxed text-white/80">
            Cada entrega registrada, cada colaborador protegido, cada
            auditoria tranquila.
          </p>
        </div>

        {/* Formulário */}
        <div className="flex flex-col justify-center p-8 sm:p-10 md:p-14">
          <h2 className="text-[22px] font-bold tracking-tight text-foreground">
            Entrar
          </h2>
          <p className="mb-7 mt-1 text-[13.5px] text-text-secondary">
            Acesse o painel de controle de EPI da sua empresa.
          </p>

          {motivo === "acesso_desativado" && (
            <p className="mb-5 rounded-lg bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger-text">
              Seu acesso foi desativado pelo administrador da sua empresa.
              Fale com ele se isso não deveria ter acontecido.
            </p>
          )}

          <LoginForm />

          <div className="mt-6 text-center text-xs text-text-muted">
            Acesso restrito a usuários autorizados
          </div>
        </div>
      </div>
    </div>
  );
}
