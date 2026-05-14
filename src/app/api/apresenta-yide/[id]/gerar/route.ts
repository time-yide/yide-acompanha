import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAnthropicClient } from "@/lib/ai/client";
import { APRESENTACAO_SYSTEM, buildApresentacaoPrompt } from "@/lib/apresenta-yide/prompt";
import { LineDelimitedSlideParser } from "@/lib/apresenta-yide/stream-parser";
import { logAudit } from "@/lib/audit/log";
import type { Slide } from "@/lib/apresenta-yide/tipos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";

/**
 * POST /api/apresenta-yide/[id]/gerar
 *
 * Stream NDJSON. Cada linha é um evento JSON:
 *   { type: "slide", slide: Slide }
 *   { type: "done", status: "pronta" }
 *   { type: "error", message: string }
 *
 * Idempotente em status='pronta' (retorna done direto sem chamar Claude).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await requireAuth();

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: row } = await sb
    .from("apresentacoes_yide")
    .select("id, prompt, objetivo, num_slides_alvo, status, criado_por")
    .eq("id", id)
    .single();
  if (!row) {
    return NextResponse.json({ error: "Apresentação não encontrada" }, { status: 404 });
  }

  const isPriv = actor.role === "adm" || actor.role === "socio";
  if (row.criado_por !== actor.id && !isPriv) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Idempotência: se já tá pronta, responde com done direto.
  if (row.status === "pronta") {
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: "done", status: "pronta" }) + "\n"));
          controller.close();
        },
      }),
      { headers: { "Content-Type": "application/x-ndjson" } },
    );
  }

  const client = getAnthropicClient();
  if (!client) {
    await sb.from("apresentacoes_yide").update({ status: "erro" }).eq("id", id);
    return NextResponse.json({ error: "Claude não configurado no servidor" }, { status: 503 });
  }

  const userPrompt = buildApresentacaoPrompt({
    prompt: row.prompt,
    objetivo: row.objetivo,
    numSlides: row.num_slides_alvo,
  });

  const encoder = new TextEncoder();
  const parser = new LineDelimitedSlideParser();
  const collected: Slide[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: object) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }

      async function persistSlides(slides: Slide[], finalStatus: "gerando" | "pronta" | "erro") {
        await sb
          .from("apresentacoes_yide")
          .update({ slides, status: finalStatus })
          .eq("id", id);
      }

      try {
        const claudeStream = client.messages.stream({
          model: MODEL,
          max_tokens: 8192,
          system: APRESENTACAO_SYSTEM,
          messages: [{ role: "user", content: userPrompt }],
        });

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const newSlides = parser.feed(event.delta.text);
            for (const slide of newSlides) {
              collected.push(slide);
              emit({ type: "slide", slide });
              // Persiste no DB a cada slide pra robustez se conexão cair.
              await persistSlides(collected, "gerando");
            }
          }
        }

        const final = parser.flush();
        for (const slide of final) {
          collected.push(slide);
          emit({ type: "slide", slide });
        }

        await persistSlides(collected, "pronta");
        emit({ type: "done", status: "pronta" });

        await logAudit({
          entidade: "apresentacoes_yide",
          entidade_id: id,
          acao: "update",
          dados_depois: { slides_gerados: collected.length, status: "pronta" },
          ator_id: actor.id,
          justificativa: "Streaming Claude concluído",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Falha desconhecida";
        await persistSlides(collected, "erro");
        emit({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
