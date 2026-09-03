import "server-only";
import { getAnthropicClient } from "@/lib/ai/client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getNichoByClientId } from "@/lib/nichos/queries";
import { searchTrends } from "./web-search";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import type { GeneratedPost, CalendarMode } from "./types";
import type { DataComemorativa } from "@/lib/nichos/schema";
import type { PromptContext } from "./prompt";

const MODEL = "claude-sonnet-4-5-20250514";

/**
 * Gera o cronograma de conteúdo de um cliente para o mês referência.
 * Retorna os posts gerados e a pesquisa de tendências usada.
 */
export async function generateCalendar(
  calendarId: string,
  clientId: string,
  mesReferencia: string,
  modo: CalendarMode,
): Promise<{ posts: GeneratedPost[]; tendencias: unknown }> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  // 1. Carregar dados do cliente
  const { data: client, error: clientErr } = await sbAny
    .from("clients")
    .select(
      "nome, tipo_pacote, design_style_guide, instagram_business_id, facebook_page_id",
    )
    .eq("id", clientId)
    .single();
  if (clientErr || !client) {
    throw new Error(`Cliente não encontrado: ${clientId}`);
  }

  // 2. Carregar nicho
  const nicho = await getNichoByClientId(clientId);
  if (!nicho) {
    throw new Error(`Nicho não configurado para cliente ${clientId}`);
  }

  // 3. Filtrar datas comemorativas para o mês alvo
  // mesReferencia = "2026-10", datas no nicho = "MM-DD"
  const [year, monthStr] = mesReferencia.split("-");
  const targetMonth = monthStr.padStart(2, "0");
  const datasDoMes: DataComemorativa[] = (nicho.datas_comemorativas ?? []).filter(
    (d) => d.data.startsWith(targetMonth + "-"),
  );

  // 4. Montar nome do mês em português
  const mesesPt = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const mesAno = `${mesesPt[parseInt(targetMonth, 10) - 1]} ${year}`;

  // 5. Redes conectadas
  const redes: string[] = [];
  if (client.instagram_business_id) redes.push("instagram");
  if (client.facebook_page_id) redes.push("facebook");
  if (redes.length === 0) redes.push("instagram"); // fallback

  // 6. Extrair style guide
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sg = (client.design_style_guide ?? {}) as any;
  const tomVoz = typeof sg.tom_voz === "string" ? sg.tom_voz : "";
  const mood = typeof sg.mood === "string" ? sg.mood : "";
  const evitar = typeof sg.evitar === "string" ? sg.evitar : "";

  // 7. Pesquisa de tendências
  const tendencias = await searchTrends(
    nicho.palavras_chave ?? [],
    mesAno,
    nicho.nome,
  );

  // 8. Salvar pesquisa de tendências no registro
  await sbAny
    .from("content_calendars")
    .update({
      pesquisa_tendencias: tendencias,
      updated_at: new Date().toISOString(),
    })
    .eq("id", calendarId);

  // 9. Montar prompt e chamar Claude
  const ctx: PromptContext = {
    clientName: client.nome,
    nicho: nicho.nome,
    mesAno,
    redes,
    tomVoz,
    mood,
    evitar,
    datasComem: datasDoMes,
    tendencias,
    modo,
  };

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: buildSystemPrompt(ctx),
    messages: [{ role: "user", content: buildUserPrompt(ctx) }],
  });

  // 10. Extrair texto da resposta
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Resposta da IA não contém texto");
  }

  // 11. Parse JSON — limpa possíveis marcadores de código
  let rawJson = textBlock.text.trim();
  if (rawJson.startsWith("```")) {
    rawJson = rawJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let posts: GeneratedPost[];
  try {
    posts = JSON.parse(rawJson) as GeneratedPost[];
  } catch {
    throw new Error(
      `Falha ao parsear JSON da IA: ${rawJson.slice(0, 200)}...`,
    );
  }

  if (!Array.isArray(posts) || posts.length === 0) {
    throw new Error("IA retornou array vazio ou formato inválido");
  }

  return { posts, tendencias };
}

/**
 * Regenera um único post no cronograma (mantém contexto do cronograma existente).
 */
export async function regenerateSinglePost(
  calendarId: string,
  postIndex: number,
  currentPosts: GeneratedPost[],
  clientId: string,
  mesReferencia: string,
  modo: CalendarMode,
): Promise<GeneratedPost> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }

  const nicho = await getNichoByClientId(clientId);
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const { data: client } = await sbAny
    .from("clients")
    .select("nome, design_style_guide, instagram_business_id, facebook_page_id")
    .eq("id", clientId)
    .single();

  const [year, monthStr] = mesReferencia.split("-");
  const mesesPt = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const mesAno = `${mesesPt[parseInt(monthStr, 10) - 1]} ${year}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sg = (client?.design_style_guide ?? {}) as any;

  const postAtual = currentPosts[postIndex];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: `Você é um estrategista de conteúdo digital. Regenere UM post de cronograma de redes sociais.
Cliente: ${client?.nome ?? ""}. Nicho: ${nicho?.nome ?? ""}. Mês: ${mesAno}.
Tom de voz: ${sg.tom_voz ?? ""}. Mood: ${sg.mood ?? ""}.
Evitar: ${sg.evitar ?? ""}.
Retorne SOMENTE um objeto JSON (não array), com os mesmos campos do post original.`,
    messages: [
      {
        role: "user",
        content: `O post atual (ordem ${postAtual.ordem}) precisa ser regenerado. Tipo: ${postAtual.tipo}.
Tema anterior: "${postAtual.tema}" — crie algo diferente mas adequado ao mesmo slot.
Modo: ${modo}.

Contexto dos outros posts do mês (para não repetir temas):
${currentPosts
  .filter((_, i) => i !== postIndex)
  .map((p) => `- Ordem ${p.ordem}: ${p.tema} (${p.tipo})`)
  .join("\n")}

Retorne o objeto JSON diretamente, sem marcadores de código.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Resposta da IA não contém texto");
  }

  let rawJson = textBlock.text.trim();
  if (rawJson.startsWith("```")) {
    rawJson = rawJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const newPost = JSON.parse(rawJson) as GeneratedPost;
  newPost.ordem = postAtual.ordem;
  return newPost;
}
