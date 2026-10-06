"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/current-user";
import { temPapelMinimo } from "@/lib/auth/permissoes";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";
import {
  PERGUNTAS_AUDITORIA_NR06,
  type RespostasAuditoria,
} from "@/lib/data/auditorias-nr06-perguntas";

const SEM_PERMISSAO = "Seu perfil de acesso não permite essa ação.";

export type RodarAuditoriaState = { error: string | null; success?: boolean };

/**
 * "sim" -> true, "nao" -> false, "na" -> null. A coluna no banco é boolean
 * nullable só pro caso "não se aplica" — um campo de verdade NÃO MARCADO
 * nunca chega até aqui: a validação logo abaixo (ver perguntasSemResposta,
 * em rodarAuditoria) já recusa o registro antes disso, pedido do Rafael,
 * 06/10/2026 ("garantir que todas as perguntas sejam respondidas"). Mantida
 * como fallback pra null mesmo assim, por segurança (nunca confiar só na
 * validação de uma camada pra decidir o que grava no banco).
 */
function paraBooleano(valor: FormDataEntryValue | null): boolean | null {
  if (valor === "sim") return true;
  if (valor === "nao") return false;
  return null;
}

const RESPOSTAS_VALIDAS = new Set(["sim", "nao", "na"]);

/**
 * Registra uma rodada do checklist de auditoria de NR-06 num setor — as 8
 * perguntas oficiais do PGR (ver PERGUNTAS_AUDITORIA_NR06, em
 * lib/data/auditorias-nr06.ts), cada uma Sim/Não/Não se aplica, mais
 * responsável, data e observações livres.
 *
 * A tabela `auditorias_nr06` já existe desde a criação do schema (ver
 * morsafe-schema.sql, seção 12), com RLS (`empresa_isolada`) desde então —
 * essa tela não depende do acesso ao Supabase que está pendente (ver
 * conversa com Rafael, 02/10/2026), só do código que faltava pra usá-la.
 *
 * Mesmo nível de permissão de registrar entrega/devolução/entrada de
 * estoque ("encarregado"+, combinado com o Rafael): é uma ação operacional
 * de rotina de segurança, não administração do sistema.
 *
 * Decisão deliberada de NÃO exigir plano de ação quando uma pergunta vem
 * "Não": a pendência fica registrada e destacada (ver contarNaoConformidades
 * e o uso dela em auditoria/page.tsx e auditoria/[setorId]/page.tsx), mas o
 * registro em si nunca é bloqueado por isso — mesma conversa com o Rafael.
 */
export async function rodarAuditoria(
  _prevState: RodarAuditoriaState,
  formData: FormData,
): Promise<RodarAuditoriaState> {
  const setorId = String(formData.get("setor_id") ?? "").trim();
  const responsavel = String(formData.get("responsavel") ?? "").trim();
  const dataAuditoria = String(formData.get("data") ?? "").trim();
  const observacoesRaw = String(formData.get("observacoes") ?? "").trim();

  if (!setorId) {
    return { error: "Setor não informado." };
  }
  if (!responsavel) {
    return { error: "Informe o responsável pela auditoria." };
  }

  // Garante que NENHUMA das 8 perguntas ficou em branco — pedido do
  // Rafael, 06/10/2026: sem isso, uma pergunta esquecida virava silenciosamente
  // a mesma coisa que "N/A" no banco (ambas null, ver paraBooleano acima), sem
  // nenhum aviso de que faltou responder. O formulário (rodar-auditoria-
  // button.tsx) já bloqueia isso no navegador antes de chegar aqui; esta
  // checagem é a segunda camada, caso o formulário seja enviado de outro
  // jeito (nunca confiar só em validação do lado do cliente).
  const perguntasSemResposta = PERGUNTAS_AUDITORIA_NR06.filter(
    (p) => !RESPOSTAS_VALIDAS.has(String(formData.get(p.chave) ?? "")),
  );
  if (perguntasSemResposta.length > 0) {
    return {
      error:
        perguntasSemResposta.length === 1
          ? `Responda a pergunta "${perguntasSemResposta[0].pergunta}" antes de salvar (marque Sim, Não ou N/A).`
          : `Responda todas as perguntas antes de salvar — faltam ${perguntasSemResposta.length}: ${perguntasSemResposta
              .map((p) => `"${p.pergunta}"`)
              .join(", ")}.`,
    };
  }

  const user = await getCurrentUser();
  if (!user?.empresaId) {
    return { error: "Não foi possível identificar a empresa do usuário." };
  }
  if (!temPapelMinimo(user.papel, "encarregado")) {
    return { error: SEM_PERMISSAO };
  }

  const supabase = await createClient();

  // Confirma que o setor é da MESMA empresa de quem está auditando, antes
  // de inserir — mesma checagem de posse já usada em colaboradores/EPIs/
  // estoque/estações, pra não depender só do RLS pra recusar um id de outra
  // empresa cliente.
  const { data: setor, error: setorError } = await supabase
    .from("setores")
    .select("nome, empresa_id")
    .eq("id", setorId)
    .maybeSingle();

  if (setorError || !setor || setor.empresa_id !== user.empresaId) {
    return { error: "Setor não encontrado." };
  }

  const respostas = Object.fromEntries(
    PERGUNTAS_AUDITORIA_NR06.map((p) => [
      p.chave,
      paraBooleano(formData.get(p.chave)),
    ]),
  ) as RespostasAuditoria;

  const naoConformidades = PERGUNTAS_AUDITORIA_NR06.filter(
    (p) => respostas[p.chave] === false,
  ).length;

  const { data: novaAuditoria, error } = await supabase
    .from("auditorias_nr06")
    .insert({
      empresa_id: user.empresaId,
      setor_id: setorId,
      responsavel,
      observacoes: observacoesRaw || null,
      ...respostas,
      // Omite a chave quando vazio, em vez de mandar string vazia — deixa o
      // default `current_date` da coluna assumir a data de hoje (mesmo
      // padrão de registrarEntradaEstoque, em estoque/actions.ts).
      ...(dataAuditoria ? { data: dataAuditoria } : {}),
    })
    .select("id")
    .single();

  if (error || !novaAuditoria) {
    console.error("rodarAuditoria:", error?.message);
    return {
      error: "Não foi possível registrar a auditoria. Tente novamente.",
    };
  }

  await registrarLogAuditoria({
    supabase,
    empresaId: user.empresaId,
    tabela: "auditorias_nr06",
    registroId: novaAuditoria.id,
    acao: "auditoria_registrada",
    usuarioId: user.id,
    detalhes: { nome: setor.nome, naoConformidades },
  });

  revalidatePath("/auditoria");
  revalidatePath(`/auditoria/${setorId}`);
  revalidatePath("/dashboard");
  return { error: null, success: true };
}
