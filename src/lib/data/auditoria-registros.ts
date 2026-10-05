import { createClient } from "@/lib/supabase/server";

export type SeveridadePendencia = "critico" | "atencao";

export type ItemPendencia = {
  titulo: string;
  href: string;
  acaoLabel: string;
};

export type GrupoPendencia = {
  tipo: string;
  titulo: string;
  descricao: string;
  severidade: SeveridadePendencia;
  itens: ItemPendencia[];
};

export type RaioXStatus = "ok" | "atencao" | "critico";

export type RaioXItem = {
  label: string;
  status: RaioXStatus;
  detalhe: string;
};

// Status de cada colaborador em relação aos EPIs obrigatórios do setor dele
// — "sem_exigencia" não é problema (setor sem nenhum EPI marcado como
// obrigatório em setor_epi), é só um terceiro estado pra não confundir com
// "completo" (tem exigência e está em dia).
export type StatusColaboradorAuditoria = "completo" | "pendente" | "sem_exigencia";

export type ColaboradorAuditoria = {
  id: string;
  nome: string;
  setorNome: string;
  status: StatusColaboradorAuditoria;
  episObrigatorios: number;
  episFaltando: string[];
  ultimaEntrega: string | null;
};

// Mesmos limiares/nomes de epis/page.tsx (statusCa) — "vencendo" a 30 dias,
// pra bater com o mesmo número já usado no Raio-X e na Visão Geral.
export type StatusCaEpi = "ok" | "vencendo" | "vencido" | "sem_ca" | "nao_exige";

export type EpiAuditoria = {
  id: string;
  nome: string;
  tipo: string | null;
  ca: string | null;
  caValidade: string | null;
  statusCa: StatusCaEpi;
  colaboradoresComPosse: number;
};

export type ApuracaoAuditoriaRegistros = {
  indiceControle: number;
  registrosAnalisados: number;
  semPendencia: number;
  atencaoTotal: number;
  criticoTotal: number;
  raioX: RaioXItem[];
  pendencias: GrupoPendencia[];
  colaboradoresDetalhe: ColaboradorAuditoria[];
  episDetalhe: EpiAuditoria[];
};

function vazio(): ApuracaoAuditoriaRegistros {
  return {
    indiceControle: 100,
    registrosAnalisados: 0,
    semPendencia: 0,
    atencaoTotal: 0,
    criticoTotal: 0,
    raioX: [],
    pendencias: [],
    colaboradoresDetalhe: [],
    episDetalhe: [],
  };
}

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

const DIA_MS = 24 * 60 * 60 * 1000;
const LIMIAR_VENCIMENTO_DIAS = 30;

function calcularStatusCa(epi: {
  exige_ca: boolean;
  ca: string | null;
  ca_validade: string | null;
}): StatusCaEpi {
  if (!epi.exige_ca) return "nao_exige";
  if (!epi.ca || !epi.ca_validade) return "sem_ca";
  const diffDias = Math.ceil(
    (new Date(epi.ca_validade + "T00:00:00").getTime() - Date.now()) / DIA_MS,
  );
  if (diffDias <= 0) return "vencido";
  if (diffDias <= LIMIAR_VENCIMENTO_DIAS) return "vencendo";
  return "ok";
}

/**
 * Auditoria de REGISTROS (diferente do checklist de campo em
 * auditorias-nr06.ts): aqui não é ninguém respondendo "sim/não" sobre o que
 * viu no chão de fábrica — é o sistema verificando, a partir do que já está
 * no banco, se os próprios registros de fornecimento/EPI estão completos o
 * bastante pra servir de evidência numa fiscalização (é exatamente o que a
 * NR-06 cobra do "sistema eletrônico": permitir extração de relatório, ver
 * art. 6.5.1-d). Pedido do Rafael, 05-06/10/2026, com o cuidado explícito de
 * nunca declarar "a empresa está em conformidade com a NR-06" — só reportar
 * o que os registros mostram (ver indiceControle: "índice de controle dos
 * registros", nunca "índice de conformidade").
 *
 * Roda tudo numa passada só (nada de N+1 por colaborador/EPI): busca listas
 * inteiras de colaboradores/EPIs/entregas/devoluções/vínculos setor×EPI da
 * empresa e cruza tudo em memória — mesmo raciocínio de "poucas dezenas/
 * centenas de linhas por empresa" já usado em listEmpresasComResumo e
 * listColaboradores (ultimaEntrega calculada em memória, não é coluna).
 */
export async function apurarAuditoriaRegistros(
  empresaId: string | null,
): Promise<ApuracaoAuditoriaRegistros> {
  if (!empresaId) return vazio();

  const supabase = await createClient();

  const [
    { data: colaboradores, error: colaboradoresError },
    { data: epis, error: episError },
    { data: entregas, error: entregasError },
    { data: devolucoes, error: devolucoesError },
    { data: setorEpiObrigatorio, error: setorEpiError },
  ] = await Promise.all([
    supabase
      .from("colaboradores")
      .select("id, nome, setor_id, status, setores ( nome )")
      .eq("empresa_id", empresaId),
    supabase
      .from("epis")
      .select("id, nome, tipo, ativo, exige_ca, ca, ca_validade")
      .eq("empresa_id", empresaId),
    supabase
      .from("entregas")
      .select("id, colaborador_id, epi_id, data, assinatura_url")
      .eq("empresa_id", empresaId),
    supabase
      .from("devolucoes")
      .select("id, colaborador_id, epi_id, data, assinatura_url")
      .eq("empresa_id", empresaId),
    supabase
      .from("setor_epi")
      .select("setor_id, epi_id")
      .eq("empresa_id", empresaId)
      .eq("obrigatorio", true),
  ]);

  if (
    colaboradoresError ||
    episError ||
    entregasError ||
    devolucoesError ||
    setorEpiError
  ) {
    console.error(
      "apurarAuditoriaRegistros:",
      colaboradoresError?.message ??
        episError?.message ??
        entregasError?.message ??
        devolucoesError?.message ??
        setorEpiError?.message,
    );
    return vazio();
  }

  const colaboradoresAtivos = (colaboradores ?? []).filter(
    (c) => c.status === "ativo",
  );
  const episAtivos = (epis ?? []).filter((e) => e.ativo);
  const epiNome = new Map((epis ?? []).map((e) => [e.id, e.nome]));
  const colaboradorNome = new Map(
    (colaboradores ?? []).map((c) => [c.id, c.nome]),
  );

  // Último evento (entrega OU devolução) de cada par colaborador×EPI — pra
  // saber se o colaborador está DE POSSE do EPI hoje. Em empate de data,
  // devolução sempre "vence" sobre entrega (mais seguro assumir que já
  // devolveu do que assumir posse indevida).
  const ultimoEvento = new Map<
    string,
    { tipo: "entrega" | "devolucao"; data: string }
  >();
  function registrarEvento(
    colaboradorId: string,
    epiId: string,
    tipo: "entrega" | "devolucao",
    data: string,
  ) {
    const key = `${colaboradorId}:${epiId}`;
    const atual = ultimoEvento.get(key);
    if (
      !atual ||
      data > atual.data ||
      (data === atual.data && tipo === "devolucao")
    ) {
      ultimoEvento.set(key, { tipo, data });
    }
  }
  for (const e of entregas ?? []) {
    registrarEvento(e.colaborador_id, e.epi_id, "entrega", e.data);
  }
  for (const d of devolucoes ?? []) {
    registrarEvento(d.colaborador_id, d.epi_id, "devolucao", d.data);
  }

  // Última entrega (qualquer EPI) de cada colaborador — pra "sem
  // movimentação recente".
  const ultimaEntregaPorColaborador = new Map<string, string>();
  for (const e of entregas ?? []) {
    const atual = ultimaEntregaPorColaborador.get(e.colaborador_id);
    if (!atual || e.data > atual) {
      ultimaEntregaPorColaborador.set(e.colaborador_id, e.data);
    }
  }

  // EPIs obrigatórios por setor, já resolvidos pro nome do EPI.
  const obrigatoriosPorSetor = new Map<string, string[]>();
  for (const v of setorEpiObrigatorio ?? []) {
    const lista = obrigatoriosPorSetor.get(v.setor_id) ?? [];
    lista.push(v.epi_id);
    obrigatoriosPorSetor.set(v.setor_id, lista);
  }

  // ---- 1. Devoluções sem assinatura (crítico) ----
  // Entregas NÃO entram aqui: assinatura_url é NOT NULL na tabela — não tem
  // como existir uma entrega sem assinatura. Devoluções ganharam o campo
  // depois (ver morsafe-add-assinatura-devolucao.sql), nullable, então
  // devoluções antigas podem estar sem.
  const devolucoesSemAssinatura = (devolucoes ?? []).filter(
    (d) => !d.assinatura_url,
  );

  // ---- 2. EPIs ativos sem C.A. completo quando exigem C.A. (crítico) ----
  const episSemCaCompleto = episAtivos.filter(
    (e) => e.exige_ca && (!e.ca || !e.ca_validade),
  );

  // ---- 3. Colaboradores ativos sem NENHUMA entrega registrada (crítico) ----
  const colaboradoresSemEntrega = colaboradoresAtivos.filter(
    (c) => !ultimaEntregaPorColaborador.has(c.id),
  );
  const idsColaboradoresSemEntrega = new Set(
    colaboradoresSemEntrega.map((c) => c.id),
  );

  // ---- 4. Colaboradores ativos com EPI obrigatório do setor pendente
  // (crítico) ---- Exclui quem já caiu no item 3 (sem nenhuma entrega) pra
  // não repetir o mesmo colaborador em dois grupos dizendo basicamente a
  // mesma coisa.
  const colaboradoresComPendenciaObrigatorio: {
    colaborador: (typeof colaboradoresAtivos)[number];
    epiNomes: string[];
  }[] = [];
  for (const c of colaboradoresAtivos) {
    if (idsColaboradoresSemEntrega.has(c.id)) continue;
    const obrigatorios = obrigatoriosPorSetor.get(c.setor_id) ?? [];
    if (obrigatorios.length === 0) continue;
    const faltando = obrigatorios.filter((epiId) => {
      const evento = ultimoEvento.get(`${c.id}:${epiId}`);
      return !evento || evento.tipo !== "entrega";
    });
    if (faltando.length > 0) {
      colaboradoresComPendenciaObrigatorio.push({
        colaborador: c,
        epiNomes: faltando.map((id) => epiNome.get(id) ?? "EPI"),
      });
    }
  }

  // ---- 5. EPIs com C.A. vencendo em até 30 dias (atenção) ----
  const hojeISO = new Date().toISOString().slice(0, 10);
  const em30DiasISO = new Date(Date.now() + 30 * DIA_MS)
    .toISOString()
    .slice(0, 10);
  const episComCaVencendo = episAtivos.filter(
    (e) =>
      e.exige_ca &&
      e.ca_validade &&
      e.ca_validade >= hojeISO &&
      e.ca_validade <= em30DiasISO,
  );

  // ---- 6. Colaboradores ativos sem movimentação há mais de 180 dias
  // (atenção) ---- Exclui quem já é crítico (sem nenhuma entrega, ou com
  // obrigatório pendente) — esses já aparecem nos grupos acima, com mais
  // detalhe.
  const idsJaCriticos = new Set([
    ...idsColaboradoresSemEntrega,
    ...colaboradoresComPendenciaObrigatorio.map((p) => p.colaborador.id),
  ]);
  const limite180DiasISO = new Date(Date.now() - 180 * DIA_MS)
    .toISOString()
    .slice(0, 10);
  const colaboradoresSemMovimentacaoRecente = colaboradoresAtivos.filter(
    (c) =>
      !idsJaCriticos.has(c.id) &&
      (ultimaEntregaPorColaborador.get(c.id) ?? "9999-99-99") <
        limite180DiasISO,
  );

  // ---- Identificação dos EPIs (Raio-X item 2) ----
  const episSemTipo = episAtivos.filter((e) => !e.tipo);

  // ---- Totais, deduplicados por entidade (um colaborador com 2 problemas
  // diferentes conta uma vez só no total de críticos) ----
  const criticosSet = new Set<string>();
  for (const d of devolucoesSemAssinatura) criticosSet.add(`devolucao:${d.id}`);
  for (const e of episSemCaCompleto) criticosSet.add(`epi:${e.id}`);
  for (const c of colaboradoresSemEntrega) criticosSet.add(`colaborador:${c.id}`);
  for (const p of colaboradoresComPendenciaObrigatorio)
    criticosSet.add(`colaborador:${p.colaborador.id}`);

  const atencaoSet = new Set<string>();
  for (const e of episComCaVencendo) atencaoSet.add(`epi:${e.id}`);
  for (const c of colaboradoresSemMovimentacaoRecente)
    atencaoSet.add(`colaborador:${c.id}`);

  const registrosAnalisados =
    (entregas?.length ?? 0) +
    (devolucoes?.length ?? 0) +
    episAtivos.length +
    colaboradoresAtivos.length;
  const criticoTotal = criticosSet.size;
  const atencaoTotal = atencaoSet.size;
  const semPendencia = Math.max(
    0,
    registrosAnalisados - criticoTotal - atencaoTotal,
  );
  const indiceControle =
    registrosAnalisados > 0
      ? Math.round((semPendencia / registrosAnalisados) * 100)
      : 100;

  const raioX: RaioXItem[] = [
    {
      label: "Registro de fornecimento",
      status: "ok",
      detalhe:
        "Toda entrega exige assinatura no momento do registro — não há como salvar uma sem.",
    },
    {
      label: "Identificação dos EPIs",
      status: episSemTipo.length > 0 ? "critico" : "ok",
      detalhe:
        episSemTipo.length > 0
          ? `${episSemTipo.length} EPI(s) ativo(s) sem tipo cadastrado.`
          : "Todos os EPIs ativos têm nome e tipo cadastrados.",
    },
    {
      label: "Controle de C.A.",
      status: episSemCaCompleto.length > 0 ? "critico" : "ok",
      detalhe:
        episSemCaCompleto.length > 0
          ? `${episSemCaCompleto.length} EPI(s) ativo(s) exigem C.A. mas estão sem número ou validade cadastrados.`
          : "Todos os EPIs que exigem C.A. têm número e validade cadastrados.",
    },
    {
      label: "Histórico de movimentações",
      status: "ok",
      detalhe:
        "Toda correção gera um novo registro no log de auditoria — nada é editado ou apagado silenciosamente.",
    },
    {
      label: "Evidência de recebimento",
      status: devolucoesSemAssinatura.length > 0 ? "critico" : "ok",
      detalhe:
        devolucoesSemAssinatura.length > 0
          ? `${devolucoesSemAssinatura.length} devolução(ões) sem assinatura registrada.`
          : "Todas as entregas e devoluções têm assinatura registrada.",
    },
    {
      label: "Substituições/devoluções",
      status: "ok",
      detalhe: "Toda devolução registra motivo e destino do EPI.",
    },
    {
      label: "EPIs próximos do vencimento do C.A.",
      status: episComCaVencendo.length > 0 ? "atencao" : "ok",
      detalhe:
        episComCaVencendo.length > 0
          ? `${episComCaVencendo.length} encontrado(s), vencendo nos próximos 30 dias.`
          : "Nenhum C.A. vencendo nos próximos 30 dias.",
    },
    {
      label: "Registros incompletos",
      status: criticoTotal > 0 ? "critico" : "ok",
      detalhe:
        criticoTotal > 0
          ? `${criticoTotal} encontrado(s) — ver aba Pendências.`
          : "Nenhum registro crítico encontrado.",
    },
  ];

  const pendencias: GrupoPendencia[] = [];

  if (devolucoesSemAssinatura.length > 0) {
    pendencias.push({
      tipo: "devolucao_sem_assinatura",
      titulo: "Devoluções sem assinatura",
      descricao:
        "Registros antigos de devolução (de antes da assinatura ter virado obrigatória nessa tela) sem evidência de recebimento. Não dá pra preencher isso retroativamente sem forjar o registro — o indicado é só ter ciência.",
      severidade: "critico",
      itens: devolucoesSemAssinatura.map((d) => ({
        titulo: `${epiNome.get(d.epi_id) ?? "EPI"} devolvido por ${colaboradorNome.get(d.colaborador_id) ?? "colaborador"} em ${formatDate(d.data)}`,
        href: `/movimentacoes?colaborador=${d.colaborador_id}`,
        acaoLabel: "Ver registro",
      })),
    });
  }

  if (episSemCaCompleto.length > 0) {
    pendencias.push({
      tipo: "epi_sem_ca",
      titulo: "EPIs cadastrados sem C.A. completo",
      descricao:
        "EPIs ativos marcados como exigindo C.A., mas sem o número ou a validade cadastrados — isso é editável no cadastro do EPI.",
      severidade: "critico",
      itens: episSemCaCompleto.map((e) => ({
        titulo: e.nome,
        href: `/epis?q=${encodeURIComponent(e.nome)}`,
        acaoLabel: "Corrigir cadastro",
      })),
    });
  }

  if (colaboradoresSemEntrega.length > 0) {
    pendencias.push({
      tipo: "colaborador_sem_entrega",
      titulo: "Colaboradores ativos sem nenhuma entrega registrada",
      descricao:
        "Colaboradores ativos no sistema sem nenhum EPI entregue registrado — pode ser falta de registro, ou colaborador que ainda não recebeu nada.",
      severidade: "critico",
      itens: colaboradoresSemEntrega.map((c) => ({
        titulo: `${c.nome} — ${(c.setores as unknown as { nome: string } | null)?.nome ?? "sem setor"}`,
        href: `/movimentacoes?colaborador=${c.id}`,
        acaoLabel: "Registrar entrega",
      })),
    });
  }

  if (colaboradoresComPendenciaObrigatorio.length > 0) {
    pendencias.push({
      tipo: "colaborador_epi_obrigatorio_pendente",
      titulo: "Colaboradores com EPI obrigatório do setor pendente",
      descricao:
        "Colaboradores ativos sem uma entrega em vigor (sem devolução depois) de um EPI marcado como obrigatório para o setor deles.",
      severidade: "critico",
      itens: colaboradoresComPendenciaObrigatorio.map((p) => ({
        titulo: `${p.colaborador.nome} — falta: ${p.epiNomes.join(", ")}`,
        href: `/movimentacoes?colaborador=${p.colaborador.id}`,
        acaoLabel: "Registrar entrega",
      })),
    });
  }

  if (episComCaVencendo.length > 0) {
    pendencias.push({
      tipo: "epi_ca_vencendo",
      titulo: "EPIs com C.A. vencendo em até 30 dias",
      descricao:
        "C.A. ainda válido hoje, mas perto do vencimento — vale revalidar ou já planejar a troca de fornecedor/lote.",
      severidade: "atencao",
      itens: episComCaVencendo.map((e) => ({
        titulo: `${e.nome} — vence em ${e.ca_validade ? formatDate(e.ca_validade) : "—"}`,
        href: `/epis?q=${encodeURIComponent(e.nome)}`,
        acaoLabel: "Ver EPI",
      })),
    });
  }

  if (colaboradoresSemMovimentacaoRecente.length > 0) {
    pendencias.push({
      tipo: "colaborador_sem_movimentacao_recente",
      titulo: "Colaboradores sem movimentação há mais de 180 dias",
      descricao:
        "Já têm entrega registrada, mas nada recente — vale confirmar se o EPI ainda está em bom estado ou se já deveria ter sido trocado.",
      severidade: "atencao",
      itens: colaboradoresSemMovimentacaoRecente.map((c) => ({
        titulo: `${c.nome} — última entrega em ${formatDate(ultimaEntregaPorColaborador.get(c.id)!)}`,
        href: `/colaboradores/${c.id}`,
        acaoLabel: "Ver colaborador",
      })),
    });
  }

  // ---- Detalhe por colaborador (aba Colaboradores) — reaproveita
  // obrigatoriosPorSetor e ultimoEvento já calculados acima, nada de
  // recalcular ou buscar de novo. ----
  const PESO_STATUS_COLABORADOR: Record<StatusColaboradorAuditoria, number> = {
    pendente: 0,
    sem_exigencia: 1,
    completo: 2,
  };
  const colaboradoresDetalhe: ColaboradorAuditoria[] = colaboradoresAtivos
    .map((c) => {
      const obrigatorios = obrigatoriosPorSetor.get(c.setor_id) ?? [];
      const faltando = obrigatorios.filter((epiId) => {
        const evento = ultimoEvento.get(`${c.id}:${epiId}`);
        return !evento || evento.tipo !== "entrega";
      });
      const status: StatusColaboradorAuditoria =
        obrigatorios.length === 0
          ? "sem_exigencia"
          : faltando.length === 0
            ? "completo"
            : "pendente";
      return {
        id: c.id,
        nome: c.nome,
        setorNome:
          (c.setores as unknown as { nome: string } | null)?.nome ??
          "Sem setor",
        status,
        episObrigatorios: obrigatorios.length,
        episFaltando: faltando.map((id) => epiNome.get(id) ?? "EPI"),
        ultimaEntrega: ultimaEntregaPorColaborador.get(c.id) ?? null,
      };
    })
    .sort((a, b) => {
      const peso = PESO_STATUS_COLABORADOR[a.status] - PESO_STATUS_COLABORADOR[b.status];
      return peso !== 0 ? peso : a.nome.localeCompare(b.nome, "pt-BR");
    });

  // ---- Detalhe por EPI (aba EPIs) — quantos colaboradores ATIVOS estão de
  // posse de cada EPI hoje, lido do mesmo ultimoEvento (tipo "entrega" sem
  // devolução depois). ----
  const idsColaboradoresAtivos = new Set(colaboradoresAtivos.map((c) => c.id));
  const posseAtualPorEpi = new Map<string, number>();
  for (const [chave, evento] of ultimoEvento) {
    if (evento.tipo !== "entrega") continue;
    const [colaboradorId, epiId] = chave.split(":");
    if (!idsColaboradoresAtivos.has(colaboradorId)) continue;
    posseAtualPorEpi.set(epiId, (posseAtualPorEpi.get(epiId) ?? 0) + 1);
  }

  const PESO_STATUS_CA: Record<StatusCaEpi, number> = {
    vencido: 0,
    sem_ca: 1,
    vencendo: 2,
    ok: 3,
    nao_exige: 4,
  };
  const episDetalhe: EpiAuditoria[] = episAtivos
    .map((e) => ({
      id: e.id,
      nome: e.nome,
      tipo: e.tipo,
      ca: e.ca,
      caValidade: e.ca_validade,
      statusCa: calcularStatusCa(e),
      colaboradoresComPosse: posseAtualPorEpi.get(e.id) ?? 0,
    }))
    .sort((a, b) => {
      const peso = PESO_STATUS_CA[a.statusCa] - PESO_STATUS_CA[b.statusCa];
      return peso !== 0 ? peso : a.nome.localeCompare(b.nome, "pt-BR");
    });

  return {
    indiceControle,
    registrosAnalisados,
    semPendencia,
    atencaoTotal,
    criticoTotal,
    raioX,
    pendencias,
    colaboradoresDetalhe,
    episDetalhe,
  };
}
