import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";

export async function sendFollowupGravacao(
  clientId: string,
  qtdVideos: number,
  qtdFotos: number,
  dataCaptacao: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: client } = await sb
    .from("clients")
    .select("nome, grupo_wpp_jid")
    .eq("id", clientId)
    .maybeSingle();

  if (!client?.grupo_wpp_jid) return;

  const dataBr = new Date(dataCaptacao + "T12:00:00Z").toLocaleDateString(
    "pt-BR",
  );

  const lines: string[] = [
    `🎬 *Gravação realizada!*`,
    ``,
    `Olá! A gravação do dia *${dataBr}* para *${client.nome}* foi concluída com sucesso!`,
    ``,
  ];

  if (qtdVideos > 0 || qtdFotos > 0) {
    const partes: string[] = [];
    if (qtdVideos > 0) partes.push(`📹 ${qtdVideos} vídeo(s)`);
    if (qtdFotos > 0) partes.push(`📷 ${qtdFotos} foto(s)`);
    lines.push(partes.join(" · "));
    lines.push(``);
  }

  lines.push(
    `Em breve os materiais editados serão entregues. Qualquer dúvida, estamos à disposição! 🚀`,
  );

  const message = lines.join("\n");

  const result = await sendWhatsAppGroupMessage(
    client.grupo_wpp_jid,
    message,
  );
  if (!result.success) {
    console.error(
      `[followup-gravacao] Falha ao enviar para grupo ${client.grupo_wpp_jid}:`,
      result.error,
    );
  }
}
