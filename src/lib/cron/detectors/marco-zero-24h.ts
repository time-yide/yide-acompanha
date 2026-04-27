// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

export async function detectMarcosZero24h(counters: { marco_zero_24h: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const tomorrowStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const { data } = await supabase
    .from("leads")
    .select("id, nome_prospect, data_reuniao_marco_zero, comercial_id, coord_alocado_id, assessor_alocado_id")
    .gte("data_reuniao_marco_zero", tomorrowStart.toISOString())
    .lt("data_reuniao_marco_zero", tomorrowEnd.toISOString())
    .neq("stage", "ativo");

  for (const l of (data ?? []) as Array<{
    id: string;
    nome_prospect: string;
    data_reuniao_marco_zero: string;
    comercial_id: string | null;
    coord_alocado_id: string | null;
    assessor_alocado_id: string | null;
  }>) {
    const recipients: string[] = [];
    if (l.comercial_id) recipients.push(l.comercial_id);
    if (l.coord_alocado_id) recipients.push(l.coord_alocado_id);
    if (l.assessor_alocado_id) recipients.push(l.assessor_alocado_id);
    if (recipients.length === 0) continue;

    await dispatchNotification({
      evento_tipo: "marco_zero_24h",
      titulo: "Marco Zero amanhã",
      mensagem: `Reunião de marco zero com ${l.nome_prospect}`,
      link: `/onboarding/${l.id}`,
      user_ids_extras: recipients,
    });
    counters.marco_zero_24h++;
  }
}
