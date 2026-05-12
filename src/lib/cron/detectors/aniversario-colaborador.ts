// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { getDatePartsInAppTz } from "@/lib/datetime/timezone";

export async function detectColaboradorBirthdays(counters: { aniversario_colaborador: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const target = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  // MM-DD calculado no fuso da app (Cuiabá). Sem isso, servidor UTC dispara
  // 1 dia adiantado quando rodando após ~20h locais.
  const parts = getDatePartsInAppTz(target);
  const monthDay = `${parts.month}-${parts.day}`;

  const { data } = await supabase
    .from("profiles")
    .select("id, nome, data_nascimento, ativo")
    .eq("ativo", true);

  for (const p of (data ?? []) as Array<{ id: string; nome: string; data_nascimento: string | null }>) {
    if (!p.data_nascimento) continue;
    const dn = p.data_nascimento.slice(5);
    if (dn !== monthDay) continue;

    await dispatchNotification({
      evento_tipo: "aniversario_colaborador",
      titulo: `Aniversário em 3 dias: ${p.nome}`,
      mensagem: `${p.nome} faz aniversário em 3 dias`,
      source_user_id: p.id,
    });
    counters.aniversario_colaborador++;
  }
}
