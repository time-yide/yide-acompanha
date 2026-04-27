// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

const WINDOWS = [45, 15, 5];

export async function detectRenovacoes(counters: { renovacao_contrato: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const today = new Date();

  for (const days of WINDOWS) {
    const target = new Date(today);
    target.setDate(target.getDate() + days);
    const targetIso = target.toISOString().slice(0, 10);

    const { data } = await supabase
      .from("client_important_dates")
      .select("id, descricao, data, client_id, tipo, cliente:clients(nome, assessor_id, coordenador_id)")
      .eq("tipo", "renovacao")
      .eq("data", targetIso);

    for (const d of (data ?? []) as Array<{
      id: string;
      descricao: string | null;
      data: string;
      client_id: string;
      cliente: { nome: string; assessor_id: string | null; coordenador_id: string | null } | null;
    }>) {
      const recipients: string[] = [];
      if (d.cliente?.assessor_id) recipients.push(d.cliente.assessor_id);
      if (d.cliente?.coordenador_id) recipients.push(d.cliente.coordenador_id);
      if (recipients.length === 0) continue;

      await dispatchNotification({
        evento_tipo: "renovacao_contrato",
        titulo: `Renovação em ${days} dias`,
        mensagem: `${d.cliente?.nome ?? "Cliente"} — ${d.descricao ?? "renovação de contrato"}`,
        link: `/clientes/${d.client_id}`,
        user_ids_extras: recipients,
      });
      counters.renovacao_contrato++;
    }
  }
}
