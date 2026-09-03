import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  PACOTES_COM_CRONOGRAMA,
  PACOTES_CRONOGRAMA_COMPLETO,
} from "@/lib/content-calendar/types";
import type { CalendarMode } from "@/lib/content-calendar/types";

export const dynamic = "force-dynamic";

/**
 * Cron de enfileiramento de cronogramas de conteúdo.
 *
 * Roda no dia 3 de cada mês. Calcula o mês seguinte e cria registros
 * content_calendars para clientes ativos com pacote e nicho configurados.
 *
 * Auth: header Authorization: Bearer ${CRON_SECRET}.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  // Calcular mês seguinte no formato YYYY-MM
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const mesReferencia = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;

  // Buscar clientes ativos com pacote elegível e nicho configurado
  const { data: clients, error } = await sbAny
    .from("clients")
    .select("id, organization_id, tipo_pacote, nicho_id")
    .eq("status", "ativo")
    .not("nicho_id", "is", null)
    .in("tipo_pacote", [...PACOTES_COM_CRONOGRAMA]);

  if (error) {
    console.error("[content-calendar-enqueue] Erro ao buscar clientes:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eligibleClients = (clients ?? []) as Array<{
    id: string;
    organization_id: string;
    tipo_pacote: string;
    nicho_id: string;
  }>;

  let created = 0;
  let skipped = 0;

  for (const c of eligibleClients) {
    // Verificar se já existe cronograma para este mês
    const { data: existing } = await sbAny
      .from("content_calendars")
      .select("id")
      .eq("client_id", c.id)
      .eq("mes_referencia", mesReferencia)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    // Determinar modo
    const modo: CalendarMode = (
      PACOTES_CRONOGRAMA_COMPLETO as readonly string[]
    ).includes(c.tipo_pacote)
      ? "completo"
      : "leve";

    const { error: insertErr } = await sbAny
      .from("content_calendars")
      .insert({
        organization_id: c.organization_id,
        client_id: c.id,
        mes_referencia: mesReferencia,
        modo,
        status: "pendente_geracao",
      });

    if (insertErr) {
      console.error(
        `[content-calendar-enqueue] Erro ao criar para ${c.id}:`,
        insertErr,
      );
      skipped++;
    } else {
      created++;
    }
  }

  return NextResponse.json({
    mes_referencia: mesReferencia,
    eligible: eligibleClients.length,
    created,
    skipped,
  });
}
