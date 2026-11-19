import "server-only";
import { after } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";
import { destinatariosAlteracao, mensagemWppAlteracao } from "./alteracao-mensagem";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://sistemaacompanha.yidedigital.com.br";

/**
 * Aviso OBRIGATÓRIO de "tarefa voltou pra Alteração" pra todos os envolvidos
 * (responsável + participantes, e quem mais o call-site passar).
 *
 * FONTE ÚNICA — usada pelos 3 caminhos que levam uma tarefa pra Alteração:
 * pedido de ajustes na aprovação, Frame (equipe ou cliente) e arrastar o card.
 *
 * 1. Notificação no app + push no celular (evento mandatory
 *    `task_alteracao_solicitada` → o usuário não consegue desligar).
 * 2. Lembrete no WhatsApp de cada um (telefone do perfil), em `after()` pra
 *    não segurar a resposta da ação. Sem telefone = só app/push.
 */
export async function notificarAlteracao(args: {
  taskId: string;
  titulo: string;
  envolvidos: Array<string | null | undefined>;
  actorId: string | null | undefined;
  /** Título/mensagem da notificação no app. */
  tituloNotif: string;
  mensagemNotif: string;
  /** O que precisa mudar (vai no WhatsApp). */
  motivo?: string | null;
}): Promise<void> {
  const destinatarios = destinatariosAlteracao(args.envolvidos, args.actorId);
  if (destinatarios.length === 0) return;

  const link = `/tarefas/${args.taskId}`;
  await dispatchNotification({
    evento_tipo: "task_alteracao_solicitada",
    titulo: args.tituloNotif,
    mensagem: args.mensagemNotif,
    link,
    user_ids_extras: destinatarios,
    source_user_id: args.actorId ?? undefined,
  });

  after(async () => {
    try {
      const sb = createServiceRoleClient();
      const [{ data: profiles }, { data: task }] = await Promise.all([
        sb.from("profiles").select("id, nome, telefone, ativo").in("id", destinatarios),
        sb.from("tasks").select("clients(nome)").eq("id", args.taskId).maybeSingle(),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clienteNome = ((task as any)?.clients?.nome as string | undefined) ?? null;

      for (const p of (profiles ?? []) as Array<{ id: string; nome: string | null; telefone: string | null; ativo: boolean }>) {
        if (!p.ativo || !p.telefone) continue;
        const texto = mensagemWppAlteracao({
          nome: p.nome,
          titulo: args.titulo,
          clienteNome,
          motivo: args.motivo,
          url: `${APP_URL}${link}`,
        });
        const res = await sendWhatsAppMessage(p.telefone, texto);
        if (!res.success) console.error("[alteracao-wpp] falhou pra", p.id, res.error);
      }
    } catch (e) {
      console.error("[alteracao-wpp] erro:", e);
    }
  });
}
