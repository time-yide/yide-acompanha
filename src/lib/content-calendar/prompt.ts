import "server-only";
import type { CalendarMode } from "./types";
import type { TrendSearchResult } from "./web-search";
import type { DataComemorativa } from "@/lib/nichos/schema";

export interface PromptContext {
  clientName: string;
  nicho: string;
  mesAno: string; // e.g. "outubro 2026"
  redes: string[]; // e.g. ["instagram", "facebook"]
  tomVoz: string;
  mood: string;
  evitar: string;
  datasComem: DataComemorativa[];
  tendencias: TrendSearchResult[];
  modo: CalendarMode;
}

export function buildSystemPrompt(ctx: PromptContext): string {
  return `Você é um estrategista de conteúdo digital especializado em marketing para redes sociais no Brasil.

Sua tarefa: criar um cronograma de conteúdo para o mês de ${ctx.mesAno} para o cliente "${ctx.clientName}" do nicho "${ctx.nicho}".

Regras gerais:
- Todos os textos devem ser em português brasileiro.
- Use linguagem ${ctx.tomVoz || "profissional e engajadora"}.
- O mood/estilo visual é: ${ctx.mood || "moderno e limpo"}.
- EVITE: ${ctx.evitar || "nada específico informado"}.
- As redes sociais ativas são: ${ctx.redes.join(", ") || "Instagram"}.
- Distribua os posts ao longo do mês, evitando mais de 1 post por dia.
- Cada post deve ter uma data_sugerida no formato YYYY-MM-DD dentro do mês alvo.

Retorne SOMENTE um JSON válido (array de objetos), sem markdown, sem explicação.`;
}

export function buildUserPrompt(ctx: PromptContext): string {
  const datasStr =
    ctx.datasComem.length > 0
      ? ctx.datasComem.map((d) => `- ${d.data}: ${d.nome}`).join("\n")
      : "Nenhuma data comemorativa cadastrada para este mês.";

  const tendenciasStr =
    ctx.tendencias.length > 0
      ? ctx.tendencias
          .map(
            (t) =>
              `Busca: "${t.query}"\n${t.results.map((r) => `  - ${r.title}: ${r.snippet}`).join("\n")}`,
          )
          .join("\n\n")
      : "Nenhuma pesquisa de tendências disponível.";

  if (ctx.modo === "completo") {
    return `Gere um cronograma COMPLETO com exatamente 12 posts para ${ctx.mesAno}:
- 8 posts de vídeo (tipo: "video")
- 4 posts de imagem ou carrossel (tipo: "imagem" ou "carrossel")

Para CADA post, retorne um objeto com:
{
  "ordem": number (1-12),
  "tema": string (título curto do conteúdo),
  "data_sugerida": "YYYY-MM-DD",
  "tipo": "video" | "imagem" | "carrossel",
  "legenda": string (texto completo para a legenda do post),
  "hashtags": string[] (10-15 hashtags relevantes),
  "primeiro_comentario": string (comentário para engajamento),
  "roteiro": string (roteiro detalhado, APENAS para tipo "video"),
  "material_estudo": string (referências ou materiais para produção),
  "tendencia_fonte": string (fonte da tendência se aplicável, ou null)
}

Datas comemorativas do nicho neste mês:
${datasStr}

Tendências encontradas:
${tendenciasStr}

Retorne o JSON array diretamente, sem marcadores de código.`;
  }

  // modo leve
  return `Gere um cronograma LEVE com 9 itens para ${ctx.mesAno}:
- 8 roteiros de vídeo (tipo: "video") — apenas tema, data e roteiro
- 1 item de estratégia do mês (tipo: "video", ordem 9) com campo "estrategia_mes"

Para cada roteiro de vídeo:
{
  "ordem": number (1-8),
  "tema": string (título curto),
  "data_sugerida": "YYYY-MM-DD",
  "tipo": "video",
  "roteiro": string (roteiro detalhado para gravação),
  "material_estudo": string (referências),
  "tendencia_fonte": string | null
}

Para o item de estratégia (ordem 9):
{
  "ordem": 9,
  "tema": "Estratégia do Mês",
  "data_sugerida": "YYYY-MM-01",
  "tipo": "video",
  "estrategia_mes": string (resumo da estratégia de conteúdo do mês)
}

NÃO inclua legenda, hashtags ou primeiro_comentario no modo leve.

Datas comemorativas do nicho neste mês:
${datasStr}

Tendências encontradas:
${tendenciasStr}

Retorne o JSON array diretamente, sem marcadores de código.`;
}
