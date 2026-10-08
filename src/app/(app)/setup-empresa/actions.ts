"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/data/current-user";
import { registrarLogAuditoria } from "@/lib/data/log-auditoria";
import {
  criarClienteAsaas,
  criarAssinaturaAsaas,
  criarCobrancaAvulsaAsaas,
  AsaasError,
} from "@/lib/asaas/client";
import {
  PLANO_VALOR_MENSAL,
  PLANO_LIMITE_COLABORADORES,
  TAXA_IMPLANTACAO,
} from "@/lib/data/planos";
import type { PlanoAssinatura } from "@/types/database";

export type CriarEmpresaState = {
  error: string | null;
  success?: boolean;
  // Aviso não-bloqueante: a empresa E a assinatura recorrente foram
  // criadas com sucesso (inclusive no Asaas), mas a taxa de implantação
  // (passo 5, abaixo) falhou ao ser lançada automaticamente. Diferente de
  // `error`, isto nunca impede o cadastro de ser considerado concluído —
  // só avisa o super_admin pra lançar manualmente via "+ Novo pagamento".
  avisoImplantacao?: string;
};

const PLANOS_COMERCIAIS = new Set<string>([
  "start",
  "essencial",
  "profissional",
  "empresa",
  "industrial",
  "enterprise",
]);

/**
 * Próximo dia 05 a partir de hoje (hoje inclusive) — padrão de vencimento
 * único definido no modelo comercial (seção 5), pra nunca ter mais de uma
 * data de vencimento circulando entre os clientes.
 */
function proximoDiaVencimento(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const dia = hoje.getDate();
  const data = dia <= 5 ? new Date(ano, mes, 5) : new Date(ano, mes + 1, 5);
  return data.toISOString().slice(0, 10);
}

/**
 * Cadastro de nova empresa cliente + seu primeiro usuário admin. Só pode
 * ser executado por um usuário com papel "super_admin" (dono do MorSafe) —
 * checado aqui no servidor, além de o item de menu só aparecer para esse
 * papel (ver NAV_ITEMS / app-shell.tsx).
 *
 * Usa o cliente com service role (mesmo padrão de usuarios/actions.ts,
 * ver lib/supabase/admin.ts) em vez do supabase.auth.signUp usado antes.
 * Dois motivos, os dois causavam falha real neste fluxo:
 *
 * 1) A tabela `usuarios` hoje só tem política de RLS pra cada usuário ler a
 *    própria linha, sem nenhuma política de inserção — o insert do passo 3
 *    com o client comum (sujeito a RLS) falhava sempre, deixando uma
 *    empresa órfã no banco e um login de autenticação "preso" (e-mail já
 *    registrado, sem conseguir tentar de novo com ele).
 * 2) auth.admin.createUser cria o usuário já com e-mail confirmado e sem
 *    trocar, nos cookies do navegador atual, a sessão de quem está logado
 *    — diferente do auth.signUp comum, que assumia a sessão do usuário
 *    recém-criado e exigia um signOut logo em seguida. O super_admin agora
 *    continua logado depois de cadastrar uma empresa nova.
 *
 * Cada passo que falha desfaz (best-effort) o que os passos anteriores já
 * tinham criado, pra nunca sobrar empresa órfã nem login de auth preso.
 *
 * Mensagens de erro pro usuário são sempre genéricas em português (o
 * detalhe técnico vai só pro log do servidor via console.error) — evita
 * vazar texto cru do Postgres/Supabase Auth pra quem está usando o
 * formulário, mesmo sendo um super_admin.
 */
export async function criarEmpresa(
  _prev: CriarEmpresaState,
  formData: FormData,
): Promise<CriarEmpresaState> {
  const requester = await getCurrentUser();
  if (!requester || requester.papel !== "super_admin") {
    return { error: "Acesso restrito." };
  }

  const empresaNome = String(formData.get("empresaNome") ?? "").trim();
  const cnpj = String(formData.get("cnpj") ?? "").trim();
  const endereco = String(formData.get("endereco") ?? "").trim();
  const adminNome = String(formData.get("adminNome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  // "interno" cobre o caso ViniPlast/Vinitrade (empresas do próprio
  // Rafael, nunca cobradas) — único valor fora de PlanoAssinatura, só
  // existe neste formulário pra pular a criação de assinatura no Asaas.
  const plano = String(formData.get("plano") ?? "interno").trim();
  const valorEnterpriseBruto = String(formData.get("valorEnterprise") ?? "").trim();

  if (!empresaNome || !adminNome || !email || !senha) {
    return {
      error: "Preencha nome da empresa, nome do admin, e-mail e senha.",
    };
  }
  if (senha.length < 8) {
    // Mínimo subiu de 6 para 8 — ver auditoria de 06/10/2026, mesmo
    // ajuste de usuarios/actions.ts (criarUsuario), por consistência: este
    // formulário também cria um login (o primeiro admin da empresa).
    return { error: "A senha do usuário admin deve ter ao menos 8 caracteres." };
  }

  // CNPJ só são 14 dígitos (sem o cálculo dos dígitos verificadores, que
  // não vale o esforço aqui — CNPJ é usado só pra exibição, não pra
  // nenhuma integração fiscal) — rejeita algo claramente incompleto/errado
  // em vez de aceitar qualquer texto. Opcional só pra empresa "interno"
  // (ViniPlast/Vinitrade); pra qualquer plano comercial é obrigatório —
  // o Asaas exige cpfCnpj pra processar Pix/boleto/cartão. Ver auditoria
  // de 06/10/2026 e modelo comercial (06/10/2026).
  const cnpjDigitos = cnpj.replace(/\D/g, "");
  const comercial = PLANOS_COMERCIAIS.has(plano);
  if (cnpj && cnpjDigitos.length !== 14) {
    return { error: "CNPJ deve ter 14 dígitos (ou deixe em branco)." };
  }
  if (comercial && cnpjDigitos.length !== 14) {
    return {
      error: "CNPJ é obrigatório pra empresas com plano pago (o Asaas precisa dele pra gerar a cobrança).",
    };
  }

  // Valor mensal — fixo por plano, exceto "enterprise" (sob consulta,
  // negociado manualmente a cada caso).
  let valorMensal: number | null = null;
  if (comercial) {
    if (plano === "enterprise") {
      valorMensal = Number(valorEnterpriseBruto.replace(",", "."));
      if (!valorMensal || valorMensal <= 0) {
        return {
          error: "Informe o valor mensal negociado pro plano Enterprise.",
        };
      }
    } else {
      valorMensal = PLANO_VALOR_MENSAL[plano as keyof typeof PLANO_VALOR_MENSAL];
    }
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("criarEmpresa (admin client):", e);
    return {
      error:
        "Configuração do servidor incompleta (SUPABASE_SERVICE_ROLE_KEY ausente). Avise o suporte do MorSafe.",
    };
  }

  // Aviso de nome duplicado — não é uma trava do banco (só `cnpj` é
  // unique), mas a confirmação exata de nome em resetarDadosEmpresa e
  // excluirEmpresaPermanentemente (ver empresas/actions.ts) existe
  // justamente pra evitar errar a empresa na lista — duas com o mesmo
  // nome tornariam essa lista ambígua de propósito. Comparação sem
  // diferenciar maiúsculas/espaços nas pontas, porque é isso que ficaria
  // visualmente idêntico na lista de empresas.
  const { data: duplicada } = await admin
    .from("empresas")
    .select("id")
    .ilike("nome", empresaNome)
    .maybeSingle();
  if (duplicada) {
    return {
      error: `Já existe uma empresa chamada "${empresaNome}". Se for mesmo outra empresa (ex.: outra unidade), use um nome que as diferencie na lista.`,
    };
  }

  // 1) Cria a empresa primeiro (tabela sem RLS, insert sempre permitido).
  // limite_colaboradores vem do plano escolhido, como sugestão inicial —
  // coluna ainda pendente de aplicação (ver morsafe-add-limite-
  // colaboradores.sql), por isso o fallback abaixo, mesmo padrão já usado
  // em movimentacoes/actions.ts pro grupo_entrega_id. Testa tanto 42703
  // (Postgres "coluna não existe") quanto PGRST204 (o PostgREST rejeita
  // antes de chegar no banco, por não achar a coluna no SCHEMA CACHE dele
  // — é o código real confirmado em produção, ver mesmo ajuste em
  // definirLimiteColaboradores, empresas/actions.ts); só 42703 deixava
  // esse fallback nunca disparar de verdade.
  const limiteColaboradoresSugerido =
    comercial && plano !== "enterprise"
      ? PLANO_LIMITE_COLABORADORES[plano as keyof typeof PLANO_LIMITE_COLABORADORES]
      : null;

  let { data: empresa, error: empresaError } = await admin
    .from("empresas")
    .insert({
      nome: empresaNome,
      cnpj: cnpj || null,
      endereco: endereco || null,
      limite_colaboradores: limiteColaboradoresSugerido,
    })
    .select("id")
    .single();

  if (
    empresaError &&
    (empresaError.code === "42703" || empresaError.code === "PGRST204") &&
    /limite_colaboradores/i.test(empresaError.message ?? "")
  ) {
    ({ data: empresa, error: empresaError } = await admin
      .from("empresas")
      .insert({ nome: empresaNome, cnpj: cnpj || null, endereco: endereco || null })
      .select("id")
      .single());
  }

  if (empresaError || !empresa) {
    console.error("criarEmpresa (insert empresa):", empresaError?.message);
    return {
      error: "Não foi possível criar a empresa. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  // 2) Cria o usuário no Supabase Auth, já com e-mail confirmado.
  const { data: created, error: createError } = await admin.auth.admin.createUser(
    {
      email,
      password: senha,
      email_confirm: true,
    },
  );

  if (createError || !created.user) {
    // Best-effort: remove a empresa órfã já que o usuário não foi criado.
    await admin.from("empresas").delete().eq("id", empresa.id);
    const jaExiste =
      createError?.code === "email_exists" ||
      /already.*registered/i.test(createError?.message ?? "");
    console.error("criarEmpresa (createUser):", createError?.message);
    return {
      error: jaExiste
        ? "Já existe um usuário com esse e-mail."
        : "Não foi possível criar o usuário. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  // 3) Vincula o usuário à empresa como admin.
  const { error: usuarioError } = await admin.from("usuarios").insert({
    id: created.user.id,
    empresa_id: empresa.id,
    nome: adminNome,
    papel: "admin",
  });

  if (usuarioError) {
    // Best-effort: desfaz os dois passos anteriores, já que o cadastro como
    // um todo falhou — sem isso, sobra empresa órfã e login de auth preso.
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from("empresas").delete().eq("id", empresa.id);
    console.error("criarEmpresa (insert usuario):", usuarioError.message);
    return {
      error: "Não foi possível vincular o usuário à empresa. Tente novamente ou avise o suporte do MorSafe.",
    };
  }

  // 4) Plano comercial: cria a assinatura recorrente no Asaas. A ordem
  // aqui importa pela segurança do dinheiro envolvido — grava a linha de
  // `assinaturas` ANTES de chamar o Asaas (nunca depois), pra nunca criar
  // uma cobrança recorrente de verdade sem um jeito de rastreá-la daqui.
  // Se a tabela ainda não existir (migração pendente — ver
  // morsafe-add-assinaturas-asaas.sql), falha AQUI, antes de qualquer
  // chamada ao Asaas, então nada foi cobrado de ninguém.
  let avisoImplantacao: string | undefined;

  if (comercial && valorMensal !== null) {
    const plano_ = plano as PlanoAssinatura;

    const { data: assinatura, error: assinaturaInsertError } = await admin
      .from("assinaturas")
      .insert({
        empresa_id: empresa.id,
        plano: plano_,
        valor_mensal: valorMensal,
        status: "pendente",
      })
      .select("id")
      .single();

    if (assinaturaInsertError || !assinatura) {
      await admin.auth.admin.deleteUser(created.user.id);
      await admin.from("empresas").delete().eq("id", empresa.id);
      const tabelaAusente = assinaturaInsertError?.code === "42P01";
      console.error("criarEmpresa (insert assinatura):", assinaturaInsertError?.message);
      return {
        error: tabelaAusente
          ? "A cobrança recorrente depende de uma migração pendente no banco (acesso ao Supabase bloqueado). Cadastre esta empresa sem plano pago por enquanto, ou avise o suporte do MorSafe."
          : "Não foi possível criar a assinatura. Tente novamente ou avise o suporte do MorSafe.",
      };
    }

    // Guardado fora do try pra ficar acessível no passo 5 (taxa de
    // implantação), logo abaixo — só fica preenchido se o cliente Asaas
    // foi criado com sucesso, o que só acontece se o try inteiro passar
    // do ponto de criarClienteAsaas (qualquer falha antes disso retorna
    // cedo, via catch, então o passo 5 nunca roda com isto nulo).
    let asaasCustomerId: string | null = null;

    try {
      const cliente = await criarClienteAsaas({
        nome: empresaNome,
        cpfCnpj: cnpjDigitos,
        email,
        referenciaExterna: empresa.id,
      });
      asaasCustomerId = cliente.id;

      const proximoVencimento = proximoDiaVencimento();
      const assinaturaAsaas = await criarAssinaturaAsaas({
        asaasCustomerId: cliente.id,
        valor: valorMensal,
        proximoVencimento,
        descricao: `Assinatura MorSafe — plano ${plano_}`,
        referenciaExterna: empresa.id,
      });

      const { error: atualizaAssinaturaError } = await admin
        .from("assinaturas")
        .update({
          asaas_customer_id: cliente.id,
          asaas_subscription_id: assinaturaAsaas.id,
          proximo_vencimento: proximoVencimento,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", assinatura.id);

      if (atualizaAssinaturaError) {
        // A assinatura JÁ FOI criada de verdade no Asaas a essa altura —
        // desfazer o cadastro inteiro agora cancelaria uma cobrança real
        // por um problema só de gravação local, o que é pior. Fica só o
        // log bem visível pra conferência manual (painel do Asaas tem o
        // id da assinatura, visível no log abaixo).
        console.error(
          `criarEmpresa: assinatura criada no Asaas (${assinaturaAsaas.id}, cliente ${cliente.id}) mas falhou ao gravar os ids localmente (assinatura id ${assinatura.id}): ${atualizaAssinaturaError.message}`,
        );
      }
    } catch (e) {
      // Falha ao criar no Asaas (CNPJ inválido, API fora do ar, etc.) —
      // aqui sim desfaz tudo, porque nada foi cobrado de ninguém ainda.
      await admin.from("assinaturas").delete().eq("id", assinatura.id);
      await admin.auth.admin.deleteUser(created.user.id);
      await admin.from("empresas").delete().eq("id", empresa.id);
      const mensagemAsaas = e instanceof AsaasError ? e.message : null;
      console.error("criarEmpresa (Asaas):", e);
      return {
        error: mensagemAsaas
          ? `Não foi possível criar a assinatura no Asaas: ${mensagemAsaas}`
          : "Não foi possível criar a assinatura no Asaas. Confira o CNPJ e tente novamente.",
      };
    }

    // 5) Taxa de implantação (cobrança única, valor fixo — ver
    // TAXA_IMPLANTACAO, lib/data/planos.ts) — lançada automaticamente
    // aqui pra toda empresa comercial, em vez de depender de alguém
    // lembrar de criar depois em "+ Novo pagamento" (ver pagamentos/
    // actions.ts, que segue o mesmo padrão pra qualquer cobrança avulsa
    // futura). Mesma ordem de segurança do dinheiro: a linha local
    // (pendente, sem asaas_payment_id ainda) é criada ANTES da chamada ao
    // Asaas.
    //
    // Diferente da falha de assinatura acima, uma falha AQUI não desfaz o
    // cadastro inteiro — a esta altura a assinatura recorrente JÁ está
    // ativa de verdade no Asaas; desfazer a empresa deixaria essa
    // assinatura real órfã, sem nenhum registro local pra cancelá-la
    // depois. Em vez disso, mantém o cadastro como sucesso e avisa o
    // super_admin (avisoImplantacao) pra lançar manualmente — e, mesmo se
    // só o lado Asaas falhar, mantém a linha local "pendente" sem
    // asaas_payment_id (não apaga, diferente de criarPagamento), porque
    // aqui ela serve de lembrete visível em /pagamentos de que a taxa
    // ainda precisa ser cobrada.
    const vencimentoImplantacao = new Date().toISOString().slice(0, 10);
    const { data: pagamentoImplantacao, error: implantacaoInsertError } =
      await admin
        .from("pagamentos_empresa")
        .insert({
          empresa_id: empresa.id,
          valor: TAXA_IMPLANTACAO,
          data_vencimento: vencimentoImplantacao,
          observacao: "Taxa de implantação",
        })
        .select("id")
        .maybeSingle();

    if (implantacaoInsertError || !pagamentoImplantacao) {
      console.error(
        `criarEmpresa (insert taxa de implantação, empresa ${empresa.id}): ${implantacaoInsertError?.message}`,
      );
      avisoImplantacao =
        "Empresa e assinatura criadas com sucesso, mas não foi possível registrar a taxa de implantação automaticamente. Lance manualmente em \"+ Novo pagamento\".";
    } else if (asaasCustomerId) {
      try {
        const cobranca = await criarCobrancaAvulsaAsaas({
          asaasCustomerId,
          valor: TAXA_IMPLANTACAO,
          vencimento: vencimentoImplantacao,
          descricao: `Taxa de implantação MorSafe — ${empresaNome}`,
          referenciaExterna: empresa.id,
        });

        const { error: atualizaImplantacaoError } = await admin
          .from("pagamentos_empresa")
          .update({
            asaas_payment_id: cobranca.id,
            asaas_invoice_url: cobranca.invoiceUrl,
          })
          .eq("id", pagamentoImplantacao.id);

        if (atualizaImplantacaoError) {
          console.error(
            `criarEmpresa: taxa de implantação criada no Asaas (${cobranca.id}) mas falhou ao gravar o id localmente (pagamento ${pagamentoImplantacao.id}): ${atualizaImplantacaoError.message}`,
          );
        }
      } catch (e) {
        const mensagemAsaas = e instanceof AsaasError ? e.message : null;
        console.error("criarEmpresa (taxa de implantação no Asaas):", e);
        avisoImplantacao = mensagemAsaas
          ? `Empresa e assinatura criadas com sucesso, mas a taxa de implantação não pôde ser cobrada no Asaas (${mensagemAsaas}). O lançamento ficou pendente em Cobranças — confira o CNPJ/dados do cliente e tente lançar de novo por lá se precisar.`
          : "Empresa e assinatura criadas com sucesso, mas a taxa de implantação não pôde ser cobrada no Asaas. O lançamento ficou pendente em Cobranças.";
      }
    }
  }

  await registrarLogAuditoria({
    supabase: admin,
    empresaId: empresa.id,
    tabela: "empresas",
    registroId: empresa.id,
    acao: "criado",
    usuarioId: requester.id,
    detalhes: { nome: empresaNome, plano: comercial ? plano : "interno" },
  });

  return { error: null, success: true, avisoImplantacao };
}
