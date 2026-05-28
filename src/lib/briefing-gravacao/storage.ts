// src/lib/briefing-gravacao/storage.ts
//
// SERVER-ONLY. Helpers de upload/leitura/delete do PDF do roteiro no
// bucket privado 'roteiros'. Path: eventos/<eventId>/<uuid>.pdf

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const ROTEIROS_BUCKET = "roteiros";
export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_MIME = "application/pdf";

/** Validação shared por server action E pelo upload direto via storage. */
export function validatePdfFile(file: { size: number; type: string }): {
  ok: boolean;
  erro?: string;
} {
  if (file.type !== ALLOWED_MIME) {
    return { ok: false, erro: "Tipo invalido. Envie um PDF." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, erro: "Arquivo maior que 10MB." };
  }
  return { ok: true };
}

/**
 * Upload do PDF do roteiro. Retorna o storage path salvo (use em
 * calendar_events.roteiro_pdf_path).
 */
export async function uploadRoteiroPdf(params: {
  eventoId: string;
  file: ArrayBuffer;
  contentType: string;
}): Promise<{ path: string } | { erro: string }> {
  const validation = validatePdfFile({
    size: params.file.byteLength,
    type: params.contentType,
  });
  if (!validation.ok) return { erro: validation.erro! };

  const supabase = createServiceRoleClient();
  const path = `eventos/${params.eventoId}/${crypto.randomUUID()}.pdf`;

  const { error } = await supabase.storage
    .from(ROTEIROS_BUCKET)
    .upload(path, params.file, {
      contentType: params.contentType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) return { erro: `Falha no upload: ${error.message}` };
  return { path };
}

/** Signed URL pra download/abertura do PDF — TTL curto (15min). */
export async function getRoteiroSignedUrl(
  path: string,
): Promise<{ url: string } | { erro: string }> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(ROTEIROS_BUCKET)
    .createSignedUrl(path, 15 * 60);
  if (error || !data) return { erro: error?.message ?? "Sem URL" };
  return { url: data.signedUrl };
}

/** Remove um PDF do storage (chamado ao trocar de link/pdf ou apagar evento). */
export async function deleteRoteiroPdf(path: string): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase.storage.from(ROTEIROS_BUCKET).remove([path]);
}
