import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

export async function detectGravacaoNaoAlinhada(counters: {
  gravacao_pendente: number;
}): Promise<void> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  const { data: pendentes } = await sbAny
    .from("recording_scheduling_alerts")
    .select("id, client_id, clients!inner(nome, assessor_id)")
    .eq("status", "pendente")
    .lt("created_at", fiveDaysAgo.toISOString());

  for (const p of pendentes ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = p.clients as any;
    if (!client?.assessor_id) continue;
    await dispatchNotification({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      evento_tipo: "gravacao_pendente_lembrete" as any,
      titulo: "Gravacao pendente",
      mensagem: `Gravacao de ${client.nome} aguardando alinhamento ha mais de 5 dias`,
      link: "/audiovisual/pendencias-gravacao",
      user_ids_extras: [client.assessor_id],
    });
    counters.gravacao_pendente++;
  }

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data: alinhados } = await sbAny
    .from("recording_scheduling_alerts")
    .select("id, client_id, clients!inner(nome)")
    .eq("status", "alinhado_cliente")
    .lt("updated_at", threeDaysAgo.toISOString());

  for (const a of alinhados ?? []) {
    await dispatchNotification({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      evento_tipo: "gravacao_pendente_lembrete" as any,
      titulo: "Delegacao pendente",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mensagem: `Gravacao de ${(a.clients as any).nome} alinhada mas sem videomaker ha mais de 3 dias`,
      link: "/audiovisual/pendencias-gravacao",
    });
    counters.gravacao_pendente++;
  }
}
