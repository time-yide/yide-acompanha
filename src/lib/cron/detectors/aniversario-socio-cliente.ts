// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { getDatePartsInAppTz } from "@/lib/datetime/timezone";

const WINDOWS = [30, 7, 1];

export async function detectClientBirthdays(counters: { aniversario_socio_cliente: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const today = new Date();

  for (const days of WINDOWS) {
    // target = "hoje + N dias" como timestamp, e depois MM-DD calculado no fuso
    // da app (Cuiabá). Sem isso, server UTC erra MM-DD após ~20h locais.
    const target = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    const parts = getDatePartsInAppTz(target);
    const monthDay = `${parts.month}-${parts.day}`;

    const { data } = await supabase
      .from("client_important_dates")
      .select("id, descricao, data, client_id, tipo, cliente:clients(nome, assessor_id, coordenador_id)")
      .eq("tipo", "aniversario_socio");

    for (const d of (data ?? []) as Array<{
      id: string;
      descricao: string | null;
      data: string;
      client_id: string;
      cliente: { nome: string; assessor_id: string | null; coordenador_id: string | null } | null;
    }>) {
      const dataDate = d.data.slice(5); // MM-DD
      if (dataDate !== monthDay) continue;

      const recipients: string[] = [];
      if (d.cliente?.assessor_id) recipients.push(d.cliente.assessor_id);
      if (d.cliente?.coordenador_id) recipients.push(d.cliente.coordenador_id);
      if (recipients.length === 0) continue;

      await dispatchNotification({
        evento_tipo: "aniversario_socio_cliente",
        titulo: `Aniversário em ${days} dia${days === 1 ? "" : "s"}`,
        mensagem: `${d.cliente?.nome ?? "Cliente"} · ${d.descricao ?? "aniversário do sócio"}`,
        link: `/clientes/${d.client_id}`,
        user_ids_extras: recipients,
      });
      counters.aniversario_socio_cliente++;
    }
  }
}
