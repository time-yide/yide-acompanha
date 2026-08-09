// src/app/api/debug/instagram-scrape/route.ts
//
// Endpoint de debug: faz scrape Apify de UM username e retorna o JSON cru
// do Apify SEM processamento. Pra diagnosticar discrepância entre posts
// reais e posts contados (ex: collabs não vindo).
//
// Acesso restrito a socio/adm. Não usa cache.

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { normalizeUsername } from "@/lib/instagram-snapshots/scraper";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(req: Request) {
  const actor = await requireAuth();
  if (!["socio", "adm"].includes(actor.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const url = new URL(req.url);
  const username = normalizeUsername(url.searchParams.get("username"));
  if (!username) {
    return NextResponse.json({ error: "Passe ?username=NOMEUSUARIO" }, { status: 400 });
  }

  const env = getServerEnv();
  if (!env.APIFY_API_TOKEN) {
    return NextResponse.json({ error: "APIFY_API_TOKEN não configurado" }, { status: 500 });
  }

  // Mesma config do scraper de produção pra reproduzir o resultado.
  const body = {
    directUrls: [`https://www.instagram.com/${username}/`],
    resultsType: "posts",
    resultsLimit: 200,
    addParentData: false,
  };

  const apifyUrl = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(env.APIFY_API_TOKEN)}`;
  const resp = await fetch(apifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({
      ok: false,
      status: resp.status,
      raw_text: text.slice(0, 5000),
    });
  }

  // Resumo amigável + raw completo.
  const items = Array.isArray(json) ? json : [];
  const tiposCount: Record<string, number> = {};
  const productTypeCount: Record<string, number> = {};
  for (const it of items as Array<Record<string, unknown>>) {
    const t = String(it.type ?? "(sem)");
    const pt = String(it.productType ?? "(sem)");
    tiposCount[t] = (tiposCount[t] ?? 0) + 1;
    productTypeCount[pt] = (productTypeCount[pt] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: resp.ok,
    httpStatus: resp.status,
    inputUsername: username,
    apifyInput: body,
    resumo: {
      totalRetornado: items.length,
      tiposCount,
      productTypeCount,
      // Lista os campos que cada post tem (pra ver se Apify expõe coautor)
      camposDoPrimeiroPost: items[0] ? Object.keys(items[0] as object).sort() : [],
    },
    items: json,
  });
}
