// SERVER ONLY - IA Claude analisa todos os dados coletados e:
//  1. Identifica o provável decisor/dono
//  2. Gera score 0-100
//  3. Detecta oportunidades (sem site, marketing fraco, etc)
//  4. Gera observação executiva curta pra equipe comercial
//
// Usa Claude Sonnet (rápido + barato pra análise estruturada).
// Sem ANTHROPIC_API_KEY → retorna { skipped: true }.

import Anthropic from "@anthropic-ai/sdk";
import { getServerEnv } from "@/lib/env";
import type { SiteScrapingResult, PersonHit } from "./site-scraper";
import type { HunterDomainSearchResult, HunterEmailFinding } from "./hunter";
import type { InstagramProfileResult } from "./apify-instagram";

export interface IaAnalysisInput {
  empresa: string;
  categoria: string | null;
  cidade: string | null;
  telefone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  endereco: string | null;
  // Dados enriquecidos
  site: SiteScrapingResult | null;
  hunter: HunterDomainSearchResult | null;
  instagram_data: InstagramProfileResult | null;
}

export interface IaAnalysisOk {
  ok: true;
  decisor_nome: string | null;
  decisor_cargo: string | null;
  decisor_email: string | null;
  outros_decisores: Array<{ nome: string; cargo: string | null; email: string | null }>;
  score: number;          // 0-100
  qualificado: boolean;
  potencial_comercial: "alto" | "medio" | "baixo";
  observacoes_ia: string;
  diagnostico: {
    sem_site: boolean;
    sem_instagram: boolean;
    instagram_inativo: boolean;
    site_desatualizado: boolean;
    marketing_fraco: boolean;
    sem_resposta_avaliacoes: boolean;
    poucas_avaliacoes: boolean;
    pontos_fortes: string[];
    pontos_fracos: string[];
    abordagem_sugerida: string;
  };
}

export interface IaAnalysisError {
  ok: false;
  error: string;
  skipped: boolean;
}

export type IaAnalysisResult = IaAnalysisOk | IaAnalysisError;

/**
 * Monta o prompt pra Claude analisar o lead.
 * Retorna texto compactado em formato JSON-like, fácil pro modelo extrair.
 */
function buildPrompt(input: IaAnalysisInput): string {
  const sitePessoas = input.site?.pessoas?.map((p: PersonHit) => `${p.nome}${p.cargo ? ` (${p.cargo})` : ""}`).join(", ") ?? "-";
  const siteEmails = input.site?.emails?.slice(0, 10).join(", ") ?? "-";
  const hunterEmails = input.hunter?.emails?.slice(0, 10).map((e: HunterEmailFinding) =>
    `${e.value} [${e.first_name ?? "?"} ${e.last_name ?? ""} - ${e.position ?? "?"} - confidence ${e.confidence ?? "?"}]`,
  ).join("; ") ?? "-";

  return `Você é um analista comercial sênior de uma agência de marketing digital brasileira (Yide).

Você recebeu um lead potencial extraído do Google Maps + enriquecido com scraping do site + busca de emails. Sua tarefa é:

1. **Identificar o provável dono/decisor** da empresa (cruzando todos os dados)
2. **Avaliar o potencial comercial** desse lead pra agência
3. **Detectar oportunidades** (empresas com marketing fraco, sem site, sem presença digital)
4. **Sugerir uma abordagem** comercial inicial (1 frase)

## Dados do lead

EMPRESA: ${input.empresa}
CATEGORIA: ${input.categoria ?? "-"}
CIDADE: ${input.cidade ?? "-"}
ENDEREÇO: ${input.endereco ?? "-"}
TELEFONE: ${input.telefone ?? "-"}
WHATSAPP: ${input.whatsapp ?? "-"}
WEBSITE: ${input.website ?? "SEM SITE"}
INSTAGRAM: ${input.instagram ? `@${input.instagram}` : "SEM INSTAGRAM"}
GOOGLE RATING: ${input.google_rating ?? "-"} (${input.google_reviews_count ?? 0} avaliações)

## Enriquecimento de site
${input.site ? `
Status: ${input.site.success ? "OK" : `Falhou (${input.site.error})`}
Páginas visitadas: ${input.site.pagesVisited.length}
Emails encontrados no site: ${siteEmails}
Pessoas detectadas no site: ${sitePessoas}
Texto sobre (resumo): ${input.site.textoSobre?.slice(0, 800) ?? "-"}
` : "Não rodou (sem website)"}

## Enriquecimento de emails (Hunter.io)
${input.hunter && input.hunter.ok ? `
Organização: ${input.hunter.organization ?? "-"}
Emails encontrados: ${hunterEmails}
` : input.hunter?.skipped ? "Hunter.io não configurado" : `Falhou: ${input.hunter?.error ?? "-"}`}

## Enriquecimento de Instagram (Apify)
${input.instagram_data && input.instagram_data.ok ? `
@${input.instagram_data.username} - ${input.instagram_data.fullName ?? "-"}
Bio: "${input.instagram_data.bio ?? "-"}"
Seguidores: ${input.instagram_data.followersCount ?? "-"} | Posts: ${input.instagram_data.postsCount ?? "-"}
Conta business: ${input.instagram_data.isBusinessAccount ? "Sim" : "Não"} | Verificada: ${input.instagram_data.isVerified ? "Sim" : "Não"}
Categoria business: ${input.instagram_data.businessCategoryName ?? "-"}
URL externa: ${input.instagram_data.externalUrl ?? "-"}
Ativo (último post < 60d): ${input.instagram_data.ativo === null ? "?" : input.instagram_data.ativo ? "Sim" : "Não - possível conta abandonada"}
Email na bio: ${input.instagram_data.emailNaBio ?? "-"}
WhatsApp na bio: ${input.instagram_data.whatsappNaBio ?? "-"}
Nome detectado na bio: ${input.instagram_data.nomeNaBio ?? "-"}
` : input.instagram_data?.skipped ? "Apify não configurado" : `Falhou: ${input.instagram_data?.error ?? "-"}`}

## Sua resposta

Responda APENAS com um JSON válido (sem markdown, sem texto antes ou depois) no formato exato:

\`\`\`
{
  "decisor_nome": "string ou null",
  "decisor_cargo": "string ou null",
  "decisor_email": "string ou null",
  "outros_decisores": [{"nome": "...", "cargo": "...", "email": "..."}],
  "score": 0-100,
  "qualificado": true|false,
  "potencial_comercial": "alto"|"medio"|"baixo",
  "observacoes_ia": "1-2 frases sobre o lead - o que tem de bom/ruim, qualificação geral",
  "diagnostico": {
    "sem_site": bool,
    "sem_instagram": bool,
    "instagram_inativo": bool,
    "site_desatualizado": bool,
    "marketing_fraco": bool,
    "sem_resposta_avaliacoes": bool,
    "poucas_avaliacoes": bool,
    "pontos_fortes": ["...", "..."],
    "pontos_fracos": ["...", "..."],
    "abordagem_sugerida": "1 frase específica"
  }
}
\`\`\`

Critérios:
- **score**: 0=lixo, 50=ok, 80+=ótimo. Considera tamanho da empresa, presença digital, oportunidade
- **qualificado**: true se a empresa tem orçamento provável + dor visível em marketing
- **potencial_comercial**: alto se múltiplos serviços vendíveis, médio se 1-2, baixo se nenhum óbvio
- Empresas grandes consolidadas (4.5+ rating, 100+ reviews, site profissional, IG ativo) = score alto MAS potencial baixo (já têm agência)
- Empresas médias com problemas (sem site OU IG abandonado OU sem responder reviews) = score alto + potencial alto
- Empresas pequenas sem nada (sem site, sem IG, < 10 reviews) = score médio + potencial alto-médio
- Sempre tenta deduzir nome do dono cruzando: emails (joao@empresa → João), pessoas detectadas no site, organização no Hunter
- Use português brasileiro nas frases
- NÃO responda com explicação adicional. SÓ o JSON.`;
}

export async function analisarLeadComIA(input: IaAnalysisInput): Promise<IaAnalysisResult> {
  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) {
    return { ok: false, skipped: true, error: "ANTHROPIC_API_KEY não configurada" };
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  try {
    const prompt = buildPrompt(input);
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    // Pega texto da resposta
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, skipped: false, error: "Resposta sem texto" };
    }
    const raw = textBlock.text.trim();

    // Tenta extrair JSON (Claude às vezes envolve em ```json...```)
    let jsonStr = raw;
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Tenta extrair primeiro { até último } como fallback
      const startIdx = raw.indexOf("{");
      const endIdx = raw.lastIndexOf("}");
      if (startIdx !== -1 && endIdx > startIdx) {
        try {
          parsed = JSON.parse(raw.slice(startIdx, endIdx + 1));
        } catch (err) {
          return { ok: false, skipped: false, error: `Resposta IA não é JSON válido: ${err instanceof Error ? err.message : "?"}` };
        }
      } else {
        return { ok: false, skipped: false, error: "Resposta IA sem JSON detectável" };
      }
    }

    // Valida shape mínima
    const p = parsed as Partial<IaAnalysisOk>;
    if (typeof p.score !== "number" || !p.diagnostico) {
      return { ok: false, skipped: false, error: "Resposta IA com shape inválida" };
    }

    return {
      ok: true,
      decisor_nome: p.decisor_nome ?? null,
      decisor_cargo: p.decisor_cargo ?? null,
      decisor_email: p.decisor_email ?? null,
      outros_decisores: Array.isArray(p.outros_decisores) ? p.outros_decisores : [],
      score: Math.max(0, Math.min(100, Math.round(p.score))),
      qualificado: !!p.qualificado,
      potencial_comercial: (["alto", "medio", "baixo"] as const).includes(p.potencial_comercial as never)
        ? (p.potencial_comercial as "alto" | "medio" | "baixo")
        : "medio",
      observacoes_ia: typeof p.observacoes_ia === "string" ? p.observacoes_ia : "",
      diagnostico: {
        sem_site: !!p.diagnostico?.sem_site,
        sem_instagram: !!p.diagnostico?.sem_instagram,
        instagram_inativo: !!p.diagnostico?.instagram_inativo,
        site_desatualizado: !!p.diagnostico?.site_desatualizado,
        marketing_fraco: !!p.diagnostico?.marketing_fraco,
        sem_resposta_avaliacoes: !!p.diagnostico?.sem_resposta_avaliacoes,
        poucas_avaliacoes: !!p.diagnostico?.poucas_avaliacoes,
        pontos_fortes: Array.isArray(p.diagnostico?.pontos_fortes) ? p.diagnostico.pontos_fortes : [],
        pontos_fracos: Array.isArray(p.diagnostico?.pontos_fracos) ? p.diagnostico.pontos_fracos : [],
        abordagem_sugerida: typeof p.diagnostico?.abordagem_sugerida === "string" ? p.diagnostico.abordagem_sugerida : "",
      },
    };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
