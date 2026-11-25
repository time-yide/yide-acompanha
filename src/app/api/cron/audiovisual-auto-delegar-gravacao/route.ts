import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { autoAssignVideomaker } from "@/lib/audiovisual/auto-delegate";

/**
 * Cron (de hora em hora): tenta de novo a delegação automática das gravações
 * futuras paradas em "Pendentes de delegação". Pega o que a delegação na hora
 * de criar/editar/remarcar não conseguiu (rodízio ocupado naquele momento,
 * freela que saiu, gravação que liberou etc.).
 *
 * Só os próximos 30 dias (mesma janela da contagem do rodízio). Não avisa o
 * coord quando falha — o aviso já saiu na criação e repetiria a cada hora.
 * Uma de cada vez, pra contagem de carga do rodízio ir atualizando.
 */
const MAX_PER_RUN = 30;
const JANELA_DIAS = 30;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const agora = new Date();
  const limite = new Date(agora.getTime() + JANELA_DIAS * 24 * 60 * 60 * 1000);
  const { data, error } = await sb
    .from("calendar_events")
    .select("id")
    .eq("sub_calendar", "videomakers")
    .eq("videomaker_status", "pending_delegation")
    .gte("inicio", agora.toISOString())
    .lte("inicio", limite.toISOString())
    .order("inicio", { ascending: true })
    .limit(MAX_PER_RUN);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pendentes = (data ?? []) as Array<{ id: string }>;
  let delegadas = 0;
  for (const e of pendentes) {
    const r = await autoAssignVideomaker(e.id, null);
    if (r === "delegada") delegadas++;
  }

  if (delegadas > 0) {
    revalidateTag("calendar", "default");
    revalidatePath("/audiovisual");
    revalidatePath("/calendario");
  }
  return NextResponse.json({ tentadas: pendentes.length, delegadas });
}
