import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAnthropicClient } from "@/lib/ai/client";
import { extrairJson } from "@/lib/blog/pipeline/gerar";
import { parsePaginaGerada } from "./gerar-parse";
import { slugPagina } from "./slug";
import type { Servico, Localidade } from "./queries";

const SEO_MODEL = "claude-haiku-4-5";

export function montarPromptPagina(servico: Servico, loc: Localidade): string {
  const nivel = loc.tipo === "estado" ? `no estado ${loc.nome} (${loc.uf})` : `na cidade de ${loc.nome} (${loc.uf})`;
  return `Você é redator(a) de SEO da Yide Digital, agência de marketing e programação. Escreva o conteúdo de uma PÁGINA DE SERVIÇO local, ORIGINAL em pt-br, sobre "${servico.nome}" ${nivel}.

Contexto do serviço: ${servico.descricao_base}

Regras:
- Foque em "${servico.nome.toLowerCase()} em ${loc.nome}"; use variações naturais.
- Conteúdo DISTINTO pra esta localidade (realidade local, tipos de negócio da praça). NÃO escreva algo genérico que sirva pra qualquer cidade.
- Tom profissional e acessível. Posicione a Yide como referência local.
- NUNCA use travessão nem meia-risca. Use vírgula, dois-pontos, ponto ou parênteses.

Responda SOMENTE com JSON válido (sem cercas, sem texto fora):
{"titulo": "H1 com serviço e localidade", "meta_title": "SEO até 60 chars", "meta_description": "SEO até 155 chars", "conteudo_md": "600-900 palavras em markdown com ## subtítulos: o que é, por que investir em ${loc.nome}, como a Yide entrega, resultados, CTA", "faq": [{"pergunta": "...", "resposta": "..."}]}
Gere 3 a 5 itens de FAQ específicos da localidade.`;
}

export async function gerarPaginaLocal(orgId: string, servico: Servico, loc: Localidade): Promise<boolean> {
  const client = getAnthropicClient();
  if (!client) { console.error("[seo] Anthropic não configurado"); return false; }
  try {
    const res = await client.messages.create({ model: SEO_MODEL, max_tokens: 3500,
      messages: [{ role: "user", content: montarPromptPagina(servico, loc) }] });
    const txt = res.content.map((c) => ("text" in c ? c.text : "")).join("").trim();
    const parsed = parsePaginaGerada(extrairJson(txt));
    if (!parsed) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = createServiceRoleClient();
    const { error } = await sb.from("seo_paginas").upsert({
      organization_id: orgId, service_id: servico.id, localidade_id: loc.id, slug: slugPagina(servico.slug, loc.slug),
      titulo: parsed.titulo, meta_title: parsed.meta_title, meta_description: parsed.meta_description,
      conteudo_md: parsed.conteudo_md, faq: parsed.faq, status: "rascunho", updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,service_id,localidade_id" });
    if (error) { console.error("[seo] upsert página:", error.message); return false; }
    return true;
  } catch (e) { console.error("[seo] gerarPaginaLocal:", e); return false; }
}

export async function gerarPaginasPendentes(orgId: string, servicos: Servico[], localidades: Localidade[], jaExistem: Set<string>, limite = 4): Promise<{ gerados: number; erros: number }> {
  let gerados = 0, erros = 0;
  for (const s of servicos.filter((x) => x.ativo)) {
    for (const l of localidades.filter((x) => x.ativo)) {
      if (gerados >= limite) return { gerados, erros };
      if (jaExistem.has(`${s.id}:${l.id}`)) continue;
      const ok = await gerarPaginaLocal(orgId, s, l);
      if (ok) gerados++; else erros++;
    }
  }
  return { gerados, erros };
}
