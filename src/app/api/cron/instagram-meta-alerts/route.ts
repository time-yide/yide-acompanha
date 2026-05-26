// src/app/api/cron/instagram-meta-alerts/route.ts
//
// Cron diário (~08:00 Cuiabá) que verifica clientes elegíveis com meta
// configurada e dispara notificação pro assessor quando a projeção do
// mês não bate a meta. Idempotente por dia: roda uma vez por dia e
// notifica só status 'critico' (90% da meta não vai ser batida).

import { NextResponse } from "next/server";
import { listClientesComUltimoSnapshot } from "@/lib/instagram-snapshots/queries";
import { computeCounts } from "@/lib/instagram-snapshots/counts";
import { evaluateMeta, diasNoMes } from "@/lib/instagram-snapshots/meta-alerta";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import type { PostRecente } from "@/lib/instagram-snapshots/tipos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Sem filtro por unit — pega tudo. Cada assessor recebe só dos clientes
  // que ele atende.
  const clientes = await listClientesComUltimoSnapshot({ unitId: null, assessorId: null });

  const now = new Date();
  const diaAtual = now.getDate();
  const total = diasNoMes(now.getFullYear(), now.getMonth() + 1);

  let avaliados = 0;
  let notificados = 0;
  let semAssessor = 0;
  let semMeta = 0;

  // Agrupa por assessor pra mandar 1 notificação por assessor com lista
  // de clientes críticos — evita spammar quem tem muita carteira.
  const criticosPorAssessor = new Map<string, Array<{ nome: string; faltam: number; projecao: number | null }>>();

  for (const c of clientes) {
    if (c.meta_posts_mes === null || c.meta_posts_mes === 0) {
      semMeta++;
      continue;
    }
    if (!c.assessor_id) {
      semAssessor++;
      continue;
    }
    const snap = c.ultimo_snapshot;
    if (!snap || snap.scrape_status !== "ok") continue;

    avaliados++;
    const posts = snap.recent_posts as PostRecente[];
    const counts = computeCounts(posts);
    const meta = evaluateMeta({
      metaMes: c.meta_posts_mes,
      postsMes: counts.mes,
      diaAtual,
      diasNoMes: total,
    });

    if (meta.status !== "critico") continue;

    const list = criticosPorAssessor.get(c.assessor_id) ?? [];
    list.push({
      nome: c.cliente_nome,
      faltam: meta.faltam ?? 0,
      projecao: meta.projecao,
    });
    criticosPorAssessor.set(c.assessor_id, list);
  }

  // Dispara uma notificação por assessor agrupando até 5 clientes na
  // mensagem (mais que isso vira ruído visual).
  for (const [assessorId, criticos] of criticosPorAssessor.entries()) {
    const total = criticos.length;
    const top = criticos.slice(0, 5).map((x) => x.nome).join(", ");
    const sufixo = total > 5 ? ` e mais ${total - 5}` : "";
    const mensagem =
      total === 1
        ? `${criticos[0].nome} está atrasado da meta (faltam ${criticos[0].faltam} posts)`
        : `${total} clientes estão atrasados da meta: ${top}${sufixo}`;

    await dispatchNotification({
      // Cast: types do Supabase ainda não regenerados c/ o novo valor de enum
      // (migration 20260612 adiciona 'instagram_meta_offtrack'). Quando rodar
      // `npx supabase gen types`, esse cast vira desnecessário.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      evento_tipo: "instagram_meta_offtrack" as any,
      titulo: total === 1 ? "Cliente atrasado da meta de posts" : "Clientes atrasados da meta de posts",
      mensagem,
      link: "/",
      user_ids_extras: [assessorId],
    });
    notificados++;
  }

  // Loga execução pra debug — sem persistir, só response.
  return NextResponse.json({
    ok: true,
    total_clientes: clientes.length,
    avaliados,
    sem_meta: semMeta,
    sem_assessor: semAssessor,
    assessores_notificados: notificados,
    criticos_total: Array.from(criticosPorAssessor.values()).reduce((acc, l) => acc + l.length, 0),
  });
}
