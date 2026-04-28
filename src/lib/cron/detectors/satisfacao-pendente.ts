// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { currentIsoWeek } from "@/lib/satisfacao/iso-week";
import { synthesizeAndStore } from "@/lib/satisfacao/actions";
import { listClientsWithEntriesButNoSynthesis } from "@/lib/satisfacao/queries";

interface ClientRow { id: string; assessor_id: string | null; coordenador_id: string | null }
interface ProfileRow { id: string; role: string }

const PRODUTORES = ["videomaker", "designer", "editor", "audiovisual_chefe"];

export async function detectSatisfacaoPendente(counters: { satisfacao_pendente: number }): Promise<void> {
  const dayOfWeek = new Date().getUTCDay(); // 0=domingo, 1=segunda, ..., 4=quinta
  const weekIso = currentIsoWeek();

  // Segunda-feira: bootstrap pendentes + notificação
  if (dayOfWeek === 1) {
    await bootstrapPendingEntriesForWeek(weekIso);
    await dispatchNotification({
      evento_tipo: "satisfacao_pendente",
      titulo: "Avaliação de satisfação pendente",
      mensagem: "Avalie seus clientes esta semana em /satisfacao/avaliar",
      link: "/satisfacao/avaliar",
    });
    counters.satisfacao_pendente++;
    return;
  }

  // Quinta-feira: força síntese pra clientes pendentes
  if (dayOfWeek === 4) {
    const clientIds = await listClientsWithEntriesButNoSynthesis(weekIso);
    for (const clientId of clientIds) {
      try {
        await synthesizeAndStore(clientId, weekIso);
      } catch (err) {
        console.error("[detector] synthesize failed for", clientId, err);
      }
    }
    return;
  }

  // Outros dias: no-op
}

async function bootstrapPendingEntriesForWeek(weekIso: string): Promise<void> {
  const supabase = createServiceRoleClient();

  // Carrega todos clientes ativos
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, assessor_id, coordenador_id")
    .eq("status", "ativo");
  const clients = (clientsData ?? []) as ClientRow[];
  if (clients.length === 0) return;

  // Carrega todos perfis ativos elegíveis (coord, assessor, audiovisual_chefe, produtores)
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("ativo", true);
  const profiles = (profilesData ?? []) as ProfileRow[];

  const entriesToInsert: Array<{
    client_id: string;
    autor_id: string;
    papel_autor: string;
    semana_iso: string;
    cor: null;
    comentario: null;
  }> = [];

  for (const client of clients) {
    for (const profile of profiles) {
      const isCoord = profile.role === "coordenador";
      const isAssessorDoCliente = profile.role === "assessor" && client.assessor_id === profile.id;
      const isAudiovisualOuProdutor = PRODUTORES.includes(profile.role);
      if (isCoord || isAssessorDoCliente || isAudiovisualOuProdutor) {
        entriesToInsert.push({
          client_id: client.id,
          autor_id: profile.id,
          papel_autor: profile.role,
          semana_iso: weekIso,
          cor: null,
          comentario: null,
        });
      }
    }
  }

  if (entriesToInsert.length === 0) return;

  // Insert ignora conflitos (entry pode já existir se rodou antes)
  await supabase
    .from("satisfaction_entries")
    .upsert(entriesToInsert, { onConflict: "client_id,autor_id,semana_iso", ignoreDuplicates: true });
}
