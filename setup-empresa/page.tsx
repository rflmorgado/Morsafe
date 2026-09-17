import { ShieldIcon } from "@/components/brand/shield-icon";
import { SetupEmpresaForm } from "./setup-empresa-form";

// Ferramenta interna de onboarding: cadastra uma nova empresa cliente +
// seu primeiro usuário admin. Não há link para esta página em nenhum
// lugar do app — o acesso é apenas por URL direta, e a ação em si exige a
// senha em EMPRESA_SETUP_SECRET. Ver src/lib/supabase/middleware.ts
// (PUBLIC_PATHS) e src/app/setup-empresa/actions.ts.
export default function SetupEmpresaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-[0_1px_2px_rgba(18,53,36,0.06),0_4px_16px_rgba(18,53,36,0.06)]">
        <div
          className="flex items-center gap-3 px-8 py-6"
          style={{ background: "var(--brand-950)" }}
        >
          <ShieldIcon className="h-9 w-9" />
          <div>
            <div className="text-[15px] font-bold tracking-tight text-white">
              <span className="text-brand-300">Mor</span>
              <span className="font-extrabold text-brand-500">Safe</span>
            </div>
            <div className="text-[11.5px] text-white/50">
              Cadastro interno de nova empresa cliente
            </div>
          </div>
        </div>

        <div className="p-8">
          <SetupEmpresaForm />
        </div>
      </div>
    </div>
  );
}
