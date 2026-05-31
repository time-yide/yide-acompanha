# Ligações: integração de voz Zenvia (ex-TotalVoice) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir fazer e registrar ligações de voz reais no módulo `/ligacoes` via a API de voz da Zenvia (ex-TotalVoice): discar pelo webphone embutido, e registrar cada ligação automaticamente (status/duração/gravação) por webhook.

**Architecture:** Cliente REST server-only pra Zenvia (`POST /chamada`, `GET /webphone`); ação de discagem que cria a `ligacoes` e dispara a chamada; webhook público (autenticado por `webhook_secret` por instância) que fecha/cria a ligação de forma idempotente; componentes client (discador em iframe + botão Ligar); config que mostra a URL do webhook e marca o provedor Zenvia como "pronto". Token via env var `ZENVIA_VOICE_TOKEN`.

**Tech Stack:** Next.js (versão customizada — **antes de mexer em `revalidatePath`/route handlers, conferir `node_modules/next/dist/docs/`**; assinaturas podem diferir), TypeScript, Zod, Supabase (service-role pro webhook), Vitest. Reaproveita o módulo `ligacoes` existente (tabelas `ligacoes` e `ligacoes_instancias` já em prod).

**Convenções do projeto:** migrations Supabase são aplicadas **manualmente** após o merge; sem emoji/em-dash na UI; PRs separados da main; após type-check/lint passar, commit + PR direto.

---

## Estrutura de arquivos

- **Criar** `src/lib/ligacoes/zenvia.ts` — cliente Zenvia (server-only): `iniciarChamada`, `getWebphoneUrl`, `mapStatusZenvia`, `processarEventoWebhook` (lógica pura testável).
- **Criar** `src/app/api/webhooks/ligacoes/zenvia/route.ts` — handler POST do webhook.
- **Criar** `src/components/ligacoes/Discador.tsx` — webphone embutido (iframe).
- **Criar** `src/components/ligacoes/LigarButton.tsx` — botão "Ligar".
- **Criar** `supabase/migrations/20260619000000_ligacoes_origem_totalvoice.sql`.
- **Criar** testes em `tests/unit/ligacoes-zenvia.test.ts`.
- **Modificar** `src/lib/env.ts` (+ `.env.example`) — `ZENVIA_VOICE_TOKEN`.
- **Modificar** `src/lib/ligacoes/schema.ts` — `iniciarLigacaoSchema`.
- **Modificar** `src/lib/ligacoes/actions.ts` — `iniciarLigacaoAction`, `getWebphoneUrlAction`.
- **Modificar** `src/lib/ligacoes/instancias.ts` — provedor `totalvoice` → `pronto` + label.
- **Modificar** `src/components/ligacoes/InstanciaFormModal.tsx` — selector de provedor pra telefone + URL do webhook.
- **Modificar** `src/app/(authed)/ligacoes/page.tsx` e `src/components/ligacoes/LigacoesTable.tsx` — montar Discador + botão Ligar.

---

## Task 1: Fundação — migration `origem` + env var

**Files:**
- Create: `supabase/migrations/20260619000000_ligacoes_origem_totalvoice.sql`
- Modify: `src/lib/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Criar a migration**

Create `supabase/migrations/20260619000000_ligacoes_origem_totalvoice.sql`:

```sql
-- supabase/migrations/20260619000000_ligacoes_origem_totalvoice.sql
-- Libera origem 'totalvoice'/'zenvia' nas ligações (integração de voz Zenvia).
alter table public.ligacoes
  drop constraint if exists ligacoes_origem_check;

alter table public.ligacoes
  add constraint ligacoes_origem_check
  check (origem in ('manual','twilio','evolution','zapi','ifix','voip_generic','mock','outro','totalvoice','zenvia'));
```

- [ ] **Step 2: Adicionar `ZENVIA_VOICE_TOKEN` ao env schema**

Em `src/lib/env.ts`, dentro de `serverSchema` (depois das vars do Yori, antes do fechamento `});`), adicionar:

```typescript
  // Zenvia Voz (ex-TotalVoice) - token de API pra ligações de voz no módulo
  // /ligacoes. Sem isso, o cliente Zenvia é no-op (discar retorna erro
  // amigável). Pegar em painel Zenvia → Desenvolvedores → API.
  ZENVIA_VOICE_TOKEN: z.string().optional(),
```

- [ ] **Step 3: Documentar no `.env.example`**

Em `.env.example`, adicionar uma linha (perto das outras opcionais):

```
# Zenvia Voz (ex-TotalVoice) - ligações de voz no módulo /ligacoes (opcional).
ZENVIA_VOICE_TOKEN=
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -iE "env.ts" || echo "clean"`
Expected: `clean`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260619000000_ligacoes_origem_totalvoice.sql src/lib/env.ts .env.example
git commit -m "feat(ligacoes): libera origem totalvoice + env ZENVIA_VOICE_TOKEN

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Cliente Zenvia + mapeamento de status (TDD)

**Files:**
- Create: `src/lib/ligacoes/zenvia.ts`
- Test: `tests/unit/ligacoes-zenvia.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/unit/ligacoes-zenvia.test.ts`:

```typescript
// tests/unit/ligacoes-zenvia.test.ts
import { describe, it, expect } from "vitest";
import { mapStatusZenvia, buildWebhookUrl } from "@/lib/ligacoes/zenvia";

describe("mapStatusZenvia", () => {
  it("atendida -> atendida", () => {
    expect(mapStatusZenvia("atendida", 30)).toBe("atendida");
  });
  it("atendida muito curta (<5s) -> rejeitada", () => {
    expect(mapStatusZenvia("atendida", 3)).toBe("rejeitada");
  });
  it("sem resposta / nao atendida -> perdida", () => {
    expect(mapStatusZenvia("nao_atendida", 0)).toBe("perdida");
    expect(mapStatusZenvia("sem_resposta", 0)).toBe("perdida");
  });
  it("ocupado -> ocupada", () => {
    expect(mapStatusZenvia("ocupado", 0)).toBe("ocupada");
  });
  it("caixa postal -> caixa_postal", () => {
    expect(mapStatusZenvia("caixa_postal", 0)).toBe("caixa_postal");
  });
  it("falha/cancelada -> cancelada", () => {
    expect(mapStatusZenvia("falha", 0)).toBe("cancelada");
    expect(mapStatusZenvia("cancelada", 0)).toBe("cancelada");
  });
  it("desconhecido -> perdida", () => {
    expect(mapStatusZenvia("xpto", 0)).toBe("perdida");
  });
});

describe("buildWebhookUrl", () => {
  it("monta a URL com secret", () => {
    expect(buildWebhookUrl("https://app.x.com", "sec123")).toBe(
      "https://app.x.com/api/webhooks/ligacoes/zenvia?secret=sec123",
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/unit/ligacoes-zenvia.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `src/lib/ligacoes/zenvia.ts`**

Create `src/lib/ligacoes/zenvia.ts`:

```typescript
// SERVER ONLY - cliente da API de voz Zenvia (ex-TotalVoice).
import { getServerEnv } from "@/lib/env";
import type { StatusLigacao } from "./tipos";

const BASE = "https://voice-api.zenvia.com";

function token(): string | null {
  const t = getServerEnv().ZENVIA_VOICE_TOKEN;
  return t && t.trim() ? t.trim() : null;
}

/** Mapeia o status textual da Zenvia pro enum interno. */
export function mapStatusZenvia(statusZenvia: string, duracaoFaladaSegundos: number): StatusLigacao {
  const s = (statusZenvia || "").toLowerCase();
  if (s.includes("ocupad")) return "ocupada";
  if (s.includes("caixa")) return "caixa_postal";
  if (s.includes("cancel") || s.includes("falha") || s.includes("erro")) return "cancelada";
  if (s.includes("atendida")) return duracaoFaladaSegundos < 5 ? "rejeitada" : "atendida";
  if (s.includes("nao_atendida") || s.includes("não") || s.includes("sem_resposta") || s.includes("nao atendid")) return "perdida";
  return "perdida";
}

/** Monta a URL do webhook que a usuária cola no painel da Zenvia. */
export function buildWebhookUrl(appUrl: string, webhookSecret: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/webhooks/ligacoes/zenvia?secret=${webhookSecret}`;
}

export interface IniciarChamadaArgs {
  numeroOrigem: string;   // ramal do colaborador
  numeroDestino: string;  // E.164 do lead
  gravar: boolean;
  tags?: string;          // id da nossa ligacao (correlação)
}

export interface IniciarChamadaResult {
  ok: boolean;
  externalId?: string;
  error?: string;
}

/** POST /chamada - inicia a ligação. No-op tratável quando token ausente. */
export async function iniciarChamada(args: IniciarChamadaArgs): Promise<IniciarChamadaResult> {
  const t = token();
  if (!t) return { ok: false, error: "Zenvia não configurada (ZENVIA_VOICE_TOKEN ausente)" };
  try {
    const res = await fetch(`${BASE}/chamada`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": t },
      body: JSON.stringify({
        numero_origem: args.numeroOrigem,
        numero_destino: args.numeroDestino,
        gravar_audio: args.gravar,
        tags: args.tags,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: `Zenvia ${res.status}: ${JSON.stringify(data).slice(0, 200)}` };
    }
    // Resposta da Zenvia: id da chamada pode vir em data.id ou data.dados.id.
    const dados = (data.dados as Record<string, unknown> | undefined) ?? data;
    const externalId = (dados.id ?? dados.chamada_id ?? data.id) as string | number | undefined;
    return { ok: true, externalId: externalId != null ? String(externalId) : undefined };
  } catch (e) {
    return { ok: false, error: `Falha ao chamar Zenvia: ${(e as Error).message}` };
  }
}

/** GET /webphone - retorna a URL do webphone pré-configurada pro ramal. */
export async function getWebphoneUrl(ramal: string): Promise<string | null> {
  const t = token();
  if (!t) return null;
  try {
    const res = await fetch(`${BASE}/webphone?ramal=${encodeURIComponent(ramal)}`, {
      headers: { "Access-Token": t },
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const dados = (data.dados as Record<string, unknown> | undefined) ?? data;
    const url = (dados.url ?? dados.webphone_url ?? data.url) as string | undefined;
    return typeof url === "string" ? url : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Rodar e confirmar PASS**

Run: `npx vitest run tests/unit/ligacoes-zenvia.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ligacoes/zenvia.ts tests/unit/ligacoes-zenvia.test.ts
git commit -m "feat(ligacoes): cliente Zenvia (chamada/webphone) + mapeamento de status

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Lógica do webhook (idempotente) + handler

**Files:**
- Modify: `src/lib/ligacoes/zenvia.ts` (adicionar `parseEventoWebhook`)
- Create: `src/app/api/webhooks/ligacoes/zenvia/route.ts`
- Test: `tests/unit/ligacoes-zenvia.test.ts` (append)

- [ ] **Step 1: Teste da extração do payload (append no test file)**

Adicionar em `tests/unit/ligacoes-zenvia.test.ts`:

```typescript
import { parseEventoWebhook } from "@/lib/ligacoes/zenvia";

describe("parseEventoWebhook", () => {
  it("extrai campos do payload da Zenvia", () => {
    const r = parseEventoWebhook({
      id: "abc123",
      status: "atendida",
      duracao_segundos: 65,
      duracao_falada_segundos: 60,
      preco: 0.18,
      url_gravacao: "https://x/rec.mp3",
      motivo_desconexao: "normal",
    });
    expect(r.externalId).toBe("abc123");
    expect(r.statusInterno).toBe("atendida");
    expect(r.duracaoSegundos).toBe(65);
    expect(r.gravacaoUrl).toBe("https://x/rec.mp3");
  });
  it("status curto vira rejeitada", () => {
    const r = parseEventoWebhook({ id: "x", status: "atendida", duracao_segundos: 4, duracao_falada_segundos: 2 });
    expect(r.statusInterno).toBe("rejeitada");
  });
  it("sem id retorna externalId vazio", () => {
    const r = parseEventoWebhook({ status: "ocupado" });
    expect(r.externalId).toBe("");
    expect(r.statusInterno).toBe("ocupada");
  });
});
```

- [ ] **Step 2: Rodar e confirmar FAIL**

Run: `npx vitest run tests/unit/ligacoes-zenvia.test.ts`
Expected: FAIL (`parseEventoWebhook` não existe).

- [ ] **Step 3: Implementar `parseEventoWebhook` em `zenvia.ts`**

Adicionar ao final de `src/lib/ligacoes/zenvia.ts`:

```typescript
export interface EventoWebhookParsed {
  externalId: string;
  statusInterno: StatusLigacao;
  duracaoSegundos: number;
  gravacaoUrl: string | null;
  raw: Record<string, unknown>;
}

/** Extrai e normaliza um evento de fim/atualização de chamada da Zenvia. */
export function parseEventoWebhook(payload: Record<string, unknown>): EventoWebhookParsed {
  const externalId = String(payload.id ?? payload.chamada_id ?? "");
  const statusZenvia = String(payload.status ?? "");
  const duracaoSegundos = Number(payload.duracao_segundos ?? 0) || 0;
  const duracaoFalada = Number(payload.duracao_falada_segundos ?? duracaoSegundos) || 0;
  const gravacaoUrl = (payload.url_gravacao as string | undefined) ?? null;
  return {
    externalId,
    statusInterno: mapStatusZenvia(statusZenvia, duracaoFalada),
    duracaoSegundos,
    gravacaoUrl: typeof gravacaoUrl === "string" ? gravacaoUrl : null,
    raw: payload,
  };
}
```

- [ ] **Step 4: Rodar e confirmar PASS**

Run: `npx vitest run tests/unit/ligacoes-zenvia.test.ts`
Expected: PASS (11 testes).

- [ ] **Step 5: Implementar o route handler**

Create `src/app/api/webhooks/ligacoes/zenvia/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseEventoWebhook } from "@/lib/ligacoes/zenvia";

// Webhook público: autenticado pelo ?secret= (= ligacoes_instancias.webhook_secret).
// Idempotente por external_id. Sempre responde rápido (best-effort).
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret) return NextResponse.json({ error: "missing secret" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const { data: inst } = await sb
    .from("ligacoes_instancias")
    .select("id, organization_id, colaborador_id, ramal, numero")
    .eq("webhook_secret", secret)
    .is("arquivado_em", null)
    .maybeSingle();
  if (!inst) return NextResponse.json({ error: "invalid secret" }, { status: 401 });

  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: true }); // payload inválido: ignora sem erro
  }

  const ev = parseEventoWebhook(payload);

  try {
    if (ev.externalId) {
      const { data: existing } = await sb
        .from("ligacoes")
        .select("id")
        .eq("origem", "totalvoice")
        .eq("external_id", ev.externalId)
        .maybeSingle();

      const patch = {
        status: ev.statusInterno,
        duracao_segundos: ev.duracaoSegundos,
        gravacao_url: ev.gravacaoUrl,
        finalizada_em: new Date().toISOString(),
        raw_data: ev.raw,
      };

      if (existing) {
        await sb.from("ligacoes").update(patch).eq("id", (existing as { id: string }).id);
        return NextResponse.json({ ok: true, updated: true });
      }
    }

    // Sem external_id correspondente: ligação de entrada -> cria nova.
    await sb.from("ligacoes").insert({
      organization_id: inst.organization_id,
      tipo: "telefone",
      direcao: "entrada",
      colaborador_id: inst.colaborador_id,
      instancia_id: inst.id,
      numero: String(payload.numero_origem ?? payload.numero ?? "desconhecido"),
      status: ev.statusInterno,
      iniciada_em: new Date().toISOString(),
      finalizada_em: new Date().toISOString(),
      duracao_segundos: ev.duracaoSegundos,
      gravacao_url: ev.gravacaoUrl,
      origem: "totalvoice",
      external_id: ev.externalId || null,
      raw_data: ev.raw,
    });
    return NextResponse.json({ ok: true, created: true });
  } catch (e) {
    console.error("[webhook zenvia] erro:", (e as Error).message);
    return NextResponse.json({ ok: true }); // não reprocessar em loop
  }
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -iE "webhooks/ligacoes|ligacoes/zenvia" || echo "clean"`
Expected: `clean`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ligacoes/zenvia.ts src/app/api/webhooks/ligacoes/zenvia/route.ts tests/unit/ligacoes-zenvia.test.ts
git commit -m "feat(ligacoes): webhook Zenvia (registro automático idempotente)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Ação de discagem + URL do webphone

**Files:**
- Modify: `src/lib/ligacoes/schema.ts`
- Modify: `src/lib/ligacoes/actions.ts`
- Test: `tests/unit/ligacoes-zenvia.test.ts` (append)

- [ ] **Step 1: Teste do schema (append)**

Adicionar em `tests/unit/ligacoes-zenvia.test.ts`:

```typescript
import { iniciarLigacaoSchema } from "@/lib/ligacoes/schema";

describe("iniciarLigacaoSchema", () => {
  it("aceita número + instancia válidos", () => {
    const r = iniciarLigacaoSchema.safeParse({
      numero: "+5511999998888",
      instancia_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(r.success).toBe(true);
  });
  it("rejeita número curto", () => {
    const r = iniciarLigacaoSchema.safeParse({ numero: "123", instancia_id: "11111111-1111-1111-1111-111111111111" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar FAIL**

Run: `npx vitest run tests/unit/ligacoes-zenvia.test.ts`
Expected: FAIL (`iniciarLigacaoSchema` não existe).

- [ ] **Step 3: Adicionar o schema**

Em `src/lib/ligacoes/schema.ts`, adicionar (depois de `createLigacaoSchema`):

```typescript
export const iniciarLigacaoSchema = z.object({
  numero: z.string().trim().min(8).max(40),
  instancia_id: z.string().regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Instância inválida",
  ),
  contato_nome: z.string().trim().max(200).optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  lead_gerado_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  gravar: z.coerce.boolean().default(false),
});
export type IniciarLigacaoInput = z.infer<typeof iniciarLigacaoSchema>;
```

- [ ] **Step 4: Rodar e confirmar PASS**

Run: `npx vitest run tests/unit/ligacoes-zenvia.test.ts`
Expected: PASS.

- [ ] **Step 5: Implementar `iniciarLigacaoAction` e `getWebphoneUrlAction`**

Em `src/lib/ligacoes/actions.ts`, adicionar os imports no topo:

```typescript
import { iniciarLigacaoSchema } from "./schema";
import { iniciarChamada, getWebphoneUrl } from "./zenvia";
```

E adicionar as actions ao final do arquivo:

```typescript
// ===========================================================================
// Discagem real via Zenvia
// ===========================================================================

export async function iniciarLigacaoAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = iniciarLigacaoSchema.safeParse({
    numero: fd(formData, "numero"),
    instancia_id: fd(formData, "instancia_id"),
    contato_nome: fd(formData, "contato_nome"),
    lead_id: fd(formData, "lead_id"),
    lead_gerado_id: fd(formData, "lead_gerado_id"),
    client_id: fd(formData, "client_id"),
    gravar: formData.get("gravar") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: inst } = await sb
    .from("ligacoes_instancias")
    .select("id, organization_id, ramal, provedor")
    .eq("id", parsed.data.instancia_id)
    .is("arquivado_em", null)
    .maybeSingle();
  if (!inst) return { error: "Instância não encontrada" };
  if (inst.provedor !== "totalvoice") return { error: "Essa instância não é Zenvia" };
  if (!inst.ramal) return { error: "Instância sem ramal configurado" };

  // Cria a ligação em andamento
  const { data: lig, error: insErr } = await sb
    .from("ligacoes")
    .insert({
      organization_id: inst.organization_id,
      tipo: "telefone",
      direcao: "saida",
      colaborador_id: actor.id,
      instancia_id: inst.id,
      numero: parsed.data.numero,
      contato_nome: parsed.data.contato_nome,
      lead_id: parsed.data.lead_id,
      lead_gerado_id: parsed.data.lead_gerado_id,
      client_id: parsed.data.client_id,
      status: "em_andamento",
      iniciada_em: new Date().toISOString(),
      origem: "totalvoice",
    })
    .select("id")
    .single();
  if (insErr || !lig) return { error: insErr?.message ?? "Erro ao criar ligação" };
  const ligacaoId = (lig as { id: string }).id;

  // Dispara a chamada na Zenvia
  const r = await iniciarChamada({
    numeroOrigem: inst.ramal as string,
    numeroDestino: parsed.data.numero,
    gravar: parsed.data.gravar,
    tags: ligacaoId,
  });
  if (!r.ok) {
    await sb.from("ligacoes").update({ status: "cancelada", observacoes: r.error }).eq("id", ligacaoId);
    return { error: r.error ?? "Falha ao iniciar ligação" };
  }

  await sb.from("ligacoes").update({ external_id: r.externalId ?? null }).eq("id", ligacaoId);
  revalidatePath("/ligacoes");
  return { success: true };
}

export async function getWebphoneUrlAction(): Promise<{ url: string | null; ramal: string | null }> {
  const actor = await requireAuth();
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: inst } = await sb
    .from("ligacoes_instancias")
    .select("ramal, provedor")
    .eq("colaborador_id", actor.id)
    .eq("provedor", "totalvoice")
    .is("arquivado_em", null)
    .maybeSingle();
  const ramal = (inst?.ramal as string | null) ?? null;
  if (!ramal) return { url: null, ramal: null };
  const url = await getWebphoneUrl(ramal);
  return { url, ramal };
}
```

- [ ] **Step 6: Type-check + lint**

Run: `npx tsc --noEmit 2>&1 | grep -iE "ligacoes/actions|ligacoes/schema" || echo "clean"` e `npx next lint 2>&1 | grep -iE "ligacoes/actions" || echo "lint clean"`
Expected: `clean` / `lint clean`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ligacoes/schema.ts src/lib/ligacoes/actions.ts tests/unit/ligacoes-zenvia.test.ts
git commit -m "feat(ligacoes): ação de discagem Zenvia + URL do webphone

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Provedor Zenvia "pronto" + config com URL do webhook

**Files:**
- Modify: `src/lib/ligacoes/instancias.ts`
- Modify: `src/components/ligacoes/InstanciaFormModal.tsx`

- [ ] **Step 1: Marcar `totalvoice` como pronto**

Em `src/lib/ligacoes/instancias.ts`, na entrada `totalvoice` do `PROVEDOR_DEFS`, trocar `status: "em_construcao"` por `status: "pronto"`, ajustar o label e remover o campo `access_token` (token agora é env var). A entrada fica:

```typescript
  {
    value: "totalvoice",
    label: "Zenvia (ex-TotalVoice)",
    tipo: "telefone",
    status: "pronto",
    webhookHint: "Cole essa URL no painel da Zenvia → Desenvolvedores → Webhooks (eventos de chamada)",
    campos: [],
  },
```

- [ ] **Step 2: Selector de provedor pra telefone + URL do webhook no modal**

Em `src/components/ligacoes/InstanciaFormModal.tsx`:

(a) Trocar a função `provedorPadrao` por um estado de provedor controlado. Substituir a linha:

```tsx
  const provedor = isEdit ? (instancia?.provedor ?? provedorPadrao(tipo)) : provedorPadrao(tipo);
```

por um estado:

```tsx
  const [provedor, setProvedor] = useState<string>(
    instancia?.provedor ?? (tipo === "whatsapp" ? "evolution" : "manual"),
  );
```

E quando o `tipo` muda, ajustar o provedor default. Adicionar logo após o `setTipo`/select de tipo um efeito simples: trocar o `onValueChange` do select de tipo pra:

```tsx
              <Select value={tipo} onValueChange={(v) => {
                const novo = v ?? "whatsapp";
                setTipo(novo);
                setProvedor(novo === "whatsapp" ? "evolution" : "manual");
              }}>
```

(b) Adicionar, logo abaixo do bloco de tipo/colaborador, um selector de provedor que aparece só pra telefone (oferecendo Manual e Zenvia):

```tsx
            {tipo === "telefone" && (
              <div className="space-y-1.5">
                <Label htmlFor="provedor">Como vai ligar</Label>
                <Select value={provedor} onValueChange={(v) => setProvedor(v ?? "manual")}>
                  <SelectTrigger id="provedor"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Registro manual (sem integração)</SelectItem>
                    <SelectItem value="totalvoice">Zenvia (ligar pelo sistema)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
```

(c) Trocar a linha que monta o `fd.set("provedor", provedor)` — já usa a variável `provedor`, agora vinda do estado (nenhuma mudança extra além de (a)).

(d) Substituir o bloco de QR (que hoje só aparece pra whatsapp) por: manter o QR pra whatsapp, e adicionar o painel de webhook pra telefone+totalvoice quando em edição (a instância já tem `webhook_secret`). Adicionar após o bloco do QR:

```tsx
          {tipo === "telefone" && provedor === "totalvoice" && isEdit && instancia?.webhook_secret && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-1.5">
              <p className="text-sm font-medium">URL do webhook (cole no painel da Zenvia)</p>
              <code className="block break-all rounded bg-background px-2 py-1 text-[11px]">
                {`${appUrl}/api/webhooks/ligacoes/zenvia?secret=${instancia.webhook_secret}`}
              </code>
              <p className="text-[11px] text-muted-foreground">
                Zenvia → Desenvolvedores → Webhooks. Informe também o ramal acima. O token
                da conta vai na variável ZENVIA_VOICE_TOKEN (configurada pela equipe).
              </p>
            </div>
          )}
```

E no topo do componente, obter o `appUrl` do client env. Adicionar o import:

```tsx
import { env } from "@/lib/env";
```

e dentro do componente:

```tsx
  const appUrl = env.NEXT_PUBLIC_APP_URL;
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit 2>&1 | grep -iE "InstanciaFormModal|instancias.ts" || echo "clean"` e `npx next lint 2>&1 | grep -iE "InstanciaFormModal" || echo "lint clean"`
Expected: `clean` / `lint clean`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ligacoes/instancias.ts src/components/ligacoes/InstanciaFormModal.tsx
git commit -m "feat(ligacoes): provedor Zenvia pronto + URL do webhook na config

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Discador embutido + botão Ligar na página

**Files:**
- Create: `src/components/ligacoes/Discador.tsx`
- Create: `src/components/ligacoes/LigarButton.tsx`
- Modify: `src/app/(authed)/ligacoes/page.tsx`
- Modify: `src/components/ligacoes/LigacoesTable.tsx`

- [ ] **Step 1: Componente Discador (webphone em iframe)**

Create `src/components/ligacoes/Discador.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { getWebphoneUrlAction } from "@/lib/ligacoes/actions";

export function Discador() {
  const [state, setState] = useState<{ url: string | null; ramal: string | null; loading: boolean }>({
    url: null,
    ramal: null,
    loading: true,
  });

  useEffect(() => {
    let alive = true;
    getWebphoneUrlAction()
      .then((r) => { if (alive) setState({ url: r.url, ramal: r.ramal, loading: false }); })
      .catch(() => { if (alive) setState({ url: null, ramal: null, loading: false }); });
    return () => { alive = false; };
  }, []);

  if (state.loading) {
    return <div className="rounded-lg border p-3 text-xs text-muted-foreground">Carregando discador...</div>;
  }

  if (!state.ramal || !state.url) {
    return (
      <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground flex items-center gap-2">
        <PhoneOff className="h-4 w-4 shrink-0" />
        Discador indisponível. {state.ramal ? "Zenvia não configurada (token)." : "Você não tem um ramal Zenvia atribuído."}
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs font-medium">
        <Phone className="h-3.5 w-3.5 text-emerald-500" /> Discador (ramal {state.ramal})
      </div>
      <iframe
        title="Discador Zenvia"
        src={state.url}
        allow="microphone"
        className="h-[420px] w-full border-0"
      />
    </div>
  );
}
```

- [ ] **Step 2: Componente LigarButton**

Create `src/components/ligacoes/LigarButton.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { iniciarLigacaoAction } from "@/lib/ligacoes/actions";

interface Props {
  numero: string;
  instanciaId: string | null;
  contatoNome?: string | null;
  size?: "sm" | "icon";
}

export function LigarButton({ numero, instanciaId, contatoNome, size = "sm" }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ligar() {
    if (!instanciaId) { setError("Sem instância Zenvia"); return; }
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("numero", numero);
      fd.set("instancia_id", instanciaId);
      if (contatoNome) fd.set("contato_nome", contatoNome);
      const r = await iniciarLigacaoAction(fd);
      if ("error" in r) { setError(r.error); return; }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start">
      <Button
        type="button"
        size={size}
        variant="outline"
        onClick={ligar}
        disabled={pending || !instanciaId}
        title={!instanciaId ? "Sem instância Zenvia atribuída" : "Ligar via Zenvia"}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
        {size === "sm" && <span className="ml-1">Ligar</span>}
      </Button>
      {error && <span className="mt-0.5 text-[10px] text-destructive">{error}</span>}
    </span>
  );
}
```

- [ ] **Step 3: Montar o Discador na página `/ligacoes`**

Em `src/app/(authed)/ligacoes/page.tsx`, importar e renderizar o `Discador` perto do topo do conteúdo (ex.: numa coluna lateral ou acima da tabela). Adicionar o import:

```tsx
import { Discador } from "@/components/ligacoes/Discador";
```

E inserir `<Discador />` no JSX, em um bloco visível (ex.: logo antes da seção da tabela/toolbar):

```tsx
      <div className="mb-4">
        <Discador />
      </div>
```

(Posicionamento exato: seguir o layout existente da página — colocar dentro do container principal, antes da `LigacoesTable`.)

- [ ] **Step 4: Botão Ligar nas linhas da tabela**

Em `src/components/ligacoes/LigacoesTable.tsx`, importar `LigarButton` e renderizar numa coluna de ações por linha, passando o número da linha e a `instancia_id` da própria ligação (quando houver) — ou null:

```tsx
import { LigarButton } from "./LigarButton";
```

Na renderização de cada linha (na célula de ações), adicionar:

```tsx
<LigarButton numero={lig.numero} instanciaId={lig.instancia_id ?? null} contatoNome={lig.contato_nome} size="icon" />
```

> Se `LigacoesTable` não expõe `instancia_id`/`contato_nome` no tipo da linha, adicioná-los ao SELECT/tipo em `src/lib/ligacoes/queries.ts` (incluir `instancia_id` e `contato_nome` na query da tabela) e ao tipo da linha usado pelo componente. Manter o fallback (`?? null`) pra não quebrar.

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit 2>&1 | grep -iE "ligacoes" | grep -v "web-push" || echo "clean"` e `npx next lint 2>&1 | grep -iE "Discador|LigarButton|LigacoesTable|ligacoes/page" || echo "lint clean"`
Expected: `clean` / `lint clean`.

- [ ] **Step 6: Build (confiança — componentes client + route handler)**

Run: `npx next build 2>&1 | tail -20`
Expected: build conclui (ou, se falhar por dependência ausente no worktree não relacionada, confirmar que o erro não é dos arquivos desta feature).

- [ ] **Step 7: Commit**

```bash
git add src/components/ligacoes/Discador.tsx src/components/ligacoes/LigarButton.tsx "src/app/(authed)/ligacoes/page.tsx" src/components/ligacoes/LigacoesTable.tsx src/lib/ligacoes/queries.ts
git commit -m "feat(ligacoes): discador embutido (webphone) + botão Ligar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final + PR

- [ ] **Step 1: Suite + type-check + lint**

Run: `npx tsc --noEmit 2>&1 | grep -iE "ligacoes" | grep -v "web-push" || echo "clean"` ; `npx next lint 2>&1 | grep -iE "ligacoes" || echo "lint clean"` ; `npx vitest run 2>&1 | tail -3`
Expected: tudo verde.

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feat/ligacoes-zenvia
gh pr create --base main --title "feat(ligacoes): integração de voz Zenvia (discador + webhook)" --body "$(cat <<'EOF'
## O que muda
- Discador embutido (webphone Zenvia) na página /ligacoes
- Botão "Ligar" que disca via Zenvia (POST /chamada)
- Webhook que registra a ligação automaticamente (status/duração/gravação), autenticado por webhook_secret e idempotente
- Provedor Zenvia (totalvoice) marcado como "pronto"; config mostra a URL do webhook
- Token via env ZENVIA_VOICE_TOKEN

## Migration (aplicar manualmente após o merge)
- 20260619000000_ligacoes_origem_totalvoice.sql (libera origem 'totalvoice'/'zenvia')

## Pendências da Zenvia (pra ir ao ar)
- Criar conta + token (ZENVIA_VOICE_TOKEN na Vercel), configurar ramal, colar URL do webhook no painel.

## Atenção
- O formato exato do payload do webhook/da resposta do /chamada pode precisar de 1 ajuste fino ao plugar a conta real (código é defensivo e guarda raw_data).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notas / riscos
- **Payload real da Zenvia a confirmar:** `iniciarChamada` e `parseEventoWebhook` leem campos com fallback e guardam `raw_data`; pode precisar de 1 ajuste quando a conta real estiver ativa.
- **iframe do webphone:** exige microfone + HTTPS; conferir que CSP/headers do projeto não bloqueiam o domínio da Zenvia (se houver CSP, liberar `voice-api.zenvia.com`/domínio do webphone em `frame-src`).
- **Migration manual** após o merge (padrão do projeto).
- **Next.js customizado:** conferir `node_modules/next/dist/docs/` antes de mexer em route handlers/`revalidatePath` se algo divergir.
