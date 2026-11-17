import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAnthropicClient } from "@/lib/ai/client";
import { gerarImagemOpenAI, editarImagemOpenAI } from "@/lib/ai/image-gen/openai";
import { sizeParaFormato, formatoLabel } from "@/lib/ai/image-gen/tipos";
import { getCanvaAccessToken, uploadAssetBuffer, pollAssetUpload, moveToFolder } from "./client";
import { ensureCanvaFolder } from "./ensure-folder";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

interface DesignTaskContext {
  taskId: string;
  clientId: string;
  organizationId: string;
  titulo: string;
  descricao: string;
  formato?: string;
}

async function fetchClientPhoto(sb: SB, clientId: string): Promise<Buffer | null> {
  const { data: files } = await sb
    .from("client_files")
    .select("storage_path, mime_type")
    .eq("client_id", clientId)
    .like("mime_type", "image/%")
    .order("created_at", { ascending: false })
    .limit(5);

  if (!files || files.length === 0) return null;

  const criativo = files.find((f: { storage_path: string }) =>
    !f.storage_path.includes("contrato") && !f.storage_path.includes("briefing"),
  );
  const file = criativo ?? files[0];

  try {
    const { data, error } = await sb.storage
      .from("client-files")
      .download(file.storage_path);
    if (error || !data) return null;
    const ab = await data.arrayBuffer();
    if (ab.byteLength > 20 * 1024 * 1024) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

export async function generateDesignForTask(ctx: DesignTaskContext): Promise<{
  imageUrl: string | null;
  canvaAssetId: string | null;
  canvaError: string | null;
  error: string | null;
}> {
  const sb = createServiceRoleClient() as SB;

  const { data: client } = await sb
    .from("clients")
    .select("nome, design_style_guide, canva_folder_id, nicho_id")
    .eq("id", ctx.clientId)
    .single();

  if (!client) return { imageUrl: null, canvaAssetId: null, canvaError: null, error: "Cliente não encontrado" };

  let canvaFolderId = client.canva_folder_id as string | null;
  if (!canvaFolderId) {
    canvaFolderId = await ensureCanvaFolder(ctx.clientId, client.nome, ctx.organizationId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sg = (client.design_style_guide ?? {}) as any;
  const fmt = ctx.formato || "feed";

  const [prompt, clientPhoto] = await Promise.all([
    buildImagePrompt(ctx.titulo, ctx.descricao, {
      clientName: client.nome,
      tomVoz: sg.tom_voz ?? "",
      mood: sg.mood ?? "",
      evitar: sg.evitar ?? "",
      coresPrimarias: sg.cores_primarias ?? "",
      coresSecundarias: sg.cores_secundarias ?? "",
      fontes: sg.fontes ?? "",
      observacoes: sg.observacoes ?? "",
      formato: fmt,
      hasRealPhoto: true,
    }),
    fetchClientPhoto(sb, ctx.clientId),
  ]);

  if (!prompt) return { imageUrl: null, canvaAssetId: null, canvaError: null, error: "Falha ao gerar prompt de imagem" };

  const size = sizeParaFormato(fmt);

  const imgResult = clientPhoto
    ? await editarImagemOpenAI({ imageBuffer: clientPhoto, prompt, size, quality: "medium" })
    : await gerarImagemOpenAI({ prompt, size, quality: "medium" });

  if (!imgResult.ok || !imgResult.b64) {
    if (clientPhoto) {
      const fallback = await gerarImagemOpenAI({ prompt, size, quality: "medium" });
      if (!fallback.ok || !fallback.b64) {
        return { imageUrl: null, canvaAssetId: null, canvaError: null, error: fallback.error ?? "Falha ao gerar imagem" };
      }
      return finishDesign(sb, ctx, canvaFolderId, fallback.b64);
    }
    return { imageUrl: null, canvaAssetId: null, canvaError: null, error: imgResult.error ?? "Falha ao gerar imagem" };
  }

  return finishDesign(sb, ctx, canvaFolderId, imgResult.b64);
}

async function finishDesign(
  sb: SB,
  ctx: DesignTaskContext,
  canvaFolderId: string | null,
  b64: string,
): Promise<{ imageUrl: string | null; canvaAssetId: string | null; canvaError: string | null; error: string | null }> {
  const imageBuffer = Buffer.from(b64, "base64");
  const storagePath = `design-auto/${ctx.taskId}.png`;
  await sb.storage.from("task-attachments").upload(storagePath, imageBuffer, {
    contentType: "image/png",
    upsert: true,
  });

  const { data: urlData } = sb.storage.from("task-attachments").getPublicUrl(storagePath);
  const imageUrl = urlData?.publicUrl ?? null;

  let canvaAssetId: string | null = null;
  let canvaError: string | null = null;

  try {
    const accessToken = await getCanvaAccessToken(ctx.organizationId);
    if (!accessToken) {
      canvaError = "Canva não conectado";
    } else {
      const { jobId } = await uploadAssetBuffer(accessToken, ctx.titulo, imageBuffer);
      const result = await pollAssetUpload(accessToken, jobId);
      if (!result) {
        canvaError = "Upload pro Canva falhou (timeout ou erro de processamento)";
      } else {
        canvaAssetId = result.assetId;
        if (canvaFolderId) {
          const moved = await moveToFolder(accessToken, result.assetId, canvaFolderId);
          if (!moved) {
            canvaError = "Arte no Canva mas não conseguiu mover pra pasta do cliente";
          }
        }
      }
    }
  } catch (err) {
    canvaError = err instanceof Error ? err.message : String(err);
    console.error("[auto-design] Canva upload failed:", canvaError);
  }

  if (imageUrl) {
    await sb
      .from("tasks")
      .update({
        attachment_urls: [imageUrl],
        updated_at: new Date().toISOString(),
      })
      .eq("id", ctx.taskId);
  }

  return { imageUrl, canvaAssetId, canvaError, error: null };
}

async function buildImagePrompt(
  titulo: string,
  descricao: string,
  style: {
    clientName: string;
    tomVoz: string;
    mood: string;
    evitar: string;
    coresPrimarias: string;
    coresSecundarias: string;
    fontes: string;
    observacoes: string;
    formato: string;
    hasRealPhoto: boolean;
  },
): Promise<string | null> {
  const anthropic = getAnthropicClient();
  if (!anthropic) return null;

  const tema = descricao.split("\n")[0]?.replace("Tema: ", "") || titulo;
  const fmtLabel = formatoLabel(style.formato);

  const brandLines: string[] = [];
  if (style.coresPrimarias) brandLines.push(`Cores primárias da marca: ${style.coresPrimarias}`);
  if (style.coresSecundarias) brandLines.push(`Cores secundárias: ${style.coresSecundarias}`);
  if (style.fontes) brandLines.push(`Fontes: ${style.fontes}`);
  if (style.observacoes) brandLines.push(`Observações da marca: ${style.observacoes}`);
  const brandBlock = brandLines.length > 0 ? `\nIdentidade visual:\n${brandLines.join("\n")}` : "";

  const photoNote = style.hasRealPhoto
    ? "\n- A imagem será aplicada sobre uma foto real do cliente — descreva como estilizar/transformar a foto em um visual de post profissional"
    : "";

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `Gere um prompt CURTO (máx 200 palavras) para criar uma imagem de ${style.formato === "feed" ? "post de Instagram" : style.formato}.

Cliente: ${style.clientName}
Tema: ${tema}
Estilo visual: ${style.mood || "moderno e profissional"}
Tom: ${style.tomVoz || "profissional"}
Evitar: ${style.evitar || "nada específico"}${brandBlock}

Regras:
- NÃO inclua texto escrito na imagem (o texto será adicionado no Canva depois)
- Foque em imagem de fundo/visual atraente que combine com o tema
- Use as cores da marca do cliente como paleta dominante
- Seja específico sobre cores, composição e elementos visuais
- Formato: ${fmtLabel}${photoNote}

Retorne APENAS o prompt, sem explicação.`,
      },
    ],
  });

  const text = res.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text.trim() : null;
}
