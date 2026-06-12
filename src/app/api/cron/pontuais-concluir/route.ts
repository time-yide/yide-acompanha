import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getTodayDate } from "@/lib/datetime/timezone";
import { dataConclusaoPontual, pontualMesEncerrado } from "@/lib/clientes/pontual";

export const dynamic = "force-dynamic";

/**
 * Cron: encerra serviços pontuais cujo mês de entrada já terminou.
 *
 * Um pontual (modalidade='pontual') vale pelo mês em que entrou. No 1º dia do
 * mês seguinte ele vira `status='concluido'` — sai da Carteira/Clientes ativos
 * (a saída já acontece pela data, este cron só atualiza a etiqueta visível).
 *
 * Idempotente: só pega `status='ativo'`. Schedule (vercel.json): diário.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const hoje = getTodayDate();

  // Candidatos: pontuais ainda ativos. Filtra app-side por mês encerrado
  // (mesma regra do cadastro, via helper compartilhado).
  const { data, error } = await sb
    .from("clients")
    .select("id, data_entrada, data_churn")
    .eq("modalidade", "pontual")
    .eq("status", "ativo")
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const candidatos = (
    (data ?? []) as Array<{ id: string; data_entrada: string; data_churn: string | null }>
  ).filter((c) => c.data_entrada && pontualMesEncerrado(c.data_entrada, hoje));

  let concluidos = 0;
  for (const c of candidatos) {
    const { error: upErr, data: upData } = await sb
      .from("clients")
      .update({
        status: "concluido",
        data_churn: c.data_churn ?? dataConclusaoPontual(c.data_entrada),
      })
      .eq("id", c.id)
      .eq("status", "ativo") // guarda contra corrida
      .select("id");
    if (!upErr && upData && upData.length > 0) concluidos += 1;
  }

  if (concluidos > 0) revalidateTag("dashboard", "default");

  return NextResponse.json({ candidatos: candidatos.length, concluidos });
}
