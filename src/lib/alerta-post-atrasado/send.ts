import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";
import { getTodayDate, formatDateBR } from "@/lib/datetime/timezone";

export async function sendAlertaPostAtrasado(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient();
  const today = getTodayDate();

  const { data: posts } = await sb
    .from("social_media_posts")
    .select("id, titulo, agendar_para, client_id, clients(nome, assessor_id)")
    .lt("agendar_para", today)
    .not("status", "in", '("publicado","rascunho")')
    .is("archived_at", null)
    .not("agendar_para", "is", null);

  if (!posts || posts.length === 0) return { sent: 0, skipped: 0 };

  type PostRow = { id: string; titulo: string | null; agendar_para: string; clients: { nome: string; assessor_id: string | null } | null };
  const rows = posts as PostRow[];

  const byAssessor = new Map<string, Array<{ titulo: string | null; clientNome: string; agendar_para: string }>>();

  for (const p of rows) {
    const assessorId = p.clients?.assessor_id;
    if (!assessorId) continue;
    const list = byAssessor.get(assessorId) ?? [];
    list.push({
      titulo: p.titulo,
      clientNome: p.clients?.nome ?? "Cliente",
      agendar_para: p.agendar_para,
    });
    byAssessor.set(assessorId, list);
  }

  if (byAssessor.size === 0) return { sent: 0, skipped: 0 };

  const assessorIds = [...byAssessor.keys()];
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, nome, telefone")
    .in("id", assessorIds);

  interface Profile { id: string; nome: string; telefone: string | null }
  const profileMap = new Map<string, Profile>();
  for (const p of (profiles ?? []) as Profile[]) {
    profileMap.set(p.id, p);
  }

  let sent = 0;
  let skipped = 0;

  for (const [assessorId, postList] of byAssessor) {
    const profile = profileMap.get(assessorId);
    if (!profile?.telefone) {
      skipped++;
      continue;
    }

    const lines = [
      `⚠️ *Posts atrasados!*`,
      ``,
      `${profile.nome?.split(" ")[0] ?? ""}, você tem *${postList.length}* post(s) que deveriam ter sido publicados:`,
      ``,
    ];

    for (const p of postList) {
      lines.push(`• *${p.clientNome}* — ${p.titulo ?? "sem título"} (era pra ${formatDateBR(p.agendar_para)})`);
    }

    lines.push(``);
    lines.push(`Verifique no sistema! 📱`);

    const result = await sendWhatsAppMessage(profile.telefone, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}
