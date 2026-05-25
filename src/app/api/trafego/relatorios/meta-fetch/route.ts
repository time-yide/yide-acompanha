// src/app/api/trafego/relatorios/meta-fetch/route.ts
//
// Endpoint chamado pelo form de "Novo relatório" pra pré-popular dados
// da Meta API antes de submeter. Permite o assessor revisar/editar antes
// de gravar.
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { fetchDadosMeta } from "@/lib/trafego/relatorios/meta-fetch";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:trafego_relatorios")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const url = new URL(req.url);
  const clienteId = url.searchParams.get("cliente_id");
  const inicio = url.searchParams.get("inicio");
  const fim = url.searchParams.get("fim");
  if (!clienteId || !inicio || !fim) {
    return NextResponse.json({ error: "Parâmetros faltando" }, { status: 400 });
  }
  const r = await fetchDadosMeta(clienteId, inicio, fim);
  return NextResponse.json(r);
}
