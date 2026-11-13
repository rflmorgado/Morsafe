import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Medição anônima de uso da calculadora de economia (public/calculadora/
 * index.html). Criado em 13/11/2026 a pedido do Rafael.
 *
 * Recebe só { e: evento, o: origem } e soma 1 numa contagem diária (ver
 * morsafe-add-metricas-calculadora.sql). NÃO lê nem guarda IP, cookie,
 * user-agent nem qualquer dado do visitante. É de propósito público (sem
 * login), como /api/mora — quem chama é sempre um visitante do site.
 *
 * Usa um cliente comum com a chave anon (não a service role): a tabela não
 * é acessível direto pela API, só a função registrar_metrica_calculadora,
 * que valida de novo os nomes de evento e de origem no banco.
 *
 * Nunca quebra a página: qualquer erro é engolido e a resposta é sempre 204.
 */

export const runtime = "nodejs";

const EVENTOS = new Set(["acesso", "simulacao", "whatsapp", "demo"]);

export async function POST(request: NextRequest) {
  try {
    const texto = await request.text();
    if (texto.length > 300) return new NextResponse(null, { status: 204 });

    const corpo = JSON.parse(texto) as { e?: unknown; o?: unknown };
    const evento = typeof corpo.e === "string" ? corpo.e : "";
    const origem =
      typeof corpo.o === "string" ? corpo.o.slice(0, 20) : "direto";

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (EVENTOS.has(evento) && url && anonKey) {
      const supabase = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await supabase.rpc("registrar_metrica_calculadora", {
        p_evento: evento,
        p_origem: origem,
      });
    }
  } catch {
    // Medição é "melhor esforço": nunca devolve erro pro navegador.
  }

  return new NextResponse(null, { status: 204 });
}
