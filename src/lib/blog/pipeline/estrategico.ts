// Gerador de conteúdo ESTRATÉGICO (GEO/EEAT) — artigos aprofundados no formato
// pergunta-resposta. `montarPromptEstrategico` e `parseArtigoEstrategico` são
// PUROS (testáveis); `gerarArtigoEstrategico` é server (chama Claude).
import { getAnthropicClient } from "@/lib/ai/client";
import { extrairJson } from "./gerar";
import { semTravessao } from "../texto";
import type { FaqItem } from "../queries";

const BLOG_MODEL = "claude-haiku-4-5";

export interface ArtigoEstrategico {
  titulo: string;
  resumo: string;
  conteudo_md: string;
  keywords: string[];
  meta_title: string;
  meta_description: string;
  faq: FaqItem[];
}

/**
 * PURA. Monta o prompt do editor-chefe. Persona + regras de EEAT honesto, GEO,
 * links internos, SEO local natural e saída JSON estrita (FAQ separada).
 */
export function montarPromptEstrategico(tema: string, keywordsAlvo: string[] = []): string {
  const alvoTxt = keywordsAlvo.length
    ? `\n\nSEO LOCAL: a Yide atua com marketing e programação. Trabalhe estas expressões de forma NATURAL no texto (sem keyword stuffing, que o Google penaliza) e inclua as mais relevantes nas meta tags. Use só as que couberem com naturalidade:\n- ${keywordsAlvo.join("\n- ")}`
    : "";

  return `Você é o editor-chefe de um portal de negócios voltado a pequenas e médias empresas brasileiras. Seu público são donos de PMEs (que faturam de R$ 50 mil a R$ 10 milhões por ano) buscando conteúdo prático que os ajude a crescer. Escreva um artigo aprofundado que responda a esta pergunta:

PERGUNTA (tema do artigo): ${tema}

ESTILO (Forbes / Exame / HBR): storytelling + estratégia + exemplos concretos. Linguagem simples e direta, sem jargão desnecessário. Sempre explique o PORQUÊ de cada recomendação. Nunca encha linguiça: cada parágrafo precisa entregar valor.

ESTRUTURA:
- Título forte (a própria pergunta ou uma variação chamativa dela).
- Introdução que desperta curiosidade e mostra por que o tema importa.
- Contexto do problema.
- Explicação profunda do assunto.
- Exemplos ILUSTRATIVOS e genéricos (nunca invente nomes de clientes ou empresas reais).
- Passo a passo prático.
- Erros comuns a evitar.
- O que fazer na prática.
- Uma tabela em markdown quando ajudar a comparar opções.
- Conclusão que resume e orienta o próximo passo.

EEAT HONESTO: escreva com a autoridade da Yide (agência de marketing e programação em Cuiabá, Mato Grosso), SEM inventar cifras específicas ("R$ X mil de faturamento", "aumentou 300% as vendas"), SEM inventar nomes de clientes e SEM inventar resultados numéricos precisos. Use exemplos genéricos e ilustrativos. Prefira faixas e princípios a números falsos.

GEO (otimização para respostas de IA/buscadores): seja objetivo, use listas, definições claras, comparações e passo a passo. Responda a pergunta de forma direta logo no começo e detalhe depois.

LINKS INTERNOS: quando fizer sentido no fluxo do texto, insira links markdown para os serviços da Yide (sem forçar): [gestão de tráfego](/servicos/gestao-de-trafego), [criação de sites](/servicos/criacao-de-sites), [redes sociais](/servicos/redes-sociais), [CRM, IA e dados](/servicos/crm-ia-dados), [audiovisual](/servicos/audiovisual).${alvoTxt}

REGRA DE PONTUAÇÃO: NUNCA use travessão nem meia-risca ("—" ou "–") em nenhum lugar (título, resumo, corpo, meta tags, FAQ). No lugar, use vírgula, dois-pontos, ponto ou parênteses.

TAMANHO: entre 2.000 e 3.500 palavras no corpo. NÃO inclua a seção de FAQ dentro de "conteudo_md" (ela vai no campo "faq" separado).

Responda SOMENTE com um JSON válido (sem cercas de código, sem texto fora do JSON):
{"titulo": "título forte em pt-br", "resumo": "1-2 frases de resumo", "conteudo_md": "artigo em markdown com subtítulos usando ##, 2000 a 3500 palavras, SEM a FAQ", "keywords": ["4 a 8 palavras-chave em pt-br, incluindo as expressões de SEO local usadas"], "meta_title": "título SEO até 60 caracteres", "meta_description": "descrição SEO até 155 caracteres", "faq": [{"pergunta": "pergunta relacionada ao tema", "resposta": "resposta objetiva"}]}

A FAQ deve ter de 3 a 8 itens, com perguntas que o público realmente faria sobre o tema.`;
}

/**
 * PURA. Valida e sanitiza a saída da IA. Retorna `ArtigoEstrategico` ou null se
 * faltar título/conteúdo. Remove travessão de tudo, limita keywords/faq a 8.
 */
export function parseArtigoEstrategico(json: Record<string, unknown> | null): ArtigoEstrategico | null {
  if (!json || typeof json.titulo !== "string" || typeof json.conteudo_md !== "string") return null;
  const titulo = semTravessao(String(json.titulo).trim());
  const conteudo_md = semTravessao(String(json.conteudo_md).trim());
  if (!titulo || !conteudo_md) return null;

  const faq: FaqItem[] = Array.isArray(json.faq)
    ? (json.faq as unknown[])
        .map((raw) => {
          const item = (raw ?? {}) as { pergunta?: unknown; resposta?: unknown };
          return {
            pergunta: item.pergunta != null ? semTravessao(String(item.pergunta).trim()) : "",
            resposta: item.resposta != null ? semTravessao(String(item.resposta).trim()) : "",
          };
        })
        .filter((f) => f.pergunta && f.resposta)
        .slice(0, 8)
    : [];

  return {
    titulo,
    resumo: json.resumo != null ? semTravessao(String(json.resumo).trim()) : "",
    conteudo_md,
    keywords: Array.isArray(json.keywords)
      ? json.keywords.map((k) => semTravessao(String(k).trim())).filter(Boolean).slice(0, 8)
      : [],
    meta_title: json.meta_title != null ? semTravessao(String(json.meta_title).trim()).slice(0, 70) : titulo.slice(0, 70),
    meta_description: json.meta_description != null ? semTravessao(String(json.meta_description).trim()).slice(0, 160) : "",
    faq,
  };
}

/** SERVER. Gera um artigo estratégico a partir de um tema (pergunta). */
export async function gerarArtigoEstrategico(tema: string, keywordsAlvo: string[] = []): Promise<ArtigoEstrategico | null> {
  const client = getAnthropicClient();
  if (!client) { console.error("[blog-estrategico] Anthropic não configurado"); return null; }

  const prompt = montarPromptEstrategico(tema, keywordsAlvo);
  try {
    const res = await client.messages.create({
      model: BLOG_MODEL,
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });
    const txt = res.content.map((c) => ("text" in c ? c.text : "")).join("").trim();
    return parseArtigoEstrategico(extrairJson(txt));
  } catch (e) {
    console.error("[blog-estrategico] gerarArtigoEstrategico:", e);
    return null;
  }
}
